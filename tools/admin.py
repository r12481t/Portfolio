#!/usr/bin/env python3
"""Curiohatch local admin panel. Python 3.8+, standard library only.

    python tools/admin.py            start the panel, then open the address it prints
    python tools/admin.py --port 9000

What it does: edits the same content files the site is built from (content/*.json and the lesson articles), then runs the
same generator as `python tools/site.py sync`. It adds lessons, courses, packages and prices, and case studies, with the same
rules `python tools/site.py check` enforces.

What it does not do: publish. It never runs git, never pushes, never deploys. Nothing is public until you commit and
deploy the changed files yourself.

Safety: it listens on 127.0.0.1 only (not on your network), every request needs a random token printed in the terminal,
requests from other websites are refused, and it can only write the content files, lesson pages, case-study pages and
uploaded images. Every save is backed up, and "Undo last change" restores it. Stop it with Ctrl+C.
"""
import argparse, base64, contextlib, datetime, http.server, importlib.util, io, json, mimetypes, os, re, secrets, shutil, socketserver, struct, subprocess, sys, threading, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('curiohatch_site', os.path.join(HERE, 'site.py'))
sc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sc)
ROOT = sc.ROOT
ADMIN_DIR = os.path.join(HERE, 'admin')
BACKUPS = os.path.join(ROOT, '.admin-backups')
LOCK = threading.Lock()
MAX_BODY = 8 * 1024 * 1024
MAX_IMAGE = 3 * 1024 * 1024
IMAGE_EXT = {'png', 'jpg', 'jpeg', 'webp'}
UNSAFE_HTML = re.compile(r'<\s*(script|iframe|object|embed|style|link|meta|form)\b|\son\w+\s*=|javascript:', re.I)


class Refused(Exception):
    """A request that is not allowed or has bad data. The message is shown to the person using the panel."""


