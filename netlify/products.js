// netlify/functions/products.js
// ============================================================
// SHEET columns (row 1 = headers, one row per product):
//   printify_id | product_name |
//   price_xs | gumroad_xs | price_s | gumroad_s | price_m | gumroad_m |
//   price_l  | gumroad_l  | price_xl| gumroad_xl| price_2xl|gumroad_2xl|
//   price_one_size | gumroad_one_size
//
// Leave both price and gumroad blank for a size = hidden on store.
// Image is pulled automatically from Printify.
//
// Netlify environment variables:
//   PRINTIFY_API_KEY, PRINTIFY_SHOP_ID, GOOGLE_SHEET_ID, GOOGLE_API_KEY
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// ─── CACHE (10 minutes) ──────────────────────────────────
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

const SIZE_KEYS = [
  // Apparel
  { label: 'XS',       price: 'price_xs',       gumroad: 'gumroad_xs'       },
  { label: 'S',        price: 'price_s',         gumroad: 'gumroad_s'        },
  { label: 'M',        price: 'price_m',         gumroad: 'gumroad_m'        },
  { label: 'L',        price: 'price_l',         gumroad: 'gumroad_l'        },
  { label: 'XL',       price: 'price_xl',        gumroad: 'gumroad_xl'       },
  { label: '2XL',      price: 'price_2xl',       gumroad: 'gumroad_2xl'      },
  { label: 'One Size', price: 'price_one_size',  gumroad: 'gumroad_one_size' },
  // Mugs (ounces)
  { label: '6oz',      price: 'price_6oz',       gumroad: 'gumroad_6oz'      },
  { label: '11oz',     price: 'price_11oz',      gumroad: 'gumroad_11oz'     },
  { label: '15oz',     price: 'price_15oz',      gumroad: 'gumroad_15oz'     },
];

// ─── PRODUCT TYPE ─────────────────────────────────────────
function getProductType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('mug')) return 'mug';
  if (n.includes('case')) return 'case';
  return 'apparel';
}

