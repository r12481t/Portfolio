import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
import fixture
repo=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..')); PORT=8769
socketserver.TCPServer.allow_reuse_address=True
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
httpd=socketserver.TCPServer(('127.0.0.1',PORT),functools.partial(Q,directory=repo)); threading.Thread(target=httpd.serve_forever,daemon=True).start()
AXE=os.environ.get('AXE_JS',os.path.join(os.path.dirname(__file__),'node_modules','axe-core','axe.min.js'))
if not os.path.exists(AXE): sys.exit('axe-core not installed. Run: cd tests && npm install axe-core   (or set AXE_JS to axe.min.js)')
axe=open(AXE).read()
pages=['index.html','services/','services/builds/','work/','about/','contact/','privacy/','courses/','learn/']+sys.argv[2:]
tot=0
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (390,1280):
        ctx=b.new_context(viewport={'width':w,'height':900}); pg=ctx.new_page()
        for path in pages:
            pg.goto(f'http://127.0.0.1:{PORT}/{path}'); pg.wait_for_timeout(500)
            pg.mouse.wheel(0,20000); pg.wait_for_timeout(900)   # reveal everything before testing contrast
            pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(200)
            pg.evaluate(axe)
            r=pg.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})")
            v=r['violations']; tot+=len(v)
            print(f'{w:>4} {path:<22} violations={len(v)} passes={len(r["passes"])} incomplete={len(r["incomplete"])}')
            for x in v:
                print('     -',x['id'],x['impact'],'|',x['help'],'|',len(x['nodes']),'node(s):',x['nodes'][0]['target'],x['nodes'][0].get('failureSummary','')[:140].replace('\n',' '))
        ctx.close()
    b.close()
httpd.shutdown(); print('TOTAL violations',tot)
