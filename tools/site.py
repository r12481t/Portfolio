#!/usr/bin/env python3
"""Curiohatch site helper. Python 3.8+, standard library only. Run it from anywhere; it finds the repo itself.

This is a convenience for the person editing the site. The website does not need it to run: it only writes
plain HTML files that are then committed like any other file.

    python tools/site.py chrome          Rewrite the shared header, menu drawer and footer on every Curiohatch page.
    python tools/site.py sync            Rebuild what is generated from the content files:
                                         the topic list on /learn/, the course list on /courses/, every topic page's
                                         head and frame (the written article is never touched), the prices on /services/
                                         and the home page (from content/pricing.json), sitemap.xml.
    python tools/site.py new SLUG "Title"  Add a draft topic record and its page.
    python tools/site.py covered [WORDS] List what is already covered (concepts included) so a new video does not repeat it.
    python tools/site.py check           Validate the content files and report anything out of date. Changes nothing.

Why it exists: the header, drawer and footer are the same on ten or more pages, and a topic's title, summary and dates
would otherwise have to be typed in several places. Here each fact is written once.
"""
import argparse, datetime, difflib, glob, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOMAIN = 'https://curiohatch.studio'
YOUTUBE = 'https://www.youtube.com/@curiohatchstudio'
CSS_V, JS_V, LEARN_JS_V = 2, 2, 1
TOPICS_FILE = os.path.join(ROOT, 'content', 'learn', 'topics.json')
COURSES_FILE = os.path.join(ROOT, 'content', 'courses', 'courses.json')
PRICING_FILE = os.path.join(ROOT, 'content', 'pricing.json')
PROJECTS_FILE = os.path.join(ROOT, 'content', 'projects.json')
PROJECT_STATUSES = ['draft', 'published', 'archived']
PROJECT_GROUPS = ['projects', 'templates']
GENERATED_MARK = '<!-- GENERATED:PROJECT -->'
TOPIC_STATUSES = ['planned', 'drafted', 'reviewed', 'published', 'archived']
COURSE_STATUSES = ['planned', 'upcoming', 'available', 'archived']
SLUG_RE = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
VIDEO_RE = re.compile(r'^[A-Za-z0-9_-]{11}$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
PLACEHOLDER = 'ARTICLE_PLACEHOLDER'

# Curiohatch pages that carry the shared chrome. Topic pages under learn/ are added automatically.
STATIC_PAGES = ['index.html', 'services/index.html', 'services/builds/index.html', 'work/index.html', 'about/index.html',
                'contact/index.html', 'privacy/index.html', 'courses/index.html', 'learn/index.html']
# Pages listed in sitemap.xml besides published topics (project write-ups are public work evidence). The two case studies are
# written without .html because that is the address Netlify serves for them (checked on the live site).
SITEMAP_PAGES = ['', 'services/', 'services/builds/', 'work/', 'about/', 'contact/', 'privacy/', 'courses/', 'learn/',
                 'projects/taqen/case-study', 'projects/classley/case-study']


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def esc(s):
    return html.escape(str(s), quote=True)


def load_json(path, key):
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    return data.get(key, [])


def valid_date(iso):
    try:
        datetime.date.fromisoformat(iso)
        return bool(DATE_RE.match(iso))
    except (ValueError, TypeError):
        return False


def pretty_date(iso):
    d = datetime.date.fromisoformat(iso)
    return d.strftime('%B ') + str(d.day) + d.strftime(', %Y')


def topic_pages():
    return sorted(glob.glob(os.path.join(ROOT, 'learn', '*', 'index.html')))


def generated_projects(projects=None):
    projects = load_json(PROJECTS_FILE, 'projects') if projects is None else projects
    return [p for p in projects if p.get('page') == 'generated']


def all_chrome_pages():
    pages = list(STATIC_PAGES)
    for p in topic_pages():
        pages.append(os.path.relpath(p, ROOT).replace(os.sep, '/'))
    for p in generated_projects():
        pages.append(f'projects/{p["slug"]}/index.html')
    return [p for p in pages if os.path.exists(os.path.join(ROOT, p))]


# ---------------------------------------------------------------- shared chrome
def prefix(rel):
    return '../' * rel.count('/')


def render_header(rel):
    P = prefix(rel)
    here = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    def item(label, href):
        cur = ' aria-current="page"' if href == here else ''
        return f'<li><a href="{P}{href}"{cur}>{label}</a></li>'
    items = ''.join([item('Services', 'services/'), item('Work', 'work/'), item('About', 'about/'), item('Contact', 'contact/')])
    brand_href = P if P else './'
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="{brand_href}"><img src="{P}assets/brand/wordmark-cream-320.webp" width="160" height="32" alt="Curiohatch"></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="drawer" hidden>Menu</button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>
        {items}
        <li><a class="btn btn--gold" href="{P}contact/?type=audit">Get a free audit</a></li>
      </ul>
    </nav>
  </div>
</header>'''


def render_footer(rel):
    P = prefix(rel)
    here = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    def link(label, href, external=False):
        cur = ' aria-current="page"' if (not external and href == here) else ''
        full = href if external else P + href
        return f'<li><a href="{full}"{cur}>{label}</a></li>'
    def drawer_link(i, label, href):
        cur = ' aria-current="page"' if href == here else ''
        return f'<li style="--i:{i}"><a href="{P}{href}"{cur}>{label}</a></li>'
    def sub_link(label, href, external=False):
        full = href if external else P + href
        cur = ' aria-current="page"' if (not external and href == here) else ''
        return f'<li><a href="{full}"{cur}>{label}</a></li>'
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="{P}assets/brand/badge-128.webp" width="64" height="64" alt="">
        <p>Curiohatch is a studio name used by Ruhan Tahlil. It is not a registered company.</p>
      </div>
      <nav class="footer-col" aria-labelledby="f-studio">
        <h2 id="f-studio">Studio</h2>
        <ul class="footer-links">
          {link('Services', 'services/')}
          {link('Website builds', 'services/builds/')}
          {link('Work', 'work/')}
          {link('About', 'about/')}
        </ul>
      </nav>
      <nav class="footer-col" aria-labelledby="f-start">
        <h2 id="f-start">Get started</h2>
        <ul class="footer-links">
          {link('Free website audit', 'contact/?type=audit')}
          {link('Start a project', 'contact/?type=website')}
          {link('Pricing', 'services/#pricing')}
          {link('Contact', 'contact/')}
        </ul>
      </nav>
      <nav class="footer-col" aria-labelledby="f-learn">
        <h2 id="f-learn">Learn</h2>
        <ul class="footer-links">
          {link('Courses', 'courses/')}
          {link('Learning library', 'learn/')}
          {link('Curiohatch on YouTube', YOUTUBE, True)}
        </ul>
      </nav>
      <nav class="footer-col" aria-labelledby="f-more">
        <h2 id="f-more">More</h2>
        <ul class="footer-links">
          {link('Ruhan&rsquo;s portfolio', 'ruhan/Ruhan-portfolio.html')}
          {link('Privacy', 'privacy/')}
        </ul>
      </nav>
    </div>
    <p class="footer-small"><span>&copy; 2026 Curiohatch</span><a href="#main">Back to top</a></p>
  </div>
</footer>
<div class="drawer" id="drawer">
  <div class="drawer-backdrop" data-drawer-close></div>
  <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <div class="drawer-top">
      <p class="mono-label" id="drawer-title">Menu</p>
      <button class="drawer-close" type="button" data-drawer-close>Close</button>
    </div>
    <nav aria-label="Menu">
      <ul class="drawer-links">
        {drawer_link(1, 'Services', 'services/')}
        {drawer_link(2, 'Work', 'work/')}
        {drawer_link(3, 'About', 'about/')}
        {drawer_link(4, 'Contact', 'contact/')}
      </ul>
    </nav>
    <div class="drawer-cta" style="--i:5">
      <a class="btn btn--gold" href="{P}contact/?type=audit">Get a free website audit</a>
      <p>The audit is free, and you do not have to buy anything afterward.</p>
    </div>
    <nav class="drawer-learn" style="--i:6" aria-label="Learn">
      <p class="mono-label">Learn</p>
      <ul class="drawer-sub">
        {sub_link('Courses', 'courses/')}
        {sub_link('Learning library', 'learn/')}
        {sub_link('Curiohatch on YouTube', YOUTUBE, True)}
      </ul>
    </nav>
  </div>
</div>'''


def marked(name, body):
    return f'<!-- CHROME:{name}:START -->\n{body}\n<!-- CHROME:{name}:END -->'


def apply_chrome(text, rel):
    S = re.S
    header = marked('HEADER', render_header(rel))
    footer = marked('FOOTER', render_footer(rel))
    if '<!-- CHROME:HEADER:START -->' in text:
        text = re.sub(r'<!-- CHROME:HEADER:START -->.*?<!-- CHROME:HEADER:END -->', lambda m: header, text, flags=S)
    else:
        text, n = re.subn(r'<a class="skip-link" href="#main">Skip to content</a>\s*<header class="site-header">.*?</header>', lambda m: header, text, count=1, flags=S)
        if n == 0:
            raise SystemExit(f'{rel}: could not find the header to replace')
    if '<!-- CHROME:FOOTER:START -->' in text:
        text = re.sub(r'<!-- CHROME:FOOTER:START -->.*?<!-- CHROME:FOOTER:END -->', lambda m: footer, text, flags=S)
    else:
        text, n = re.subn(r'<footer class="site-footer">.*?</footer>', lambda m: footer, text, count=1, flags=S)
        if n == 0:
            raise SystemExit(f'{rel}: could not find the footer to replace')
    # head: the "js" class (lets CSS know scripts run) and cache-busting numbers
    if "documentElement.className+=' js'" not in text:
        text = text.replace('<link rel="stylesheet" href="', "<script>document.documentElement.className+=' js'</script>\n<link rel=\"stylesheet\" href=\"", 1)
    text = re.sub(r'(css/site\.css)\?v=\d+', rf'\1?v={CSS_V}', text)
    text = re.sub(r'(js/site\.js)\?v=\d+', rf'\1?v={JS_V}', text)
    text = re.sub(r'(js/learn\.js)\?v=\d+', rf'\1?v={LEARN_JS_V}', text)
    return text


def cmd_chrome(write_files=True):
    changed = []
    for rel in all_chrome_pages():
        path = os.path.join(ROOT, rel)
        old = read(path)
        new = apply_chrome(old, rel)
        if new != old:
            changed.append(rel)
            if write_files:
                write(path, new)
    return changed


# ---------------------------------------------------------------- learning content
def published_topics(topics):
    return sorted([t for t in topics if t.get('status') == 'published'], key=lambda t: (t.get('publishedAt', ''), t.get('title', '')), reverse=True)


def topic_card(t):
    tags = '|'.join(t.get('tags', []))
    haystack = ' '.join([t.get('title', ''), t.get('summary', ''), t.get('category', ''), ' '.join(t.get('tags', [])),
                         ' '.join(t.get('subtopics', [])), ' '.join(t.get('concepts', []))]).lower()
    cat = f'<p class="tag">{esc(t["category"])}</p>' if t.get('category') else ''
    return (f'<li data-category="{esc(t.get("category", ""))}" data-tags="{esc(tags)}" data-text="{esc(haystack)}">\n'
            f'  <article class="card">\n    {cat}\n    <h3><a href="{esc(t["slug"])}/">{esc(t["title"])}</a></h3>\n'
            f'    <p>{esc(t["summary"])}</p>\n'
            f'    <p class="card-meta">Published <time datetime="{t["publishedAt"]}">{pretty_date(t["publishedAt"])}</time></p>\n  </article>\n</li>')


def render_library(topics):
    pub = published_topics(topics)
    if not pub:
        return ('<div class="empty" id="library-empty">\n'
                '  <h2>No topics are published yet</h2>\n'
                '  <p>Each Curiohatch video will get a written lesson here, with the video, the explanation, the key ideas and links to related lessons. Nothing has been published yet, so this list is empty.</p>\n'
                f'  <p>The videos come first. You can find them on <a href="{YOUTUBE}">the Curiohatch YouTube channel</a>.</p>\n'
                '</div>')
    cards = '\n'.join(topic_card(t) for t in pub)
    return f'<h2>All topics</h2>\n<ul class="cards" id="topic-list">\n{cards}\n</ul>'


def course_card(c):
    status = c['status']
    if status == 'available':
        tag = 'Available'
        title = f'<a href="{esc(c["url"])}">{esc(c["title"])}</a>'
    else:
        tag = 'Planned. Not available yet.'
        title = esc(c['title'])
    facts = []
    if c.get('audience'): facts.append(('For', c['audience']))
    if c.get('level'): facts.append(('Level', c['level']))
    if c.get('duration'): facts.append(('Length', c['duration']))
    if c.get('prerequisites'): facts.append(('Before you start', c['prerequisites']))
    meta = ''
    if facts:
        meta = '<dl class="proj-meta" style="color:var(--muted)">' + ''.join(f'<dt style="color:var(--navy)">{esc(k)}</dt><dd>{esc(v)}</dd>' for k, v in facts) + '</dl>'
    cat = f'<p class="card-meta">{esc(c["category"])}</p>' if c.get('category') else ''
    return (f'<li>\n  <article class="card">\n    <p class="tag">{tag}</p>\n    <h3>{title}</h3>\n    <p>{esc(c["summary"])}</p>\n    {meta}\n    {cat}\n  </article>\n</li>')


def render_courses(courses):
    live = [c for c in courses if c.get('status') == 'available']
    plan = [c for c in courses if c.get('status') in ('planned', 'upcoming')]
    if not live and not plan:
        return ('<div class="empty" id="courses-empty">\n'
                '  <h3>No courses yet</h3>\n'
                '  <p>No Curiohatch course exists yet, so there is nothing to enrol in and nothing to buy. When one is ready it will be listed here with what it covers, who it is for and how to start.</p>\n'
                '  <p>In the meantime, the <a href="../learn/">Learning library</a> collects the written lessons that go with each video.</p>\n'
                '</div>')
    out = []
    if live:
        out.append('<h2>Available now</h2>\n<ul class="cards">\n' + '\n'.join(course_card(c) for c in live) + '\n</ul>')
    if plan:
        out.append('<h2 style="margin-top:3rem">Planned</h2>\n<p class="prose">These are plans. They are not available yet, and no release date is promised.</p>\n<ul class="cards">\n' + '\n'.join(course_card(c) for c in plan) + '\n</ul>')
    return '\n'.join(out)


def replace_between(text, tag, body):
    pat = re.compile(rf'<!-- {tag}:START -->.*?<!-- {tag}:END -->', re.S)
    if not pat.search(text):
        raise SystemExit(f'missing <!-- {tag}:START --> / <!-- {tag}:END --> markers')
    return pat.sub(lambda m: f'<!-- {tag}:START -->\n{body}\n<!-- {tag}:END -->', text)


ARTICLE_RE = re.compile(r'<!-- ARTICLE:START -->(.*?)<!-- ARTICLE:END -->', re.S)


def render_topic(t, topics, courses, article):
    P = '../../'
    rel = f'learn/{t["slug"]}/index.html'
    by_id = {x['id']: x for x in topics}
    published = t.get('status') == 'published'
    canonical = f'{DOMAIN}/learn/{t["slug"]}/'
    title = t['title']
    summary = t.get('summary', '')
    robots = '' if published else '<meta name="robots" content="noindex">\n'
    ld = ''
    if published:
        data = {'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': summary,
                'datePublished': t['publishedAt'], 'dateModified': t.get('updatedAt') or t['publishedAt'],
                'mainEntityOfPage': canonical, 'publisher': {'@type': 'Organization', 'name': 'Curiohatch'}}
        ld = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'
    cat = t.get('category')
    crumbs = f'<p class="crumbs"><a href="../">Learning library</a>' + (f' &middot; {esc(cat)}' if cat else '') + '</p>'
    meta = ''
    if published:
        meta = f'<p class="topic-meta">Published <time datetime="{t["publishedAt"]}">{pretty_date(t["publishedAt"])}</time>'
        if t.get('updatedAt') and t['updatedAt'] != t['publishedAt']:
            meta += f' &middot; Updated <time datetime="{t["updatedAt"]}">{pretty_date(t["updatedAt"])}</time>'
        meta += '</p>'
    else:
        meta = f'<p class="topic-meta">Status: {esc(t.get("status", "drafted"))}. This page is not public, not listed and not in the sitemap.</p>'
    video = ''
    if t.get('videoId'):
        vid = t['videoId']
        video = (f'<div class="video" data-video-id="{esc(vid)}" data-title="{esc(title)}">\n'
                 f'  <p>Playing the video loads it from YouTube. <a href="https://www.youtube.com/watch?v={esc(vid)}">Watch on YouTube instead</a></p>\n</div>\n')
    side = []
    if t.get('concepts'):
        side.append('<h2>Concepts covered</h2>\n<ul>' + ''.join(f'<li>{esc(c)}</li>' for c in t['concepts']) + '</ul>')
    pre = [by_id[i] for i in t.get('prerequisites', []) if i in by_id and by_id[i].get('status') == 'published']
    if pre:
        side.append('<h2>Before you start</h2>\n<ul>' + ''.join(f'<li><a href="../{esc(x["slug"])}/">{esc(x["title"])}</a></li>' for x in pre) + '</ul>')
    rel_topics = [by_id[i] for i in t.get('related', []) if i in by_id and by_id[i].get('status') == 'published']
    if rel_topics:
        side.append('<h2>Related topics</h2>\n<ul>' + ''.join(f'<li><a href="../{esc(x["slug"])}/">{esc(x["title"])}</a></li>' for x in rel_topics) + '</ul>')
    cmap = {c['id']: c for c in courses}
    live = [cmap[i] for i in t.get('courses', []) if i in cmap and cmap[i].get('status') == 'available' and cmap[i].get('url')]
    if live:
        side.append('<h2>Part of a course</h2>\n<ul>' + ''.join(f'<li><a href="{esc(c["url"])}">{esc(c["title"])}</a></li>' for c in live) + '</ul>')
    side.append(f'<h2>More from Curiohatch</h2>\n<ul><li><a href="../">All topics</a></li><li><a href="{P}courses/">Courses</a></li><li><a href="{YOUTUBE}">YouTube channel</a></li></ul>')
    side_html = '\n'.join(side)
    og_title = esc(f'{title} | Curiohatch Learn')
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- FRAME:HEAD:START (written by tools/site.py from content/learn/topics.json; edit the JSON, not this block) -->
<title>{og_title}</title>
<meta name="description" content="{esc(summary)}">
<meta name="theme-color" content="#011022">
{robots}<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Curiohatch">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{esc(summary)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{DOMAIN}/assets/brand/social-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
{ld}<!-- FRAME:HEAD:END -->
<link rel="icon" href="{P}assets/brand/favicon.ico" sizes="48x48">
<link rel="icon" href="{P}assets/brand/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="{P}assets/brand/apple-touch-icon.png">
<link rel="preload" href="{P}assets/fonts/space-grotesk-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{P}assets/fonts/ibm-plex-sans-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.className+=' js'</script>
<link rel="stylesheet" href="{P}css/site.css?v={CSS_V}">
</head>
<body>
{marked('HEADER', render_header(rel))}
<main id="main">
<!-- FRAME:TOP:START (generated; edit the JSON) -->
<div class="sky sky--field band--navy">
  <div class="wrap page-head">
    {crumbs}
    <h1>{esc(title)}</h1>
    <p class="lede">{esc(summary)}</p>
    {meta}
  </div>
</div>
<!-- FRAME:TOP:END -->
<section class="band horizon">
  <div class="wrap topic-layout">
    <article class="article">
      <!-- FRAME:VIDEO:START (generated; edit the JSON) -->
      {video}<!-- FRAME:VIDEO:END -->
      <!-- ARTICLE:START -->{article}<!-- ARTICLE:END -->
    </article>
    <aside class="side" aria-label="About this topic">
      <!-- FRAME:SIDE:START (generated; edit the JSON) -->
      {side_html}
      <!-- FRAME:SIDE:END -->
    </aside>
  </div>
</section>
</main>
{marked('FOOTER', render_footer(rel))}
<script src="{P}js/site.js?v={JS_V}" defer></script>
</body>
</html>
'''


def placeholder_article(title):
    return (f'\n      <p><strong>{PLACEHOLDER}</strong>: write the lesson here and delete this line. Use h2 headings for sections, '
            'a short "Key takeaways" box at the end, and only code you have run.</p>\n      ')


def current_article(t):
    path = os.path.join(ROOT, 'learn', t['slug'], 'index.html')
    if os.path.exists(path):
        m = ARTICLE_RE.search(read(path))
        if m:
            return m.group(1)
    return placeholder_article(t['title'])


# ---------------------------------------------------------------- wording lint (warnings only)
CLAIM_RE = re.compile(r"(guarantee|\bbest\b|#1|\b100%|\baward|testimonial|\breview(s)?\b|\d+\s?%|\d+\s?x\b|\bdoubl|\btripl|\bboost|\bincreas|\bleading\b|top[- ]rated|\branked\b|\brevenue\b|\bsales\b|\bcustomers\b)", re.I)


def claim_warnings(label, text):
    """Words that often turn into claims the site cannot back up. A prompt to double-check, never a block."""
    found = sorted({m.group(0).lower() for m in CLAIM_RE.finditer(text or '')})
    return [f'{label}: check the wording of "{w}". Only say what you can show.' for w in found]


# ---------------------------------------------------------------- projects and case studies
def load_projects():
    return load_json(PROJECTS_FILE, 'projects')


def link_href(href, P):
    return href if re.match(r'^(https?:|mailto:|#)', href) else P + href


def effective_links(p):
    links = []
    if p.get('page') == 'generated':
        links.append({'label': 'Read the case study', 'href': f'projects/{p["slug"]}/'})
    return links + list(p.get('links', []))


def paragraphs(text):
    parts = [re.sub(r'\s*\n\s*', ' ', x).strip() for x in re.split(r'\n\s*\n', (text or '').strip())]
    return [x for x in parts if x]


def render_plate(p, P, home=False):
    links = effective_links(p)
    first = links[0]['href'] if links else ''
    title = f'<a href="{esc(link_href(first, P))}">{esc(p["title"])}</a>' if first else esc(p['title'])
    meta = []
    if p.get('builtBy') and not home: meta.append(('Built by', p['builtBy']))
    if p.get('builtWith'): meta.append(('Built with', p['builtWith']))
    if p.get('outcome'): meta.append(('Outcome', p['outcome']))
    dl = '<dl class="proj-meta">' + ''.join(f'<dt>{esc(k)}</dt><dd>{esc(v)}</dd>' for k, v in meta) + '</dl>\n        ' if meta else ''
    shows = f'<details><summary>What this shows</summary><div><p>{esc(p["shows"])}</p></div></details>\n        ' if p.get('shows') else ''
    lk = '<div class="links">' + ''.join(f'<a href="{esc(link_href(l["href"], P))}">{esc(l["label"])}</a>' for l in links) + '</div>\n        ' if links else ''
    return (f'<article class="proj">\n        <p class="tag">{esc(p["tag"])}</p>\n        <h3>{title}</h3>\n        <p>{esc(p["summary"])}</p>\n        '
            f'{dl}{shows}{lk}</article>').replace('\n        </article>', '\n      </article>')


def published_projects(projects, group=None):
    out = [p for p in projects if p.get('status') == 'published' and (group is None or p.get('group') == group)]
    return sorted(out, key=lambda p: (p.get('order', 100), p.get('title', '')))


def render_work(projects):
    P = '../'
    projs, tmpl = published_projects(projects, 'projects'), published_projects(projects, 'templates')
    if not projs and not tmpl:
        return ('<section class="band horizon">\n  <div class="wrap">\n    <div class="empty">\n      <h2>No projects are listed yet</h2>\n'
                '      <p>Projects will appear here when there is something real to show, labelled for what it is.</p>\n    </div>\n  </div>\n</section>')
    out, first = [], True
    if projs:
        plates = '\n      '.join(render_plate(p, P) for p in projs)
        out.append('<section class="band horizon">\n  <div class="wrap">\n    <div data-reveal><h2>Personal and team projects</h2>\n'
                   '    <p class="prose">Each project has its own page that says what was built, who built it and what happened. Open the details on any card to see what the project shows.</p></div>\n'
                   f'    <div class="showcase" data-reveal>\n      {plates}\n    </div>\n  </div>\n</section>')
        first = False
    if tmpl:
        plates = '\n      '.join(render_plate(p, P) for p in tmpl)
        cls = 'band band--cream2' + (' horizon' if first else '')
        out.append(f'<section class="{cls}">\n  <div class="wrap" data-reveal>\n    <h2>Sample templates</h2>\n    <div class="showcase">\n      {plates}\n    </div>\n  </div>\n</section>')
    return '\n\n'.join(out)


def render_home_projects(projects):
    feat = [p for p in published_projects(projects, 'projects') if p.get('featured')][:3]
    if not feat:
        return '<p class="prose">No projects are listed yet.</p>'
    return '\n      '.join(render_plate(p, '', home=True) for p in feat)


def render_project_page(p):
    P = '../../'
    rel = f'projects/{p["slug"]}/index.html'
    published = p.get('status') == 'published'
    canonical = f'{DOMAIN}/projects/{p["slug"]}/'
    title, summary = p['title'], p.get('summary', '')
    robots = '' if published else '<meta name="robots" content="noindex">\n'
    body = []
    for img in p.get('images', []):
        cap = f'<figcaption>{esc(img["caption"])}</figcaption>' if img.get('caption') else ''
        dims = f' width="{int(img["width"])}" height="{int(img["height"])}"' if img.get('width') and img.get('height') else ''
        body.append(f'<figure class="shot"><img src="{P}{esc(img["src"])}" alt="{esc(img.get("alt", ""))}"{dims} loading="lazy">{cap}</figure>')
    def section(h, text):
        ps = paragraphs(text)
        if ps: body.append(f'<h2>{h}</h2>\n' + '\n'.join(f'<p>{esc(x)}</p>' for x in ps))
    section('What was built', p.get('built'))
    section('Our part', p.get('role'))
    section('What happened', p.get('whatHappened'))
    if p.get('learned'):
        body.append('<h2>What we learned</h2>\n<ul>' + ''.join(f'<li>{esc(x)}</li>' for x in p['learned']) + '</ul>')
    meta = []
    if p.get('builtBy'): meta.append(('Built by', p['builtBy']))
    if p.get('builtWith'): meta.append(('Built with', p['builtWith']))
    if p.get('outcome'): meta.append(('Outcome', p['outcome']))
    side = ''.join(f'<h2>{esc(k)}</h2><p>{esc(v)}</p>' for k, v in meta)
    ext = [l for l in p.get('links', [])]
    if ext:
        side += '<h2>Links</h2><ul>' + ''.join(f'<li><a href="{esc(link_href(l["href"], P))}">{esc(l["label"])}</a></li>' for l in ext) + '</ul>'
    side += f'<h2>More</h2><ul><li><a href="{P}work/">All work</a></li><li><a href="{P}contact/?type=audit">Get a free website audit</a></li></ul>'
    og = esc(f'{title} | Curiohatch')
    return f'''<!doctype html>
<html lang="en">
{GENERATED_MARK}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{og}</title>
<meta name="description" content="{esc(summary)}">
<meta name="theme-color" content="#011022">
{robots}<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Curiohatch">
<meta property="og:title" content="{og}">
<meta property="og:description" content="{esc(summary)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{DOMAIN}/assets/brand/social-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{P}assets/brand/favicon.ico" sizes="48x48">
<link rel="icon" href="{P}assets/brand/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="{P}assets/brand/apple-touch-icon.png">
<link rel="preload" href="{P}assets/fonts/space-grotesk-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{P}assets/fonts/ibm-plex-sans-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.className+=' js'</script>
<link rel="stylesheet" href="{P}css/site.css?v={CSS_V}">
</head>
<body>
{marked('HEADER', render_header(rel))}
<main id="main">
<div class="sky sky--field band--navy">
  <div class="wrap page-head">
    <p class="crumbs"><a href="{P}work/">Work</a> &middot; {esc(p["tag"])}</p>
    <h1>{esc(title)}</h1>
    <p class="lede">{esc(summary)}</p>
  </div>
</div>
<section class="band horizon">
  <div class="wrap topic-layout">
    <article class="article">
{chr(10).join(body)}
    </article>
    <aside class="side" aria-label="About this project">
{side}
    </aside>
  </div>
</section>
</main>
{marked('FOOTER', render_footer(rel))}
<script src="{P}js/site.js?v={JS_V}" defer></script>
</body>
</html>
'''


# ---------------------------------------------------------------- pricing
def load_pricing():
    with open(PRICING_FILE, encoding='utf-8') as f:
        return json.load(f)


def money(n):
    return '${:,}'.format(n)


def render_plan(p, intro_on, P):
    starting = p['priceType'] == 'starting'
    tag = 'Starting price' if starting else 'Package price'
    from_html = '<span class="plan-from">Starting at</span> ' if starting else ''
    intro = ''
    if intro_on and p.get('introPrice'):
        lead = 'Starting at ' if starting else ''
        intro = f'<p class="plan-intro"><strong>{lead}{money(p["introPrice"])}</strong> first-three-client price</p>\n    '
    scope = ''
    if p.get('scope'):
        scope = '<ul class="stars">' + ''.join(f'<li>{esc(x)}</li>' for x in p['scope']) + '</ul>\n    '
    note = f'<p class="plan-note">{esc(p["note"])}</p>\n    ' if p.get('note') else ''
    cta = p['cta']
    return (f'<li class="plan" id="plan-{esc(p["id"])}">\n  <article>\n    <p class="tag">{tag}</p>\n    <h3>{esc(p["name"])}</h3>\n'
            f'    <p class="plan-price">{from_html}<span class="plan-amount">{money(p["price"])}</span></p>\n    {intro}'
            f'<p class="plan-summary">{esc(p["summary"])}</p>\n    {scope}{note}'
            f'<a class="btn btn--line plan-cta" href="{P}{esc(cta["href"])}">{esc(cta["label"])}<span class="sr-only"> for {esc(p["name"])}</span></a>\n  </article>\n</li>')


def render_pricing(pr, P):
    intro_on = bool(pr.get('introOffer', {}).get('active'))
    plans = '\n'.join(render_plan(p, intro_on, P) for p in pr['packages'])
    offer = f'<p class="prose">{esc(pr["introOffer"]["note"])}</p>\n    ' if intro_on else ''
    terms = ''
    if pr.get('terms', {}).get('approved'):
        items = ''.join(f'<li>{esc(t)}</li>' for t in pr['terms']['items'])
        terms = f'\n    <h3 id="terms" style="margin-top:2.5rem">Scope and terms</h3>\n    <ul class="stars prose">{items}</ul>'
    return f'''<h2>Prices</h2>
    <p class="prose">Start with the free audit. Then choose the package that fits, or ask for fixes. These are starting scopes, not unlimited-work agreements. Final scope, timeline, revisions, exclusions and payment terms are agreed in writing before any work begins.</p>
    {offer}<ul class="plans">
{plans}
    </ul>
    <p class="prose" style="margin-top:2rem">{esc(pr["notIncludedByDefault"])}</p>
    <p class="muted prose">{esc(pr["currencyNote"])}</p>{terms}
    <div class="btn-row"><a class="btn btn--gold" href="{P}contact/?type=audit">Get a free website audit</a></div>'''


def render_pricing_teaser(pr, P):
    def line(p):
        pre = 'from ' if p['priceType'] == 'starting' else ''
        return f'<li><strong>{esc(p["name"])}</strong>, {pre}{money(p["price"])}</li>'
    items = ''.join(line(p) for p in pr['packages'])
    return f'''<h2>Prices</h2>
    <p class="prose">The audit is free. After that, fixes and websites have published prices, and the scope is agreed in writing before work begins.</p>
    <ul class="stars prose">{items}</ul>
    <p style="margin-top:1rem"><a href="{P}services/#pricing">See what each package includes</a></p>'''


# ---------------------------------------------------------------- sitemap
def render_sitemap(topics):
    urls = [f'{DOMAIN}/{p}' for p in SITEMAP_PAGES]
    urls += [f'{DOMAIN}/learn/{t["slug"]}/' for t in sorted(published_topics(topics), key=lambda t: t['slug'])]
    urls += [f'{DOMAIN}/projects/{p["slug"]}/' for p in sorted(generated_projects(), key=lambda p: p['slug']) if p.get('status') == 'published']
    body = '\n'.join(f'  <url><loc>{esc(u)}</loc></url>' for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


# ---------------------------------------------------------------- commands
def expected_files():
    try:
        return _expected_files()
    except (ValueError, KeyError, TypeError) as e:
        raise SystemExit(f'cannot build the generated pages ({type(e).__name__}: {e}). A record in content/ has a bad value; run: python tools/site.py check')


def _expected_files():
    """Everything generated, as {relative path: text}. Used by sync (write) and check (compare)."""
    topics = load_json(TOPICS_FILE, 'topics')
    courses = load_json(COURSES_FILE, 'courses')
    out = {}
    learn = read(os.path.join(ROOT, 'learn', 'index.html'))
    out['learn/index.html'] = replace_between(learn, 'TOPICS', render_library(topics))
    courses_page = read(os.path.join(ROOT, 'courses', 'index.html'))
    out['courses/index.html'] = replace_between(courses_page, 'COURSES', render_courses(courses))
    for t in topics:
        if t.get('status') == 'planned':
            continue
        rel = f'learn/{t["slug"]}/index.html'
        try:
            out[rel] = render_topic(t, topics, courses, current_article(t))
        except (ValueError, KeyError, TypeError) as e:
            raise SystemExit(f'{t.get("slug", "?")}: cannot build the page ({e}). Fix the record, then run: python tools/site.py check')
    pr = load_pricing()
    services = read(os.path.join(ROOT, 'services', 'index.html'))
    out['services/index.html'] = replace_between(services, 'PRICING', render_pricing(pr, '../'))
    home = read(os.path.join(ROOT, 'index.html'))
    out['index.html'] = replace_between(home, 'PRICING-TEASER', render_pricing_teaser(pr, ''))
    projects = load_projects()
    work = read(os.path.join(ROOT, 'work', 'index.html'))
    out['work/index.html'] = replace_between(work, 'PROJECTS', render_work(projects))
    out['index.html'] = replace_between(out['index.html'], 'PROJECTS-HOME', render_home_projects(projects))
    for p in generated_projects(projects):
        if p.get('status') == 'archived' and not os.path.exists(os.path.join(ROOT, 'projects', p['slug'], 'index.html')):
            continue
        out[f'projects/{p["slug"]}/index.html'] = render_project_page(p)
    out['sitemap.xml'] = render_sitemap(topics)
    return out


def cmd_sync():
    files = expected_files()
    for rel, text in files.items():
        if rel.endswith('.html'):
            text = apply_chrome(text, rel)
        write(os.path.join(ROOT, rel), text)
    cmd_chrome()
    print(f'synced {len(files)} generated files and the shared chrome')


STOP = {'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'is', 'are', 'what', 'how', 'why', 'with', 'your', 'basics', 'intro', 'introduction', 'guide'}


def words(text):
    found = set(re.findall(r'[a-z0-9]+', text.lower())) - STOP
    return {w[:-1] if len(w) > 3 and w.endswith('s') else w for w in found}     # loops and loop count as one word


def similar_topics(title, slug, concepts, topics, exclude_id=None):
    """Topics already recorded that look like the same subject: close titles, close slugs or shared concepts."""
    found = []
    mine = words(title)
    my_concepts = {c.strip().lower() for c in concepts if c.strip()}
    for t in topics:
        if t.get('id') == exclude_id or t.get('status') == 'archived':
            continue
        theirs = words(t.get('title', ''))
        overlap = len(mine & theirs) / max(1, min(len(mine), len(theirs)))
        ratio = difflib.SequenceMatcher(None, slug, t.get('slug', '')).ratio()
        shared = my_concepts & {c.strip().lower() for c in t.get('concepts', [])}
        why = []
        if mine and theirs and overlap >= 0.67: why.append('similar title')
        if ratio >= 0.8: why.append('similar slug')
        if shared: why.append('same concept: ' + ', '.join(sorted(shared)))
        if why:
            found.append((t, '; '.join(why)))
    return found


def cmd_covered(terms):
    topics = [t for t in load_json(TOPICS_FILE, 'topics') if t.get('status') != 'archived']
    q = [w.lower() for w in terms]
    shown = 0
    for t in sorted(topics, key=lambda t: t.get('id', '')):
        hay = ' '.join([t.get('title', ''), t.get('summary', ''), t.get('category', ''), ' '.join(t.get('tags', [])), ' '.join(t.get('subtopics', [])), ' '.join(t.get('concepts', []))]).lower()
        if q and not all(w in hay for w in q):
            continue
        shown += 1
        concepts = ', '.join(t.get('concepts', [])) or '(none recorded)'
        print(f'{t["id"]}  {t["status"]:<9} {t.get("category", "") or "-":<18} {t["title"]}\n      concepts: {concepts}')
    print(f'{shown} topic(s) listed' + (f' for "{" ".join(terms)}"' if terms else '') + '. Archived topics are not shown.')


def cmd_new(slug, title, allow_similar=False):
    if not SLUG_RE.match(slug):
        raise SystemExit('slug must be lowercase words joined by hyphens, for example css-grid-basics')
    topics = load_json(TOPICS_FILE, 'topics')
    if any(t['slug'] == slug for t in topics):
        raise SystemExit(f'slug "{slug}" already exists')
    near = similar_topics(title, slug, [], topics)
    if near and not allow_similar:
        print('A similar topic is already recorded, so nothing was added:')
        for t, why in near:
            print(f'  {t["id"]} ({t["status"]}) {t["title"]}  [{why}]')
        raise SystemExit('If this really is a different lesson, run the command again with --allow-similar. To see what is covered: python tools/site.py covered')
    nums = [int(t['id'][1:]) for t in topics if re.match(r'^t\d+$', t.get('id', ''))]
    new_id = 't%03d' % (max(nums + [0]) + 1)
    rec = {'id': new_id, 'slug': slug, 'status': 'drafted', 'title': title, 'summary': '', 'category': '', 'subtopics': [],
           'tags': [], 'concepts': [], 'videoId': '', 'publishedAt': '', 'updatedAt': '', 'prerequisites': [], 'related': [], 'courses': []}
    topics.append(rec)
    write(TOPICS_FILE, json.dumps({'schema': 1, 'topics': topics}, indent=2, ensure_ascii=False) + '\n')
    cmd_sync()
    print(f'added {new_id} ({slug}) as a draft and created learn/{slug}/index.html. Fill in the record in content/learn/topics.json, write the article, then run: python tools/site.py sync')


def site_file_exists(href):
    path = href.split('#')[0].split('?')[0]
    full = os.path.join(ROOT, path)
    if path.endswith('/') or path == '':
        return os.path.exists(os.path.join(full, 'index.html'))
    return os.path.exists(full) or os.path.exists(full + '.html')


def collect_issues():
    problems, warnings = [], []
    try:
        topics = load_json(TOPICS_FILE, 'topics')
        courses = load_json(COURSES_FILE, 'courses')
    except json.JSONDecodeError as e:
        raise SystemExit(f'content file is not valid JSON: {e}')
    tid = [t.get('id') for t in topics]
    if len(set(tid)) != len(tid): problems.append('duplicate topic ids')
    slugs = [t.get('slug') for t in topics]
    if len(set(slugs)) != len(slugs): problems.append('duplicate topic slugs')
    cid = [c.get('id') for c in courses]
    if len(set(cid)) != len(cid): problems.append('duplicate course ids')
    topic_ids, course_ids = set(tid), set(cid)
    for t in topics:
        n = t.get('id') or t.get('slug') or '?'
        if not SLUG_RE.match(t.get('slug', '')): problems.append(f'{n}: slug is missing or not lowercase-hyphenated')
        if t.get('status') not in TOPIC_STATUSES: problems.append(f'{n}: status must be one of {TOPIC_STATUSES}')
        if not t.get('title'): problems.append(f'{n}: title is missing')
        for field in ('prerequisites', 'related'):
            for ref in t.get(field, []):
                if ref not in topic_ids: problems.append(f'{n}: {field} points to unknown id {ref}')
                elif ref == t.get('id'): problems.append(f'{n}: {field} points to itself')
        for ref in t.get('courses', []):
            if ref not in course_ids: problems.append(f'{n}: courses points to unknown id {ref}')
        if t.get('status') == 'published':
            if not t.get('summary'): problems.append(f'{n}: published but summary is empty')
            elif len(t['summary']) > 170: warnings.append(f'{n}: summary is {len(t["summary"])} characters; search results cut it near 160')
            if not VIDEO_RE.match(t.get('videoId', '')): problems.append(f'{n}: published but videoId is not an 11-character YouTube id')
            if not valid_date(t.get('publishedAt', '')): problems.append(f'{n}: published but publishedAt is not a real date written YYYY-MM-DD')
            if t.get('updatedAt') and (not valid_date(t['updatedAt']) or t['updatedAt'] < t.get('publishedAt', '')): problems.append(f'{n}: updatedAt is invalid or earlier than publishedAt')
            if not t.get('category'): warnings.append(f'{n}: no category')
            page = os.path.join(ROOT, 'learn', t.get('slug', '_'), 'index.html')
            if not os.path.exists(page): problems.append(f'{n}: published but learn/{t.get("slug")}/index.html does not exist; run sync')
            else:
                art = ARTICLE_RE.search(read(page))
                if not art or PLACEHOLDER in art.group(1): problems.append(f'{n}: published but the article is still the placeholder')
                elif len(re.sub(r'<[^>]+>', ' ', art.group(1)).split()) < 300: warnings.append(f'{n}: article is under 300 words; make sure it adds more than the video does')
            for ref in t.get('related', []) + t.get('prerequisites', []):
                other = next((x for x in topics if x['id'] == ref), None)
                if other and other.get('status') != 'published': warnings.append(f'{n}: links to {ref}, which is not published, so the link is left out of the page')
        elif t.get('status') in ('drafted', 'reviewed', 'archived'):
            page = os.path.join(ROOT, 'learn', t.get('slug', '_'), 'index.html')
            if os.path.exists(page) and 'name="robots" content="noindex"' not in read(page): problems.append(f'{n}: not published but its page is indexable; run sync')
    seen = set()
    for t in topics:
        if t.get('status') == 'archived':
            continue
        for other, why in similar_topics(t.get('title', ''), t.get('slug', ''), t.get('concepts', []), topics, exclude_id=t.get('id')):
            key = tuple(sorted([t.get('id', ''), other.get('id', '')]))
            if key not in seen:
                seen.add(key)
                warnings.append(f'{key[0]} and {key[1]} may cover the same ground ({why}). Merge them, or make their concepts distinct.')
    for c in courses:
        n = c.get('id') or c.get('title') or '?'
        if c.get('status') not in COURSE_STATUSES: problems.append(f'{n}: course status must be one of {COURSE_STATUSES}')
        if not c.get('title') or not c.get('summary'): problems.append(f'{n}: course needs a title and summary')
        if c.get('status') == 'available' and not c.get('url'): problems.append(f'{n}: available course needs a url that works')
        for ref in c.get('lessons', []):
            if ref not in topic_ids: problems.append(f'{n}: lessons points to unknown topic id {ref}')
    # projects and case studies
    projects = load_projects()
    pids = [p.get('id') for p in projects]
    if len(set(pids)) != len(pids): problems.append('duplicate project ids')
    pslugs = [p.get('slug') for p in projects]
    if len(set(pslugs)) != len(pslugs): problems.append('duplicate project slugs')
    for p in projects:
        n = p.get('id') or p.get('slug') or '?'
        if not SLUG_RE.match(p.get('slug', '')): problems.append(f'project {n}: slug is missing or not lowercase-hyphenated')
        if p.get('status') not in PROJECT_STATUSES: problems.append(f'project {n}: status must be one of {PROJECT_STATUSES}')
        if p.get('group') not in PROJECT_GROUPS: problems.append(f'project {n}: group must be one of {PROJECT_GROUPS}')
        if p.get('page') not in ('generated', 'existing'): problems.append(f'project {n}: page must be generated or existing')
        for l in p.get('links', []):
            if not l.get('label') or not l.get('href'): problems.append(f'project {n}: every link needs a label and an address')
            elif not re.match(r'^https?://', l['href']) and not site_file_exists(l['href']):
                problems.append(f'project {n}: link {l["href"]} does not lead to a file in the site')
        if p.get('page') == 'generated':
            d = os.path.join(ROOT, 'projects', p.get('slug', '_'))
            idx = os.path.join(d, 'index.html')
            if os.path.isdir(d) and (not os.path.exists(idx) or GENERATED_MARK not in read(idx)):
                problems.append(f'project {n}: projects/{p.get("slug")}/ already exists and was not made by the admin panel; choose another slug')
            for im in p.get('images', []):
                if not im.get('alt'): problems.append(f'project {n}: image {im.get("src")} needs alt text')
                if not os.path.exists(os.path.join(ROOT, im.get('src', '_'))): problems.append(f'project {n}: image {im.get("src")} is missing')
        else:
            if not p.get('links'): problems.append(f'project {n}: an existing page needs at least one link')
        if p.get('status') == 'published':
            for f in ('tag', 'title', 'summary'):
                if not p.get(f): problems.append(f'project {n}: published but {f} is empty')
            if p.get('page') == 'generated' and not (p.get('built') or p.get('role')): problems.append(f'project {n}: a published case study page needs "What was built" or "Our part" written')
        for f in ('title', 'summary', 'builtBy', 'builtWith', 'outcome', 'shows', 'built', 'role', 'whatHappened'):
            warnings.extend(claim_warnings(f'project {n} ({f})', p.get(f, '')))
        for x in p.get('learned', []): warnings.extend(claim_warnings(f'project {n} (learned)', x))
    for c in courses:
        for f in ('title', 'summary', 'audience', 'prerequisites'):
            warnings.extend(claim_warnings(f'course {c.get("id", "?")} ({f})', c.get(f, '')))
    for t in topics:
        if t.get('status') == 'published':
            warnings.extend(claim_warnings(f'lesson {t.get("id", "?")} (summary)', t.get('summary', '')))
    # generated files must match what sync would write
    try:
        for rel, text in expected_files().items():
            path = os.path.join(ROOT, rel)
            want = apply_chrome(text, rel) if rel.endswith('.html') else text
            if not os.path.exists(path) or read(path) != want:
                problems.append(f'{rel} is out of date; run: python tools/site.py sync')
    except SystemExit as e:
        problems.append(str(e))
    for rel in STATIC_PAGES:
        path = os.path.join(ROOT, rel)
        if os.path.exists(path) and read(path) != apply_chrome(read(path), rel):
            problems.append(f'{rel}: shared header/drawer/footer is out of date; run: python tools/site.py chrome')
    # orphan topic pages
    known = {t.get('slug') for t in topics}
    for p in topic_pages():
        slug = os.path.basename(os.path.dirname(p))
        if slug not in known: problems.append(f'learn/{slug}/ has no record in topics.json')
    # pricing: valid, and prices appear only in the generated blocks so they cannot drift apart
    try:
        pr = load_pricing()
        ids = [p.get('id') for p in pr.get('packages', [])]
        if len(set(ids)) != len(ids) or not ids: problems.append('pricing.json: package ids missing or duplicated')
        for p in pr.get('packages', []):
            n = p.get('id', '?')
            if p.get('priceType') not in ('starting', 'package'): problems.append(f'pricing {n}: priceType must be starting or package')
            if not isinstance(p.get('price'), int) or p['price'] <= 0: problems.append(f'pricing {n}: price must be a whole number above 0')
            ip = p.get('introPrice')
            if ip is not None and (not isinstance(ip, int) or ip >= p.get('price', 0)): problems.append(f'pricing {n}: introPrice must be a whole number below price, or null')
            if not p.get('cta', {}).get('href') or not os.path.exists(os.path.join(ROOT, p['cta']['href'].split('?')[0], 'index.html')): problems.append(f'pricing {n}: cta link does not lead to a page')
        if pr.get('introOffer', {}).get('active'): warnings.append('pricing: the first-three-client prices are shown. Set introOffer.active to false in content/pricing.json when the third paid project is agreed.')
        if not pr.get('terms', {}).get('approved'): warnings.append('pricing: the terms draft is NOT published (terms.approved is false). Approve it, then set it to true.')
    except (OSError, json.JSONDecodeError, KeyError) as e:
        problems.append(f'pricing.json: {e}')
    for rel in all_chrome_pages():
        txt = read(os.path.join(ROOT, rel))
        txt = re.sub(r'<!-- PRICING(-TEASER)?:START -->.*?<!-- PRICING(-TEASER)?:END -->', '', txt, flags=re.S)
        if re.search(r'\$\s?\d', txt): problems.append(f'{rel}: a price is written by hand outside the generated pricing blocks; move it into content/pricing.json')
    # contact form must be a real Netlify form
    contact = read(os.path.join(ROOT, 'contact', 'index.html'))
    for need in ('data-netlify="true"', 'name="inquiry"', 'netlify-honeypot="_gotcha"', 'method="POST"'):
        if need not in contact: problems.append(f'contact form is missing {need}')
    warnings.append('contact form: delivery is NOT verified by this check. After deploying a preview, send a real test message and confirm it arrives (docs/launch-checklist.md).')
    left = 0
    for dirpath, _, files in os.walk(ROOT):
        if '.git' in dirpath.split(os.sep) or 'tools' in dirpath.split(os.sep): continue
        for f in files:
            if f.endswith(('.html', '.js')):
                left += read(os.path.join(dirpath, f)).count('{{')
    if left: problems.append(f'{left} "{{{{" placeholder(s) remain in the site; fill or remove them before launch')
    return problems, warnings, topics, courses


def cmd_check():
    problems, warnings, topics, courses = collect_issues()
    for w in warnings: print('warning:', w)
    for p in problems: print('PROBLEM:', p)
    pub = len(published_topics(topics))
    projects = load_projects()
    print(f'checked {len(topics)} topic(s) ({pub} published), {len(courses)} course(s) and {len(projects)} project(s): {len(problems)} problem(s), {len(warnings)} warning(s)')
    return 1 if problems else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('chrome'); sub.add_parser('sync'); sub.add_parser('check')
    n = sub.add_parser('new'); n.add_argument('slug'); n.add_argument('title'); n.add_argument('--allow-similar', action='store_true')
    c = sub.add_parser('covered'); c.add_argument('words', nargs='*')
    a = ap.parse_args()
    if a.cmd == 'chrome':
        ch = cmd_chrome(); print('updated', len(ch), 'page(s):', ', '.join(ch) if ch else 'none, already current')
    elif a.cmd == 'sync': cmd_sync()
    elif a.cmd == 'new': cmd_new(a.slug, a.title, a.allow_similar)
    elif a.cmd == 'covered': cmd_covered(a.words)
    elif a.cmd == 'check': sys.exit(cmd_check())


if __name__ == '__main__':
    main()
