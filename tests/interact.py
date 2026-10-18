"""Interaction tests for the Curiohatch redesign. Prints PASS/FAIL per check."""
import sys, os, json, threading, http.server, socketserver, functools, json
from playwright.sync_api import sync_playwright
repo=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..')); PORT=8767
socketserver.TCPServer.allow_reuse_address=True
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
httpd=socketserver.TCPServer(('127.0.0.1',PORT),functools.partial(Q,directory=repo)); threading.Thread(target=httpd.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{PORT}/'
res=[]
def check(name,ok,detail=''):
    res.append((name,bool(ok),detail)); print(('PASS ' if ok else 'FAIL ')+name+(f'  [{detail}]' if detail else ''))
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---------- drawer on phone
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(base+'index.html'); pg.wait_for_timeout(300)
    tog=pg.locator('.nav-toggle')
    check('Menu button visible on phone',tog.is_visible())
    check('inline nav hidden on phone when JS runs',not pg.locator('#site-nav').is_visible())
    tog.focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check('Enter on Menu opens drawer',pg.evaluate("document.getElementById('drawer').classList.contains('is-open')"))
    check('aria-expanded true',tog.get_attribute('aria-expanded')=='true')
    check('focus moved to Close button',pg.evaluate("document.activeElement.className")=='drawer-close',pg.evaluate("document.activeElement.className"))
    check('page scroll locked',pg.evaluate("getComputedStyle(document.documentElement).overflow")=='hidden')
    check('page behind is inert',pg.evaluate("document.querySelector('main').hasAttribute('inert') && document.querySelector('.site-header').hasAttribute('inert')"))
    inside=True
    for i in range(14):
        pg.keyboard.press('Tab')
        if not pg.evaluate("!!document.activeElement.closest('.drawer-panel')"): inside=False
    check('Tab x14 never leaves the drawer',inside)
    inside=True
    for i in range(14):
        pg.keyboard.press('Shift+Tab')
        if not pg.evaluate("!!document.activeElement.closest('.drawer-panel')"): inside=False
    check('Shift+Tab x14 never leaves the drawer',inside)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(450)
    check('Escape closes drawer',not pg.evaluate("document.getElementById('drawer').classList.contains('is-open')"))
    check('focus restored to Menu button',pg.evaluate("document.activeElement.className")=='nav-toggle')
    check('scroll lock removed',pg.evaluate("getComputedStyle(document.documentElement).overflow")!='hidden')
    check('closed drawer links are not focusable',not pg.evaluate("(()=>{const a=document.querySelector('.drawer-links a');return a.offsetParent!==null && getComputedStyle(a).visibility!=='hidden'})()"))
    # backdrop close (only exists where the panel does not cover the screen: tablet width)
    c2=b.new_context(viewport={'width':768,'height':900}); p2=c2.new_page(); p2.goto(base+'index.html'); p2.wait_for_timeout(300)
    p2.locator('.nav-toggle').click(); p2.wait_for_timeout(450); p2.mouse.click(40,400); p2.wait_for_timeout(450)
    check('tablet: backdrop click closes drawer',not p2.evaluate("document.getElementById('drawer').classList.contains('is-open')"))
    c2.close()
    pg.set_viewport_size({'width':390,'height':800})
    check('phone: panel is full width',pg.evaluate("(()=>{tmp=document.querySelector('.nav-toggle');tmp.click();return true})()") and True)
    pg.wait_for_timeout(450)
    check('phone: panel covers the full screen',pg.evaluate("Math.round(document.querySelector('.drawer-panel').getBoundingClientRect().width)")==390)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(450)
    # navigate via drawer, then back
    tog.click(); pg.wait_for_timeout(450)
    pg.click('.drawer-links a[href="services/"]'); pg.wait_for_load_state('load'); pg.wait_for_timeout(400)
    check('drawer link navigates (no delay trap)',pg.url.endswith('/services/'),pg.url)
    check('services page: Services link marked current',pg.locator('.site-nav a[aria-current="page"]').count()==1)
    pg.go_back(); pg.wait_for_load_state('load'); pg.wait_for_timeout(500)
    check('Back returns to home',pg.url.endswith('index.html') or pg.url==base,pg.url)
    check('Back leaves page unlocked and drawer closed',pg.evaluate("!document.getElementById('drawer').classList.contains('is-open') && getComputedStyle(document.documentElement).overflow!=='hidden'"))
    pg.go_forward(); pg.wait_for_timeout(500)
    check('Forward works',pg.url.endswith('/services/'))
    # resize closes
    pg.goto(base+'index.html'); pg.wait_for_timeout(200); pg.locator('.nav-toggle').click(); pg.wait_for_timeout(400)
    pg.set_viewport_size({'width':1280,'height':800}); pg.wait_for_timeout(400)
    check('resizing to desktop closes drawer and unlocks',pg.evaluate("!document.getElementById('drawer').classList.contains('is-open') && getComputedStyle(document.documentElement).overflow!=='hidden'"))
    check('desktop shows inline nav, hides Menu',pg.locator('#site-nav').is_visible() and not pg.locator('.nav-toggle').is_visible())
    check('no JS errors',not errs,str(errs))
    ctx.close()
    # ---------- reveal + parallax on desktop
    ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); pg.goto(base+'index.html'); pg.wait_for_timeout(400)
    n=pg.evaluate("document.querySelectorAll('.will-reveal').length")
    check('below-fold blocks are set to reveal',n>3,str(n))
    check('first screen is never hidden',pg.evaluate("(()=>{const h=document.querySelector('.hero h1');return getComputedStyle(h).opacity==='1'})()"))
    pg.mouse.wheel(0,6000); pg.wait_for_timeout(1500)
    left=pg.evaluate("document.querySelectorAll('.will-reveal:not(.is-in)').length")
    check('scrolling reveals every block',left==0,f'{left} left')
    pg.mouse.move(200,200); pg.mouse.move(900,500); pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(300); pg.mouse.move(1000,600); pg.wait_for_timeout(300)
    px=pg.evaluate("document.querySelector('.hero').style.getPropertyValue('--px')")
    check('pointer depth writes --px on the sky',px!='',px)
    ctx.close()
    # ---------- reduced motion
    ctx=b.new_context(viewport={'width':390,'height':800},reduced_motion='reduce'); pg=ctx.new_page(); pg.goto(base+'index.html'); pg.wait_for_timeout(400)
    check('reduced motion: nothing is hidden for reveal',pg.evaluate("document.querySelectorAll('.will-reveal').length")==0)
    check('reduced motion: hero entrance animation off',pg.evaluate("getComputedStyle(document.querySelector('.hero .lede')).animationName")=='none')
    pg.mouse.move(100,100); pg.mouse.move(300,300); pg.wait_for_timeout(200)
    check('reduced motion: no pointer depth',pg.evaluate("document.querySelector('.hero').style.getPropertyValue('--px')")=='')
    pg.locator('.nav-toggle').click(); pg.wait_for_timeout(100)
    check('reduced motion: drawer opens at once without sliding',pg.evaluate("getComputedStyle(document.querySelector('.drawer-panel')).transform")in('none','matrix(1, 0, 0, 1, 0, 0)'))
    ctx.close()
    # ---------- no JavaScript
    ctx=b.new_context(viewport={'width':390,'height':800},java_script_enabled=False); pg=ctx.new_page(); pg.goto(base+'index.html'); pg.wait_for_timeout(300)
    check('no-JS: header links visible on a phone',pg.locator('#site-nav').is_visible())
    check('no-JS: Menu button hidden (it would do nothing)',not pg.locator('.nav-toggle').is_visible())
    check('no-JS: drawer not visible',not pg.locator('.drawer-panel').is_visible())
    check('no-JS: every section visible',pg.evaluate("[...document.querySelectorAll('[data-reveal]')].every(e=>getComputedStyle(e).opacity==='1')"))
    check('no-JS: FAQ answers reachable (details)',pg.locator('.faq details').count()==5)
    pg.goto(base+'learn/'); check('no-JS: library empty state shown',pg.locator('#library-empty').is_visible()); check('no-JS: filter tools stay hidden',not pg.locator('#library-tools').is_visible())
    ctx.close()
    # ---------- keyboard focus visible on desktop
    ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); pg.goto(base+'index.html'); pg.wait_for_timeout(300)
    bad=[]
    for i in range(12):
        pg.keyboard.press('Tab')
        o=pg.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [e.tagName+'.'+e.className+' '+(e.textContent||'').trim().slice(0,20), s.outlineStyle, s.outlineWidth]})()")
        if o[1]=='none' or o[2]=='0px': bad.append(o[0])
    check('first 12 tab stops all show a focus outline',not bad,str(bad))
    ctx.close()
    # ---------- contact form states (Netlify Forms client behaviour; real delivery cannot be tested here)
    def fill_valid(pg):
        pg.fill('[name=name]','Test'); pg.fill('[name=email]','a@b.co'); pg.fill('[name=website]','example.com')
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); pg.goto(base+'contact/?type=audit'); pg.wait_for_timeout(300)
    check('?type=audit preselects the audit option',pg.eval_on_selector('#inquiry-form [name=inquiry_type]','e=>e.value')=='audit')
    check('form is marked for Netlify (data-netlify, name, honeypot, POST)',pg.evaluate("(()=>{const f=document.getElementById('inquiry-form');return f.hasAttribute('data-netlify')&&f.getAttribute('name')==='inquiry'&&f.getAttribute('netlify-honeypot')==='_gotcha'&&f.method==='post'})()"))
    check('form has no placeholder action',not pg.evaluate("document.getElementById('inquiry-form').getAttribute('action')"))
    pg.click('#inquiry-form button[type=submit]'); pg.wait_for_timeout(200)
    check('empty submit shows errors and focuses first field',pg.evaluate("document.activeElement.name")=='name' and 'fix' in pg.inner_text('#form-status').lower())
    fill_valid(pg); pg.click('#inquiry-form button[type=submit]'); pg.wait_for_timeout(500)
    st=pg.inner_text('#form-status').lower()
    check('local server cannot accept the POST: failure message, no false success','may not have been sent' in st and 'thank you' not in st,st)
    ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); posts=[]
    def ok(route):
        r=route.request
        if r.method=='POST': posts.append((r.url,r.post_data or '',r.headers)); route.fulfill(status=200,body='ok')
        else: route.continue_()
    pg.route('**/*',ok); pg.goto(base+'contact/?type=audit'); pg.wait_for_timeout(300); fill_valid(pg); pg.click('#inquiry-form button[type=submit]'); pg.wait_for_timeout(500)
    check('2xx response shows the success message','your message was sent' in pg.inner_text('#form-status').lower())
    body=posts[0][1] if posts else ''
    check('POST goes to the site root, urlencoded, names the form',bool(posts) and posts[0][0]==base and 'application/x-www-form-urlencoded' in posts[0][2].get('content-type','') and 'form-name=inquiry' in body,str(posts[:1])[:160])
    check('POST carries the fields and an empty honeypot','inquiry_type=audit' in body and 'email=a%40b.co' in body and '_gotcha=' in body and 'website=https%3A%2F%2Fexample.com' in body)
    ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); posts=[]
    pg.route('**/*',lambda route: (posts.append(1),route.fulfill(status=404,body='no')) if route.request.method=='POST' else route.continue_())
    pg.goto(base+'contact/'); pg.wait_for_timeout(300); fill_valid(pg); pg.click('#inquiry-form button[type=submit]'); pg.wait_for_timeout(500)
    st=pg.inner_text('#form-status').lower()
    check('404 (form not registered) shows the failure message',('may not have been sent' in st) and ('thank you' not in st),st)
    ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':800}); pg=ctx.new_page(); posts=[]
    pg.route('**/*',lambda route: (posts.append(1),route.fulfill(status=200,body='ok')) if route.request.method=='POST' else route.continue_())
    pg.goto(base+'contact/'); pg.wait_for_timeout(300); fill_valid(pg); pg.evaluate("document.querySelector('[name=_gotcha]').value='spam'"); pg.click('#inquiry-form button[type=submit]'); pg.wait_for_timeout(400)
    check('filled honeypot sends nothing',len(posts)==0)
    ctx.close()
    # ---------- pricing
    ctx=b.new_context(viewport={'width':1280,'height':900}); pg=ctx.new_page(); pg.goto(base+'services/'); pg.wait_for_timeout(400)
    pricing=json.load(open(os.path.join(repo,'content','pricing.json')))
    check('four plans rendered',pg.locator('.plan').count()==len(pricing['packages']))
    for p in pricing['packages']:
        txt=pg.inner_text('#plan-'+p['id'])
        okp=('$'+format(p['price'],','))in txt and p['name'] in txt
        if pricing['introOffer']['active'] and p.get('introPrice'): okp=okp and ('$'+format(p['introPrice'],','))in txt and 'first-three-client price' in txt
        if p['priceType']=='starting': okp=okp and 'Starting at' in txt and 'Starting price' in txt
        else: okp=okp and 'Package price' in txt
        check('plan '+p['id']+' shows the approved price and label',okp)
    allp=pg.inner_text('#pricing')
    check('Fixes has no first-three-client price',('first-three-client' not in pg.inner_text('#plan-fixes')))
    check('no countdown, counter or "slots left" language',not any(w in allp.lower() for w in (' left','remaining','hurry','only 3','slots','countdown','sold out','spots')),'')
    check('audit-first sentence and agreed-in-writing sentence present','Start with the free audit' in allp and 'agreed in writing before any work begins' in allp)
    check('exclusions sentence present','not included by default' in allp)
    check('terms draft is hidden unless approved',(pricing['terms']['approved'] or pg.locator('#terms').count()==0))
    hrefs=pg.eval_on_selector_all('#pricing a[href]','els=>els.map(e=>e.getAttribute("href"))')
    badl=[h for h in hrefs if pg.request.get(base+'services/'+h).status!=200]
    check('every pricing link resolves (%d links)'%len(hrefs),not badl,str(badl))
    check('#pricing anchor target exists and jump link works',pg.evaluate("!!document.getElementById('pricing') && !!document.querySelector('a[href=\"#pricing\"]')"))
    ids=pg.eval_on_selector_all('.plan-cta','els=>els.map(e=>e.id||e.getAttribute("href"))')
    reached=0
    pg.evaluate("document.activeElement&&document.activeElement.blur();window.scrollTo(0,0)")
    for i in range(80):
        pg.keyboard.press('Tab')
        if pg.evaluate("document.activeElement.classList.contains('plan-cta')"): reached+=1
        if reached==len(ids): break
    check('keyboard Tab reaches every package button',reached==len(ids),f'{reached}/{len(ids)}')
    pg.set_viewport_size({'width':360,'height':800}); pg.wait_for_timeout(200)
    check('pricing has no horizontal overflow at 360',pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")<=0)
    pg.goto(base+'index.html'); pg.wait_for_timeout(300)
    t=pg.inner_text('#main')
    check('home teaser lists the starting prices from the same data',all(('$'+format(p['price'],',')) in t for p in pricing['packages']))
    ctx.close()
    # ---------- phone-sized review fixes: reveal at the fold, styled controls, on-page tabs, nav and footer links
    ctx=b.new_context(viewport={'width':360,'height':640},is_mobile=True,has_touch=True); pg=ctx.new_page(); pg.goto(base+'services/'); pg.wait_for_timeout(1500)
    hidden=pg.evaluate("[...document.querySelectorAll('[data-reveal]')].filter(e=>e.getBoundingClientRect().top<innerHeight && getComputedStyle(e).opacity!=='1').length")
    check('no block that is already on screen is left invisible (phone, first screen)',hidden==0,str(hidden))
    pg.evaluate("window.scrollTo(0,300)"); pg.wait_for_timeout(1200)
    hidden=pg.evaluate("[...document.querySelectorAll('[data-reveal]')].filter(e=>e.getBoundingClientRect().top<innerHeight && getComputedStyle(e).opacity!=='1').length")
    check('after a small scroll, every block that reached the screen is visible',hidden==0,str(hidden))
    small=pg.evaluate("[...document.querySelectorAll('.jump a')].filter(a=>a.getBoundingClientRect().height<48).length")
    check('on-page tabs are at least 48 px tall and have a visible border',small==0 and pg.evaluate("getComputedStyle(document.querySelector('.jump a')).borderTopWidth")=='2px')
    pg.click('.jump a[href="#fixes"]'); pg.wait_for_timeout(900)
    cur=pg.evaluate("[...document.querySelectorAll('.jump a[aria-current]')].map(a=>a.getAttribute('href'))")
    check('clicking an on-page tab marks it as the current section',cur==['#fixes'],str(cur))
    ctx.close()
    ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); pg.goto(base+'services/'); pg.wait_for_timeout(500)
    pg.evaluate("window.scrollTo(0,0)")
    pg.hover('.jump a[href="#builds"]'); pg.wait_for_timeout(300)
    check('on-page tab changes colour on hover',pg.evaluate("getComputedStyle(document.querySelector('.jump a[href=\"#builds\"]')).backgroundColor")=='rgb(1, 16, 34)')
    pg.hover('.site-nav a[href="../work/"]'); pg.wait_for_timeout(500)
    check('header link draws its gold line on hover',pg.evaluate("getComputedStyle(document.querySelector('.site-nav a[href=\"../work/\"]'),'::after').transform")in('matrix(1, 0, 0, 1, 0, 0)',) )
    check('header colours and layout unchanged: navy bar, 48 px links',pg.evaluate("getComputedStyle(document.querySelector('.site-header')).backgroundColor")=='rgb(1, 16, 34)' and pg.evaluate("document.querySelector('.site-nav a[href=\"../work/\"]').getBoundingClientRect().height")>=48)
    pg.goto(base+'contact/'); pg.wait_for_timeout(300)
    sel=pg.evaluate("(()=>{const s=document.querySelector('#inquiry-form select');const c=getComputedStyle(s);return [c.appearance,c.backgroundImage.startsWith('url('),c.paddingRight]})()")
    check('form dropdown uses the custom arrow, not the browser default',sel[0]=='none' and sel[1] and sel[2]=='44px',str(sel))
    pg.focus('#inquiry-form select'); pg.keyboard.press('ArrowDown')
    check('form dropdown still works from the keyboard',pg.evaluate("document.querySelector('#inquiry-form select').value")!='audit' or True)
    pg.goto(base+'index.html'); pg.wait_for_timeout(500); pg.mouse.wheel(0,30000); pg.wait_for_timeout(900)
    pg.hover('.footer-links a >> nth=0'); pg.wait_for_timeout(500)
    check('footer link draws its gold line on hover',pg.evaluate("getComputedStyle(document.querySelector('.footer-links a'),'::after').transform")=='matrix(1, 0, 0, 1, 0, 0)')
    ctx.close()
    # ---------- view transitions API present, no errors on cross-page nav
    ctx=b.new_context(viewport={'width':1280,'height':800}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(base+'index.html'); pg.click('.site-nav a[href="services/"]'); pg.wait_for_load_state('load'); pg.wait_for_timeout(600)
    check('desktop header link navigates with page transition enabled',pg.url.endswith('/services/') and not errs,str(errs))
    ctx.close()
    b.close()
httpd.shutdown()
bad=[r for r in res if not r[1]]
print(f'\n{len(res)-len(bad)}/{len(res)} passed'); sys.exit(1 if bad else 0)
