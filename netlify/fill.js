// netlify/functions/fill.js
// Auto-fills the Google Sheet with Printify product IDs and names.
// Only writes rows that don't already exist — never overwrites
// your existing Gumroad links or prices.
//
// Manual trigger:
//   https://your-site.netlify.app/.netlify/functions/fill?key=YOUR_SYNC_KEY

const { GoogleAuth } = require('google-auth-library');
const { google }     = require('googleapis');

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

exports.handler = async (event) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const isScheduled = !!event.scheduledTime;
  const key = event.queryStringParameters?.key || '';
  if (!isScheduled && key !== process.env.SYNC_KEY) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
  }

  try {
    // ── 1. Fetch all Printify products ──────────────────────
    let page = 1;
    let allProducts = [];
    while (true) {
      const res = await fetch(
        `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json?limit=50&page=${page}`,
        { headers: { Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}` } }
      );
      if (!res.ok) throw new Error(`Printify error ${res.status}: ${await res.text()}`);
      const data  = await res.json();
      const items = data.data || [];
      allProducts = allProducts.concat(items);
      if (items.length < 50) break;
      page++;
      if (page > 20) break;
    }

    // ── 2. Auth with Google ──────────────────────────────────
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key:  fixPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets  = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // ── 3. Read existing sheet ───────────────────────────────
    const existing     = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:B',
    });
    const existingRows = existing.data.values || [];
    const existingIds  = new Set(
      existingRows.slice(1).map(r => (r[0] || '').trim()).filter(Boolean)
    );

    // ── 4. Find new products ─────────────────────────────────
    const newProducts = allProducts.filter(p => !existingIds.has(String(p.id)));

    if (!newProducts.length) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          ok: true,
          message: `Sheet already has all ${allProducts.length} products. Nothing to add.`,
          added: 0,
        }),
      };
    }

    // ── 5. Write header if sheet is empty ───────────────────
    if (!existingRows.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [[
          'printify_id',    'product_name',
          'price_xs',       'gumroad_xs',
          'price_s',        'gumroad_s',
          'price_m',        'gumroad_m',
          'price_l',        'gumroad_l',
          'price_xl',       'gumroad_xl',
          'price_2xl',      'gumroad_2xl',
          'price_one_size', 'gumroad_one_size',
          'price_6oz',      'gumroad_6oz',
          'price_11oz',     'gumroad_11oz',
          'price_15oz',     'gumroad_15oz',
        ]] },
      });
    }

    // ── 6. Append new rows ───────────────────────────────────
    const newRows = newProducts.map(p => [
      String(p.id), p.title || '',
      '','','','','','','','','','','','','','','','','','','',
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRows },
    });

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true,
        message: `Added ${newProducts.length} new product(s). Open the sheet and add your Gumroad links.`,
        added: newProducts.length,
        products: newProducts.map(p => ({ id: p.id, name: p.title })),
      }, null, 2),
    };

  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
