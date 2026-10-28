// netlify/functions/sync.js
// ============================================================
// Secret manual sync endpoint — forces a fresh pull from Printify
// and checks your sheet is accessible.
//
// Access it at:
//   https://your-site.netlify.app/.netlify/functions/sync?key=YOUR_SYNC_KEY
//
// Add this in Netlify → Environment variables:
//   SYNC_KEY    any secret word/phrase you choose, e.g. taqen-sync-2026
//
// Nobody else knows this URL exists. Keep your key private.
// ============================================================

exports.handler = async (event) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Check secret key
  const key = event.queryStringParameters?.key || '';
  if (!key || key !== process.env.SYNC_KEY) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: 'Not found' }),
    };
  }

  const results = { printify: null, sheet: null, errors: [], debug: {
    has_printify_key: !!process.env.PRINTIFY_API_KEY,
    has_shop_id: !!process.env.PRINTIFY_SHOP_ID,
    has_sheet_id: !!process.env.GOOGLE_SHEET_ID,
    has_google_key: !!process.env.GOOGLE_API_KEY,
    shop_id: process.env.PRINTIFY_SHOP_ID || 'MISSING',
    printify_key_prefix: (process.env.PRINTIFY_API_KEY || '').slice(0, 6),
    printify_key_length: (process.env.PRINTIFY_API_KEY || '').length,
  }};

  // Test Printify connection
  try {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=50`,
      { headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` } }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Printify returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    results.printify = {
      ok: true,
      products: (data.data || []).length,
      names: (data.data || []).slice(0, 5).map(p => p.title),
    };
  } catch (e) {
    results.printify = { ok: false };
    results.errors.push('Printify: ' + e.message);
  }

  // Test Google Sheet connection
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Sheet1!A:A?key=${process.env.GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (res.status === 403) throw new Error('Sheet not public — Share → Anyone with link → Viewer');
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const rows = (data.values || []).length;
    results.sheet = { ok: true, rows: rows - 1 }; // minus header row
  } catch (e) {
    results.sheet = { ok: false };
    results.errors.push('Sheet: ' + e.message);
  }

  const allOk = results.errors.length === 0;

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: allOk,
      timestamp: new Date().toISOString(),
      debug: results.debug,
      printify: results.printify,
      sheet: results.sheet,
      errors: results.errors,
      message: allOk
        ? `✓ All good. Printify has ${results.printify.products} products. Sheet has ${results.sheet.rows} product rows.`
        : '⚠ Some issues found — see errors.',
    }, null, 2),
  };
};
