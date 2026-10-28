// netlify/functions/publish-products.js
// ============================================================
// Fixes products stuck in "Publishing" on a Custom Printify
// API Store by sending the publishing_succeeded signal.
//
// Printify waits for this POST before flipping a product's
// status from "Publishing" → "Published".
//
// Access at:
//   https://your-site.netlify.app/.netlify/functions/publish-products?key=YOUR_SYNC_KEY
//
// Uses the same SYNC_KEY and Printify credentials as sync.js.
// ============================================================

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // Auth check — same key as sync.js
  const key = event.queryStringParameters?.key || '';
  if (!key || key !== process.env.SYNC_KEY) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
  }

  const apiKey = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!apiKey || !shopId) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: 'Missing PRINTIFY_API_KEY or PRINTIFY_SHOP_ID.' }),
    };
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // ── 1. Fetch all products (paginated) ──────────────────
    let page = 1;
    let allProducts = [];

    while (true) {
      const res = await fetch(
        `https://api.printify.com/v1/shops/${shopId}/products.json?limit=50&page=${page}`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error(`Printify fetch error ${res.status}: ${await res.text()}`);

      const data  = await res.json();
      const items = data.data || [];
      allProducts = allProducts.concat(items);

      if (items.length < 50) break;
      if (++page > 20) break;
    }

    // ── 2. Send publishing_succeeded to ALL products ───────
    // Printify's list endpoint doesn't reliably expose publishing
    // state — sending this to already-published products is a
    // safe no-op on Printify's side.
    const toPublish = allProducts;

    if (!toPublish.length) {
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({
          ok: true,
          total: 0,
          published: 0,
          message: 'No products found in your Printify shop.',
        }),
      };
    }

    // ── 3. Send publishing_succeeded for each product ──────
    const results  = [];
    const failures = [];

    for (const product of toPublish) {
      try {
        const res = await fetch(
          `https://api.printify.com/v1/shops/${shopId}/products/${product.id}/publishing_succeeded.json`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              external: {
                id:     `taqen-${product.id}`,
                handle: `https://taqenshop.netlify.app/products/${slugify(product.title || product.id)}`,
              },
            }),
          }
        );

        if (!res.ok) {
          const errBody = await res.text();
          failures.push({ id: product.id, title: product.title, error: `${res.status}: ${errBody.slice(0, 120)}` });
        } else {
          results.push({ id: product.id, title: product.title });
        }
      } catch (e) {
        failures.push({ id: product.id, title: product.title, error: e.message });
      }
    }

    const allOk = failures.length === 0;

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: allOk,
        total:     allProducts.length,
        published: results.length,
        failed:    failures.length,
        message: allOk
          ? `✓ Sent publishing_succeeded to all ${results.length} products.`
          : `⚠ Sent to ${results.length}, but ${failures.length} failed — see failures.`,
        publishedProducts: results,
        failures,
      }, null, 2),
    };

  } catch (e) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ ok: false, error: e.message }),
    };
  }
};

// ── SLUG (matches products.js) ─────────────────────────────
function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
