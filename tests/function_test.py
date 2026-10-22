"""Tests the live Learn function (netlify/functions) against the real thing it must match: the Python page renderer.
The same lessons are rendered both ways and the two must be identical byte for byte (lesson pages, the library list, the
sitemap). Also: drafts are never served, bad addresses never reach the database, only SELECTs are sent and only with the read
token, a database outage gives a plain 503 that is never cached, and the cache headers are right.
Nothing here touches a real database or Netlify. Needs Node 18+ (skipped with a note if it is missing).
Usage: python tests/function_test.py"""
import functools, http.server, importlib.util, json, os, shutil, socketserver, subprocess, sys, tempfile, threading

os.environ['CURIOHATCH_STORE'] = 'json'
for k in ('TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'CURIOHATCH_DB', 'TURSO_READ_TOKEN'):
    os.environ.pop(k, None)
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.dirname(here)
sys.path.insert(0, here); sys.path.insert(0, os.path.join(repo, 'tools'))
res = []


def check(n, ok, d=''):
    res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f'  [{d}]' if d else ''))


try:
    node = subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()
    if int(node.lstrip('v').split('.')[0]) < 18:
        raise ValueError
except Exception:
    print('SKIPPED: Node 18 or newer was not found, so the live function was not tested. Install Node (nodejs.org) to run this.')
    sys.exit(0)

import store, turso, fake_turso
spec = importlib.util.spec_from_file_location('curiohatch_site', os.path.join(repo, 'tools', 'site.py'))
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
tmp = tempfile.mkdtemp(prefix='curiohatch-fn-')

ART1 = '\n<h2>Why it matters</h2>\n<p>Tom &amp; Jerry say "hello" &lt;b&gt; \u2014 and \u0985\u09ae\u09bf, caf\u00e9, na\u00efve.</p>\n<pre><code>if (a &lt; b) { x = 1; }</code></pre>\n'
ART2 = '\n<p>Plain.</p>\n'


def lesson(i, slug, status, title, **kw):
    base = {'id': f't{i:03d}', 'slug': slug, 'status': status, 'title': title, 'summary': kw.pop('summary', 'A summary.'), 'category': kw.pop('category', ''),
            'subtopics': [], 'tags': [], 'concepts': [], 'videoId': '', 'publishedAt': '', 'updatedAt': '', 'prerequisites': [], 'related': [], 'courses': []}
    base.update(kw)
    return base


TOPICS = [
    lesson(1, 'what-is-a-variable', 'published', 'What is a "variable" & why <it> matters?', summary='A named box. It\'s <small> & "quoted" with a </script> inside.', category='JavaScript basics',
           subtopics=['naming', 'scope'], tags=['variables', 'basics'], concepts=['let & const', 'a <b>box</b>', 'caf\u00e9 \u2014 na\u00efve'], videoId='dQw4w9WgXcQ',
           publishedAt='2026-10-01', updatedAt='2026-10-09', prerequisites=['t002'], related=['t002', 't003'], courses=['c001', 'c002']),
    lesson(2, 'loops-in-plain-words', 'published', 'Loops in plain words', category='JavaScript basics', videoId='9bZkp7q19f0', publishedAt='2026-10-01', updatedAt='2026-10-01', tags=['loops']),
    lesson(3, 'a-draft-lesson', 'drafted', 'A draft that must never be served', summary='Secret draft.', videoId='aaaaaaaaaaa', publishedAt='2026-10-03'),
    lesson(4, 'css-flexbox-basics', 'published', 'CSS flexbox basics', summary='Rows and columns.', category='CSS', videoId='bbbbbbbbbbb', publishedAt='2026-09-15',
           related=['t003', 't005'], prerequisites=['t003'], concepts=[]),
    lesson(5, 'old-archived', 'archived', 'Archived lesson', summary='Old.', videoId='ccccccccccc', publishedAt='2026-01-01'),
    lesson(6, 'zeta-no-category', 'published', 'Zeta lesson without a category', summary='No category here.', videoId='ddddddddddd', publishedAt='2026-10-09'),
]
COURSES = [
    {'id': 'c001', 'status': 'available', 'title': 'JavaScript from zero', 'summary': 'Start.', 'url': 'https://example.com/js?a=1&b=2', 'category': 'JavaScript', 'level': 'Beginner', 'lessons': ['t001']},
    {'id': 'c002', 'status': 'planned', 'title': 'Not open yet', 'summary': 'Later.', 'lessons': ['t001']},
    {'id': 'c003', 'status': 'upcoming', 'title': 'Web basics & "more"', 'summary': 'Coming <soon>.', 'audience': 'Absolute beginners', 'level': 'Beginner', 'duration': '6 weeks', 'prerequisites': 'None at all'},
    {'id': 'c004', 'status': 'archived', 'title': 'An old course', 'summary': 'Gone.'},
]


