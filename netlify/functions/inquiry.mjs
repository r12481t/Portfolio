// The contact form's receiver. A visitor's message is written to the database, and the visitor is told "sent" only
// after the database confirms the row exists. Nothing else is promised: there is no email notification (docs/contact-form.md).
//
//   POST /.netlify/functions/inquiry     JSON (what js/site.js sends) or a plain urlencoded form post (no JavaScript)
//   JSON answers:   200 {ok:true}   400 {ok:false, errors:{field: message}}   403 / 405 / 413 / 415 / 429 / 503 {ok:false, message}
//   Form answers:   303 to /contact/thanks/ when stored, otherwise a small error page that links back to the form
//
// Settings (Netlify, Site configuration, Environment variables):
//   TURSO_DATABASE_URL   the same address the page function uses
//   TURSO_WRITE_TOKEN    a full-access token (not the read-only one). It can write, so it stays in Netlify and is never committed (docs/contact-form.md).
//   SITE_ORIGIN          optional, https://curiohatch.studio. Posts from any other website are refused.
//
// Spam: a hidden field people never fill (_gotcha), at most 3 messages per email address and 40 in total per hour (counted in the
// same statement that stores the message, so two quick posts cannot both slip past), and size limits. There is no CAPTCHA.

const TYPES = ['audit', 'website', 'fixes'];
const MAX_BODY = 20000;
const PER_EMAIL_PER_HOUR = 3;
const TOTAL_PER_HOUR = 40;
const LIMITS = { name: 120, email: 254, website: 300, business_type: 120, location: 120, message: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECURITY = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY } });

function page(status, title, text) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1rem"><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="/contact/">Back to the contact form</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY } });
}

function clean(v, max) {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max + 1) : '';
}

function normalizeUrl(v) {
  let s = v.trim();
  if (s && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

function validUrl(v) {
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.indexOf('.') > 0; } catch { return false; }
}

// Returns { values } or { errors }. Mirrors the checks in js/site.js; this copy is the one that counts.
export function validate(raw) {
  const v = {};
  for (const [k, max] of Object.entries(LIMITS)) v[k] = clean(raw[k], max);
  v.inquiry_type = clean(raw.inquiry_type, 20);
  const errors = {};
  if (!TYPES.includes(v.inquiry_type)) errors.inquiry_type = 'Choose what you need.';
  if (!v.name) errors.name = 'Enter your name.';
  if (!EMAIL_RE.test(v.email) || v.email.length > LIMITS.email) errors.email = 'Enter an email address we can reply to.';
  v.email = v.email.toLowerCase();   // stored lowercase, so the per-address limit cannot be dodged by changing capital letters
  v.website = normalizeUrl(v.website);
  if (v.inquiry_type === 'audit' && !v.website) errors.website = 'Enter your website address so we can run the audit.';
  else if (v.website && !validUrl(v.website)) errors.website = 'That does not look like a website address. Example: example.com';
  for (const [k, max] of Object.entries(LIMITS)) if (v[k].length > max) errors[k] = `That is too long (at most ${max} characters).`;
  return Object.keys(errors).length ? { errors } : { values: v };
}

function encode(x) {
  if (x === null || x === undefined) return { type: 'null' };
  if (typeof x === 'number' && Number.isInteger(x)) return { type: 'integer', value: String(x) };
  return { type: 'text', value: String(x) };
}

// One statement that stores the message only if neither limit is reached. Returns the number of rows stored (0 or 1).
// Anything unexpected, including no answer at all, throws, and the visitor is told the message was not sent.
async function store(v, { url, token, fetchImpl = fetch, now = new Date() }) {
  const base = url.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(base)) throw new Error('The database address must use https.');
  const since = new Date(now.getTime() - 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  const sql = `INSERT INTO inquiries (inquiry_type, name, email, website, business_type, location, message)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE (SELECT count(*) FROM inquiries WHERE email = ? AND created_at > ?) < ${PER_EMAIL_PER_HOUR}
      AND (SELECT count(*) FROM inquiries WHERE created_at > ?) < ${TOTAL_PER_HOUR}`;
  const args = [v.inquiry_type, v.name, v.email, v.website, v.business_type, v.location, v.message, v.email, since, since].map(encode);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let res;
  try {
    res = await fetchImpl(base + '/v2/pipeline', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }, { type: 'close' }] }),
    });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`The database answered with HTTP ${res.status}.`);
  const data = await res.json();
  const r = (data.results || [])[0];
  if (!r || r.type !== 'ok') throw new Error('The database refused the insert: ' + ((r && r.error && r.error.message) || 'no answer'));
  const n = Number(r.response && r.response.result && r.response.result.affected_row_count);
  if (n !== 0 && n !== 1) throw new Error('The database did not say whether the row was stored.');
  return n;
}

