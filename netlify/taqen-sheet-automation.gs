// ============================================================
// TAQEN STORE — Google Apps Script Automation
// ============================================================
// Paste this entire script into Apps Script (Extensions → Apps Script)
// Then run setupTrigger() ONCE to activate daily automation.
//
// SETUP:
// 1. Paste this script
// 2. Fill in your credentials in the CONFIG section below
// 3. Click Run → setupTrigger (do this once only)
// 4. Grant permissions when prompted
// ============================================================

// ── CONFIG — fill these in ──────────────────────────────────
const CONFIG = {
  PRINTIFY_API_KEY: 'YOUR_PRINTIFY_API_KEY',   // Printify → My account → Connections
  PRINTIFY_SHOP_ID: 'YOUR_PRINTIFY_SHOP_ID',   // Printify → Manage my stores → Store ID
  SHIPPING:         6.99,                        // Flat shipping baked into every price
  SHEET_NAME:       'Sheet1',                    // Your sheet tab name
};

// ── COLUMN HEADERS (must match your sheet row 1 exactly) ────
const HEADERS = [
  'printify_id', 'product_name',
  'price_xs',  'gumroad_xs',
  'price_s',   'gumroad_s',
  'price_m',   'gumroad_m',
  'price_l',   'gumroad_l',
  'price_xl',  'gumroad_xl',
  'price_2xl', 'gumroad_2xl',
  'price_one_size', 'gumroad_one_size',
  'price_6oz', 'gumroad_6oz',
  'price_11oz','gumroad_11oz',
  'price_15oz','gumroad_15oz',
  'bundle_name','bundle_description','bundle_price','bundle_gumroad','bundle_products',
];

// Size label → column name mapping
const SIZE_MAP = [
  { regex: /^XS$/i,       col: 'price_xs'       },
  { regex: /^S$/i,        col: 'price_s'        },
  { regex: /^M$/i,        col: 'price_m'        },
  { regex: /^L$/i,        col: 'price_l'        },
  { regex: /^XL$/i,       col: 'price_xl'       },
  { regex: /^2XL|XXL$/i,  col: 'price_2xl'      },
  { regex: /one.size|OS/i,col: 'price_one_size' },
  { regex: /^6\s*oz/i,    col: 'price_6oz'      },
  { regex: /^11\s*oz/i,   col: 'price_11oz'     },
  { regex: /^15\s*oz/i,   col: 'price_15oz'     },
];

// ============================================================
// MAIN — runs daily via trigger
// ============================================================
function runDaily() {
  Logger.log('=== Taqen daily sync starting ===');
  try {
    addNewProducts();
    fillPrices();
    Logger.log('=== Done ===');
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
  }
}

// ============================================================
// STEP 1 — Add new Printify products to sheet
// ============================================================
function addNewProducts() {
  const sheet      = getSheet();
  const allRows    = sheet.getDataRange().getValues();
  const headers    = allRows[0];
  const pidCol     = headers.indexOf('printify_id');
  const nameCol    = headers.indexOf('product_name');

  // Collect existing IDs
  const existingIds = new Set(
    allRows.slice(1).map(r => String(r[pidCol] || '').trim()).filter(Boolean)
  );

  // Fetch all Printify products
  const products = fetchAllPrintify();
  Logger.log(`Printify has ${products.length} products. Sheet has ${existingIds.size}.`);

  const newProducts = products.filter(p => !existingIds.has(String(p.id)));
  if (!newProducts.length) {
    Logger.log('No new products to add.');
    return;
  }

  // Write header row if sheet is empty
  if (allRows.length <= 1 && !allRows[0].length) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  // Append new rows (only printify_id and product_name — leave prices/gumroad blank)
  const newRows = newProducts.map(p => {
    const row = new Array(HEADERS.length).fill('');
    row[HEADERS.indexOf('printify_id')]   = String(p.id);
    row[HEADERS.indexOf('product_name')]  = p.title || '';
    return row;
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, HEADERS.length).setValues(newRows);
  Logger.log(`Added ${newProducts.length} new products: ${newProducts.map(p => p.title).join(', ')}`);
}

// ============================================================
// STEP 2 — Fill prices from Printify (+ shipping)
// ============================================================
function fillPrices() {
  const sheet   = getSheet();
  const allRows = sheet.getDataRange().getValues();
  const headers = allRows[0];