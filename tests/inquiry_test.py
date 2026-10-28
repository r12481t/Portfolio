"""Tests the contact function (netlify/functions/inquiry.mjs) against a fake Turso backed by a real SQLite file that has the real
schema (db/migrations/002_inquiries.sql). Covers: a good message is stored and answered ok; a no-JavaScript form post is stored and redirected;
bad input is refused with field messages and stores nothing; the hidden trap field stores nothing; other websites are refused;
size and method limits; the per-email and total hourly limits; a database that is down, rejects the token or is not configured
gives a failure and never a false "sent"; the function sends one INSERT with the write token and logs no visitor details; and the
database's own rules refuse bad rows even without the function. Nothing here touches a real database or Netlify. Needs Node 18+.
Usage: python tests/inquiry_test.py"""
import json, os, shutil, subprocess, sys, tempfile
for k in ('TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'CURIOHATCH_DB', 'TURSO_WRITE_TOKEN', 'SITE_ORIGIN'):
    os.environ.pop(k, None)
os.environ['CURIOHATCH_STORE'] = 'json'
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.dirname(here)
sys.path.insert(0, here); sys.path.insert(0, os.path.join(repo, 'tools'))
res = []


def check(n, ok, d=''):
    res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f'  [{d}]' if d else ''))


try:
    if int(subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip().lstrip('v').split('.')[0]) < 18:
        raise ValueError
except Exception:
    print('SKIPPED: Node 18 or newer was not found, so the contact function was not tested.'); sys.exit(0)

import store, turso, fake_turso
tmp = tempfile.mkdtemp(prefix='curiohatch-inq-')
JSON_H = {'Content-Type': 'application/json'}
GOOD = {'inquiry_type': 'audit', 'name': 'Ana Test', 'email': 'ana@example.com', 'website': 'example.com', 'business_type': 'bakery', 'location': 'Dhaka, Bangladesh', 'message': 'Hello\nthere', '_gotcha': ''}


def make():
    path = os.path.join(tmp, f'inq{len(os.listdir(tmp))}.db')
    conn = turso.open_database('file:' + path)
    store.reset(); store.settings = lambda: ('t', None); store._conn[('t', None)] = conn
    assert store.migrate(conn) == ['001_init', '002_inquiries']   # the real migrations, the way `db.py init` applies them
    FAKE = {'token': 'write-token', 'path': path, 'log': [], 'sessions': {}, 'fail_on': None}
    return conn, FAKE, fake_turso.serve(FAKE)


def call(reqs, port, token='write-token', extra=None):
    env = dict(os.environ, TURSO_DATABASE_URL=f'http://127.0.0.1:{port}', TURSO_WRITE_TOKEN=token)
    env.update(extra or {})
    for k in [k for k, v in env.items() if v is None]: env.pop(k)
    out = subprocess.run(['node', os.path.join(here, 'inquiry_harness.mjs'), json.dumps(reqs)], capture_output=True, text=True, env=env, cwd=repo, timeout=60)
    if out.returncode != 0: raise RuntimeError(out.stderr[-600:])
    return json.loads(out.stdout), out.stderr


def post(body, headers=JSON_H, **kw):
    return dict(method='POST', headers=headers, body=body if isinstance(body, str) else json.dumps(body), **kw)


def count(conn, where='1=1', args=()): return conn.query(f'SELECT count(*) AS n FROM inquiries WHERE {where}', list(args))[0]['n']


