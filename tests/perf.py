import sys, os, json, statistics, threading, http.server, socketserver, functools, gzip
from playwright.sync_api import sync_playwright
def serve(repo,port):
    socketserver.TCPServer.allow_reuse_address=True
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
        def do_GET(self):
            p=self.translate_path(self.path.split('?')[0])
            if os.path.isdir(p): p=os.path.join(p,'index.html')
            if os.path.exists(p) and p.endswith(('.css','.js','.html','.svg','.xml')):
                data=gzip.compress(open(p,'rb').read(),6)
                ctype={'css':'text/css','js':'text/javascript','html':'text/html','svg':'image/svg+xml','xml':'application/xml'}[p.rsplit('.',1)[1]]
                self.send_response(200); self.send_header('Content-Type',ctype+'; charset=utf-8'); self.send_header('Content-Encoding','gzip'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
            else: super().do_GET()
    h=socketserver.TCPServer(('127.0.0.1',port),functools.partial(Q,directory=repo)); threading.Thread(target=h.serve_forever,daemon=True).start(); return h
JS="""() => new Promise(res => {
  const out={lcp:0,cls:0,tbt:0};
  new PerformanceObserver(l=>{for(const e of l.getEntries()){out.lcp=e.startTime;out.el=e.element?e.element.tagName+'.'+e.element.className:'?'}}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) out.cls+=e.value}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) if(e.duration>50) out.tbt+=e.duration-50}).observe({type:'longtask',buffered:true});
  setTimeout(()=>res(out),2500);
})"""
def run(repo,port,path,runs=5):
    h=serve(repo,port); rows=[]
    with sync_playwright() as p:
        b=p.chromium.launch()
        for i in range(runs):
            ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True); pg=ctx.new_page()
            cdp=ctx.new_cdp_session(pg); cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':1.6*1024*1024/8,'uploadThroughput':750*1024/8})
            cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
            total=[0]; n=[0]
            cdp.on('Network.loadingFinished',lambda e:(total.__setitem__(0,total[0]+e['encodedDataLength']),n.__setitem__(0,n[0]+1)))
            pg.add_init_script("window.__m=null")
            pg.goto(f'http://127.0.0.1:{port}/{path}',wait_until='load')
            m=pg.evaluate(JS)
            nav=pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];return {dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd}})()")
            rows.append({**m,**nav,'bytes':total[0],'requests':n[0]}); ctx.close()
        b.close()
    h.shutdown(); h.server_close()
    med={k:statistics.median(r[k] for r in rows) for k in rows[0] if k!='el'}; med['el']=rows[-1].get('el')
    return med
if __name__=='__main__':
    # usage: python tests/perf.py label=path [label=path ...]   (lab numbers only: throttled mobile profile, gzip like the host)
    args=[a.split('=',1) for a in sys.argv[1:]] or [('this repo',os.path.abspath(os.path.join(os.path.dirname(__file__),'..')))]
    for n,(label,repo) in enumerate(args):
        for path in ('index.html','services/'):
            m=run(os.path.abspath(repo),8800+n,path)
            print(f"{label:12} {path:11} LCP {m['lcp']:.0f} ms | CLS {m['cls']:.3f} | DCL {m['dcl']:.0f} ms | load {m['load']:.0f} ms | {m['bytes']/1024:.0f} KB transferred | LCP element {m['el']}")
