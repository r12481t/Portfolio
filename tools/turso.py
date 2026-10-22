"""A small database client with no dependencies. Two engines behind one interface:

  Local   a SQLite file on this computer. Used for development and for the tests, so nothing touches Turso by accident.
  Remote  Turso (libSQL) over HTTPS, using Turso's documented "SQL over HTTP" endpoint (POST /v2/pipeline).

Both take the same SQL with `?` placeholders. Values are always sent as parameters, never pasted into the SQL text.

    db = open_database('libsql://my-db-my-org.turso.io', token)      # or 'file:content/dev.db'
    rows = db.query('SELECT * FROM lessons WHERE id = ?', ['t001'])  # a list of dicts
    db.transaction([('INSERT INTO ...', [..]), ('DELETE FROM ...', [..])])   # all or nothing
    db.script(open('db/migrations/001_init.sql').read())             # several statements, all or nothing

The auth token is only ever sent in the Authorization header. It is never put in an error message or printed.
"""
import base64, json, os, sqlite3, threading, time, urllib.error, urllib.parse, urllib.request


class DbError(Exception):
    """Anything that went wrong talking to the database, in words a person can act on."""


def split_statements(script):
    """Split a SQL script into single statements. Uses SQLite's own rule for where a statement ends, so a trigger
    (which has semicolons inside BEGIN ... END) stays in one piece, however the script is laid out."""
    out, start = [], 0
    for i, ch in enumerate(script):
        if ch == ';' and sqlite3.complete_statement(script[start:i + 1]):
            out.append(script[start:i + 1].strip())
            start = i + 1
    rest = ''.join(l for l in script[start:].splitlines() if l.strip() and not l.strip().startswith('--'))
    if rest.strip():
        raise DbError('The SQL script ends in the middle of a statement.')
    return out


# ---------------------------------------------------------------- local SQLite file
class Local:
    kind = 'local'

    def __init__(self, path):
        folder = os.path.dirname(os.path.abspath(path))
        os.makedirs(folder, exist_ok=True)
        self.path = path
        self.label = 'local file ' + os.path.basename(path)
        # The admin panel answers requests on several threads. One lock lets them share this connection safely, one at a time.
        self._lock = threading.RLock()
        self._con = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        self._con.execute('PRAGMA foreign_keys = ON')

    def query(self, sql, args=()):
        with self._lock:
            try:
                return [dict(r) for r in self._con.execute(sql, list(args)).fetchall()]
            except sqlite3.Error as e:
                raise DbError(f'{e}') from None

    def query_many(self, statements):
        with self._lock:
            return [self.query(sql, args) for sql, args in statements]

    def transaction(self, statements):
        with self._lock:
            try:
                self._con.execute('BEGIN')
                try:
                    for sql, args in statements:
                        self._con.execute(sql, list(args))
                except BaseException:
                    self._con.execute('ROLLBACK')
                    raise
                self._con.execute('COMMIT')
            except sqlite3.Error as e:
                raise DbError(f'{e}') from None

    def script(self, sql):
        self.transaction([(s, []) for s in split_statements(sql)])

    def close(self):
        with self._lock:
            self._con.close()


# ---------------------------------------------------------------- Turso over HTTPS
def _encode(v):
    if v is None:
        return {'type': 'null'}
    if isinstance(v, bool):
        return {'type': 'integer', 'value': '1' if v else '0'}
    if isinstance(v, int):
        return {'type': 'integer', 'value': str(v)}
    if isinstance(v, float):
        return {'type': 'float', 'value': v}
    if isinstance(v, (bytes, bytearray)):
        return {'type': 'blob', 'base64': base64.b64encode(bytes(v)).decode('ascii')}
    return {'type': 'text', 'value': str(v)}


def _decode(v):
    if not isinstance(v, dict):
        return v
    t = v.get('type')
    if t == 'null':
        return None
    if t == 'integer':
        return int(v['value'])
    if t == 'float':
        return float(v['value'])
    if t == 'blob':
        return base64.b64decode(v.get('base64', ''))
    return v.get('value')


def _stmt(sql, args):
    out = {'sql': sql}
    if args:
        out['args'] = [_encode(a) for a in args]
    return {'type': 'execute', 'stmt': out}


