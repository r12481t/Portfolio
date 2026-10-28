"""A small fake of Turso's HTTP API (POST /v2/pipeline), backed by a local SQLite file. Used by the tests so nothing ever
reaches a real database. It keeps a stream open between requests when the client sends no `close` (that is how a transaction
spans two requests), answers a failing statement with an error and carries on with the rest, as the real service does.

    state = {'token': 'secret', 'path': '/tmp/x.db', 'log': [], 'sessions': {}, 'fail_on': None}
    server = fake_turso.serve(state)         # -> ThreadingHTTPServer, already running; server.server_address[1] is its port
"""
import base64, http.server, json, sqlite3, threading, uuid


def serve(FAKE):

    def enc(v):
        if v is None: return {'type': 'null'}
        if isinstance(v, int): return {'type': 'integer', 'value': str(v)}
        if isinstance(v, float): return {'type': 'float', 'value': v}
        if isinstance(v, bytes): return {'type': 'blob', 'base64': base64.b64encode(v).decode()}
        return {'type': 'text', 'value': v}

    def dec(a):
        t = a['type']
        return None if t == 'null' else int(a['value']) if t == 'integer' else float(a['value']) if t == 'float' else base64.b64decode(a['base64']) if t == 'blob' else a['value']

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a): pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            FAKE['log'].append({'path': self.path, 'auth': self.headers.get('Authorization'), 'body': body})
            if self.headers.get('Authorization') != 'Bearer ' + FAKE['token']:
                self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"bad token"}'); return
            baton = body.get('baton')
            con = FAKE['sessions'].pop(baton) if baton else sqlite3.connect(FAKE['path'], isolation_level=None, check_same_thread=False)
            results, closed = [], False
            for r in body['requests']:
                if r['type'] == 'close':
                    closed = True; results.append({'type': 'ok', 'response': {'type': 'close'}}); continue
                st = r['stmt']
                try:
                    if FAKE['fail_on'] and FAKE['fail_on'] in st['sql']:
                        raise sqlite3.Error('simulated failure')
                    cur = con.execute(st['sql'], [dec(a) for a in st.get('args', [])])
                    cols = [{'name': d[0], 'decltype': None} for d in (cur.description or [])]
                    rows = [[enc(v) for v in row] for row in cur.fetchall()] if cur.description else []
                    results.append({'type': 'ok', 'response': {'type': 'execute', 'result': {'cols': cols, 'rows': rows, 'affected_row_count': (0 if cur.description else max(cur.rowcount, 0)), 'last_insert_rowid': None}}})
                except sqlite3.Error as e:
                    results.append({'type': 'error', 'error': {'message': str(e), 'code': 'SQLITE_ERROR'}})
            new = None
            if closed:
                con.close()
            else:
                new = uuid.uuid4().hex; FAKE['sessions'][new] = con
            out = json.dumps({'baton': new, 'base_url': None, 'results': results}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(out)

    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