// ─── SLUG ────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  try {
    // Return cached response if fresh
    const now = Date.now();
    if (cache && (now - cacheTime) < CACHE_TTL) {
      // If a specific slug was requested, filter the cached response
      const reqSlug = (event.queryStringParameters || {}).slug;
      if (reqSlug) {
        const cached = JSON.parse(cache);
        const product = cached.products.find(p => p.slug === reqSlug);
        if (product) {
          // Return just this product + 4 related for fast single-product load
          const related = cached.products
            .filter(p => p.slug !== reqSlug)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);
          return {
            statusCode: 200,
            headers: { ...CORS, 'Cache-Control': 'public, max-age=300' },
            body: JSON.stringify({ product, related }),
          };
        }
      }
      return {
        statusCode: 200,
        headers: CORS,
        body: cache,
      };
    }

    const [printifyData, sheetRows] = await Promise.all([
      fetchAllPrintify(),
      fetchSheet(),
    ]);

    // Build maps from Printify
    const imageMap         = {};
    const imagesMap        = {};
    const nameMap          = {};
    const descMap          = {};
    const coloursMap       = {};
    const colourImgMap     = {};
    const colourGalleryMap = {};

    for (const item of printifyData) {
      // Default + all images
      imageMap[item.id]  = item.images?.find(i => i.is_default)?.src
                        || item.images?.[0]?.src || '';
      imagesMap[item.id] = (item.images || []).map(i => i.src).filter(Boolean);
      nameMap[item.id]   = item.title || '';
      descMap[item.id]   = (item.description || '').replace(/<[^>]*>/g, '').trim();

      // Parse colours and build gallery maps
      const variants   = item.variants || [];
      const hasSlash   = variants.some(v => (v.title || '').includes('/'));

      // Build variantId → colour map
      const variantColourMap = {};
      for (const v of variants) {
        if (!v.title) continue;
        const colour = hasSlash && v.title.includes('/')
          ? v.title.split('/')[0].trim()
          : v.title.trim();
        variantColourMap[v.id] = colour;
      }

      // Build variantId → image src map (Printify links images to variants)
      const variantImageMap = {};
      for (const img of (item.images || [])) {
        for (const vid of (img.variant_ids || [])) {
          if (!variantImageMap[vid]) variantImageMap[vid] = img.src;
        }
      }

      // colour → first image (for swatches)
      // colour → ALL images (for gallery swap)
      const colourSet      = [];
      const colourImgs     = {};
      const colourGalleryS = {}; // colour → Set of srcs

      for (const v of variants) {
        if (!v.title) continue;
        const colour = hasSlash && v.title.includes('/')
          ? v.title.split('/')[0].trim()
          : v.title.trim();
        if (!colourImgs.hasOwnProperty(colour)) {
          colourSet.push(colour);
          colourImgs[colour] = variantImageMap[v.id] || '';
        }
      }

      for (const img of (item.images || [])) {
        for (const vid of (img.variant_ids || [])) {
          const colour = variantColourMap[vid];
          if (!colour) continue;
          if (!colourGalleryS[colour]) colourGalleryS[colour] = new Set();
          colourGalleryS[colour].add(img.src);
        }
      }

      const colourGallery = {};
      for (const [c, set] of Object.entries(colourGalleryS)) {
        colourGallery[c] = [...set];
      }

      coloursMap[item.id]        = hasSlash ? colourSet : [];
      colourImgMap[item.id]      = colourImgs;
      colourGalleryMap[item.id]  = colourGallery;
    }

    const products = [];
    const bundles  = [];

    for (const row of sheetRows) {
      // Bundle row
      if (!row.printify_id && row.bundle_name && row.bundle_gumroad) {
        bundles.push({
          name:        row.bundle_name,
          description: row.bundle_description || '',
          price:       parsePrice(row.bundle_price),
          gumroad:     row.bundle_gumroad,
          productIds:  (row.bundle_products || '').split('|').map(s => s.trim()).filter(Boolean),
        });
        continue;
      }

      if (!row.printify_id) continue;

      const id = row.printify_id.trim();

      // Build sizes — only include sizes that have a gumroad link
      const sizes = SIZE_KEYS
        .filter(s => row[s.gumroad] && row[s.gumroad].trim())
        .map(s => ({
          label:   s.label,
          price:   parsePrice(row[s.price]),
          gumroad: row[s.gumroad].trim(),
        }));

      if (!sizes.length) continue;

      const validPrices = sizes.map(s => s.price).filter(p => p > 0);
      const startPrice  = validPrices.length ? Math.min(...validPrices) : 0;

      const name = (row.product_name && row.product_name.trim()) || nameMap[id] || 'Unnamed Product';

      products.push({
        id,
        slug:          slugify(name),
        name,
        productType:   getProductType(name),
        image:         imageMap[id]          || '',
        images:        imagesMap[id]         || [],
        description:   descMap[id]           || '',
        colours:       coloursMap[id]        || [],
        colourImages:  colourImgMap[id]      || {},
        colourGallery: colourGalleryMap[id]  || {},
        startPrice,
        sizes,
      });
    }

    // Resolve bundles
    const resolvedBundles = bundles.map(b => {
      const bp = b.productIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean)
        .map(p => ({ id: p.id, name: p.name, price: p.startPrice.toFixed(2) }));

      if (bp.length < 2) return null;

      const originalTotal = bp.reduce((s, p) => s + parsePrice(p.price), 0);
      const savings       = originalTotal - b.price;
      return {
        ...b, products: bp,
        originalTotal: originalTotal.toFixed(2),
        savings:       Math.max(0, savings).toFixed(2),
        savingsPct:    originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0,
      };
    }).filter(Boolean);

    const body = JSON.stringify({ products, bundles: resolvedBundles });
    cache = body;
    cacheTime = Date.now();

    // If a specific slug was requested, return just that product + related
    const reqSlug = (event.queryStringParameters || {}).slug;
    if (reqSlug) {
      const product = products.find(p => p.slug === reqSlug);
      if (product) {
        const related = products
          .filter(p => p.slug !== reqSlug)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);
        return {
          statusCode: 200,
          headers: { ...CORS, 'Cache-Control': 'public, max-age=300' },
          body: JSON.stringify({ product, related }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body,
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};


// ─── PRICE PARSER ────────────────────────────────────────
function parsePrice(val) {
  if (!val && val !== 0) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── PRINTIFY — paginated fetch ───────────────────────────
async function fetchAllPrintify() {
  const key    = process.env.PRINTIFY_API_KEY;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!key || !shopId) throw new Error('Missing PRINTIFY_API_KEY or PRINTIFY_SHOP_ID.');

  let page = 1;
  let allProducts = [];

  while (true) {
    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json?limit=50&page=${page}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`Printify error ${res.status}`);
    const data = await res.json();
    const items = data.data || [];
    allProducts = allProducts.concat(items);
    if (items.length < 50) break;
    page++;
    if (page > 20) break;
  }

  return allProducts;
}

// ─── GOOGLE SHEETS API ───────────────────────────────────
async function fetchSheet() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey  = process.env.GOOGLE_API_KEY;
  if (!sheetId || !apiKey) return [];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:Z?key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 403) throw new Error('Sheet not public. Share → "Anyone with the link" → Viewer.');
  if (!res.ok) throw new Error(`Sheets error ${res.status}`);

  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0].map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  }).filter(r => r.printify_id || r.bundle_name);
}