async function readBody(request) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooBig: true };
  if (type === 'application/json') {
    try { const o = JSON.parse(text); return { raw: o && typeof o === 'object' && !Array.isArray(o) ? o : {}, form: false }; } catch { return { bad: true }; }
  }
  if (type === 'application/x-www-form-urlencoded') return { raw: Object.fromEntries(new URLSearchParams(text)), form: true };
  return { unsupported: true };
}

export default async (request, context, deps = {}) => {
  const env = deps.env || process.env;
  let wantsJson = true;
  try {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', ...SECURITY } });

    const allowed = env.SITE_ORIGIN ? new URL(env.SITE_ORIGIN).origin : new URL(request.url).origin;
    const from = request.headers.get('origin');
    if (from && from !== allowed) return json(403, { ok: false, message: 'This form can only be sent from the Curiohatch website.' });

    const body = await readBody(request);
    wantsJson = !body.form;
    const fail = (status, message) => (wantsJson ? json(status, { ok: false, message }) : page(status, 'Your message was not sent', message));
    if (body.tooBig) return fail(413, 'That message is too large.');
    if (body.unsupported) return fail(415, 'This form sends the wrong kind of data.');
    if (body.bad) return fail(400, 'This form sends data the server cannot read.');

    // The hidden field only a program fills in. The sender is told it worked and nothing is stored.
    if (clean(body.raw._gotcha, 200)) return wantsJson ? json(200, { ok: true }) : Response.redirect(new URL('/contact/thanks/', request.url), 303);

    const result = validate(body.raw);
    if (result.errors) return wantsJson ? json(400, { ok: false, errors: result.errors, message: 'Please fix the highlighted fields.' }) : page(400, 'Your message was not sent', Object.values(result.errors).join(' '));

    if (!env.TURSO_DATABASE_URL || !env.TURSO_WRITE_TOKEN) {
      const missing = ['TURSO_DATABASE_URL', 'TURSO_WRITE_TOKEN'].filter((k) => !env[k]);
      const seen = Object.keys(env).filter((k) => k.startsWith('TURSO_') || k === 'SITE_ORIGIN');   // names only, never values
      console.error('inquiry: not set in Netlify for this function and deploy context: ' + missing.join(', ') + '. Names this function can see: ' + (seen.join(', ') || 'none') + '.');
      return fail(503, 'The message could not be saved right now. Please try again in a few minutes.');
    }
    let stored;
    try {
      stored = await store(result.values, { url: env.TURSO_DATABASE_URL, token: env.TURSO_WRITE_TOKEN, fetchImpl: deps.fetchImpl, now: deps.now });
    } catch (e) {
      console.error('inquiry: not stored:', e && e.message);   // no visitor details are logged
      return fail(503, 'The message could not be saved right now. Please try again in a few minutes.');
    }
    if (stored === 0) return fail(429, 'Too many messages were sent from this address recently. Please try again in an hour.');
    return wantsJson ? json(200, { ok: true }) : Response.redirect(new URL('/contact/thanks/', request.url), 303);
  } catch (e) {
    console.error('inquiry: unexpected:', e && e.message);
    return wantsJson ? json(500, { ok: false, message: 'Something went wrong.' }) : page(500, 'Your message was not sent', 'Something went wrong.');
  }
};
