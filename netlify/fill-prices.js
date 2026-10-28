// netlify/functions/fill-prices.js
// Reads Printify prices and syncs them into the Google Sheet
// with $6.99 shipping baked in.
//
// Manual trigger:
//   https://your-site.netlify.app/.netlify/functions/fill-prices?key=YOUR_SYNC_KEY

const { GoogleAuth } = require('google-auth-library');
const { google }     = require('googleapis');

const SHIPPING = 6.99;

const SIZE_MATCHERS = [
  { col: 'price_xs',       regex: /\bxs\b/i                     },
  { col: 'price_s',        regex: /(?<![a-z])s(?![a-z])/i       },
  { col: 'price_m',        regex: /(?<![a-z])m(?![a-z])/i       },
  { col: 'price_l',        regex: /(?<![a-z])l(?![a-z])/i       },
  { col: 'price_xl',       regex: /\bxl\b/i                     },
  { col: 'price_2xl',      regex: /\b2xl\b|\bxxl\b/i            },
  { col: 'price_one_size', regex: /one[\s-]?size|os\b/i         },
  { col: 'price_6oz',      regex: /6\s*oz/i                     },
  { col: 'price_11oz',     regex: /11\s*oz/i                    },
  { col: 'price_15oz',     regex: /15\s*oz/i                    },
];

// ── Bulletproof private key fixer ───────────────────────────
function fixPrivateKey(key) {
  if (!key) throw new Error('GOOGLE_PRIVATE_KEY is not set.');
  key = key.replace(/\\n/g, '\n');
  key = key.replace(/-----BEGIN PRIVATE KEY-----(.+?)-----END PRIVATE KEY-----/s, (_, body) => {
    const cleaned = body.replace(/\s+/g, '');
    const lines   = cleaned.match(/.{1,64}/g).join('\n');
    return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
  });
  return key.trim();
}

function indexToColLetter(i) {
  let letter = '', n = i + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const isScheduled = !!event.scheduledTime;
  const key = event.queryStringParameters?.key || '';
  if (!isScheduled && (!key || key !== process.env.SYNC_KEY)) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
  }

  try {
    // ── 1. Auth with Google (same method as fill.js) ─────────
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key:  fixPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets  = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // ── 2. Read sheet ────────────────────────────────────────
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z',
    });
    const values = readRes.data.values || [];
    if (values.length < 2) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, message: 'Sheet is empty.' }) };
    }

    const headers = values[0];
    const colIdx  = {};
    headers.forEach((h, i) => { colIdx[h.trim()] = i; });

    const pidIdx = colIdx['printify_id'];
    if (pidIdx === undefined) throw new Error('No printify_id column found in sheet.');

    // ── 3. Fetch all Printify products ───────────────────────
    let page = 1, allProducts = [];
    while (true) {
      const r = await fetch(
        `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=50&page=${page}`,
        { headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` } }
      );
      if (!r.ok) throw new Error(`Printify error ${r.status}`);
      const d = await r.json();
      allProducts = allProducts.concat(d.data || []);
      if ((d.data || []).length < 50) break;
      if (++page > 20) break;
    }

    // ── 4. Build id → lowest price per size col ──────────────
    const printifyPrices = {};
    for (const product of allProducts) {
      const sizes = {};
      for (const v of (product.variants || [])) {
        if (!v.is_enabled) continue;
        const price    = (v.price || 0) / 100;
        const sizePart = (v.title || '').includes('/')
          ? v.title.split('/').pop().trim()
          : (v.title || '').trim();
        for (const { col, regex } of SIZE_MATCHERS) {
          if (regex.test(sizePart)) {
            if (!sizes[col] || price < sizes[col]) sizes[col] = price;
            break;
          }
        }
      }
      printifyPrices[String(product.id)] = sizes;
    }

    // ── 5. Build batch updates ───────────────────────────────
    const updates = [];
    const PRICE_COLS = SIZE_MATCHERS.map(m => m.col);

    for (let rowI = 1; rowI < values.length; rowI++) {
      const row = values[rowI];
      const pid = (row[pidIdx] || '').trim();
      if (!pid) continue;

      const sizes = printifyPrices[pid];
      if (!sizes) continue;

      for (const sizeCol of PRICE_COLS) {
        const ci = colIdx[sizeCol];
        if (ci === undefined) continue;

        const printifyPrice = sizes[sizeCol];
        if (!printifyPrice) continue;

        const finalPrice = printifyPrice + SHIPPING;
        const currentRaw = (row[ci] || '').trim();
        const currentNum = currentRaw ? parseFloat(currentRaw) : NaN;

        if (!isNaN(currentNum) && Math.abs(currentNum - finalPrice) < 0.005) continue;

        updates.push({
          range:  `Sheet1!${indexToColLetter(ci)}${rowI + 1}`,
          values: [[finalPrice.toFixed(2)]],
          _log:   `${sizeCol}: ${currentRaw || '(empty)'} → ${finalPrice.toFixed(2)}`,
        });
      }
    }

    if (!updates.length) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ ok: true, message: 'All prices already up to date.' }),
      };
    }

    // ── 6. Batch write ───────────────────────────────────────
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map(u => ({ range: u.range, values: u.values })),
      },
    });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true,
        message: `Updated ${updates.length} price cells.`,
        changes: updates.slice(0, 20).map(u => u._log),
      }),
    };

  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
