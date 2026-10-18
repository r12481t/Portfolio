"""SEO and metadata checks. Static: reads the files, no browser. Usage: python tests/seo_check.py [repo_dir]
Checks canonical and social URLs, sitemap, robots.txt and lesson structured data against what is actually in the files."""
import json, os, re, sys, glob
from html.parser import HTMLParser
repo = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
DOMAIN = 'https://curiohatch.studio'
ALLOWED_EXTERNAL_NETLIFY = ('taqenshop.netlify.app',)   # the TAQEN store, linked on purpose as an external site
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.canon = None; self.title = ''; self._t = False; self.h1 = []; self._h = False; self.ld = []; self._ld = False; self.times = []
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == 'title': self._t = True
        if tag == 'h1': self._h = True; self.h1.append('')
        if tag == 'meta':
            k = a.get('property') or a.get('name')
            if k: self.meta[k] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical': self.canon = a.get('href')
        if tag == 'script' and a.get('type') == 'application/ld+json': self._ld = True; self.ld.append('')
        if tag == 'time': self.times.append(a.get('datetime'))
    def handle_endtag(self, tag):
        if tag == 'title': self._t = False
        if tag == 'h1': self._h = False
        if tag == 'script': self._ld = False
    def handle_data(self, d):
        if self._t: self.title += d
        if self._h and self.h1: self.h1[-1] += d
        if self._ld and self.ld: self.ld[-1] += d

def parse(path):
    p = P(); p.feed(open(path, encoding='utf-8').read()); return p

def route_of(canon):
    path = canon[len(DOMAIN):].split('#')[0].split('?')[0]
    full = os.path.join(repo, path.lstrip('/'))
    if path.endswith('/'): return os.path.join(full, 'index.html')
    if os.path.exists(full): return full
    # Netlify "pretty URLs": /dir/page serves dir/page.html. The live host matched it case-insensitively; so do we.
    d, base = os.path.split(full + '.html')
    if os.path.isdir(d):
        for name in os.listdir(d):
            if name.lower() == base.lower(): return os.path.join(d, name)
    return full

pages = [f for f in glob.glob(os.path.join(repo, '**', '*.html'), recursive=True) if '/node_modules/' not in f and '/tests/' not in f]
indexable = {}
for f in sorted(pages):
    rel = os.path.relpath(f, repo)
    p = parse(f)
    if p.meta.get('robots', '') .startswith('noindex'): continue
    if rel.startswith(('ruhan/services/', '404')): continue      # redirect stub and error page
    if rel == 'projects/classley/classley.html': continue          # the demo app: several screens in one page, not a document
    indexable[rel] = p
bad = []
for rel, p in indexable.items():
    if not p.canon: bad.append(f'{rel}: no canonical'); continue
    if not p.canon.startswith(DOMAIN + '/'): bad.append(f'{rel}: canonical is {p.canon}'); continue
    if not os.path.exists(route_of(p.canon)): bad.append(f'{rel}: canonical {p.canon} does not map to an existing file (case matters)')
    elif os.path.realpath(route_of(p.canon)) != os.path.realpath(os.path.join(repo, rel)): bad.append(f'{rel}: canonical points at a different file: {p.canon}')
check(f'every indexable page ({len(indexable)}) has a canonical on {DOMAIN} that maps to its own file', not bad, '; '.join(bad[:4]))

bad = []
for rel, p in indexable.items():
    if p.meta.get('og:url') and p.canon and p.meta['og:url'] != p.canon: bad.append(f'{rel}: og:url differs from canonical')
    img = p.meta.get('og:image')
    if img:
        if not img.startswith(DOMAIN + '/'): bad.append(f'{rel}: og:image is {img}')
        elif not os.path.exists(os.path.join(repo, img[len(DOMAIN) + 1:])): bad.append(f'{rel}: og:image file missing')
check('og:url matches canonical and og:image is an absolute production URL to a file that exists', not bad, '; '.join(bad[:4]))

hits = []
for f in pages + glob.glob(os.path.join(repo, '*.xml')) + glob.glob(os.path.join(repo, '*.txt')):
    t = open(f, encoding='utf-8').read()
    for m in re.finditer(r'(canonical" href|og:url" content|og:image" content|<loc>|Sitemap:)[^\n]*?(github\.io|netlify\.app|localhost|127\.0\.0\.1)', t):
        hits.append(os.path.relpath(f, repo))
