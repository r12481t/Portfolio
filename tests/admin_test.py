"""Tests the local admin panel in a throwaway copy of the site. Usage: python tests/admin_test.py
Covers: localhost-only and token security, every save path (lessons, courses, packages, case studies, images), the files
that come out, refusal of bad data, undo, and the browser interface (phone-sized). The real repo is never changed."""
import base64, http.client, json, os, re, shutil, struct, subprocess, sys, tempfile, time, zlib
repo = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
tmp = tempfile.mkdtemp(prefix='curiohatch-admin-'); site = os.path.join(tmp, 'site')
shutil.copytree(repo, site, ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__', '.admin-backups'))
PORT = 8791
proc = subprocess.Popen([sys.executable, os.path.join(site, 'tools', 'admin.py'), '--port', str(PORT)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
res = []
def check(n, ok, d=''): res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f'  [{d}]' if d else ''))
url = None
for _ in range(60):
    line = proc.stdout.readline()
    m = re.search(r'http://127\.0\.0\.1:(\d+)/\?t=(\S+)', line)
    if m: url, port, token = m.group(0), int(m.group(1)), m.group(2); break
    time.sleep(0.1)
if not url:
    print('FAIL admin server did not start'); proc.kill(); sys.exit(1)

def req(method, path, body=None, token_=token, headers=None, host=None):
    c = http.client.HTTPConnection('127.0.0.1', port, timeout=30)
    h = {'Host': host or f'127.0.0.1:{port}'}
    if token_: h['X-Admin-Token'] = token_
    data = None
    if body is not None: data = json.dumps(body); h['Content-Type'] = 'application/json'
    h.update(headers or {})
    c.request(method, path, body=data, headers=h)
    r = c.getresponse(); raw = r.read(); c.close()
    try: j = json.loads(raw)
    except ValueError: j = None
    return r.status, j, raw
def post(path, body, **k): return req('POST', path, body, **k)
def rd(rel): return open(os.path.join(site, rel), encoding='utf-8').read()
def png(w=40, h=30):
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    raw = b''.join(b'\x00' + b'\x01\x02\x03' * w for _ in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

try:
    # ---------- security
    check('server announced a 127.0.0.1 address', url.startswith('http://127.0.0.1:'))
    check('API refuses a request with no token', req('GET', '/api/state', token_=None)[0] == 403)
    check('API refuses a wrong token', req('GET', '/api/state', token_='nope')[0] == 403)
    check('API refuses a foreign Host header (DNS rebinding)', req('GET', '/api/state', host='evil.example')[0] == 403)
    check('POST from another website (Origin) is refused', post('/api/run', {'action': 'check'}, headers={'Origin': 'http://evil.example'})[0] == 403)
    check('POST without JSON content type is refused', req('POST', '/api/run', None, headers={'Content-Type': 'text/plain'})[0] in (413, 415))
    check('path traversal out of the preview is blocked', req('GET', '/preview/../../../etc/passwd', token_=None)[0] in (400, 404))
    check('encoded traversal out of the admin folder is blocked', req('GET', '/admin/..%2f..%2fsite.py', token_=None)[0] in (400, 404))
    check('git and backup folders are not served by the preview', req('GET', '/preview/.admin-backups/', token_=None)[0] in (400, 404) and req('GET', '/preview/.git/config', token_=None)[0] in (400, 404))
    check('preview serves the site read-only', req('GET', '/preview/', token_=None)[0] == 200 and req('POST', '/preview/', {}, token_=token)[0] in (403, 404, 501, 400))
    st, state, _ = req('GET', '/api/state')
    check('state loads with the token', st == 200 and len(state['projects']) == 3 and not state['problems'], str(state['problems'])[:100] if state else '')

    # ---------- lessons
    topic = {'title': 'What is a variable', 'slug': 'what-is-a-variable', 'status': 'drafted', 'summary': 'A named box for a value.', 'category': 'JavaScript basics',
             'subtopics': [], 'tags': ['variables'], 'concepts': ['let and const'], 'videoId': '', 'publishedAt': '', 'updatedAt': '', 'prerequisites': [], 'related': [], 'courses': []}
    st, j, _ = post('/api/topic', {'record': topic, 'article': '<h2>Why</h2><p>Words.</p>', 'create': True})
    check('add a draft lesson', st == 200 and j['ok'] and j['id'] == 't001', str(j))
    page = rd('learn/what-is-a-variable/index.html')
    check('draft page exists, is noindex and holds the article', 'name="robots" content="noindex"' in page and '<h2>Why</h2>' in page)
    check('draft is not listed and not in the sitemap', 'what-is-a-variable' not in rd('sitemap.xml') and 'what-is-a-variable' not in rd('learn/index.html').split('<!-- TOPICS:START -->')[1])
    dup = dict(topic, title='Variables explained', slug='variables-explained')
    st, j, _ = post('/api/topic', {'record': dup, 'create': True})
    check('a similar lesson is held back with the matches shown', st == 200 and j['ok'] is False and j.get('similar') and not os.path.exists(os.path.join(site, 'learn/variables-explained')))
    st, j, _ = post('/api/topic', {'record': dup, 'create': True, 'allowSimilar': True})
    check('saving anyway adds it', j['ok'] and j['id'] == 't002')
    check('a duplicate slug is refused', post('/api/topic', {'record': dict(topic, title='Other'), 'create': True})[0] == 400)
    check('a bad slug is refused', post('/api/topic', {'record': dict(topic, slug='Bad Slug', title='Different thing'), 'create': True})[0] == 400)
    check('publishing without a video id is refused', post('/api/topic', {'record': dict(topic, id='t001', status='published', publishedAt='2026-10-20'), 'create': False})[0] == 400)
    check('publishing with an impossible date is refused', post('/api/topic', {'record': dict(topic, id='t001', status='published', videoId='dQw4w9WgXcQ', publishedAt='2026-13-45'), 'create': False})[0] == 400)
    st, j, _ = post('/api/topic', {'record': dict(topic, id='t001'), 'article': '<p>x</p><script>alert(1)</script>', 'create': False})
    check('an article with a script is refused', st == 400 and 'not allowed' in j['error'])
    check('an article with an event handler is refused', post('/api/topic', {'record': dict(topic, id='t001'), 'article': '<img src=x onerror=alert(1)>', 'create': False})[0] == 400)
    check('a lesson address cannot be changed', post('/api/topic', {'record': dict(topic, id='t001', slug='renamed'), 'create': False})[0] == 400)
    long_article = '<h2>Why variables exist</h2><p>' + ('A variable holds a value so the program can use it again later. ' * 50) + '</p>'
    st, j, _ = post('/api/topic', {'record': dict(topic, id='t001', status='published', videoId='dQw4w9WgXcQ', publishedAt='2026-10-20'), 'article': long_article, 'create': False})
    check('publish a lesson with video, date and article', st == 200 and j['ok'], str(j))
    check('published lesson is listed, in the sitemap, indexable and shows the video box', 'what-is-a-variable/' in rd('learn/index.html') and 'learn/what-is-a-variable/' in rd('sitemap.xml') and 'noindex' not in rd('learn/what-is-a-variable/index.html') and 'data-video-id="dQw4w9WgXcQ"' in rd('learn/what-is-a-variable/index.html'))
    check('article text round-trips through the API', 'Why variables exist' in req('GET', '/api/article?slug=what-is-a-variable')[1]['html'])
    st, j, _ = post('/api/topic/archive', {'id': 't001'})
    check('archiving removes it from the list and sitemap but keeps the page', j['ok'] and 'what-is-a-variable/' not in rd('learn/index.html').split('<!-- TOPICS:START -->')[1] and 'learn/what-is-a-variable/' not in rd('sitemap.xml') and os.path.exists(os.path.join(site, 'learn/what-is-a-variable/index.html')))
    st, j, _ = post('/api/undo', {})
    check('undo brings the lesson back to published', j['ok'] and 'what-is-a-variable/' in rd('learn/index.html'), str(j))

    # ---------- courses
    st, j, _ = post('/api/course', {'record': {'title': 'JS from zero', 'status': 'planned', 'summary': 'A planned path.', 'level': 'Beginner', 'lessons': ['t001']}, 'create': True})
    check('add a planned course', j['ok'] and j['id'] == 'c001', str(j))
    check('planned course is labelled as not available, with no date', 'Planned. Not available yet.' in rd('courses/index.html') and 'JS from zero' in rd('courses/index.html'))
    check('an available course without an address is refused', post('/api/course', {'record': {'id': 'c001', 'title': 'JS from zero', 'status': 'available', 'summary': 'x'}, 'create': False})[0] == 400)
    check('a course pointing at an unknown lesson is refused', post('/api/course', {'record': {'title': 'Bad', 'status': 'planned', 'summary': 'x', 'lessons': ['t999']}, 'create': True})[0] == 400)
    st, j, _ = post('/api/course', {'record': {'id': 'c001', 'title': 'JS from zero', 'status': 'available', 'summary': 'A path.', 'url': 'learn/'}, 'create': False})
    check('an available course with a working address links out', j['ok'] and 'href="../learn/"' in rd('courses/index.html'), str(j))

    # ---------- packages and prices
    pr = req('GET', '/api/state')[1]['pricing']
    pr['packages'][1]['price'] = 219; pr['packages'][1]['introPrice'] = 189
    st, j, _ = post('/api/pricing', {'pricing': pr})
    check('change a package price: services and home pages follow', j['ok'] and '$219' in rd('services/index.html') and '$189' in rd('services/index.html') and '$219' in rd('index.html') and '$199' not in rd('services/index.html'), str(j))
    bad = json.loads(json.dumps(pr)); bad['packages'][1]['introPrice'] = 500
    check('an intro price above the price is refused', post('/api/pricing', {'pricing': bad})[0] == 400)
    bad = json.loads(json.dumps(pr)); bad['packages'][0]['price'] = 'abc'
    check('a non-numeric price is refused', post('/api/pricing', {'pricing': bad})[0] == 400)
    bad = json.loads(json.dumps(pr)); bad['packages'][0]['cta']['href'] = 'nowhere/'
    check('a button that leads nowhere is refused', post('/api/pricing', {'pricing': bad})[0] == 400)
    pr['introOffer']['active'] = False
    st, j, _ = post('/api/pricing', {'pricing': pr})
    check('turning the first-three-client offer off hides those prices', j['ok'] and '$189' not in rd('services/index.html') and 'first-three-client' not in rd('services/index.html').split('<!-- PRICING:START -->')[1].split('<!-- PRICING:END -->')[0])
    check('terms stay hidden until approved', 'id="terms"' not in rd('services/index.html'))
    pr['terms']['approved'] = True
    st, j, _ = post('/api/pricing', {'pricing': pr})
    check('approving the terms publishes them', j['ok'] and 'id="terms"' in rd('services/index.html'))
    pr['packages'].append({'id': 'care-plan', 'name': 'Care Plan', 'priceType': 'starting', 'price': 29, 'introPrice': None, 'summary': 'Monthly small changes.', 'scope': ['Small edits'], 'note': '', 'cta': {'label': 'Ask about it', 'href': 'contact/'}})
    st, j, _ = post('/api/pricing', {'pricing': pr})
    check('add a new package: it appears on services and the home list', j['ok'] and 'Care Plan' in rd('services/index.html') and 'Care Plan' in rd('index.html'))

    # ---------- case studies and images
    proj = {'title': 'Plumber Demo Site', 'slug': 'plumber-demo', 'status': 'draft', 'group': 'projects', 'page': 'generated', 'featured': True, 'order': 5, 'tag': 'Concept project',
            'summary': 'A demo site for an imaginary plumbing business.', 'builtBy': 'Ruhan Tahlil', 'builtWith': 'HTML, CSS, JavaScript', 'outcome': 'A concept. No client.', 'shows': 'A phone-first layout.',
            'built': 'A three-page site.\n\nIt has a call button.', 'role': 'Ruhan designed and built it.', 'whatHappened': 'Nothing was sold.', 'learned': ['Keep pages short'], 'links': [], 'images': []}
    st, j, _ = post('/api/project', {'record': proj, 'create': True})
    check('add a draft case study: page is generated and noindex', j['ok'] and 'noindex' in rd('projects/plumber-demo/index.html') and 'It has a call button.' in rd('projects/plumber-demo/index.html'), str(j))
    check('draft case study is not on the Work page, home or sitemap', 'Plumber Demo' not in rd('work/index.html') and 'Plumber Demo' not in rd('index.html') and 'plumber-demo' not in rd('sitemap.xml'))
    check('a slug that collides with a hand-built folder is refused', post('/api/project', {'record': dict(proj, slug='taqen', title='Collides'), 'create': True})[0] == 400)
    check('a link that goes nowhere is refused', post('/api/project', {'record': dict(proj, slug='x-one', title='X', links=[{'label': 'Go', 'href': 'projects/none/missing.html'}]), 'create': True})[0] == 400)
    st, j, _ = post('/api/image', {'slug': 'plumber-demo', 'filename': 'Home Page.PNG', 'data': base64.b64encode(png()).decode()})
    check('upload an image: saved under assets/work with its real size', st == 200 and j['src'] == 'assets/work/plumber-demo/home-page.png' and (j['width'], j['height']) == (40, 30) and os.path.exists(os.path.join(site, j['src'])), str(j))
    check('a non-image file is refused', post('/api/image', {'slug': 'plumber-demo', 'filename': 'x.png', 'data': base64.b64encode(b'not an image').decode()})[0] == 400)
    check('a disallowed extension is refused', post('/api/image', {'slug': 'plumber-demo', 'filename': 'x.svg', 'data': base64.b64encode(png()).decode()})[0] == 400)
    check('an oversize image is refused', post('/api/image', {'slug': 'plumber-demo', 'filename': 'big.png', 'data': base64.b64encode(png() + b'0' * 3200000).decode()})[0] == 400)
    check('a traversal filename stays inside the project folder', post('/api/image', {'slug': 'plumber-demo', 'filename': '../../../evil.png', 'data': base64.b64encode(png()).decode()})[1]['src'].startswith('assets/work/plumber-demo/'))
    proj.update(id='p004', status='published', title='Plumber <b>Demo</b> Site', images=[{'src': 'assets/work/plumber-demo/home-page.png', 'alt': '', 'caption': '', 'width': 40, 'height': 30}])
    check('an image with no alt text is refused', post('/api/project', {'record': proj, 'create': False})[0] == 400)
    proj['images'][0]['alt'] = 'The home page on a phone'
    st, j, _ = post('/api/project', {'record': proj, 'create': False})
    check('publish the case study', j['ok'], str(j))
    pg = rd('projects/plumber-demo/index.html')
    check('published page is indexable with the right canonical, image size and alt text', 'noindex' not in pg and 'https://curiohatch.studio/projects/plumber-demo/' in pg and 'alt="The home page on a phone"' in pg and 'width="40" height="30"' in pg)
    check('HTML typed into a title is shown as text, not run', '&lt;b&gt;Demo&lt;/b&gt;' in pg and '<b>Demo</b>' not in pg)
    check('published case study is on the Work page, the home page and the sitemap', 'Plumber &lt;b&gt;Demo&lt;/b&gt; Site' in rd('work/index.html') and 'Concept project' in rd('index.html') and 'projects/plumber-demo/' in rd('sitemap.xml'))
    check('existing hand-built case studies are untouched', rd('projects/taqen/case-study.html') == open(os.path.join(repo, 'projects/taqen/case-study.html'), encoding='utf-8').read())
    st, j, _ = post('/api/project/archive', {'id': 'p004'})
    check('archiving removes it from Work and the sitemap', j['ok'] and 'Plumber' not in rd('work/index.html') and 'plumber-demo' not in rd('sitemap.xml'))
    post('/api/undo', {})
    check('undo restores it', 'Plumber' in rd('work/index.html'))

    # ---------- whole-site health after all of that
    out = subprocess.run([sys.executable, os.path.join(site, 'tools', 'site.py'), 'check'], capture_output=True, text=True)
    check('site check reports 0 problems after every change above', out.returncode == 0 and ' 0 problem(s)' in out.stdout, out.stdout[-300:])
    seo = subprocess.run([sys.executable, os.path.join(site, 'tests', 'seo_check.py'), site], capture_output=True, text=True)
    check('SEO check passes on the result', seo.returncode == 0, seo.stdout[-300:])
    check('every save left a backup that undo can use', os.path.isdir(os.path.join(site, '.admin-backups')) and len(os.listdir(os.path.join(site, '.admin-backups'))) >= 10)

    # ---------- browser interface
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('dialog', lambda d: d.accept())
        pg.goto(url); pg.wait_for_selector('#tabs button'); pg.wait_for_timeout(300)
        check('UI: token is removed from the address bar after loading', 't=' not in pg.url)
        check('UI: five sections in the tab bar', pg.locator('#tabs button').count() == 5)
        check('UI: overview shows the "not published" reminder', 'Not published yet' in pg.inner_text('main'))
        check('UI: no horizontal overflow on a phone', pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth') <= 0)
        pg.click('#tabs button:has-text("Courses")'); pg.click('button:has-text("Add a course")')
        pg.fill('label:has-text("Title") + input', 'UI course') if False else None
        pg.locator('input').nth(0).fill('Course added in the browser'); pg.locator('textarea').nth(0).fill('Made with the form.')
        pg.click('button:has-text("Save course")'); pg.wait_for_selector('#toast p.ok', timeout=15000); pg.locator('main', has_text='Course added in the browser').wait_for(timeout=15000)
        check('UI: saving a course shows success and the course appears in the list', 'Course added in the browser' in pg.inner_text('main') and 'Course added in the browser' in rd('courses/index.html'))
        pg.click('#tabs button:has-text("Lessons")'); pg.click('button:has-text("Add a lesson")')
        inputs = pg.locator('main input[type=text]')
        pg.locator('main input').nth(0).fill('Loops in plain words'); pg.locator('main input').nth(1).fill('loops-in-plain-words')
        pg.locator('main input[list]').nth(1).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ') if False else None
        pg.click('button:has-text("+ Heading")')
        check('UI: article toolbar inserts a heading', '<h2>Heading</h2>' in pg.locator('textarea.code').input_value())
        pg.click('button:has-text("Preview")'); pg.wait_for_selector('iframe.preview')
        check('UI: article preview is a sandboxed frame', pg.get_attribute('iframe.preview', 'sandbox') == '')
        pg.click('button:has-text("Save lesson")'); pg.wait_for_selector('#toast p', timeout=15000); pg.locator('main', has_text='Loops in plain words').wait_for(timeout=15000)
        check('UI: lesson saved as a draft and listed', os.path.exists(os.path.join(site, 'learn/loops-in-plain-words/index.html')) and 'Loops in plain words' in pg.inner_text('main'))
        pg.click('#tabs button:has-text("Packages")'); pg.wait_for_selector('details.card')
        check('UI: packages form lists every package', pg.locator('details.card summary').count() >= 5)
        pg.click('#tabs button:has-text("Case studies")')
        check('UI: case studies list shows the generated and existing projects', 'TAQEN Collection' in pg.inner_text('main') and 'Plumber' in pg.inner_text('main'))
        pg.click('#tabs button:has-text("Overview")'); pg.click('button:has-text("Run site check")'); pg.wait_for_selector('pre:not([hidden])', timeout=20000)
        check('UI: running the site check shows its output', 'checked' in pg.inner_text('pre'))
        pg.click('button:has-text("Undo last change")'); pg.wait_for_timeout(1500)
        pg.wait_for_selector('#toast p.ok', timeout=15000)
        check('UI: undo removes the lesson just added', not os.path.exists(os.path.join(site, 'learn/loops-in-plain-words/index.html')) and not os.path.exists(os.path.join(site, 'learn/loops-in-plain-words')))
        check('UI: no console or page errors', not errs, str(errs)[:200])
        b.close()
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except Exception: proc.kill()
    shutil.rmtree(tmp, ignore_errors=True)
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