def proj(i, slug, status, title, **kw):
    base = {'id': f'p{i:03d}', 'slug': slug, 'status': status, 'group': 'projects', 'page': 'existing', 'featured': False, 'order': 100, 'tag': 'Website', 'title': title, 'summary': 'A summary & more.',
            'builtBy': '', 'builtWith': '', 'outcome': '', 'shows': '', 'links': []}
    base.update(kw)
    return base


GEN = dict(page='generated', look='field', built='', role='', whatHappened='', learned=[], images=[])
PROJECTS = [
    proj(1, 'classly', 'published', 'Classly "demo"', featured=True, order=10, tag='Software', builtBy='Two of us', builtWith='HTML & JS', outcome='No sale <yet>.', shows='It shows a working app.\nSecond line.',
         links=[{'label': 'Open the demo', 'href': 'projects/classley/classley.html'}, {'label': 'Elsewhere', 'href': 'https://example.com/?a=1&b=2'}, {'label': 'Mail', 'href': 'mailto:a@example.com'}, {'label': 'Top', 'href': '#top'}]),
    proj(2, 'cafe-site', 'published', 'Cafe site', featured=True, order=20, tag='Website', builtBy='Me', builtWith='HTML', outcome='Shipped.', **dict(GEN, look='path', built='First paragraph.\n\nSecond one,\n  continued on a new line.\n\n\n   \nThird.', role='All of it.',
         whatHappened='It went live.', learned=['Ask early', 'Keep it <small>'], images=[{'src': 'img/a.webp', 'alt': 'A "photo"', 'caption': 'Front & side', 'width': 800, 'height': 600}, {'src': 'img/b.webp', 'alt': 'Another', 'caption': '', 'width': 0, 'height': 0}],
         links=[{'label': 'Live site', 'href': 'https://example.com'}, {'label': 'Local', 'href': 'contact/'}])),
    proj(3, 'sample-template', 'published', 'Sample template', group='templates', order=5, tag='Template', builtWith='HTML', links=[{'label': 'Open it', 'href': 'projects/templates/landing-page.html'}]),
    proj(4, 'unpublished-one', 'draft', 'Draft case study', featured=True, order=1, **GEN),
    proj(5, 'archived-one', 'archived', 'Archived case study', featured=True, order=1, **GEN),
    proj(6, 'same-title-a', 'published', 'Same title', featured=True, order=10, tag='Tie'),
    proj(7, 'same-title-b', 'published', 'Same title', featured=True, order=10, tag='Tie'),
    proj(8, 'fourth-featured', 'published', 'Aardvark (a fourth featured one)', featured=True, order=10, tag='Extra', builtBy='Someone'),
    proj(9, 'no-links', 'published', 'No links at all', order=300, tag='Plain', shows='Only text.'),
]
SNAP = {'topics': TOPICS, 'courses': COURSES, 'projects': PROJECTS, 'pricing': json.load(open(os.path.join(repo, 'content', 'pricing.json'), encoding='utf-8')),
        'articles': {'what-is-a-variable': ART1, 'loops-in-plain-words': ART2, 'css-flexbox-basics': ART2, 'zeta-no-category': ART2, 'old-archived': ART2, 'a-draft-lesson': ART2}}