# ---------------------------------------------------------------- undo-able actions
class Action:
    def __init__(self, name):
        self.name = name
        self.stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        self.dir = os.path.join(BACKUPS, self.stamp)
        self.modified, self.created, self.seen = [], [], set()

    def touch(self, path):
        rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
        if rel in self.seen:
            return
        self.seen.add(rel)
        if os.path.exists(path):
            dest = os.path.join(self.dir, 'files', rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(path, dest)
            self.modified.append(rel)
        else:
            self.created.append(rel)

    def save_manifest(self):
        os.makedirs(self.dir, exist_ok=True)
        with open(os.path.join(self.dir, 'manifest.json'), 'w', encoding='utf-8') as f:
            json.dump({'name': self.name, 'modified': self.modified, 'created': self.created, 'undone': False}, f)


@contextlib.contextmanager
def action(name):
    """Record every file written inside the block so it can be undone. Writes go through sc.write."""
    act = Action(name)
    original = sc.write

    def recording_write(path, text):
        act.touch(path)
        original(path, text)

    sc.write = recording_write
    try:
        yield act
    finally:
        sc.write = original
        if act.modified or act.created:
            act.save_manifest()


def revert(act):
    for rel in act.created:
        p = os.path.join(ROOT, rel)
        if os.path.exists(p):
            os.remove(p)
    for rel in act.modified:
        shutil.copy2(os.path.join(act.dir, 'files', rel), os.path.join(ROOT, rel))


def undo_last():
    if not os.path.isdir(BACKUPS):
        raise Refused('There is nothing to undo.')
    for stamp in sorted(os.listdir(BACKUPS), reverse=True):
        mp = os.path.join(BACKUPS, stamp, 'manifest.json')
        if not os.path.exists(mp):
            continue
        m = json.load(open(mp, encoding='utf-8'))
        if m.get('undone'):
            continue
        for rel in m['created']:
            p = os.path.join(ROOT, rel)
            if os.path.exists(p):
                os.remove(p)
                d = os.path.dirname(p)
                try:
                    if d != ROOT and not os.listdir(d):
                        os.rmdir(d)
                except OSError:
                    pass
        for rel in m['modified']:
            shutil.copy2(os.path.join(BACKUPS, stamp, 'files', rel), os.path.join(ROOT, rel))
        m['undone'] = True
        json.dump(m, open(mp, 'w', encoding='utf-8'))
        return m['name']
    raise Refused('There is nothing to undo.')


def last_action_name():
    if not os.path.isdir(BACKUPS):
        return None
    for stamp in sorted(os.listdir(BACKUPS), reverse=True):
        mp = os.path.join(BACKUPS, stamp, 'manifest.json')
        if os.path.exists(mp):
            m = json.load(open(mp, encoding='utf-8'))
            if not m.get('undone'):
                return m['name']
    return None


# ---------------------------------------------------------------- helpers
def write_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def save_json(path, key, items, schema=1):
    sc.write(path, json.dumps({'schema': schema, key: items}, indent=2, ensure_ascii=False) + '\n')


def run_sync():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        sc.cmd_sync()
    return buf.getvalue().strip()


def issues():
    problems, warnings, _, _ = sc.collect_issues()
    return problems, warnings


def str_list(v, label):
    if v is None or v == '':
        return []
    if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
        raise Refused(f'{label} must be a list of text lines.')
    return [x.strip() for x in v if x.strip()]


def text(v, label, required=False, limit=2000):
    v = (v or '')
    if not isinstance(v, str):
        raise Refused(f'{label} must be text.')
    v = v.strip()
    if required and not v:
        raise Refused(f'{label} is required.')
    if len(v) > limit:
        raise Refused(f'{label} is too long (over {limit} characters).')
    if '\x00' in v:
        raise Refused(f'{label} contains an invalid character.')
    return v


def next_id(prefix, items):
    nums = [int(i['id'][len(prefix):]) for i in items if re.match(rf'^{prefix}\d+$', i.get('id', ''))]
    return f'{prefix}{max(nums + [0]) + 1:03d}'


def links_list(v, label):
    out = []
    for l in v or []:
        lab, href = text(l.get('label'), f'{label} link label', True, 120), text(l.get('href'), f'{label} link address', True, 400)
        if not re.match(r'^https?://', href) and not sc.site_file_exists(href):
            raise Refused(f'{label} link "{href}" is not a web address and does not lead to a page in the site.')
        out.append({'label': lab, 'href': href})
    return out


# ---------------------------------------------------------------- lessons
def save_topic(body):
    rec, article, create, allow_similar = body.get('record') or {}, body.get('article'), bool(body.get('create')), bool(body.get('allowSimilar'))
    topics, courses = sc.load_json(sc.TOPICS_FILE, 'topics'), sc.load_json(sc.COURSES_FILE, 'courses')
    old = None if create else next((t for t in topics if t.get('id') == rec.get('id')), None)
    if not create and not old:
        raise Refused('That lesson no longer exists. Reload the panel.')
    slug = text(rec.get('slug'), 'Slug', True, 80)
    if not sc.SLUG_RE.match(slug):
        raise Refused('Slug must be lowercase words joined by hyphens, for example css-grid-basics.')
    if old and old['slug'] != slug:
        raise Refused('A lesson address cannot be changed after it exists. Archive it and add a new one.')
    if any(t['slug'] == slug and (create or t['id'] != old['id']) for t in topics):
        raise Refused(f'The address "{slug}" is already used by another lesson.')
    status = rec.get('status')
    if status not in sc.TOPIC_STATUSES:
        raise Refused('Status must be one of: ' + ', '.join(sc.TOPIC_STATUSES) + '.')
    new = {
        'id': old['id'] if old else next_id('t', topics), 'slug': slug, 'status': status,
        'title': text(rec.get('title'), 'Title', True, 140), 'summary': text(rec.get('summary'), 'Summary', False, 300),
        'category': text(rec.get('category'), 'Category', False, 60), 'subtopics': str_list(rec.get('subtopics'), 'Subtopics'),
        'tags': [x.lower() for x in str_list(rec.get('tags'), 'Tags')], 'concepts': str_list(rec.get('concepts'), 'Concepts'),
        'videoId': text(rec.get('videoId'), 'Video id', False, 11), 'publishedAt': text(rec.get('publishedAt'), 'Published date', False, 10),
        'updatedAt': text(rec.get('updatedAt'), 'Updated date', False, 10), 'prerequisites': str_list(rec.get('prerequisites'), 'Prerequisites'),
        'related': str_list(rec.get('related'), 'Related'), 'courses': str_list(rec.get('courses'), 'Courses'),
    }
    ids = {t['id'] for t in topics} | ({new['id']} if create else set())
    for f in ('prerequisites', 'related'):
        for r in new[f]:
            if r not in ids or r == new['id']:
                raise Refused(f'"{r}" in {f} is not another lesson id.')
    for r in new['courses']:
        if r not in {c['id'] for c in courses}:
            raise Refused(f'"{r}" is not a course id.')
    if create and not allow_similar:
        near = sc.similar_topics(new['title'], slug, new['concepts'], topics)
        if near:
            return {'ok': False, 'similar': [{'id': t['id'], 'title': t['title'], 'status': t['status'], 'why': why} for t, why in near],
                    'error': 'A similar lesson is already recorded. Check it, or save again to add this one anyway.'}
    if isinstance(article, str) and article.strip():
        if UNSAFE_HTML.search(article) or 'ARTICLE:START' in article or 'ARTICLE:END' in article:
            raise Refused('The article contains something that is not allowed (script, iframe, form, style, event handlers or javascript: links). Remove it.')
        if status == 'planned':
            raise Refused('A planned lesson has no page yet. Change the status to drafted to write the article.')
    if status == 'published':
        if not new['summary']: raise Refused('A published lesson needs a summary.')
        if not sc.VIDEO_RE.match(new['videoId']): raise Refused('A published lesson needs the 11-character YouTube video id (the part after watch?v=).')
        if not sc.valid_date(new['publishedAt']): raise Refused('A published lesson needs the real publish date.')
        if new['updatedAt'] and (not sc.valid_date(new['updatedAt']) or new['updatedAt'] < new['publishedAt']): raise Refused('Updated date must be a real date, not before the publish date.')
        have = article if isinstance(article, str) and article.strip() else (sc.current_article(old) if old else '')
        if not have.strip() or sc.PLACEHOLDER in have:
            raise Refused('A published lesson needs a real article. Write it before publishing.')
    with action(('Add lesson ' if create else 'Edit lesson ') + new['title']) as act:
        topics = [new if (t.get('id') == new['id']) else t for t in topics] if not create else topics + [new]
        save_json(sc.TOPICS_FILE, 'topics', topics)
        try:
            log = run_sync()
            if isinstance(article, str) and article.strip():
                page = os.path.join(ROOT, 'learn', slug, 'index.html')
                html = open(page, encoding='utf-8').read()
                html = sc.ARTICLE_RE.sub(lambda m: '<!-- ARTICLE:START -->\n' + article.strip() + '\n<!-- ARTICLE:END -->', html, count=1)
                sc.write(page, html)
                log = run_sync()
        except (SystemExit, Exception) as e:
            revert(act)
            raise Refused(f'Could not build the pages, so nothing was saved: {e}')
    return {'ok': True, 'id': new['id'], 'log': log}


def get_article(slug):
    if not sc.SLUG_RE.match(slug or ''):
        raise Refused('Bad slug.')
    topics = sc.load_json(sc.TOPICS_FILE, 'topics')
    t = next((t for t in topics if t['slug'] == slug), None)
    if not t:
        raise Refused('No such lesson.')
    page = os.path.join(ROOT, 'learn', slug, 'index.html')
    if not os.path.exists(page):
        return {'html': ''}
    html = sc.ARTICLE_RE.search(open(page, encoding='utf-8').read())
    body = html.group(1).strip() if html else ''
    return {'html': '' if sc.PLACEHOLDER in body else body}


# ---------------------------------------------------------------- courses
def save_course(body):
    rec, create = body.get('record') or {}, bool(body.get('create'))
    courses, topics = sc.load_json(sc.COURSES_FILE, 'courses'), sc.load_json(sc.TOPICS_FILE, 'topics')
    old = None if create else next((c for c in courses if c.get('id') == rec.get('id')), None)
    if not create and not old:
        raise Refused('That course no longer exists. Reload the panel.')
    status = rec.get('status')
    if status not in sc.COURSE_STATUSES:
        raise Refused('Status must be one of: ' + ', '.join(sc.COURSE_STATUSES) + '.')
    new = {'id': old['id'] if old else next_id('c', courses), 'status': status, 'title': text(rec.get('title'), 'Title', True, 120),
           'summary': text(rec.get('summary'), 'Summary', True, 300), 'category': text(rec.get('category'), 'Category', False, 60),
           'audience': text(rec.get('audience'), 'Audience', False, 200), 'level': text(rec.get('level'), 'Level', False, 60),
           'duration': text(rec.get('duration'), 'Length', False, 60), 'prerequisites': text(rec.get('prerequisites'), 'Prerequisites', False, 200),
           'url': text(rec.get('url'), 'Address', False, 400), 'lessons': str_list(rec.get('lessons'), 'Lessons')}
    new = {k: v for k, v in new.items() if v not in ('', [])} | {'id': new['id'], 'status': status, 'title': new['title'], 'summary': new['summary']}
    if status == 'available':
        if not new.get('url'): raise Refused('An available course needs an address (url) that works.')
        if not re.match(r'^https?://', new['url']) and not sc.site_file_exists(new['url']): raise Refused('That course address does not lead to a page in the site or a web address.')
    for r in new.get('lessons', []):
        if r not in {t['id'] for t in topics}: raise Refused(f'"{r}" is not a lesson id.')
    with action(('Add course ' if create else 'Edit course ') + new['title']) as act:
        courses = courses + [new] if create else [new if c['id'] == new['id'] else c for c in courses]
        save_json(sc.COURSES_FILE, 'courses', courses)
        try:
            log = run_sync()
        except (SystemExit, Exception) as e:
            revert(act)
            raise Refused(f'Could not build the pages, so nothing was saved: {e}')
    return {'ok': True, 'id': new['id'], 'log': log}


# ---------------------------------------------------------------- packages and prices
def save_pricing(body):
    pr = body.get('pricing') or {}
    pk = pr.get('packages')
    if not isinstance(pk, list) or not pk:
        raise Refused('Keep at least one package.')
    out, seen = [], set()
    for p in pk:
        pid = text(p.get('id'), 'Package id', True, 40)
        if not sc.SLUG_RE.match(pid) or pid in seen:
            raise Refused(f'Package id "{pid}" must be unique lowercase words joined by hyphens.')
        seen.add(pid)
        if p.get('priceType') not in ('starting', 'package'):
            raise Refused(f'{pid}: price type must be "Starting at" or "Package price".')
        try:
            price = int(p.get('price'))
            intro = p.get('introPrice')
            intro = None if intro in (None, '') else int(intro)
        except (TypeError, ValueError):
            raise Refused(f'{pid}: prices must be whole numbers.')
        if price <= 0 or (intro is not None and not 0 < intro < price):
            raise Refused(f'{pid}: the price must be above 0, and the first-three-client price must be below it.')
        cta = p.get('cta') or {}
        href = text(cta.get('href'), f'{pid} button address', True, 200)
        if not sc.site_file_exists(href):
            raise Refused(f'{pid}: the button address "{href}" does not lead to a page in the site.')
        out.append({'id': pid, 'name': text(p.get('name'), f'{pid} name', True, 80), 'priceType': p['priceType'], 'price': price, 'introPrice': intro,
                    'summary': text(p.get('summary'), f'{pid} summary', True, 200), 'scope': str_list(p.get('scope'), f'{pid} scope'),
                    'note': text(p.get('note'), f'{pid} note', False, 300),
                    'cta': {'label': text(cta.get('label'), f'{pid} button label', True, 60), 'href': href}})
    terms = pr.get('terms') or {}
    new = {'schema': 1, 'currencyNote': text(pr.get('currencyNote'), 'Currency note', True, 120),
           'introOffer': {'active': bool((pr.get('introOffer') or {}).get('active')), 'note': text((pr.get('introOffer') or {}).get('note'), 'First-three-client note', True, 300)},
           'packages': out, 'notIncludedByDefault': text(pr.get('notIncludedByDefault'), 'Not included by default', True, 400),
           'terms': {'approved': bool(terms.get('approved')), 'items': str_list(terms.get('items'), 'Terms')}}
    if new['terms']['approved'] and not new['terms']['items']:
        raise Refused('Terms cannot be published with no items.')
    with action('Edit packages and prices') as act:
        sc.write(sc.PRICING_FILE, json.dumps(new, indent=2, ensure_ascii=False) + '\n')
        try:
            log = run_sync()
        except (SystemExit, Exception) as e:
            revert(act)
            raise Refused(f'Could not build the pages, so nothing was saved: {e}')
    return {'ok': True, 'log': log}


# ---------------------------------------------------------------- case studies
def image_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', data[i + 5:i + 9])
                return w, h
            i += 2 + struct.unpack('>H', data[i + 2:i + 4])[0]
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        kind = data[12:16]
        if kind == b'VP8X':
            return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
        if kind == b'VP8 ':
            w, h = struct.unpack('<HH', data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if kind == b'VP8L':
            bits = int.from_bytes(data[21:25], 'little')
            return 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
    return None


def save_image(body):
    slug = body.get('slug', '')
    if not sc.SLUG_RE.match(slug):
        raise Refused('Save the case study once with its address (slug) before adding images.')
    name = re.sub(r'[^a-z0-9._-]+', '-', (body.get('filename') or 'image').lower()).strip('-.') or 'image'
    ext = name.rsplit('.', 1)[-1] if '.' in name else ''
    if ext not in IMAGE_EXT:
        raise Refused('Images must be PNG, JPG or WebP.')
    try:
        data = base64.b64decode(body.get('data', ''), validate=True)
    except (ValueError, TypeError):
        raise Refused('The image could not be read.')
    if len(data) > MAX_IMAGE:
        raise Refused('That image is over 3 MB. Resize or compress it first (WebP at about 1200 pixels wide is plenty).')
    size = image_size(data)
    if not size:
        raise Refused('That file is not a valid PNG, JPG or WebP image.')
    rel = f'assets/work/{slug}/{name}'
    with action('Add image ' + name) as act:
        act.touch(os.path.join(ROOT, rel))
        write_bytes(os.path.join(ROOT, rel), data)
    warn = []
    if size[0] > 1600 or len(data) > 400 * 1024:
        warn.append('This image is large for a phone. Consider resizing it to about 1200 pixels wide and saving it as WebP.')
    return {'ok': True, 'src': rel, 'width': size[0], 'height': size[1], 'warnings': warn}


def save_project(body):
    rec, create = body.get('record') or {}, bool(body.get('create'))
    projects = sc.load_projects()
    old = None if create else next((p for p in projects if p.get('id') == rec.get('id')), None)
    if not create and not old:
        raise Refused('That project no longer exists. Reload the panel.')
    slug = text(rec.get('slug'), 'Slug', True, 80)
    if not sc.SLUG_RE.match(slug):
        raise Refused('Slug must be lowercase words joined by hyphens.')
    if old and old['slug'] != slug:
        raise Refused('A project address cannot be changed after it exists.')
    if any(p['slug'] == slug and (create or p['id'] != old['id']) for p in projects):
        raise Refused(f'The address "{slug}" is already used by another project.')
    if rec.get('status') not in sc.PROJECT_STATUSES or rec.get('group') not in sc.PROJECT_GROUPS or rec.get('page') not in ('generated', 'existing'):
        raise Refused('Status, group and page type must be chosen.')
    if create and rec['page'] == 'generated':
        d = os.path.join(ROOT, 'projects', slug)
        if os.path.exists(d):
            raise Refused(f'A folder projects/{slug}/ already exists. Choose another address.')
    images = []
    for im in rec.get('images') or []:
        src = text(im.get('src'), 'Image path', True, 300)
        if not re.match(rf'^assets/work/{re.escape(slug)}/[a-z0-9._-]+$', src) or not os.path.exists(os.path.join(ROOT, src)):
            raise Refused(f'Image "{src}" was not uploaded here. Upload it again.')
        images.append({'src': src, 'alt': text(im.get('alt'), f'Alt text for {src}', True, 200), 'caption': text(im.get('caption'), 'Caption', False, 200),
                       'width': int(im.get('width') or 0), 'height': int(im.get('height') or 0)})
    new = {'id': old['id'] if old else next_id('p', projects), 'slug': slug, 'status': rec['status'], 'group': rec['group'], 'page': rec['page'],
           'featured': bool(rec.get('featured')), 'order': int(rec.get('order') or 100),
           'tag': text(rec.get('tag'), 'Label', True, 60), 'title': text(rec.get('title'), 'Title', True, 100),
           'summary': text(rec.get('summary'), 'Summary', True, 400), 'builtBy': text(rec.get('builtBy'), 'Built by', False, 200),
           'builtWith': text(rec.get('builtWith'), 'Built with', False, 200), 'outcome': text(rec.get('outcome'), 'Outcome', False, 300),
           'shows': text(rec.get('shows'), 'What this shows', False, 600), 'links': links_list(rec.get('links'), 'A')}
    if new['page'] == 'generated':
        new.update({'built': text(rec.get('built'), 'What was built', False, 4000), 'role': text(rec.get('role'), 'Our part', False, 3000),
                    'whatHappened': text(rec.get('whatHappened'), 'What happened', False, 3000), 'learned': str_list(rec.get('learned'), 'What we learned'), 'images': images})
        if new['status'] == 'published' and not (new['built'] or new['role']):
            raise Refused('A published case study page needs "What was built" or "Our part" written.')
    elif not new['links']:
        raise Refused('A project that links to an existing page needs at least one link.')
    if new['status'] == 'published' and not new['links'] and new['page'] == 'existing':
        raise Refused('A published project needs a link.')
    with action(('Add case study ' if create else 'Edit case study ') + new['title']) as act:
        projects = projects + [new] if create else [new if p['id'] == new['id'] else p for p in projects]
        save_json(sc.PROJECTS_FILE, 'projects', projects)
        try:
            log = run_sync()
        except (SystemExit, Exception) as e:
            revert(act)
            raise Refused(f'Could not build the pages, so nothing was saved: {e}')
    return {'ok': True, 'id': new['id'], 'log': log}


# ---------------------------------------------------------------- state and commands
def git_changes():
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        return None
    try:
        r = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True, timeout=8)
        return [l for l in r.stdout.splitlines() if l.strip()] if r.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def state():
    problems, warnings = issues()
    return {'topics': sc.load_json(sc.TOPICS_FILE, 'topics'), 'courses': sc.load_json(sc.COURSES_FILE, 'courses'),
            'pricing': sc.load_pricing(), 'projects': sc.load_projects(), 'problems': problems, 'warnings': warnings,
            'git': git_changes(), 'undo': last_action_name(),
            'enums': {'topicStatuses': sc.TOPIC_STATUSES, 'courseStatuses': sc.COURSE_STATUSES, 'projectStatuses': sc.PROJECT_STATUSES, 'projectGroups': sc.PROJECT_GROUPS},
            'youtube': sc.YOUTUBE}


def run_command(name):
    if name == 'sync':
        with action('Rebuild pages'):
            return {'ok': True, 'output': run_sync()}
    if name == 'check':
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = sc.cmd_check()
        return {'ok': code == 0, 'output': buf.getvalue()}
    if name == 'seo':
        script = os.path.join(ROOT, 'tests', 'seo_check.py')
        if not os.path.exists(script):
            raise Refused('tests/seo_check.py is not in this copy of the site.')
        r = subprocess.run([sys.executable, script, ROOT], capture_output=True, text=True, timeout=60)
        return {'ok': r.returncode == 0, 'output': (r.stdout + r.stderr).strip()}
    raise Refused('Unknown command.')


# ---------------------------------------------------------------- web server
class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'CuriohatchAdmin'

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        data = body if isinstance(body, bytes) else body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def _host_ok(self):
        host = (self.headers.get('Host') or '').lower()
        return host in (f'127.0.0.1:{self.server.port}', f'localhost:{self.server.port}')

    def _token_ok(self):
        return secrets.compare_digest(self.headers.get('X-Admin-Token', ''), self.server.token)

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, 'Wrong host', 'text/plain')
        url = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(url.path)
        try:
            if path == '/':
                return self._file(os.path.join(ADMIN_DIR, 'index.html'))
            if path.startswith('/admin/'):
                return self._file(self._inside(ADMIN_DIR, path[len('/admin/'):]))
            if path.startswith('/preview'):
                rel = path[len('/preview'):].lstrip('/')
                target = self._inside(ROOT, rel)
                if any(part.startswith('.') for part in rel.split('/') if part):
                    raise Refused('Not found')
                if os.path.isdir(target):
                    if not path.endswith('/'):
                        self.send_response(301); self.send_header('Location', path + '/'); self.end_headers(); return
                    target = os.path.join(target, 'index.html')
                elif not os.path.exists(target) and os.path.exists(target + '.html'):
                    target += '.html'
                return self._file(target)
            if path.startswith('/api/'):
                if not self._token_ok():
                    return self._json(403, {'ok': False, 'error': 'Missing or wrong token. Open the address printed in the terminal.'})
                if path == '/api/state':
                    return self._json(200, state())
                if path == '/api/article':
                    return self._json(200, get_article(urllib.parse.parse_qs(url.query).get('slug', [''])[0]))
            return self._send(404, 'Not found', 'text/plain')
        except Refused as e:
            return self._json(400, {'ok': False, 'error': str(e)})
        except Exception as e:  # never leak a traceback to the page
            return self._json(500, {'ok': False, 'error': f'Unexpected error: {type(e).__name__}: {e}'})

    def do_POST(self):
        if not self._host_ok():
            return self._send(403, 'Wrong host', 'text/plain')
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://127.0.0.1:{self.server.port}', f'http://localhost:{self.server.port}'):
            return self._json(403, {'ok': False, 'error': 'Requests from other websites are refused.'})
        if not self._token_ok():
            return self._json(403, {'ok': False, 'error': 'Missing or wrong token. Open the address printed in the terminal.'})
        if 'application/json' not in (self.headers.get('Content-Type') or ''):
            return self._json(415, {'ok': False, 'error': 'JSON only.'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {'ok': False, 'error': 'Request too large.'})
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {'ok': False, 'error': 'That request was not valid JSON.'})
        routes = {'/api/topic': save_topic, '/api/course': save_course, '/api/pricing': save_pricing, '/api/project': save_project, '/api/image': save_image}
        path = urllib.parse.urlparse(self.path).path
        try:
            with LOCK:
                if path in routes:
                    return self._json(200, routes[path](body))
                if path == '/api/run':
                    return self._json(200, run_command(body.get('action')))
                if path == '/api/undo':
                    return self._json(200, {'ok': True, 'undone': undo_last()})
                if path in ('/api/topic/archive', '/api/course/archive', '/api/project/archive'):
                    return self._json(200, archive(path.split('/')[2], body.get('id')))
            return self._json(404, {'ok': False, 'error': 'Unknown request.'})
        except Refused as e:
            return self._json(400, {'ok': False, 'error': str(e)})
        except Exception as e:
            return self._json(500, {'ok': False, 'error': f'Unexpected error: {type(e).__name__}: {e}'})

    @staticmethod
    def _inside(base, rel):
        full = os.path.realpath(os.path.join(base, rel))
        if full != os.path.realpath(base) and not full.startswith(os.path.realpath(base) + os.sep):
            raise Refused('Not found')
        return full

    def _file(self, path):
        if not os.path.isfile(path):
            return self._send(404, 'Not found', 'text/plain')
        ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
            ctype += '; charset=utf-8'
        # the lesson preview is a sandboxed frame; fonts need this header or it falls back to a plain font
        extra = {'Access-Control-Allow-Origin': '*'} if ctype.startswith('font/') or path.endswith('.woff2') else None
        with open(path, 'rb') as f:
            self._send(200, f.read(), ctype, extra)


