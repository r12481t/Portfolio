"""Curiohatch QA crawler. Usage: python3 qa.py <repo_dir> [--shots outdir] [--motion reduce]
Serves the repo over http.server, visits every .html page, and reports:
  - HTTP status of each page, console errors, failed requests
  - broken internal links and missing #anchors
  - horizontal overflow at 360, 390, 768, 1280 px
  - interactive elements smaller than 44x44 px (Curiohatch pages only)
Nothing here is invented: every line comes from the browser."""
import sys, os, json, threading, http.server, socketserver, functools, re
from urllib.parse import urljoin, urlparse
from playwright.sync_api import sync_playwright

repo = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(__file__), '..'))
shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
reduce = ('--motion' in sys.argv and sys.argv[sys.argv.index('--motion') + 1] == 'reduce')
PORT = 8765
WIDTHS = [360, 390, 768, 1280]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Quiet, directory=repo)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{PORT}/'

pages = []
for root, _, files in os.walk(repo):
    if '/.git' in root or '/node_modules' in root or '/tests' in root or '/tools' in root: continue
    for f in files:
        if f.endswith('.html'):
            pages.append(os.path.relpath(os.path.join(root, f), repo))
pages.sort()

def exists(path):
    p = path.split('#')[0].split('?')[0]
    full = os.path.join(repo, p.lstrip('/'))
    if os.path.isdir(full): return os.path.exists(os.path.join(full, 'index.html'))
    return os.path.exists(full)

report = {'pages': {}, 'broken_links': [], 'overflow': [], 'small_targets': {}, 'console': {}}
with sync_playwright() as p:
    b = p.chromium.launch()
    for rel in pages:
        url = base + rel
        ctx = b.new_context(viewport={'width': 390, 'height': 800}, reduced_motion='reduce' if reduce else 'no-preference')
        pg = ctx.new_page()
        errs = []
        pg.on('console', lambda m, errs=errs: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e, errs=errs: errs.append('pageerror: ' + str(e)))
        pg.on('requestfailed', lambda r, errs=errs: errs.append('requestfailed: ' + r.url) if not r.url.startswith('https://fonts.') and 'cdn' not in r.url else None)
        try:
            resp = pg.goto(url, wait_until='load', timeout=15000)
            report['pages'][rel] = resp.status if resp else None
        except Exception as e:
            report['pages'][rel] = 'ERR ' + str(e)[:80]
            ctx.close(); continue
        pg.wait_for_timeout(300)
        report['console'][rel] = errs[:6]
        if pg.url != url:
            report['pages'][rel] = '200 (redirects to ' + pg.url.replace(base,'') + ')'
            ctx.close(); continue
        # links
        hrefs = pg.eval_on_selector_all('a[href]', 'els => els.map(e => [e.getAttribute("href"), e.textContent.trim().slice(0,40)])')
        for href, text in hrefs:
            if re.match(r'^(mailto:|tel:|javascript:)', href) or href.startswith('http'): continue
            if '{{' in href:
                report['broken_links'].append((rel, href, 'placeholder')); continue
            target = urljoin(url, href)
            path = urlparse(target).path
            local = path[1:] if path.startswith('/') else path
            if not exists(local):
                report['broken_links'].append((rel, href, 'missing'))
            elif '#' in href and not href.startswith('http'):
                frag = href.split('#')[1]
                if frag:
                    tgt_file = local.split('?')[0] or rel
                    if os.path.isdir(os.path.join(repo, tgt_file)): tgt_file = os.path.join(tgt_file, 'index.html')
                    if href.startswith('#'): tgt_file = rel
                    try:
                        html = open(os.path.join(repo, tgt_file), encoding='utf-8').read()
                        if not re.search(r'id=["\']' + re.escape(frag) + r'["\']', html):
                            report['broken_links'].append((rel, href, 'anchor missing'))
                    except Exception:
                        pass
        # overflow + targets
        for w in WIDTHS:
            pg.set_viewport_size({'width': w, 'height': 800})
            pg.wait_for_timeout(120)
            over = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if over > 0: report['overflow'].append((rel, w, over))
            if shots and w in (390, 1280):
                os.makedirs(shots, exist_ok=True)
                name = rel.replace('/', '_').replace('.html', '') + f'_{w}.png'
                pg.screenshot(path=os.path.join(shots, name), full_page=True)
        if rel in ('index.html',) or re.match(r'^(services|work|about|contact|privacy|courses|learn)/', rel):
            pg.set_viewport_size({'width': 390, 'height': 800})
            small = pg.evaluate('''() => [...document.querySelectorAll('a,button,select,input:not([type=hidden]),textarea,summary')].filter(e => {
                const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
                return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (r.height < 44 || r.width < 44) && !e.closest('p,li.prose') && e.className.indexOf('skip-link') < 0 && !(e.tagName==='A' && getComputedStyle(e).display==='inline') && !e.closest('.hp');
            }).map(e => e.tagName + '.' + e.className + ' "' + (e.textContent||'').trim().slice(0,24) + '" ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))''')
            if small: report['small_targets'][rel] = small[:8]
        ctx.close()
    b.close()
httpd.shutdown()
print(json.dumps(report, indent=1))