check('no preview, GitHub Pages or localhost address in any canonical, social URL, sitemap or robots', not hits, ', '.join(sorted(set(hits))[:5]))
ext = []
for f in pages:
    for m in re.finditer(r'https?://[^"\'\s<>]*(github\.io|netlify\.app)[^"\'\s<>]*', open(f, encoding='utf-8').read()):
        if not any(a in m.group(0) for a in ALLOWED_EXTERNAL_NETLIFY): ext.append(os.path.relpath(f, repo) + ' -> ' + m.group(0))
check('no stray links to a github.io or netlify.app address (other than the TAQEN store)', not ext, '; '.join(ext[:3]))

titles = {}
for rel, p in indexable.items(): titles.setdefault(p.title.strip(), []).append(rel)
dups = {t: r for t, r in titles.items() if len(r) > 1}
check('page titles are unique', not dups, str(dups)[:160])
nodesc = [rel for rel, p in indexable.items() if not p.meta.get('description')]
check('every indexable page has a description', not nodesc, ', '.join(nodesc[:4]))
noh1 = [rel for rel, p in indexable.items() if len(p.h1) != 1]
check('exactly one h1 on every indexable page', not noh1, ', '.join(f'{r}({len(indexable[r].h1)})' for r in noh1[:4]))

sm = open(os.path.join(repo, 'sitemap.xml'), encoding='utf-8').read()
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
check('sitemap has no duplicate addresses', len(locs) == len(set(locs)))
check(f'all {len(locs)} sitemap addresses use {DOMAIN}', all(l.startswith(DOMAIN + '/') for l in locs))
missing = [l for l in locs if not os.path.exists(route_of(l))]
check('every sitemap address maps to an existing file', not missing, ', '.join(missing[:3]))
noidx = []
for l in locs:
    if os.path.exists(route_of(l)) and parse(route_of(l)).meta.get('robots', '').startswith('noindex'): noidx.append(l)
check('no noindex page is in the sitemap', not noidx, ', '.join(noidx))
topics = json.load(open(os.path.join(repo, 'content/learn/topics.json'), encoding='utf-8')).get('topics', [])
pub = {f'{DOMAIN}/learn/{t["slug"]}/' for t in topics if t.get('status') == 'published'}
notpub = {f'{DOMAIN}/learn/{t["slug"]}/' for t in topics if t.get('status') != 'published'}
check(f'sitemap lists exactly the {len(pub)} published lessons and no unpublished one', pub <= set(locs) and not (notpub & set(locs)))

rb = open(os.path.join(repo, 'robots.txt'), encoding='utf-8').read()
check('robots.txt allows crawling and names the production sitemap', 'Allow: /' in rb and f'Sitemap: {DOMAIN}/sitemap.xml' in rb and 'Disallow: /\n' not in rb)

bad = []; n = 0
for rel, p in indexable.items():
    for blob in p.ld:
        n += 1
        try: d = json.loads(blob)
        except ValueError: bad.append(f'{rel}: JSON-LD does not parse'); continue
        if d.get('@type') == 'Article':
            if d.get('headline', '').strip() != p.h1[0].strip(): bad.append(f'{rel}: headline differs from the h1')
            if d.get('mainEntityOfPage') != p.canon: bad.append(f'{rel}: mainEntityOfPage differs from canonical')
            if d.get('datePublished') not in p.times: bad.append(f'{rel}: datePublished is not shown on the page')
            extra = set(d) - {'@context', '@type', 'headline', 'description', 'datePublished', 'dateModified', 'mainEntityOfPage', 'publisher'}
            if extra: bad.append(f'{rel}: unverified structured-data fields {sorted(extra)}')
            if d.get('description') != p.meta.get('description'): bad.append(f'{rel}: description differs from the page description')
check(f'structured data matches the page ({n} block(s) found; none is expected until a lesson is published)', not bad, '; '.join(bad[:3]))
print(f'{sum(results)}/{len(results)} passed'); sys.exit(0 if all(results) else 1)
