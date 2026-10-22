// Calls the live lesson function the way Netlify does and prints what came back, as JSON. Used by tests/function_test.py.
// Usage: node tests/function_harness.mjs <origin> <query> [<query> ...]     e.g.  http://127.0.0.1:8000 "view=lesson&slug=abc"
// A query that starts with "POST:" is sent as a POST. The settings come from the environment, exactly as on Netlify.
import handler from '../netlify/functions/learn.mjs';

const [origin, ...queries] = process.argv.slice(2);
const out = [];
for (const q of queries) {
  const post = q.startsWith('POST:');
  const res = await handler(new Request(`${origin}/.netlify/functions/learn?${post ? q.slice(5) : q}`, { method: post ? 'POST' : 'GET' }));
  out.push({ query: q, status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
}
process.stdout.write(JSON.stringify(out));
