// Calls the contact function the way Netlify does and prints what came back, as JSON. Used by tests/inquiry_test.py.
// Usage: node tests/inquiry_harness.mjs '<json array of {method, url, headers, body}>'    The settings come from the environment.
import handler from '../netlify/functions/inquiry.mjs';

const out = [];
for (const r of JSON.parse(process.argv[2])) {
  const res = await handler(new Request(r.url || 'https://curiohatch.studio/.netlify/functions/inquiry', { method: r.method || 'POST', headers: r.headers || {}, body: r.method === 'GET' ? undefined : r.body }));
  out.push({ status: res.status, location: res.headers.get('location'), type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), body: await res.text() });
}
process.stdout.write(JSON.stringify(out));