class Remote:
    kind = 'remote'

    def __init__(self, url, token, timeout=30):
        parsed = urllib.parse.urlparse(url.replace('libsql://', 'https://', 1) if url.startswith('libsql://') else url)
        if parsed.scheme not in ('https', 'http') or not parsed.netloc:
            raise DbError('The database address must look like libsql://your-db-your-org.turso.io')
        local_host = parsed.hostname in ('127.0.0.1', 'localhost')
        if parsed.scheme == 'http' and not local_host:
            raise DbError('Refusing to talk to a remote database without HTTPS.')
        if not token and not local_host:
            raise DbError('The database auth token is missing.')
        self.base = f'{parsed.scheme}://{parsed.netloc}'
        self.label = parsed.netloc
        self._token = token or ''
        self.timeout = timeout
        self.requests_made = 0

    # one HTTP call to the pipeline endpoint
    def _post(self, body, base=None, retry=False):
        data = json.dumps(body).encode('utf-8')
        headers = {'Content-Type': 'application/json', 'User-Agent': 'curiohatch-tools/1'}
        if self._token:
            headers['Authorization'] = 'Bearer ' + self._token
        attempts = 2 if retry else 1
        for attempt in range(attempts):
            req = urllib.request.Request((base or self.base) + '/v2/pipeline', data=data, headers=headers, method='POST')
            self.requests_made += 1
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    return json.loads(r.read().decode('utf-8'))
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    raise DbError('Turso refused the token. It may have expired, or it belongs to a different database.') from None
                if e.code >= 500 and attempt + 1 < attempts:
                    time.sleep(0.6)
                    continue
                detail = ''
                try:
                    detail = json.loads(e.read().decode('utf-8')).get('error', '')
                except Exception:
                    pass
                raise DbError(f'Turso answered with HTTP {e.code}. {detail}'.strip()) from None
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if attempt + 1 < attempts:
                    time.sleep(0.6)
                    continue
                raise DbError(f'Could not reach the database at {self.label}: {getattr(e, "reason", e)}') from None
            except ValueError:
                raise DbError('The database sent back something that is not JSON.') from None

    @staticmethod
    def _result(entry):
        if entry.get('type') == 'error':
            err = entry.get('error') or {}
            raise DbError(err.get('message') or 'The database refused the statement.')
        res = (entry.get('response') or {}).get('result') or {}
        cols = [c.get('name') for c in res.get('cols', [])]
        return [dict(zip(cols, (_decode(v) for v in row))) for row in res.get('rows', [])]

    def query(self, sql, args=()):
        return self.query_many([(sql, args)])[0]

    def query_many(self, statements):
        """Several reads in one round trip."""
        body = {'requests': [_stmt(s, a) for s, a in statements] + [{'type': 'close'}]}
        res = self._post(body, retry=True)
        results = res.get('results', [])
        return [self._result(results[i]) for i in range(len(statements))]

    def transaction(self, statements):
        """All or nothing. The statements run on one stream between BEGIN and COMMIT. COMMIT is only sent after every
        statement is known to have worked; otherwise ROLLBACK is sent, so a failure part-way never leaves half a change."""
        # The first statement asks for foreign keys to be enforced. If a server ignores or refuses it, that is not an error here.
        stmts = [('PRAGMA foreign_keys = ON', [])] + [('BEGIN', [])] + list(statements)
        res = self._post({'requests': [_stmt(s, a) for s, a in stmts]})
        results, baton = res.get('results', []), res.get('baton')
        base = res.get('base_url') or None
        failure = next((r for r in results[1:] if r.get('type') == 'error'), None)
        if failure is not None or len(results) < len(stmts) or not baton:
            if baton:
                try:
                    self._post({'baton': baton, 'requests': [_stmt('ROLLBACK', []), {'type': 'close'}]}, base=base)
                except DbError:
                    pass    # the server drops an unfinished transaction by itself when the stream times out
            if failure is not None:
                self._result(failure)
            raise DbError('The database did not keep the connection open for the whole change, so nothing was saved.')
        done = self._post({'baton': baton, 'requests': [_stmt('COMMIT', []), {'type': 'close'}]}, base=base)
        self._result(done['results'][0])

    def script(self, sql):
        self.transaction([(s, []) for s in split_statements(sql)])

    def close(self):
        pass


def open_database(url, token=None):
    """`file:path/to.db` opens a local SQLite file. A libsql:// or https:// address opens Turso."""
    if url.startswith('file:'):
        return Local(url[5:])
    return Remote(url, token)
