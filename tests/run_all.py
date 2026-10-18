"""Runs the whole local test suite and prints one summary. Usage: python tests/run_all.py
Needs: Python 3.8+, `pip install playwright` and `playwright install chromium`. The accessibility scan also needs
`cd tests && npm install axe-core`; it is skipped with a clear note if axe-core is missing.
Browser tests run in headless Chromium only. Nothing here tests Safari, Firefox, real phones, screen readers or live delivery of the form."""
import os, re, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.dirname(here)
sys.path.insert(0, here)
import fixture
sample = fixture.build(repo)   # throwaway copy with SAMPLE lessons; the real repo is never changed
steps = [
    ('content and pricing check', [sys.executable, os.path.join(repo, 'tools', 'site.py'), 'check']),
    ('SEO and metadata', [sys.executable, os.path.join(here, 'seo_check.py'), repo]),
    ('admin panel (temp copy)', [sys.executable, os.path.join(here, 'admin_test.py')]),
    ('lesson and pricing tooling (temp copy)', [sys.executable, os.path.join(here, 'tools_test.py')]),
    ('interaction, form, pricing', [sys.executable, os.path.join(here, 'interact.py'), repo]),
    ('SEO and metadata with sample lessons published', [sys.executable, os.path.join(here, 'seo_check.py'), sample]),
    ('learning library (sample data)', [sys.executable, os.path.join(here, 'learn_test.py'), sample]),
    ('link, overflow and console crawl', [sys.executable, os.path.join(here, 'crawl.py'), repo]),
    ('link, overflow and console crawl (reduced motion)', [sys.executable, os.path.join(here, 'crawl.py'), repo, '--motion', 'reduce']),
    ('accessibility scan (axe-core), all pages plus a sample lesson page', [sys.executable, os.path.join(here, 'axe_run.py'), sample, 'learn/what-is-a-variable/']),
]
fails = 0
for name, cmd in steps:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = r.stdout + r.stderr
    if 'crawl.py' in cmd[1]:
        import json
        try:
            d = json.loads(r.stdout); problems = len(d['broken_links']) + len(d['overflow']) + sum(1 for k, v in d['console'].items() if v and not k.startswith(('projects', 'ruhan')))
            line = f"{len(d['pages'])} pages, {len(d['broken_links'])} broken links, {len(d['overflow'])} overflows, {problems - len(d['broken_links']) - len(d['overflow'])} pages with console errors"
            ok = problems == 0
        except Exception: line, ok = out[-200:], False
    elif 'axe-core not installed' in out: line, ok = 'SKIPPED (axe-core not installed)', None
    elif 'axe_run' in cmd[1]:
        m = re.search(r'TOTAL violations (\d+)', out); line = f'{m.group(0)}' if m else out[-200:]; ok = bool(m) and m.group(1) == '0'
    elif 'site.py' in cmd[1]:
        m = re.search(r'checked .*', out); line = m.group(0) if m else out[-200:]; ok = r.returncode == 0
    else:
        m = re.findall(r'(\d+/\d+) passed', out); line = (m[-1] + ' passed') if m else out[-200:]; ok = r.returncode == 0
    if ok is False: fails += 1; print('FAIL', name, '-', line); print('\n'.join('   ' + l for l in out.splitlines() if l.startswith(('FAIL', 'PROBLEM', '  -', '     -'))))
    else: print('SKIP' if ok is None else 'PASS', name, '-', line)
print('\nALL STEPS PASSED' if not fails else f'\n{fails} STEP(S) FAILED'); sys.exit(1 if fails else 0)