def archive(kind, rid):
    cfg = {'topic': (sc.TOPICS_FILE, 'topics'), 'course': (sc.COURSES_FILE, 'courses'), 'project': (sc.PROJECTS_FILE, 'projects')}[kind]
    items = sc.load_json(*cfg)
    item = next((i for i in items if i.get('id') == rid), None)
    if not item:
        raise Refused('That item no longer exists.')
    item['status'] = 'archived'
    with action(f'Archive {kind} {item.get("title", rid)}') as act:
        save_json(cfg[0], cfg[1], items)
        try:
            run_sync()
        except (SystemExit, Exception) as e:
            revert(act)
            raise Refused(f'Could not rebuild the pages, so nothing was changed: {e}')
    return {'ok': True}


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=8777)
    a = ap.parse_args()
    server = None
    for port in range(a.port, a.port + 20):
        try:
            server = Server(('127.0.0.1', port), Handler)
            break
        except OSError:
            continue
    if not server:
        raise SystemExit(f'Ports {a.port} to {a.port + 19} are all busy. Close the other program or use --port.')
    server.port, server.token = port, secrets.token_urlsafe(18)
    print(f'\nCuriohatch admin is running. Open this address in your browser:\n\n  http://127.0.0.1:{port}/?t={server.token}\n')
    print('It only listens on this device. Nothing is published by it. Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
