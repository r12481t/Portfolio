// Calls the live lesson function the way Netlify does and prints what came back, as JSON. Used by tests/function_test.py.
// Usage: node tests/function_harness.mjs <origin> <query> [<query> ...]     e.g.  http://127.0.0.1:8000 "view=lesson&slug=abc"
// A query that starts with "POST:" is sent as a POST. One that starts with "PATH:" is a plain address as a visitor would type it,
// with no ?view= on it (that is how Netlify may show the function a rewritten request). The settings come from the environment.
import handler from '../netlify/functions/learn.mjs';

const [origin, ...queries] = process.argv.slice(2);
const out = [];
for (const q of queries) {
  const post = q.startsWith('POST:');
  const asked = q.startsWith('PATH:') ? origin + q.slice(5) : `${origin}/.netlify/functions/learn?${post ? q.slice(5) : q}`;
  const res = await handler(new Request(asked, { method: post ? 'POST' : 'GET' }));
  out.push({ query: q, status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
}
process.stdout.write(JSON.stringify(out));
