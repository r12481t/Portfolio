// ============================================================
// TAQEN STORE — Google Apps Script Automation
// ============================================================
// HOW TO SET UP (mobile steps):
// 1. Open your Google Sheet
// 2. Tap the 3-dot menu → Extensions → Apps Script
// 3. Delete all existing code
// 4. Paste this entire script
// 5. Fill in your PRINTIFY_API_KEY and PRINTIFY_SHOP_ID below
// 6. Tap Run → select "setupTrigger" → grant permissions
// That's it. Runs automatically every day at 2AM.
// ============================================================

// ── YOUR CREDENTIALS ────────────────────────────────────────
const PRINTIFY_API_KEY = 'YOUR_PRINTIFY_API_KEY';
const PRINTIFY_SHOP_ID = 'YOUR_PRINTIFY_SHOP_ID';
const SHIPPING_COST    = 6.99;
const SHEET_NAME       = 'Sheet1';
// ────────────────────────────────────────────────────────────

// Column order — must match your sheet row 1 exactly
const HEADERS = [
  'printify_id', 'product_name',
  'price_xs',    'gumroad_xs',
  'price_s',     'gumroad_s',
  'price_m',     'gumroad_m',
  'price_l',     'gumroad_l',
  'price_xl',    'gumroad_xl',
  'price_2xl',   'gumroad_2xl',
  'price_one_size', 'gumroad_one_size',
  'price_6oz',   'gumroad_6oz',
  'price_11oz',  'gumroad_11oz',
  'price_15oz',  'gumroad_15oz',
];

// Size label → column name
const SIZE_MAP = [
  { regex: /^XS$/i,            col: 'price_xs'        },
  { regex: /^S$/i,             col: 'price_s'         },
  { regex: /^M$/i,             col: 'price_m'         },
  { regex: /^L$/i,             col: 'price_l'         },
  { regex: /^XL$/i,            col: 'price_xl'        },
  { regex: /^(2XL|XXL)$/i,     col: 'price_2xl'       },
  { regex: /one.?size|^OS$/i,  col: 'price_one_size'  },
  { regex: /^6\s*oz/i,         col: 'price_6oz'       },
  { regex: /^11\s*oz/i,        col: 'price_11oz'      },
  { regex: /^15\s*oz/i,        col: 'price_15oz'      },
];

// ============================================================
// DAILY RUNNER — this is what the trigger calls
// ============================================================
function runDaily() {
  Logger.log('=== Taqen daily sync starting ===');
  addNewProducts();
  fillPrices();
  Logger.log('=== Sync complete ===');
}

// ============================================================
// STEP 1 — Add any new Printify products to the sheet
// ============================================================
function addNewProducts() {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const pidCol  = headers.indexOf('printify_id');

  // Collect IDs already in sheet
  const existingIds = new Set(
    data.slice(1)
      .map(r => String(r[pidCol] || '').trim())
      .filter(Boolean)
  );

  // Fetch all products from Printify
  const products = fetchAllPrintify();
  Logger.log('Printify: ' + products.length + ' products. Sheet has: ' + existingIds.size);

  const newOnes = products.filter(p => !existingIds.has(String(p.id)));
  if (!newOnes.length) {
    Logger.log('No new products to add.');
    return;
  }

  // Build rows — only ID and name, leave price/gumroad blank for you to fill
  const newRows = newOnes.map(p => {
    const row = new Array(HEADERS.length).fill('');
    row[0] = String(p.id);
    row[1] = p.title || '';
    return row;
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, HEADERS.length).setValues(newRows);
  Logger.log('Added ' + newOnes.length + ' new products.');
}

// ============================================================
// STEP 2 — Fill prices from Printify + shipping
// ============================================================
function fillPrices() {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const pidCol  = headers.indexOf('printify_id');

  // Build header → column index map
  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h] = i; });

  // Fetch all Printify products
  const products = fetchAllPrintify();

  // Build map: printify_id → { priceCol: lowestPrice }
  const priceMap = {};
  for (const p of products) {
    const sizes = {};
    for (const v of (p.variants || [])) {
      if (!v.is_enabled) continue;
      const title    = v.title || '';
      const priceCents = v.price || 0;
      const sizePart = title.includes('/') ? title.split('/').pop().trim() : title.trim();
      for (const sm of SIZE_MAP) {
        if (sm.regex.test(sizePart)) {
          const priceUSD = priceCents / 100;
          if (!sizes[sm.col] || priceUSD < sizes[sm.col]) {
            sizes[sm.col] = priceUSD;
          }
          break;
        }
      }
    }
    priceMap[String(p.id)] = sizes;
  }

  // Price columns only (not gumroad columns)
  const priceCols = SIZE_MAP.map(s => s.col).filter(c => colIdx[c] !== undefined);

  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const pid = String(row[pidCol] || '').trim();
    if (!pid) continue;

    const sizes = priceMap[pid];
    if (!sizes) continue;

    for (const col of priceCols) {
      const printifyPrice = sizes[col];
      if (!printifyPrice) continue;

      const finalPrice  = printifyPrice + SHIPPING_COST;
      const ci          = colIdx[col];
      const currentVal  = String(row[ci] || '').trim();
      const currentNum  = currentVal ? parseFloat(currentVal) : NaN;

      // Skip if already correct (within 1 cent)
      if (!isNaN(currentNum) && Math.abs(currentNum - finalPrice) < 0.01) {
        skipped++;
        continue;
      }

      // Write the new price
      sheet.getRange(i + 1, ci + 1).setValue(finalPrice.toFixed(2));
      updated++;
    }
  }

  Logger.log('Prices — updated: ' + updated + ', skipped (already correct): ' + skipped);
}

// ============================================================
// FETCH ALL PRINTIFY PRODUCTS (handles pagination)
// ============================================================
function fetchAllPrintify() {
  let page     = 1;
  let all      = [];
  const headers = { 'Authorization': 'Bearer ' + PRINTIFY_API_KEY };

  while (true) {
    const url = 'https://api.printify.com/v1/shops/' + PRINTIFY_SHOP_ID +
                '/products.json?limit=50&page=' + page;
    const res  = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true });
    const code = res.getResponseCode();

    if (code !== 200) {
      Logger.log('Printify API error: ' + code + ' — ' + res.getContentText());
      break;
    }

    const data  = JSON.parse(res.getContentText());
    const items = data.data || [];
    all = all.concat(items);

    if (items.length < 50) break;
    page++;
    if (page > 20) break;
  }

  return all;
}

// ============================================================
// SETUP TRIGGER — run this ONCE manually to activate daily sync
// ============================================================
function setupTrigger() {
  // Delete any existing triggers for runDaily to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runDaily')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Create new daily trigger at 2AM
  ScriptApp.newTrigger('runDaily')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log('Trigger set. runDaily will run every day at 2AM.');
  SpreadsheetApp.getUi().alert('✓ Done! Taqen sync will run automatically every day at 2AM.');
}

// ============================================================
// RUN MANUALLY — tap this any time to sync right now
// ============================================================
function runNow() {
  runDaily();
  SpreadsheetApp.getUi().alert('✓ Sync complete! Check the Apps Script logs for details.');
}
