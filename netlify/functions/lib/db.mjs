// A read-only client for Turso's HTTP API. No packages: it uses the fetch that Node already has.
// Only SELECT statements are accepted, and the token this runs with should be a read-only token (docs/database.md),
// so even a mistake here cannot change the database.

export class DbUnavailable extends Error {}

function encode(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number' && Number.isInteger(v)) return { type: 'integer', value: String(v) };
  if (typeof v === 'number') return { type: 'float', value: v };
  return { type: 'text', value: String(v) };
}

function decode(v) {
  if (!v || typeof v !== 'object') return v;
  switch (v.type) {
    case 'null': return null;
    case 'integer': return Number(v.value);
    case 'float': return Number(v.value);
    default: return v.value;
  }
}

export function makeDb({ url, token, timeoutMs = 8000, fetchImpl = fetch }) {
  if (!url || !token) throw new DbUnavailable('The database settings are missing.');
  const base = url.replace(/^libsql:\/\//, 'https://').replace(/\/+$/, '');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(base)) {
    throw new DbUnavailable('The database address must use https.');
  }
  return {
    // Several reads in one round trip. statements: [[sql, [args]], ...]. Returns one array of row objects per statement.
    async queryMany(statements) {
      for (const [sql] of statements) {
        if (!/^\s*select\b/i.test(sql)) throw new Error('This client only runs SELECT statements.');
      }
      const body = {
        requests: [
          ...statements.map(([sql, args = []]) => ({ type: 'execute', stmt: { sql, args: args.map(encode) } })),
          { type: 'close' },
        ],
      };
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(base + '/v2/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
      } catch (e) {
        throw new DbUnavailable('Could not reach the database.');
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new DbUnavailable(`The database answered with HTTP ${res.status}.`);
      let data;
      try { data = await res.json(); } catch { throw new DbUnavailable('The database sent back something that is not JSON.'); }
      return statements.map((_, i) => {
        const r = (data.results || [])[i];
        if (!r || r.type === 'error') throw new DbUnavailable((r && r.error && r.error.message) || 'The database refused the query.');
        const result = (r.response && r.response.result) || {};
        const cols = (result.cols || []).map((c) => c.name);
        return (result.rows || []).map((row) => Object.fromEntries(cols.map((c, j) => [c, decode(row[j])])));
      });
    },
  };
}
