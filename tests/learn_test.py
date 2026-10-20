import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
import fixture
repo=sys.argv[1] if len(sys.argv)>1 else fixture.build(os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))); PORT=8768
socketserver.TCPServer.allow_reuse_address=True
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
httpd=socketserver.TCPServer(('127.0.0.1',PORT),functools.partial(Q,directory=repo)); threading.Thread(target=httpd.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{PORT}/'; res=[]
def check(n,ok,d=''):
    res.append(bool(ok)); print(('PASS ' if ok else 'FAIL ')+n+(f'  [{d}]' if d else ''))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}); ctx.add_init_script("try{localStorage.setItem('curiohatch-analytics','decline')}catch(e){}"); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(base+'learn/'); pg.wait_for_timeout(400)
    check('library lists only the 2 published topics',pg.locator('#topic-list > li').count()==2,str(pg.locator('#topic-list > li').count()))
    check('draft, archived and planned topics are not listed','Unfinished' not in pg.content() and 'Old topic' not in pg.content() and 'Later idea' not in pg.content())
    check('filter tools appear with JS',pg.locator('#library-tools').is_visible())
    check('count line reads "2 topics"',pg.inner_text('#lib-count').strip()=='2 topics',pg.inner_text('#lib-count'))
    check('category select filled',pg.locator('#lib-cat option').count()==2)
    check('tag chips built',pg.locator('#lib-tags button').count()==3,str(pg.locator('#lib-tags button').count()))
    pg.fill('#lib-q','loop'); pg.wait_for_timeout(150)
    vis=pg.locator('#topic-list > li:visible').count()
    check('search "loop" leaves 1 topic',vis==1 and 'matches' in pg.inner_text('#lib-count'),pg.inner_text('#lib-count'))
    check('URL carries the search',pg.url.endswith('?q=loop'),pg.url)
    pg.fill('#lib-q','zzzz'); pg.wait_for_timeout(150)
    check('no-results message shown',pg.locator('#lib-none').is_visible() and pg.locator('#topic-list > li:visible').count()==0)
    pg.click('#lib-reset'); pg.wait_for_timeout(150)
    check('Clear filters restores the list and refocuses search',pg.locator('#topic-list > li:visible').count()==2 and pg.evaluate("document.activeElement.id")=='lib-q')
    pg.click('#lib-tags button:has-text("variables")'); pg.wait_for_timeout(150)
    check('tag chip filters (aria-pressed true, 1 topic)',pg.locator('#lib-tags button[aria-pressed=true]').count()==1 and pg.locator('#topic-list > li:visible').count()==1)
    pg.goto(base+'learn/?q=variable&category=JavaScript%20basics'); pg.wait_for_timeout(300)
    check('filters restore from a shared link',pg.locator('#topic-list > li:visible').count()==1)
    # topic page
    reqs=[]; pg.on('request',lambda r: reqs.append(r.url))
    pg.goto(base+'learn/what-is-a-variable/'); pg.wait_for_timeout(500)
    check('topic page: one h1 with the title',pg.locator('h1').count()==1 and pg.inner_text('h1')=='What is a variable?')
    check('topic page: no request to YouTube before Play',not any('youtube' in r or 'ytimg' in r for r in reqs),str([r for r in reqs if 'youtube' in r]))
    check('topic page: Play button present',pg.locator('.video-play').is_visible())
    check('topic page: plain YouTube link kept as fallback','watch?v=dQw4w9WgXcQ' in pg.content())
    check('topic page: related and prerequisite links point to published pages only',pg.locator('.side a[href="../loops-in-plain-words/"]').count()==1 and 'unfinished' not in pg.inner_text('.side').lower())
    check('topic page: planned course is not linked',pg.locator('.side :text("Part of a course")').count()==0)
    check('topic page: dates shown',pg.locator('time[datetime="2026-10-20"]').count()==1 and pg.locator('time[datetime="2026-10-22"]').count()==1)
    ov=pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth'); check('topic page: no horizontal overflow at 390',ov<=0,str(ov))
    pg.click('.video-play'); pg.wait_for_timeout(400)
    src=pg.get_attribute('.video iframe','src') if pg.locator('.video iframe').count() else ''
    check('Play loads youtube-nocookie iframe only on click','youtube-nocookie.com/embed/dQw4w9WgXcQ' in src,src)
    pg.goto(base+'learn/unfinished-draft/'); pg.wait_for_timeout(200)
    check('draft page is noindex',pg.locator('meta[name=robots][content=noindex]').count()==1)
    pg.goto(base+'courses/'); pg.wait_for_timeout(300)
    t=pg.inner_text('main')
    check('courses: planned card is labelled as not available','Planned. Not available yet.' in t and 'Fixture course (test only)' in t)
    check('courses: live course links out',pg.locator('a[href="https://example.org/course"]').count()==1 and 'Available' in t)
    check('courses: no enrol/buy/progress controls',pg.locator('main button, main input[type=submit], main form').count()==0)
    check('no console or page errors',not errs,str(errs))
    pg.goto(base+'learn/what-is-a-variable/'); pass
    b.close()
httpd.shutdown(); print(f'{sum(res)}/{len(res)} passed')
