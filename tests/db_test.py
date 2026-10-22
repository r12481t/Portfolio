"""Tests the database layer without touching Turso: the schema's own rules, the data layer's round trips, all-or-nothing writes,
the Turso HTTP client (against a small fake server that speaks the same protocol), the db.py tool, and the secret-file checks.
Usage: python tests/db_test.py        Needs only Python 3.8+. Everything runs in a temporary folder."""
import base64, copy, http.server, importlib.util, json, os, shutil, sqlite3, subprocess, sys, tempfile, threading, uuid

os.environ['CURIOHATCH_STORE'] = 'json'          # nothing here may be redirected to a real database
for k in ('TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'CURIOHATCH_DB'):
    os.environ.pop(k, None)
repo = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
tmp = tempfile.mkdtemp(prefix='curiohatch-db-')
sys.path.insert(0, os.path.join(repo, 'tools'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store, turso, fake_turso

res = []


def check(n, ok, d=''):
    res.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + n + (f'  [{d}]' if d else ''))


def local():
    path = os.path.join(tmp, f'{uuid.uuid4().hex[:8]}.db')
    conn = turso.open_database('file:' + path)
    store.migrate(conn)
    return conn


def use(conn):
    """Point the data layer at this connection."""
    store.reset()
    store._conn[('test', None)] = conn
    store.settings = lambda: ('test', None)


def refuses(conn, sql, args=()):
    try:
        conn.transaction([(sql, list(args))])
        return False
    except turso.DbError:
        return True


# ---------------------------------------------------------------- fixtures
ARTICLE = '\n<h2>Why</h2><p>Words.</p>\n'
TOPICS = [
    {'id': 't001', 'slug': 'what-is-a-variable', 'status': 'published', 'title': 'What is a variable', 'summary': 'A named box for a value.', 'category': 'JavaScript basics',
     'subtopics': ['naming'], 'tags': ['variables', 'basics'], 'concepts': ['let', 'const'], 'videoId': 'dQw4w9WgXcQ', 'publishedAt': '2026-10-01', 'updatedAt': '2026-10-05',
     'prerequisites': ['t002'], 'related': ['t002'], 'courses': ['c001']},
    {'id': 't002', 'slug': 'what-is-a-function', 'status': 'drafted', 'title': 'What is a function', 'summary': '', 'category': '', 'subtopics': [], 'tags': [], 'concepts': [],
     'videoId': '', 'publishedAt': '', 'updatedAt': '', 'prerequisites': [], 'related': [], 'courses': ['c001']},
    {'id': 't003', 'slug': 'planned-one', 'status': 'planned', 'title': 'Planned one', 'summary': '', 'category': '', 'subtopics': [], 'tags': [], 'concepts': [],
     'videoId': '', 'publishedAt': '', 'updatedAt': '', 'prerequisites': [], 'related': [], 'courses': ['c002']},   # c002 does not list it: the import must merge the two sides
]
COURSES = [
    {'id': 'c001', 'status': 'available', 'title': 'JavaScript from zero', 'summary': 'Start here.', 'category': 'JavaScript', 'level': 'Beginner', 'url': 'https://example.com/c', 'lessons': ['t002', 't001']},
    {'id': 'c002', 'status': 'planned', 'title': 'Web basics', 'summary': 'Later.'},
]
PROJECTS = [
    {'id': 'p001', 'slug': 'classly', 'status': 'published', 'group': 'projects', 'page': 'existing', 'featured': True, 'order': 10, 'tag': 'Software', 'title': 'Classly',
     'summary': 'A demo.', 'builtBy': 'Two of us', 'builtWith': 'HTML', 'outcome': 'No sale.', 'shows': '', 'links': [{'label': 'Demo', 'href': 'projects/classley/classley.html'}]},
    {'id': 'p002', 'slug': 'cafe-site', 'status': 'draft', 'group': 'projects', 'page': 'generated', 'featured': False, 'order': 100, 'tag': 'Website', 'title': 'Cafe site',
     'summary': 'A cafe.', 'builtBy': '', 'builtWith': '', 'outcome': '', 'shows': '', 'links': [], 'look': 'orbit', 'built': 'Pages.', 'role': 'Everything.', 'whatHappened': 'It shipped.',
     'learned': ['Ask early', 'Keep it small'], 'images': [{'src': 'img/a.webp', 'alt': 'A photo', 'caption': 'Front', 'width': 800, 'height': 600}]},
]
PRICING = json.load(open(os.path.join(repo, 'content', 'pricing.json'), encoding='utf-8'))
SNAP = {'topics': TOPICS, 'courses': COURSES, 'projects': PROJECTS, 'pricing': PRICING, 'articles': {'what-is-a-variable': ARTICLE}}


def load_snapshot(conn):
    use(conn)
    store.replace_all(copy.deepcopy(SNAP))
    return conn


try:
    # ---------- schema and its own rules
    conn = local()
    names = {r['name'] for r in conn.query("SELECT name FROM sqlite_master WHERE type = 'table'")}
    check('the schema creates every table', {'lessons', 'courses', 'course_lessons', 'projects', 'packages', 'pricing_settings', 'lesson_links', 'project_images'} <= names)
    check('applying migrations again changes nothing', store.migrate(conn) == [] and store.schema_ready(conn))
    stmts = turso.split_statements(open(os.path.join(repo, 'db', 'migrations', '001_init.sql'), encoding='utf-8').read())
    check('the SQL splitter keeps a trigger in one piece', any(s.startswith('CREATE TRIGGER') and s.rstrip().endswith('END;') for s in stmts) and all(s.rstrip().endswith(';') for s in stmts))
    base = "INSERT INTO lessons (id, slug, status, title, summary, video_id, published_at, article_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ok_row = ['t001', 'a-lesson', 'published', 'T', 'S', 'dQw4w9WgXcQ', '2026-10-01', '<p>x</p>']
    check('a complete published lesson is accepted', not refuses(conn, base, ok_row))
    conn = local()
    check('a published lesson with no video is refused', refuses(conn, base, ['t001', 'a-lesson', 'published', 'T', 'S', '', '2026-10-01', '<p>x</p>']))
    check('a published lesson with no article is refused', refuses(conn, base, ['t001', 'a-lesson', 'published', 'T', 'S', 'dQw4w9WgXcQ', '2026-10-01', '']))
    check('a lesson status outside the list is refused', refuses(conn, base, ['t001', 'a-lesson', 'live', 'T', 'S', '', '', '']))
    for bad in ('Has Capitals', 'double--hyphen', '-leading', 'trailing-', 'has space', 'ünïcode'):
        check(f'the address "{bad}" is refused', refuses(conn, base, ['t001', bad, 'drafted', 'T', '', '', '', '']))
    check('a video id of the wrong length is refused', refuses(conn, base, ['t001', 'ok', 'drafted', 'T', '', 'short', '', '']))
    check('a date that is not YYYY-MM-DD is refused', refuses(conn, base, ['t001', 'ok', 'drafted', 'T', '', '', '1 Oct 2026', '']))
    conn.transaction([(base, ['t001', 'first', 'drafted', 'T', '', '', '', ''])])
    check('a lesson address cannot be changed afterwards', refuses(conn, "UPDATE lessons SET slug = 'second' WHERE id = 't001'"))
    check('two lessons cannot share an address', refuses(conn, base, ['t002', 'first', 'drafted', 'T', '', '', '', '']))
    check('a link to a lesson that does not exist is refused', refuses(conn, "INSERT INTO lesson_links (lesson_id, kind, position, target_id) VALUES ('t001', 'related', 0, 't999')"))
    check('a lesson cannot link to itself', refuses(conn, "INSERT INTO lesson_links (lesson_id, kind, position, target_id) VALUES ('t001', 'related', 0, 't001')"))
    check('a tag must be lowercase', refuses(conn, "INSERT INTO lesson_tags (lesson_id, position, tag) VALUES ('t001', 0, 'Loud')"))
    check('an available course needs an address', refuses(conn, "INSERT INTO courses (id, status, title, summary) VALUES ('c001', 'available', 'T', 'S')"))
    check('a first-three-client price must be below the normal price', refuses(conn, "INSERT INTO packages (id, position, name, price_type, price, intro_price, summary, cta_label, cta_href) VALUES ('x', 0, 'N', 'package', 100, 150, 'S', 'L', '/h')"))
    conn.transaction([("INSERT INTO lesson_tags (lesson_id, position, tag) VALUES ('t001', 0, 'a')", [])])
    conn.transaction([("DELETE FROM lessons WHERE id = 't001'", [])])
    check('deleting a lesson removes its list rows', conn.query('SELECT count(*) AS n FROM lesson_tags')[0]['n'] == 0)

    # ---------- round trips through the data layer
    conn = load_snapshot(local())
    t = store.load('topics')
    check('lessons come back with their tags, concepts, links and courses', t[0]['tags'] == ['variables', 'basics'] and t[0]['concepts'] == ['let', 'const'] and t[0]['prerequisites'] == ['t002'] and t[0]['courses'] == ['c001'])
    check('a lesson that only one side listed is merged into its course on import', t[2]['courses'] == ['c002'] and store.load('courses')[1]['lessons'] == ['t003'])
    check('course lesson order is kept', store.load('courses')[0]['lessons'] == ['t002', 't001'])
    check('empty course fields stay out, as in the JSON files', 'category' not in store.load('courses')[1] and 'lessons' in store.load('courses')[1])
    p = store.load('projects')
    check('projects keep links, images and lists, and existing pages carry no generated-page fields', p[1]['images'][0]['width'] == 800 and p[1]['learned'] == ['Ask early', 'Keep it small'] and p[0]['featured'] is True and 'look' not in p[0] and p[1]['look'] == 'orbit')
    check('pricing round-trips exactly, key order included', json.dumps(store.load('pricing')) == json.dumps(PRICING))
    check('an article comes back byte for byte', store.get_article('what-is-a-variable') == ARTICLE and store.get_article('what-is-a-function') == '')
    snap = store.snapshot()
    check('a snapshot restores into another database with the same content', json.dumps(snap, sort_keys=True) == json.dumps(
        (lambda c: (use(c), store.replace_all(snap), store.snapshot())[2])(local()), sort_keys=True))

    # ---------- writes: only what changed, all or nothing
    conn = load_snapshot(local())
    seen = []
    real = conn.transaction
    conn.transaction = lambda s: (seen.append(list(s)), real(s))[1]
    store.save('topics', store.load('topics'))
    check('saving nothing new writes nothing', seen == [])
    edited = store.load('topics'); edited[1]['title'] = 'What is a function, really'
    store.save('topics', edited)
    texts = ' '.join(str(a) for stmt in seen[0] for a in stmt[1])
    check('editing one lesson writes only that lesson', len(seen) == 1 and 't002' in texts and 't001' not in texts and 't003' not in texts, texts[:80])
    check('the edit is in the database', store.load('topics')[1]['title'] == 'What is a function, really')
    conn.transaction = real
    before = json.dumps(store.snapshot(), sort_keys=True)
    broken = store.load('topics'); broken[0]['title'] = 'Changed'; broken[2]['slug'] = 'Bad Slug'
    try:
        store.save('topics', broken); raised = False
    except store.StoreError:
        raised = True
    check('a save with one bad record is refused and changes nothing at all', raised and json.dumps(store.snapshot(), sort_keys=True) == before)
    new = store.load('topics') + [{'id': 't004', 'slug': 'brand-new', 'status': 'published', 'title': 'New', 'summary': 'S', 'videoId': 'dQw4w9WgXcQ', 'publishedAt': '2026-10-02', 'courses': []}]
    try:
        store.save('topics', new); raised = False
    except store.StoreError:
        raised = True
    check('publishing a lesson with no article is refused', raised and len(store.load('topics')) == 3)
    store.save('topics', new, articles={'brand-new': '\n<p>Hello</p>\n'})
    check('a lesson and its article can be saved in one go', len(store.load('topics')) == 4 and store.get_article('brand-new') == '\n<p>Hello</p>\n')
    store.set_article('brand-new', '\n<p>Hello again</p>\n')
    check('an article can be replaced', store.get_article('brand-new') == '\n<p>Hello again</p>\n')
    try:
        store.set_article('nope', 'x'); raised = False
    except store.StoreError:
        raised = True
    check('replacing the article of a lesson that does not exist is refused', raised)
    cs = store.load('courses'); cs[1]['lessons'] = ['t003', 't004']
    store.save('courses', cs)
    check('a course can be given lessons, and the lessons see it', store.load('courses')[1]['lessons'] == ['t003', 't004'] and store.load('topics')[3]['courses'] == ['c002'])
    ts = store.load('topics'); ts[3]['courses'] = []
    store.save('topics', ts)
    check('removing a course from a lesson removes the lesson from the course', store.load('courses')[1]['lessons'] == ['t003'])
    ts = [x for x in store.load('topics') if x['id'] != 't004']
    store.save('topics', ts)
    check('removing a lesson deletes it, its links and its place in courses', len(store.load('topics')) == 3 and 't004' not in str(store.load('courses')))
    pr = store.load('pricing'); pr['introOffer']['active'] = False; pr['packages'][1]['introPrice'] = None
    store.save('pricing', pr)
    check('pricing changes are saved', store.load('pricing')['introOffer']['active'] is False and store.load('pricing')['packages'][1]['introPrice'] is None)
    pj = store.load('projects'); pj[1]['images'].append({'src': 'img/b.webp', 'alt': 'Another', 'caption': '', 'width': 10, 'height': 10}); pj[1]['title'] = 'Cafe site v2'
    store.save('projects', pj)
    check('project changes (including images) are saved', len(store.load('projects')[1]['images']) == 2 and store.load('projects')[1]['title'] == 'Cafe site v2')

    # ---------- configuration
    spec = importlib.util.spec_from_file_location('store_cfg', os.path.join(repo, 'tools', 'store.py'))
    cfg = importlib.util.module_from_spec(spec); spec.loader.exec_module(cfg)
    root = os.path.join(tmp, 'cfgroot'); os.makedirs(root); cfg.ROOT = root
    open(os.path.join(root, '.env.local'), 'w').write('# comment\nTURSO_DATABASE_URL="libsql://x-y.turso.io"\nTURSO_AUTH_TOKEN=abc\n')
    for k in ('CURIOHATCH_STORE', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'CURIOHATCH_DB'):
        os.environ.pop(k, None)
    check('.env.local is read, quotes removed', cfg.settings() == ('libsql://x-y.turso.io', 'abc'))
    os.environ['TURSO_AUTH_TOKEN'] = 'from-env'
    check('a value already in the environment wins over .env.local', cfg.settings()[1] == 'from-env')
    os.environ['CURIOHATCH_DB'] = 'content/dev.db'
    check('a local practice database wins over Turso and is placed inside the repo folder', cfg.settings()[0] == 'file:' + os.path.join(root, 'content', 'dev.db') and cfg.settings()[1] is None)
    os.environ['CURIOHATCH_STORE'] = 'json'
    check('CURIOHATCH_STORE=json switches the database off', cfg.settings() is None and not cfg.active())
    for k in ('TURSO_AUTH_TOKEN', 'CURIOHATCH_DB'):
        os.environ.pop(k, None)

    # ---------- the Turso client, against a fake server that speaks its protocol
    FAKE = {'token': 'secret-test-token', 'path': os.path.join(tmp, 'remote.db'), 'log': [], 'sessions': {}, 'fail_on': None}
    srv = fake_turso.serve(FAKE)
    url = f'http://127.0.0.1:{srv.server_address[1]}'
    remote = turso.Remote(url, FAKE['token'])
    check('the client sends the token only in the Authorization header', remote.query('SELECT 1 AS n') == [{'n': 1}] and FAKE['log'][-1]['auth'] == 'Bearer ' + FAKE['token'] and FAKE['token'] not in json.dumps(FAKE['log'][-1]['body']))
    check('requests go to the /v2/pipeline endpoint and end with a close', FAKE['log'][-1]['path'] == '/v2/pipeline' and FAKE['log'][-1]['body']['requests'][-1] == {'type': 'close'})
    rows = remote.query('SELECT ? AS i, ? AS f, ? AS t, ? AS n, ? AS b, ? AS z', [7, 1.5, 'héllo', None, b'\x00\xff', True])
    check('integers, floats, text, null, blobs and booleans all survive the trip', rows == [{'i': 7, 'f': 1.5, 't': 'héllo', 'n': None, 'b': b'\x00\xff', 'z': 1}], str(rows))
    n = len(FAKE['log']); many = remote.query_many([('SELECT 1 AS a', []), ('SELECT 2 AS b', [])])
    check('several reads take one round trip', many == [[{'a': 1}], [{'b': 2}]] and len(FAKE['log']) == n + 1)
    remote.script('CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1);')
    check('a migration script runs as one transaction', remote.query('SELECT a FROM t') == [{'a': 1}])
    n = len(FAKE['log']); remote.transaction([('INSERT INTO t VALUES (?)', [2]), ('INSERT INTO t VALUES (?)', [3])])
    sent = [json.dumps(e['body']) for e in FAKE['log'][n:]]
    check('a transaction sends BEGIN first and COMMIT only at the end, on the same stream', len(sent) == 2 and '"BEGIN"' in sent[0] and '"COMMIT"' not in sent[0] and '"COMMIT"' in sent[1] and FAKE['log'][n + 1]['body'].get('baton'))
    check('the committed rows are there', [r['a'] for r in remote.query('SELECT a FROM t ORDER BY a')] == [1, 2, 3])
    n = len(FAKE['log']); FAKE['fail_on'] = '(?)'
    try:
        remote.transaction([('INSERT INTO t VALUES (?)', [4]), ('INSERT INTO t VALUES (?)', [5])]); err = None
    except turso.DbError as e:
        err = str(e)
    FAKE['fail_on'] = None
    sent = ' '.join(json.dumps(e['body']) for e in FAKE['log'][n:])
    check('when a statement fails, ROLLBACK is sent, never COMMIT, and nothing is saved', err is not None and '"ROLLBACK"' in sent and '"COMMIT"' not in sent and [r['a'] for r in remote.query('SELECT a FROM t ORDER BY a')] == [1, 2, 3], str(err))
    bad = turso.Remote(url, 'wrong-token')
    try:
        bad.query('SELECT 1'); msg = ''
    except turso.DbError as e:
        msg = str(e)
    check('a refused token gives a plain message that does not contain the token', 'refused the token' in msg and 'wrong-token' not in msg)
    check('libsql:// addresses become https://', turso.Remote('libsql://my-db-org.turso.io', 'x').base == 'https://my-db-org.turso.io')
    for label, args in (('plain http to a real host', ('http://example.com', 'x')), ('a missing token', ('https://my-db-org.turso.io', '')), ('a nonsense address', ('not a url', 'x'))):
        try:
            turso.Remote(*args); refused = False
        except turso.DbError:
            refused = True
        check(f'the client refuses {label}', refused)
    try:
        turso.Remote('http://127.0.0.1:1', 'x', timeout=1).query('SELECT 1'); msg = ''
    except turso.DbError as e:
        msg = str(e)
    check('an unreachable database gives a plain message', 'Could not reach' in msg)
    # the whole data layer over the wire
    FAKE['path'] = os.path.join(tmp, 'remote2.db')
    store.reset(); store._conn[('test', None)] = turso.Remote(url, FAKE['token']); store.settings = lambda: ('test', None)
    check('the tables can be created over the wire', store.migrate() == ['001_init'] and store.schema_ready())
    store.replace_all(copy.deepcopy(SNAP))
    over = json.dumps(store.snapshot(), sort_keys=True)
    same = load_snapshot(local()) and json.dumps(store.snapshot(), sort_keys=True)
    check('a full import over the wire gives exactly what a local import gives', over == same)
    check('no request ever carried the token anywhere but the header', all(FAKE['token'] not in json.dumps(e['body']) for e in FAKE['log']))

    # ---------- db.py and the site tools, in a temporary copy
    site = os.path.join(tmp, 'site')
    shutil.copytree(repo, site, ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__', '.admin-backups', '.env.local', '*.db', '.db-backups'))
    env = dict(os.environ); env.pop('CURIOHATCH_STORE', None); env['CURIOHATCH_DB'] = 'file:content/test.db'
    def run(*a, e=env): return subprocess.run([sys.executable, os.path.join(site, 'tools', *a[0].split('/'))] + list(a[1:]), capture_output=True, text=True, cwd=site, env=e)
    off = dict(os.environ); off['CURIOHATCH_STORE'] = 'json'
    check('with the database off, status says so', 'OFF' in run('db.py', 'status', e=off).stdout)
    r = run('site.py', 'sync')
    check('switching the database on before importing is refused, so no page is blanked', r.returncode != 0 and 'db.py init' in (r.stdout + r.stderr))
    run('db.py', 'init')
    r = run('site.py', 'sync')
    check('an empty database with content files is refused too', r.returncode != 0 and 'db.py import' in (r.stdout + r.stderr))
    r = run('db.py', 'import')
    check('import copies the files in', r.returncode == 0 and 'Imported' in r.stdout, (r.stdout + r.stderr)[-200:])
    r = run('db.py', 'import')
    check('importing over existing content needs --yes', r.returncode != 0 and '--yes' in (r.stdout + r.stderr))
    check('with --yes it goes ahead', run('db.py', 'import', '--yes').returncode == 0)
    before = {rel: open(os.path.join(site, rel), 'rb').read() for rel in ('index.html', 'services/index.html', 'work/index.html', 'content/pricing.json', 'content/projects.json', 'sitemap.xml')}
    r = run('db.py', 'export')
    after = {rel: open(os.path.join(site, rel), 'rb').read() for rel in before}
    check('export rebuilds every page and file byte for byte from the database', r.returncode == 0 and before == after, (r.stdout + r.stderr)[-200:])
    r = run('site.py', 'check')
    check('the site check passes when built from the database', 'problem(s)' in r.stdout and ' 0 problem' in r.stdout, r.stdout[-200:])
    r = run('db.py', 'check')
    check('db check finds the database and the files in agreement', '0 problem(s)' in r.stdout and 'PROBLEM' not in r.stdout and 'differ' not in r.stdout, r.stdout[-300:])
    pj = json.load(open(os.path.join(site, 'content/projects.json'), encoding='utf-8')); pj['projects'][0]['title'] = 'Edited by hand'
    json.dump(pj, open(os.path.join(site, 'content/projects.json'), 'w', encoding='utf-8'))
    check('db check warns when a file was edited by hand', 'differ' in run('db.py', 'check').stdout)
    check('a backup file is written and kept out of git', run('db.py', 'backup').returncode == 0 and any(f.endswith('.json') for f in os.listdir(os.path.join(site, '.db-backups'))))
    fake_token = 'eyJ' + 'a' * 30 + '.' + 'b' * 30 + '.' + 'c' * 20
    open(os.path.join(site, 'docs', 'notes.md'), 'w').write('token ' + fake_token)
    r = run('db.py', 'check')
    check('db check finds a token pasted into a file that would be published', r.returncode != 0 and 'docs/notes.md' in r.stdout and fake_token not in r.stdout)
    os.remove(os.path.join(site, 'docs', 'notes.md'))
    gi = open(os.path.join(repo, '.gitignore'), encoding='utf-8').read()
    check('.gitignore keeps .env.local, database files and backups out of the repository', all(x in gi for x in ('.env.local', '*.db', '.db-backups/')))
    check('.env.example holds placeholders only', 'eyJ' not in open(os.path.join(repo, '.env.example'), encoding='utf-8').read())
finally:
    try:
        srv.shutdown()
    except Exception:
        pass
    shutil.rmtree(tmp, ignore_errors=True)
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if res and all(res) else 1)