servers = []
try:
    conn, FAKE, srv = make(); servers.append(srv); port = srv.server_address[1]

    # ---------- a good message
    (r,), _ = call([post(GOOD)], port)
    row = conn.query('SELECT * FROM inquiries')[0] if count(conn) else {}
    check('a valid message is answered {ok:true} with status 200', r['status'] == 200 and json.loads(r['body']) == {'ok': True}, r['body'])
    check('the message is stored with every field, and the website gets https://', count(conn) == 1 and row['name'] == 'Ana Test' and row['email'] == 'ana@example.com' and row['website'] == 'https://example.com' and row['inquiry_type'] == 'audit' and row['business_type'] == 'bakery' and row['location'] == 'Dhaka, Bangladesh' and row['message'] == 'Hello\nthere' and row['status'] == 'new', str(row))
    check('answers are never cached', r['cache'] == 'no-store')
    sent = [e for e in FAKE['log'] if e['body']['requests'][0].get('stmt')]
    check('exactly one statement is sent, an INSERT into inquiries, with the write token', len(sent) == 1 and sent[0]['body']['requests'][0]['stmt']['sql'].lstrip().upper().startswith('INSERT INTO INQUIRIES') and sent[0]['auth'] == 'Bearer write-token')

    # ---------- the no-JavaScript form post
    (r,), _ = call([post('inquiry_type=website&name=Bo&email=bo%40example.com&website=&business_type=&location=&message=Hi&_gotcha=', {'Content-Type': 'application/x-www-form-urlencoded'})], port)
    check('a plain form post is stored and sent on to /contact/thanks/', r['status'] == 303 and (r['location'] or '').endswith('/contact/thanks/') and count(conn, "email = 'bo@example.com'") == 1, str(r)[:200])
    (r,), _ = call([post('inquiry_type=audit&name=Bo&email=bo2%40example.com&website=', {'Content-Type': 'application/x-www-form-urlencoded'})], port)
    check('a plain form post with a mistake gets a readable page, not a false thank-you', r['status'] == 400 and 'text/html' in (r['type'] or '') and 'website address' in r['body'] and count(conn, "email = 'bo2@example.com'") == 0)

    # ---------- refused input stores nothing
    before = count(conn)
    cases = {
        'no name': dict(GOOD, name='  '), 'no email': dict(GOOD, email=''), 'bad email': dict(GOOD, email='not-an-email'),
        'audit without a website': dict(GOOD, website=''), 'website that is not an address': dict(GOOD, website='hello world'),
        'unknown type': dict(GOOD, inquiry_type='bogus'), 'no type': {k: v for k, v in GOOD.items() if k != 'inquiry_type'},
        'a message over 4000 characters': dict(GOOD, message='x' * 4001),
    }
    got, _ = call([post(c) for c in cases.values()], port)
    for (name, _c), g in zip(cases.items(), got):
        check(f'{name}: refused with 400 and field messages', g['status'] == 400 and json.loads(g['body']).get('ok') is False and bool(json.loads(g['body']).get('errors')), g['body'][:120])
    check('none of the refused messages was stored', count(conn) == before)
    (r,), _ = call([post(dict(GOOD, inquiry_type='fixes', website='', email='ok1@example.com'))], port)
    check('fixes and website requests do not need a website address', r['status'] == 200)
    (r,), _ = call([post(dict(GOOD, name='<b>x</b> \u0985\u09ae\u09bf', email='ok2@example.com', message='<script>alert(1)</script>'))], port)
    check('markup and Bengali text are stored as plain text, unchanged', r['status'] == 200 and conn.query("SELECT name, message FROM inquiries WHERE email = 'ok2@example.com'")[0] == {'name': '<b>x</b> \u0985\u09ae\u09bf', 'message': '<script>alert(1)</script>'})

    # ---------- spam trap, other sites, methods, sizes
    before = count(conn)
    (r,), _ = call([post(dict(GOOD, _gotcha='http://spam.example', email='bot@example.com'))], port)
    check('a filled trap field is answered ok but nothing is stored', r['status'] == 200 and json.loads(r['body']) == {'ok': True} and count(conn) == before)
    (r,), _ = call([post(dict(GOOD, email='evil@example.com'), {**JSON_H, 'Origin': 'https://evil.example'})], port)
    check('a post that comes from another website is refused', r['status'] == 403 and count(conn, "email = 'evil@example.com'") == 0)
    (r,), _ = call([post(dict(GOOD, email='same@example.com'), {**JSON_H, 'Origin': 'https://curiohatch.studio'})], port)
    check('a post from the site itself is accepted', r['status'] == 200)
    (r,), _ = call([post(dict(GOOD, email='cfg@example.com'), {**JSON_H, 'Origin': 'https://curiohatch.studio'})], port, extra={'SITE_ORIGIN': 'https://other.example'})
    check('SITE_ORIGIN, when set, decides which website may post', r['status'] == 403)
    (r,), _ = call([dict(method='GET', headers={})], port)
    check('GET is refused with 405', r['status'] == 405)
    (r,), _ = call([post('x', {'Content-Type': 'text/plain'})], port)
    check('an unexpected content type is refused with 415', r['status'] == 415)
    (r,), _ = call([post('{not json')], port)
    check('JSON that cannot be read is refused with 400', r['status'] == 400)
    (r,), _ = call([post(dict(GOOD, message='x' * 30000, email='big@example.com'))], port)
    check('a huge body is refused with 413', r['status'] == 413 and count(conn, "email = 'big@example.com'") == 0)

    # ---------- hourly limits
    (a, b, c, d), _ = call([post(dict(GOOD, email='Rep@Example.com', name=f'R{i}')) for i in range(4)], port)
    check('three messages per email address per hour are stored, the fourth is refused with 429', [a['status'], b['status'], c['status'], d['status']] == [200, 200, 200, 429], str([x['status'] for x in (a, b, c, d)]))
    check('the refused one was not stored, and addresses differing only in case count as one', count(conn, "email = 'rep@example.com'") == 3)
    conn.query("DELETE FROM inquiries")
    for i in range(40): conn.query("INSERT INTO inquiries (inquiry_type, name, email) VALUES ('fixes', 'N', ?)", [f'n{i}@example.com'])
    (r,), _ = call([post(dict(GOOD, email='late@example.com'))], port)
    check('after 40 messages in an hour the next, from a new address, is refused with 429', r['status'] == 429 and count(conn, "email = 'late@example.com'") == 0)
    conn.query("UPDATE inquiries SET created_at = '2020-01-01T00:00:00Z'")
    (r,), _ = call([post(dict(GOOD, email='late@example.com'))], port)
    check('messages older than an hour no longer count', r['status'] == 200)

    # ---------- the database misbehaves: never a false "sent"
    (r,), err = call([post(dict(GOOD, email='priv@example.com'))], port, token='wrong-token')
    check('a rejected token gives 503, not ok', r['status'] == 503 and json.loads(r['body']).get('ok') is False and count(conn, "email = 'priv@example.com'") == 0)
    check('the log line has no visitor details and no token', 'priv@example.com' not in err and 'Ana' not in err and 'wrong-token' not in err and 'wrong-token' not in r['body'] and 'inquiry: not stored' in err, err[:200])
    FAKE['fail_on'] = 'INSERT INTO inquiries'
    (r,), _ = call([post(dict(GOOD, email='fail@example.com'))], port)
    check('a statement the database refuses gives 503, not ok', r['status'] == 503 and json.loads(r['body']).get('ok') is False)
    FAKE['fail_on'] = None
    (r,), _ = call([post(dict(GOOD, email='down@example.com'))], 9)
    check('an unreachable database gives 503, not ok', r['status'] == 503 and json.loads(r['body']).get('ok') is False)
    (r,), err = call([post(dict(GOOD, email='unset@example.com'))], port, extra={'TURSO_WRITE_TOKEN': None})
    check('missing settings give 503 and say why in the log', r['status'] == 503 and 'TURSO_WRITE_TOKEN' in err)
    (r,), _ = call([post('inquiry_type=fixes&name=Zed&email=zed%40example.com', {'Content-Type': 'application/x-www-form-urlencoded'})], 9)
    check('a plain form post while the database is down gets an error page, not the thank-you redirect', r['status'] == 503 and r['location'] is None and 'not sent' in r['body'])

    # ---------- the database's own rules
    def refuses(sql, args=()):
        try: conn.query(sql, list(args)); return False
        except turso.DbError: return True
    base = "INSERT INTO inquiries (inquiry_type, name, email, website) VALUES (?, ?, ?, ?)"
    check('the database refuses an unknown type', refuses(base, ['bogus', 'N', 'a@b.co', '']))
    check('the database refuses an audit with no website', refuses(base, ['audit', 'N', 'a@b.co', '']))
    check('the database refuses an empty name', refuses(base, ['fixes', '', 'a@b.co', '']))
    check('the database refuses an email with no @ or dot', refuses(base, ['fixes', 'N', 'nobody', '']) and refuses(base, ['fixes', 'N', 'a@b', '']))
    check('the database refuses a status outside the list', refuses("UPDATE inquiries SET status = 'done'"))
    n = count(conn)
    store.replace_all({'topics': [], 'courses': [], 'projects': []})   # what `db.py import` does to the content tables
    check('importing the content into the database never touches the inquiries', n > 0 and count(conn) == n and 'inquiries' not in json.dumps(store.snapshot()))
finally:
    for s in servers:
        try: s.shutdown()
        except Exception: pass
    shutil.rmtree(tmp, ignore_errors=True)
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if res and all(res) else 1)