def make_db(name, snapshot):
    conn = turso.open_database('file:' + os.path.join(tmp, name))
    store.reset(); store.settings = lambda: ('t', None); store._conn[('t', None)] = conn
    store.migrate(conn); store.replace_all(snapshot)
    return conn


def run_node(origin, queries, env):
    out = subprocess.run(['node', os.path.join(here, 'function_harness.mjs'), origin] + queries, capture_output=True, text=True, env=env, cwd=repo, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(out.stderr[-600:])
    return json.loads(out.stdout)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


try:
    # the site's own static pages (the function reads its frame from them), served the way Netlify serves them
    socketserver.TCPServer.allow_reuse_address = True
    static = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=repo))
    threading.Thread(target=static.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{static.server_address[1]}'

    db_path = os.path.join(tmp, 'live.db'); conn = make_db('live.db', SNAP)
    FAKE = {'token': 'read-token', 'path': conn.path, 'log': [], 'sessions': {}, 'fail_on': None}
    fake = fake_turso.serve(FAKE)
    env = dict(os.environ, TURSO_DATABASE_URL=f'http://127.0.0.1:{fake.server_address[1]}', TURSO_READ_TOKEN='read-token')
    env.pop('SITE_ORIGIN', None)
    topics, courses = store.load('topics'), store.load('courses')

    slugs = [t['slug'] for t in TOPICS if t['status'] == 'published']
    queries = [f'view=lesson&slug={s}' for s in slugs] + ['view=index', 'view=sitemap']
    got = {r['query']: r for r in run_node(origin, queries, env)}

    # ---------- lesson pages: identical to the Python renderer
    for t in topics:
        if t['status'] != 'published':
            continue
        r = got[f'view=lesson&slug={t["slug"]}']
        want = sc.render_topic(t, topics, courses, store.get_article(t['slug']), absolute=True)
        same = r['body'] == want
        if not same:
            import difflib
            d = next(difflib.unified_diff(want.splitlines(), r['body'].splitlines(), 'python', 'node', lineterm='', n=0), '')
            first = [l for l in difflib.unified_diff(want.splitlines(), r['body'].splitlines(), 'python', 'node', lineterm='', n=0) if l[:1] in '+-' and l[:3] not in ('+++', '---')][:2]
        check(f'the live page for "{t["slug"]}" is identical to the Python page, byte for byte', r['status'] == 200 and same, '' if same else str(first)[:300])
    html = got['view=lesson&slug=what-is-a-variable']['body']
    check('text with quotes, ampersands, tags and non-English letters is escaped the same way', '&lt;it&gt;' in html and '&amp;' in html and '&#x27;' in html and '\u0985\u09ae\u09bf' in html and '<\\/script>' in html)
    check('only published, available things are linked (a draft prerequisite and an unopened course are left out)', 'a-draft-lesson' not in html and 'Not open yet' not in html and 'JavaScript from zero' in html)
    check('the sidebar links start from the site root, so they work at any address', 'href="/learn/loops-in-plain-words/"' in html and 'href="/courses/"' in html and 'href="../' not in html)

    # ---------- library and sitemap
    shell = open(os.path.join(repo, 'learn', 'index.html'), encoding='utf-8').read()
    want_index = sc.replace_between(shell, 'TOPICS', sc.render_library(topics))
    check('the live library page is identical to the Python one (order, filters data, dates)', got['view=index']['body'] == want_index and got['view=index']['status'] == 200)
    check('the library lists published lessons only, newest first', got['view=index']['body'].index('Zeta lesson') < got['view=index']['body'].index('Loops in plain words') < got['view=index']['body'].index('CSS flexbox basics') and 'Secret draft' not in got['view=index']['body'] and 'Archived lesson' not in got['view=index']['body'])
    check('the live sitemap is identical to the Python one', got['view=sitemap']['body'] == sc.render_sitemap(topics) and got['view=sitemap']['headers']['content-type'].startswith('application/xml'))
    check('the sitemap holds published lessons and published generated projects, never drafts', 'learn/what-is-a-variable/' in got['view=sitemap']['body'] and 'cafe-site' in got['view=sitemap']['body'] and 'a-draft-lesson' not in got['view=sitemap']['body'] and 'unpublished-one' not in got['view=sitemap']['body'])

    # ---------- caching and security headers
    h = got['view=lesson&slug=what-is-a-variable']['headers']
    check('good pages are shared at the edge for 5 minutes and may be served stale while refreshing', 's-maxage=300' in h['netlify-cdn-cache-control'] and 'stale-while-revalidate' in h['netlify-cdn-cache-control'] and h['cache-control'] == 'public, max-age=0, must-revalidate')
    check('security headers are set', h.get('x-content-type-options') == 'nosniff' and 'referrer-policy' in h)

    # ---------- what must NOT be served, and what must not reach the database
    before = len(FAKE['log'])
    bad = ['view=lesson&slug=a-draft-lesson', 'view=lesson&slug=old-archived', 'view=lesson&slug=no-such-lesson', 'view=lesson&slug=Bad_Slug', 'view=lesson&slug=..%2F..%2Fetc', 'view=lesson&slug=' + 'a' * 90, 'view=lesson&slug=', 'view=nonsense', 'view=lesson&slug=x%27%3B%20DROP%20TABLE%20lessons%3B--']
    out = run_node(origin, bad, env)
    check('a draft, an archived lesson and an unknown address are 404, never cached', all(o['status'] == 404 and o['headers']['netlify-cdn-cache-control'] == 'no-store' for o in out[:3]))
    check('the 404 is the site\'s own 404 page', all('Skip to content' in o['body'] or 'Not found' in o['body'] for o in out[:3]) and 'Secret draft' not in out[0]['body'])
    check('bad addresses (capitals, dots, slashes, too long, empty, SQL text) are refused', all(o['status'] == 404 for o in out[3:]))
    asked = [e for e in FAKE['log'][before:]]
    sent = [r['stmt']['sql'] for e in asked for r in e['body'].get('requests', []) if r.get('type') == 'execute']
    check('invalid addresses never reach the database (only the 3 valid-looking ones asked it)', len(asked) == 3, f'{len(asked)} requests')
    check('a draft is excluded by the query itself, not just hidden', all("status = 'published'" in s for s in sent if 'FROM lessons WHERE slug' in s))
    allsql = [r['stmt']['sql'] for e in FAKE['log'] for r in e['body'].get('requests', []) if r.get('type') == 'execute']
    check('the function only ever sends SELECT statements', allsql and all(s.lstrip().upper().startswith('SELECT') for s in allsql))
    check('every request carries the read token in the Authorization header and nowhere else', all(e['auth'] == 'Bearer read-token' for e in FAKE['log']) and all('read-token' not in json.dumps(e['body']) for e in FAKE['log']))
    r = run_node(origin, ['POST:view=index'], env)[0]
    check('anything but GET or HEAD is refused', r['status'] == 405)

    # ---------- every other live page: identical to what the Python generator writes
    expected = sc._expected_files()
    gen_slugs = [x['slug'] for x in PROJECTS if x['page'] == 'generated' and x['status'] == 'published']
    q2 = ['view=home', 'view=services', 'view=work', 'view=courses'] + [f'view=project&slug={x}' for x in gen_slugs]
    got2 = {r['query']: r for r in run_node(origin, q2, env)}
    for view, rel in (('home', 'index.html'), ('services', 'services/index.html'), ('work', 'work/index.html'), ('courses', 'courses/index.html')):
        r = got2[f'view={view}']
        same = r['body'] == expected[rel]
        if not same:
            import difflib
            first = [l for l in difflib.unified_diff(expected[rel].splitlines(), r['body'].splitlines(), 'python', 'node', lineterm='', n=0) if l[:1] in '+-' and l[:3] not in ('+++', '---')][:2]
        check(f'the live {view} page is identical to the page the Python generator writes, byte for byte', r['status'] == 200 and same and 's-maxage=300' in r['headers']['netlify-cdn-cache-control'], '' if same else str(first)[:300])
    pjs = store.load('projects')
    for x in pjs:
        if x['page'] == 'generated' and x['status'] == 'published':
            r = got2[f'view=project&slug={x["slug"]}']
            want = sc.render_project_page(x, absolute=True)
            same = r['body'] == want
            if not same:
                import difflib
                first = [l for l in difflib.unified_diff(want.splitlines(), r['body'].splitlines(), 'python', 'node', lineterm='', n=0) if l[:1] in '+-' and l[:3] not in ('+++', '---')][:2]
            check(f'the live case-study page for "{x["slug"]}" is identical to the Python page, byte for byte', r['status'] == 200 and same, '' if same else str(first)[:300])
    work, home = got2['view=work']['body'], got2['view=home']['body']
    check('only published projects are listed (a draft and an archived one never appear)', 'Draft case study' not in work and 'Archived case study' not in work and 'Draft case study' not in home)
    check('the home page shows at most three featured projects, in order', home.count('<article class="proj">') == 3)
    check('an archived course is never listed, an upcoming one is shown as planned', 'An old course' not in got2['view=courses']['body'] and 'Not available yet' in got2['view=courses']['body'])
    page = got2['view=project&slug=cafe-site']['body']
    check('a case-study page keeps its paragraphs, images, captions and links, escaped', '<p>First paragraph.</p>' in page and 'Second one, continued on a new line.' in page and '<figcaption>Front &amp; side</figcaption>' in page and 'Keep it &lt;small&gt;' in page and 'sky--path' in page)
    sm = run_node(origin, ['view=sitemap'], env)[0]['body']
    check('the sitemap now lists published case studies made from records and never a draft or archived one', 'projects/cafe-site/' in sm and 'unpublished-one' not in sm and 'archived-one' not in sm)
    before = len(FAKE['log'])
    out = run_node(origin, ['view=project&slug=unpublished-one', 'view=project&slug=archived-one', 'view=project&slug=sample-template', 'view=project&slug=nope', 'view=project&slug=Bad..Slug', 'view=project&slug='], env)
    check('a draft, an archived, a hand-made or an unknown case study is a 404 that is never cached', all(o['status'] == 404 and o['headers']['netlify-cdn-cache-control'] == 'no-store' for o in out) and 'Draft case study' not in out[0]['body'])
    check('only valid-looking case-study addresses reach the database', len([e for e in FAKE['log'][before:]]) == 4, f'{len(FAKE["log"]) - before} requests')
    allsql = [r['stmt']['sql'] for e in FAKE['log'] for r in e['body'].get('requests', []) if r.get('type') == 'execute']
    check('still only SELECT statements across every view', allsql and all(x.lstrip().upper().startswith('SELECT') for x in allsql))
    check('every request still carries only the read token, in the header', all(e['auth'] == 'Bearer read-token' for e in FAKE['log']) and all('read-token' not in json.dumps(e['body']) for e in FAKE['log']))

    # ---------- a database problem never breaks a hand-made page
    dead_env = dict(env, TURSO_DATABASE_URL='http://127.0.0.1:1')
    import urllib.request
    def deployed(path): return urllib.request.urlopen(origin + path).read().decode('utf-8')
    down = {r['query']: r for r in run_node(origin, ['view=home', 'view=services', 'view=work', 'view=courses', 'view=index', 'view=project&slug=cafe-site'], dead_env)}
    for view, path in (('home', '/index.html'), ('services', '/services/index.html'), ('work', '/work/index.html'), ('courses', '/courses/index.html'), ('index', '/learn/index.html')):
        r = down[f'view={view}']
        check(f'with the database down the {view} page is sent exactly as last deployed, not an error', r['status'] == 200 and r['body'] == deployed(path) and 's-maxage=60' in r['headers']['netlify-cdn-cache-control'])
    check('with the database down a page that exists only as a record is a plain, uncached 503', down['view=project&slug=cafe-site']['status'] == 503 and down['view=project&slug=cafe-site']['headers']['netlify-cdn-cache-control'] == 'no-store')
    nokey2 = {k: v for k, v in env.items() if k != 'TURSO_READ_TOKEN'}
    r = run_node(origin, ['view=work'], nokey2)[0]
    check('with the settings missing a hand-made page is still sent as deployed', r['status'] == 200 and r['body'] == deployed('/work/index.html'))

    # ---------- an empty library
    conn2 = make_db('empty.db', {'topics': [], 'courses': [], 'projects': [], 'pricing': None, 'articles': {}})
    FAKE['path'] = conn2.path
    r = run_node(origin, ['view=index'], env)[0]
    check('an empty library shows the same "no topics yet" message as the Python page', r['body'] == sc.replace_between(shell, 'TOPICS', sc.render_library([])))
    e = {x['query']: x for x in run_node(origin, ['view=work', 'view=courses', 'view=services', 'view=home'], env)}
    read = lambda rel: open(os.path.join(repo, rel), encoding='utf-8').read()
    check('an empty database shows the same empty states as the Python pages', e['view=work']['body'] == sc.replace_between(read('work/index.html'), 'PROJECTS', sc.render_work([])) and e['view=courses']['body'] == sc.replace_between(read('courses/index.html'), 'COURSES', sc.render_courses([])))
    check('with no prices in the database the services and home pages are sent as deployed rather than blank', e['view=services']['body'] == read('services/index.html') and e['view=home']['body'] == read('index.html'))

    # ---------- the database is down, or the settings are missing
    dead = dict(env, TURSO_DATABASE_URL='http://127.0.0.1:1')
    r = run_node(origin, ['view=lesson&slug=what-is-a-variable'], dead)[0]
    check('when the database cannot be reached the visitor gets a plain 503 that is never cached', r['status'] == 503 and r['headers']['netlify-cdn-cache-control'] == 'no-store' and 'try again' in r['body'].lower())
    check('the 503 page does not say why (no address, no token, no stack)', all(x not in r['body'] for x in ('127.0.0.1', 'read-token', 'Error', 'ECONNREFUSED')))
    nokey = {k: v for k, v in env.items() if k not in ('TURSO_READ_TOKEN',)}
    r = run_node(origin, ['view=lesson&slug=what-is-a-variable'], nokey)[0]
    check('missing settings give the same safe 503', r['status'] == 503 and 'TURSO' not in r['body'])
    FAKE['path'] = conn.path
    refused = dict(env, TURSO_READ_TOKEN='wrong')
    r = run_node(origin, ['view=lesson&slug=what-is-a-variable'], refused)[0]
    check('a refused token gives the same safe 503', r['status'] == 503 and 'wrong' not in r['body'])
    plain = dict(env, TURSO_DATABASE_URL='http://example.com')
    r = run_node(origin, ['view=lesson&slug=what-is-a-variable'], plain)[0]
    check('the function refuses to send the token over plain http to a real host', r['status'] == 503)

    # ---------- the Netlify settings
    import tomllib
    cfg = tomllib.load(open(os.path.join(repo, 'netlify.toml'), 'rb'))
    reds = {x['from']: x for x in cfg['redirects']}
    order = [x['from'] for x in cfg['redirects']]
    shells = ['/index.html', '/services/index.html', '/work/index.html', '/courses/index.html', '/learn/index.html']
    check('the five hand-made frames are served as plain files, and those rules come first', order[:5] == shells and all(reds[f]['to'] == f and reds[f]['status'] == 200 and reds[f]['force'] for f in shells))
    routes = {'/': 'home', '/services/': 'services', '/work/': 'work', '/courses/': 'courses', '/learn/': 'index', '/sitemap.xml': 'sitemap'}
    check('every stored-content page is routed to the function as a rewrite that beats static files', all(reds[f]['status'] == 200 and reds[f]['force'] and reds[f]['to'] == f'/.netlify/functions/learn?view={v}' for f, v in routes.items()))
    check('lessons and case studies are routed with their address, including the /index.html form (so a saved draft cannot be reached by guessing)', all(reds[f]['to'].endswith(f'view={v}&slug=:slug') for f, v in (('/learn/:slug/', 'lesson'), ('/learn/:slug/index.html', 'lesson'), ('/projects/:slug/', 'project'), ('/projects/:slug/index.html', 'project'))))
    check('the functions folder is set', cfg['functions']['directory'] == 'netlify/functions' and os.path.isfile(os.path.join(repo, 'netlify', 'functions', 'learn.mjs')))
    # the skip-deploy rule, in a throwaway git repository
    if subprocess.run(['git', '--version'], capture_output=True).returncode == 0:
        g = tempfile.mkdtemp(prefix='curiohatch-git-')
        def sh(c, e=None): return subprocess.run(c, shell=True, cwd=g, capture_output=True, text=True, env=e)
        sh('git init -q . && git config user.email t@t && git config user.name t')
        for f in ['index.html', 'learn/index.html', 'learn/x/index.html', 'projects/gen/index.html', 'projects/templates/restraunt/index.html', 'docs/n.md', 'tools/t.py', 'content/pricing.json', 'content/learn/topics.json', 'sitemap.xml', 'netlify/functions/learn.mjs', 'about/index.html']:
            os.makedirs(os.path.dirname(os.path.join(g, f)) or g, exist_ok=True); open(os.path.join(g, f), 'w').write('a')
        sh('git add -A && git commit -qm base')
        def verdict(files):
            for f in files: open(os.path.join(g, f), 'a').write('x')
            sh('git add -A && git commit -qm change')
            ref, head = sh('git rev-parse HEAD~1').stdout.strip(), sh('git rev-parse HEAD').stdout.strip()
            return sh(cfg['build']['ignore'], dict(os.environ, CACHED_COMMIT_REF=ref, COMMIT_REF=head)).returncode == 0   # True = deploy skipped
        check('a push of only notes, tests, tools or the schema-side files skips the deploy', verdict(['docs/n.md', 'tools/t.py']))
        check('a push of only the saved content copy skips the deploy (nothing reads it while the site runs)', verdict(['content/pricing.json', 'content/learn/topics.json']))
        check('a push of only saved lesson or case-study page copies, and the sitemap, skips the deploy', verdict(['learn/x/index.html', 'projects/gen/index.html', 'sitemap.xml']))
        check('a hand-made page changing deploys', not verdict(['about/index.html']))
        check('a hand-made template page changing deploys, even though it is named index.html', not verdict(['projects/templates/restraunt/index.html']))
        check('the home page or a frame changing deploys', not verdict(['index.html']) and not verdict(['learn/index.html']))
        check('the function changing deploys', not verdict(['netlify/functions/learn.mjs']))
        check('notes changing together with a page deploys', not verdict(['docs/n.md', 'about/index.html']))
        head = sh('git rev-parse HEAD').stdout.strip()
        check('a first deploy, a missing commit or an unknown commit all deploy', all(sh(cfg['build']['ignore'], dict(os.environ, CACHED_COMMIT_REF=a_, COMMIT_REF=b_)).returncode != 0 for a_, b_ in (('', head), (head, ''), ('deadbeef', head))))
        shutil.rmtree(g, ignore_errors=True)
    else:
        print('NOTE: git was not found, so the skip-deploy rule was not tested.')
finally:
    for s in ('static', 'fake'):
        try: globals()[s].shutdown()
        except Exception: pass
    shutil.rmtree(tmp, ignore_errors=True)
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if res and all(res) else 1)
