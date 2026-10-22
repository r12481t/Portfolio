"""The data layer. Reads and writes the site's content in the database, in the same shapes as content/*.json, so the page
generator and the admin panel keep working on the same dicts they always did.

    store.active()                 is the database switched on? (see "Switching it on" in docs/database.md)
    store.load('topics')           lessons    -> list of dicts   (also 'courses', 'projects', 'pricing')
    store.save('topics', items)    replace the lessons with this list, in one all-or-nothing transaction
    store.get_article(slug) / store.set_article(slug, html)    a lesson's article text
    store.read_files() / store.replace_all(data) / store.snapshot()    whole-database moves, for import, export and undo

Only records that actually changed are written, which keeps writes (and Turso's monthly row counts) small.
"""
import copy, json, os, re, time
import turso

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MIGRATIONS = os.path.join(ROOT, 'db', 'migrations')
KINDS = ('topics', 'courses', 'projects', 'pricing')
FILES = {'topics': os.path.join(ROOT, 'content', 'learn', 'topics.json'), 'courses': os.path.join(ROOT, 'content', 'courses', 'courses.json'),
         'projects': os.path.join(ROOT, 'content', 'projects.json'), 'pricing': os.path.join(ROOT, 'content', 'pricing.json')}
ARTICLE_RE = re.compile(r'<!-- ARTICLE:START -->(.*?)<!-- ARTICLE:END -->', re.S)
PLACEHOLDER = 'ARTICLE_PLACEHOLDER'
NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
CACHE_SECONDS = 2


class StoreError(Exception):
    pass


# ---------------------------------------------------------------- switching it on
def load_env():
    """Read KEY=VALUE lines from .env.local (never committed) into the environment, without overriding what is already set.
    Skipped when CURIOHATCH_STORE is already set, so tests and one-off commands are never redirected by a leftover file."""
    if os.environ.get('CURIOHATCH_STORE'):
        return
    path = os.path.join(ROOT, '.env.local')
    if not os.path.exists(path):
        return
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        os.environ.setdefault(k.strip(), v)


def settings():
    """(url, token) of the database to use, or None for the old JSON files."""
    load_env()
    if os.environ.get('CURIOHATCH_STORE', '').lower() == 'json':
        return None
    local = os.environ.get('CURIOHATCH_DB')
    if local:
        path = local[5:] if local.startswith('file:') else local
        return ('file:' + (path if os.path.isabs(path) else os.path.join(ROOT, path)), None)
    url, token = os.environ.get('TURSO_DATABASE_URL'), os.environ.get('TURSO_AUTH_TOKEN')
    if url:
        return (url, token)
    return None


def active():
    return settings() is not None


_conn = {}


def db():
    s = settings()
    if s is None:
        raise StoreError('The database is not switched on. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local (docs/database.md).')
    if s not in _conn:
        _conn[s] = turso.open_database(*s)
    return _conn[s]


def reset():
    """Forget the open connection and the cache (used by tests and after the environment changes)."""
    for c in _conn.values():
        try:
            c.close()
        except Exception:
            pass
    _conn.clear()
    _cache.clear()


# ---------------------------------------------------------------- migrations
def migration_files():
    out = []
    for name in sorted(os.listdir(MIGRATIONS)) if os.path.isdir(MIGRATIONS) else []:
        m = re.match(r'^(\d+)_(.+)\.sql$', name)
        if m:
            out.append((int(m.group(1)), m.group(2), os.path.join(MIGRATIONS, name)))
    return out


def applied_versions(conn):
    has = conn.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    if not has:
        return set()
    return {r['version'] for r in conn.query('SELECT version FROM schema_migrations')}


def migrate(conn=None):
    """Apply every migration that has not been applied yet, each in its own transaction. Returns their names."""
    conn = conn or db()
    done, applied = applied_versions(conn), []
    for version, name, path in migration_files():
        if version in done:
            continue
        stmts = [(s, []) for s in turso.split_statements(open(path, encoding='utf-8').read())]
        stmts.append((f'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, {NOW})', [version, name]))
        conn.transaction(stmts)
        applied.append(f'{version:03d}_{name}')
    return applied


def schema_ready(conn=None):
    conn = conn or db()
    return {v for v, _, _ in migration_files()} <= applied_versions(conn)


# ---------------------------------------------------------------- shaping records (what the JSON files hold)
def _text(v):
    return '' if v is None else str(v)


def _list(v):
    return [str(x) for x in (v or [])]


def _dedupe(items):
    seen, out = set(), []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _topic(t):
    return {'id': t['id'], 'slug': t['slug'], 'status': t['status'], 'title': _text(t.get('title')), 'summary': _text(t.get('summary')),
            'category': _text(t.get('category')), 'subtopics': _list(t.get('subtopics')), 'tags': _dedupe(_list(t.get('tags'))),
            'concepts': _list(t.get('concepts')), 'videoId': _text(t.get('videoId')), 'publishedAt': _text(t.get('publishedAt')),
            'updatedAt': _text(t.get('updatedAt')), 'prerequisites': _list(t.get('prerequisites')), 'related': _list(t.get('related')),
            'courses': sorted(set(_list(t.get('courses'))))}


COURSE_TEXT = ('category', 'audience', 'level', 'duration', 'prerequisites', 'url')


def _course(c):
    out = {'id': c['id'], 'status': c['status'], 'title': _text(c.get('title')), 'summary': _text(c.get('summary'))}
    for k in COURSE_TEXT:
        if _text(c.get(k)):
            out[k] = _text(c[k])
    if c.get('lessons'):
        out['lessons'] = _list(c['lessons'])
    return out


def _project(p):
    out = {'id': p['id'], 'slug': p['slug'], 'status': p['status'], 'group': p['group'], 'page': p['page'], 'featured': bool(p.get('featured')),
           'order': int(p.get('order') if p.get('order') is not None else 100), 'tag': _text(p.get('tag')), 'title': _text(p.get('title')),
           'summary': _text(p.get('summary')), 'builtBy': _text(p.get('builtBy')), 'builtWith': _text(p.get('builtWith')),
           'outcome': _text(p.get('outcome')), 'shows': _text(p.get('shows')),
           'links': [{'label': _text(l.get('label')), 'href': _text(l.get('href'))} for l in p.get('links') or []]}
    if p['page'] == 'generated':
        out.update({'look': _text(p.get('look')) or 'field', 'built': _text(p.get('built')), 'role': _text(p.get('role')),
                    'whatHappened': _text(p.get('whatHappened')), 'learned': _list(p.get('learned')),
                    'images': [{'src': _text(i.get('src')), 'alt': _text(i.get('alt')), 'caption': _text(i.get('caption')),
                                'width': int(i.get('width') or 0), 'height': int(i.get('height') or 0)} for i in p.get('images') or []]})
    return out


def _pricing(p):
    intro = p.get('introOffer') or {}
    terms = p.get('terms') or {}
    pk = []
    for x in p.get('packages') or []:
        cta = x.get('cta') or {}
        pk.append({'id': x['id'], 'name': _text(x.get('name')), 'priceType': x['priceType'], 'price': int(x['price']),
                   'introPrice': None if x.get('introPrice') in (None, '') else int(x['introPrice']), 'summary': _text(x.get('summary')),
                   'scope': _list(x.get('scope')), 'note': _text(x.get('note')), 'cta': {'label': _text(cta.get('label')), 'href': _text(cta.get('href'))}})
    return {'schema': 1, 'currencyNote': _text(p.get('currencyNote')), 'introOffer': {'active': bool(intro.get('active')), 'note': _text(intro.get('note'))},
            'packages': pk, 'notIncludedByDefault': _text(p.get('notIncludedByDefault')),
            'terms': {'approved': bool(terms.get('approved')), 'items': _list(terms.get('items'))}}


SHAPERS = {'topics': _topic, 'courses': _course, 'projects': _project}


# ---------------------------------------------------------------- reading
_cache = {}


def _fresh(key):
    hit = _cache.get(key)
    return hit[1] if hit and time.time() - hit[0] < CACHE_SECONDS else None


def _by(rows, key):
    out = {}
    for r in rows:
        out.setdefault(r[key], []).append(r)
    return out


def _read_all():
    conn = db()
    (lessons, tags, subs, concepts, links, junction, courses, projects, p_links, p_learned, p_images,
     p_settings, packages, scope, terms) = conn.query_many([
        ('SELECT id, slug, status, title, summary, category, video_id, published_at, updated_at FROM lessons ORDER BY rowid', []),
        ('SELECT lesson_id, tag AS v FROM lesson_tags ORDER BY lesson_id, position', []),
        ('SELECT lesson_id, subtopic AS v FROM lesson_subtopics ORDER BY lesson_id, position', []),
        ('SELECT lesson_id, concept AS v FROM lesson_concepts ORDER BY lesson_id, position', []),
        ('SELECT lesson_id, kind, target_id FROM lesson_links ORDER BY lesson_id, kind, position', []),
        ('SELECT course_id, lesson_id FROM course_lessons ORDER BY course_id, position', []),
        ('SELECT * FROM courses ORDER BY rowid', []),
        ('SELECT * FROM projects ORDER BY rowid', []),
        ('SELECT project_id, label, href FROM project_links ORDER BY project_id, position', []),
        ('SELECT project_id, item AS v FROM project_learned ORDER BY project_id, position', []),
        ('SELECT project_id, src, alt, caption, width, height FROM project_images ORDER BY project_id, position', []),
        ('SELECT * FROM pricing_settings WHERE id = 1', []),
        ('SELECT * FROM packages ORDER BY position', []),
        ('SELECT package_id, item AS v FROM package_scope ORDER BY package_id, position', []),
        ('SELECT item AS v FROM pricing_terms ORDER BY position', []),
    ])
    t_tags, t_subs, t_con, t_links = _by(tags, 'lesson_id'), _by(subs, 'lesson_id'), _by(concepts, 'lesson_id'), _by(links, 'lesson_id')
    in_courses = {}
    for r in sorted(junction, key=lambda r: r['course_id']):
        in_courses.setdefault(r['lesson_id'], []).append(r['course_id'])
    topics = []
    for r in lessons:
        i = r['id']
        topics.append({'id': i, 'slug': r['slug'], 'status': r['status'], 'title': r['title'], 'summary': r['summary'], 'category': r['category'],
                       'subtopics': [x['v'] for x in t_subs.get(i, [])], 'tags': [x['v'] for x in t_tags.get(i, [])],
                       'concepts': [x['v'] for x in t_con.get(i, [])], 'videoId': r['video_id'], 'publishedAt': r['published_at'],
                       'updatedAt': r['updated_at'], 'prerequisites': [x['target_id'] for x in t_links.get(i, []) if x['kind'] == 'prerequisite'],
                       'related': [x['target_id'] for x in t_links.get(i, []) if x['kind'] == 'related'], 'courses': in_courses.get(i, [])})
    c_by = _by(junction, 'course_id')
    course_list = []
    for r in courses:
        c = {'id': r['id'], 'status': r['status'], 'title': r['title'], 'summary': r['summary']}
        for k in COURSE_TEXT:
            if r[k]:
                c[k] = r[k]
        if c_by.get(r['id']):
            c['lessons'] = [x['lesson_id'] for x in c_by[r['id']]]
        course_list.append(c)
    pl, pe, pi = _by(p_links, 'project_id'), _by(p_learned, 'project_id'), _by(p_images, 'project_id')
    project_list = []
    for r in projects:
        p = {'id': r['id'], 'slug': r['slug'], 'status': r['status'], 'group': r['project_group'], 'page': r['page_type'], 'featured': bool(r['featured']),
             'order': r['sort_order'], 'tag': r['tag'], 'title': r['title'], 'summary': r['summary'], 'builtBy': r['built_by'], 'builtWith': r['built_with'],
             'outcome': r['outcome'], 'shows': r['shows'], 'links': [{'label': x['label'], 'href': x['href']} for x in pl.get(r['id'], [])]}
        if r['page_type'] == 'generated':
            p.update({'look': r['look'], 'built': r['built'], 'role': r['role'], 'whatHappened': r['what_happened'],
                      'learned': [x['v'] for x in pe.get(r['id'], [])],
                      'images': [{'src': x['src'], 'alt': x['alt'], 'caption': x['caption'], 'width': x['width'], 'height': x['height']} for x in pi.get(r['id'], [])]})
        project_list.append(p)
    pricing = None
    if p_settings:
        s = p_settings[0]
        sc = _by(scope, 'package_id')
        pricing = {'schema': 1, 'currencyNote': s['currency_note'], 'introOffer': {'active': bool(s['intro_active']), 'note': s['intro_note']},
                   'packages': [{'id': r['id'], 'name': r['name'], 'priceType': r['price_type'], 'price': r['price'], 'introPrice': r['intro_price'],
                                 'summary': r['summary'], 'scope': [x['v'] for x in sc.get(r['id'], [])], 'note': r['note'],
                                 'cta': {'label': r['cta_label'], 'href': r['cta_href']}} for r in packages],
                   'notIncludedByDefault': s['not_included_by_default'], 'terms': {'approved': bool(s['terms_approved']), 'items': [x['v'] for x in terms]}}
    return {'topics': topics, 'courses': course_list, 'projects': project_list, 'pricing': pricing}


def _all():
    data = _fresh('all')
    if data is None:
        data = _read_all()
        _cache['all'] = (time.time(), data)
    return data


def load(kind):
    """The records of one kind, as plain dicts (a list, or the pricing dict). A copy: change it freely."""
    if kind not in KINDS:
        raise StoreError(f'unknown kind {kind}')
    return copy.deepcopy(_all()[kind])


def _articles():
    data = _fresh('articles')
    if data is None:
        data = {r['slug']: r['article_html'] for r in db().query("SELECT slug, article_html FROM lessons WHERE article_html <> ''")}
        _cache['articles'] = (time.time(), data)
    return data


def get_article(slug):
    return _articles().get(slug, '')


def is_empty():
    d = _all()
    return not (d['topics'] or d['courses'] or d['projects'] or d['pricing'])


# ---------------------------------------------------------------- writing
def _run(statements):
    if statements:
        db().transaction(statements)
    _cache.clear()


def _positions(table, key, column, owner, values):
    return [(f'INSERT INTO {table} ({key}, position, {column}) VALUES (?, ?, ?)', [owner, i, v]) for i, v in enumerate(values)]


def _plan_topics(old, new, courses, articles):
    first, then = [], []
    old_by, new_ids = {t['id']: t for t in old}, {t['id'] for t in new}
    first += [('DELETE FROM lessons WHERE id = ?', [t['id']]) for t in old if t['id'] not in new_ids]
    sizes = {c['id']: len(c.get('lessons', [])) for c in courses}
    listed = {c['id']: c.get('lessons', []) for c in courses}
    for raw in new:
        t = _topic(raw)
        given = articles.get(t['slug'], '')
        if old_by.get(t['id']) == t and not given:
            continue
        # SQLite checks a would-be new row against the table's rules before it notices the row already exists, so a published
        # lesson being updated has to carry its current article along. (The CASE below keeps the stored text when none is given.)
        art = given or (_articles().get(t['slug'], '') if t['status'] == 'published' and t['id'] in old_by else '')
        first.append(('INSERT INTO lessons (id, slug, status, title, summary, category, video_id, published_at, updated_at, article_html) '
                      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, status = excluded.status, '
                      'title = excluded.title, summary = excluded.summary, category = excluded.category, video_id = excluded.video_id, '
                      'published_at = excluded.published_at, updated_at = excluded.updated_at, '
                      "article_html = CASE WHEN excluded.article_html <> '' THEN excluded.article_html ELSE lessons.article_html END, "
                      f'modified_at = {NOW}',
                      [t['id'], t['slug'], t['status'], t['title'], t['summary'], t['category'], t['videoId'], t['publishedAt'], t['updatedAt'], art]))
        i = t['id']
        for table in ('lesson_tags', 'lesson_subtopics', 'lesson_concepts', 'lesson_links', 'course_lessons'):
            then.append((f'DELETE FROM {table} WHERE lesson_id = ?', [i]))
        then += _positions('lesson_tags', 'lesson_id', 'tag', i, t['tags'])
        then += _positions('lesson_subtopics', 'lesson_id', 'subtopic', i, t['subtopics'])
        then += _positions('lesson_concepts', 'lesson_id', 'concept', i, t['concepts'])
        for kind, ids in (('prerequisite', t['prerequisites']), ('related', t['related'])):
            then += [('INSERT INTO lesson_links (lesson_id, kind, position, target_id) VALUES (?, ?, ?, ?)', [i, kind, n, target]) for n, target in enumerate(_dedupe(ids))]
        for cid in t['courses']:
            if i in listed.get(cid, []):
                pos = listed[cid].index(i)
            else:
                pos = sizes.get(cid, 0)
                sizes[cid] = pos + 1
            then.append(('INSERT INTO course_lessons (course_id, lesson_id, position) VALUES (?, ?, ?)', [cid, i, pos]))
    return first, then


def _plan_courses(old, new):
    first, then = [], []
    old_by, new_ids = {c['id']: c for c in old}, {c['id'] for c in new}
    first += [('DELETE FROM courses WHERE id = ?', [c['id']]) for c in old if c['id'] not in new_ids]
    for raw in new:
        c = _course(raw)
        if old_by.get(c['id']) == c:
            continue
        first.append(('INSERT INTO courses (id, status, title, summary, category, audience, level, duration, prerequisites, url) '
                      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, title = excluded.title, '
                      'summary = excluded.summary, category = excluded.category, audience = excluded.audience, level = excluded.level, '
                      f'duration = excluded.duration, prerequisites = excluded.prerequisites, url = excluded.url, modified_at = {NOW}',
                      [c['id'], c['status'], c['title'], c['summary']] + [c.get(k, '') for k in COURSE_TEXT]))
        then.append(('DELETE FROM course_lessons WHERE course_id = ?', [c['id']]))
        then += [('INSERT INTO course_lessons (course_id, lesson_id, position) VALUES (?, ?, ?)', [c['id'], lid, n]) for n, lid in enumerate(_dedupe(c.get('lessons', [])))]
    return first, then


def _plan_projects(old, new):
    first, then = [], []
    old_by, new_ids = {p['id']: p for p in old}, {p['id'] for p in new}
    first += [('DELETE FROM projects WHERE id = ?', [p['id']]) for p in old if p['id'] not in new_ids]
    for raw in new:
        p = _project(raw)
        if old_by.get(p['id']) == p:
            continue
        gen = p['page'] == 'generated'
        first.append(('INSERT INTO projects (id, slug, status, project_group, page_type, featured, sort_order, tag, title, summary, built_by, built_with, '
                      'outcome, shows, look, built, role, what_happened) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) '
                      'ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, status = excluded.status, project_group = excluded.project_group, '
                      'page_type = excluded.page_type, featured = excluded.featured, sort_order = excluded.sort_order, tag = excluded.tag, '
                      'title = excluded.title, summary = excluded.summary, built_by = excluded.built_by, built_with = excluded.built_with, '
                      'outcome = excluded.outcome, shows = excluded.shows, look = excluded.look, built = excluded.built, role = excluded.role, '
                      f'what_happened = excluded.what_happened, modified_at = {NOW}',
                      [p['id'], p['slug'], p['status'], p['group'], p['page'], 1 if p['featured'] else 0, p['order'], p['tag'], p['title'], p['summary'],
                       p['builtBy'], p['builtWith'], p['outcome'], p['shows'], p.get('look', 'field'), p.get('built', ''), p.get('role', ''), p.get('whatHappened', '')]))
        i = p['id']
        for table in ('project_links', 'project_learned', 'project_images'):
            then.append((f'DELETE FROM {table} WHERE project_id = ?', [i]))
        then += [('INSERT INTO project_links (project_id, position, label, href) VALUES (?, ?, ?, ?)', [i, n, l['label'], l['href']]) for n, l in enumerate(p['links'])]
        if gen:
            then += _positions('project_learned', 'project_id', 'item', i, p['learned'])
            then += [('INSERT INTO project_images (project_id, position, src, alt, caption, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [i, n, m['src'], m['alt'], m['caption'], m['width'], m['height']]) for n, m in enumerate(p['images'])]
    return first, then


def _plan_pricing(old, new):
    p = _pricing(new)
    if old is not None and _pricing(old) == p:
        return [], []
    first = [(f'DELETE FROM {t}', []) for t in ('package_scope', 'packages', 'pricing_terms', 'pricing_settings')]
    first.append(('INSERT INTO pricing_settings (id, currency_note, intro_active, intro_note, not_included_by_default, terms_approved) VALUES (1, ?, ?, ?, ?, ?)',
                  [p['currencyNote'], 1 if p['introOffer']['active'] else 0, p['introOffer']['note'], p['notIncludedByDefault'], 1 if p['terms']['approved'] else 0]))
    then = []
    for n, x in enumerate(p['packages']):
        first.append(('INSERT INTO packages (id, position, name, price_type, price, intro_price, summary, note, cta_label, cta_href) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                      [x['id'], n, x['name'], x['priceType'], x['price'], x['introPrice'], x['summary'], x['note'], x['cta']['label'], x['cta']['href']]))
        then += _positions('package_scope', 'package_id', 'item', x['id'], x['scope'])
    then += [('INSERT INTO pricing_terms (position, item) VALUES (?, ?)', [n, item]) for n, item in enumerate(p['terms']['items'])]
    return first, then


def save(kind, data, articles=None):
    """Make the database hold exactly `data` for this kind. One transaction: either all of it is saved or none of it.
    `articles` ({slug: html}) sets lesson article text in the same transaction."""
    if kind not in KINDS:
        raise StoreError(f'unknown kind {kind}')
    current = _all()
    try:
        if kind == 'topics':
            first, then = _plan_topics(current['topics'], data, current['courses'], articles or {})
        elif kind == 'courses':
            first, then = _plan_courses(current['courses'], data)
        elif kind == 'projects':
            first, then = _plan_projects(current['projects'], data)
        else:
            first, then = _plan_pricing(current['pricing'], data)
    except (KeyError, TypeError, ValueError) as e:
        raise StoreError(f'A {kind} record is missing or has a bad value ({type(e).__name__}: {e}).') from None
    try:
        _run(first + then)
    except turso.DbError as e:
        raise StoreError(f'The database refused the change: {e}') from None


def set_article(slug, html):
    rows = db().query('SELECT id FROM lessons WHERE slug = ?', [slug])
    if not rows:
        raise StoreError(f'There is no lesson with the address "{slug}" in the database.')
    _run([(f'UPDATE lessons SET article_html = ?, modified_at = {NOW} WHERE slug = ?', [html, slug])])


# ---------------------------------------------------------------- whole-database moves
def snapshot():
    """Everything, as one dict. Used for undo and for backups."""
    data = {k: load(k) for k in KINDS}
    data['articles'] = dict(_articles())
    return data


def _merge_junction(topics, courses):
    """A course's lesson list and a lesson's course list describe the same links. Merge them into the course side, so the
    two can be written once without colliding."""
    by_id = {c['id']: copy.deepcopy(c) for c in courses}
    for c in by_id.values():
        c['lessons'] = _dedupe(_list(c.get('lessons')))
    plain = []
    for t in topics:
        t = copy.deepcopy(t)
        for cid in _list(t.get('courses')):
            if cid not in by_id:
                raise StoreError(f'Lesson {t["id"]} lists course {cid}, which does not exist.')
            if t['id'] not in by_id[cid]['lessons']:
                by_id[cid]['lessons'].append(t['id'])
        t['courses'] = []
        plain.append(t)
    return plain, list(by_id.values())


def replace_all(data):
    """Make the database hold exactly this snapshot (all kinds and all articles), in one transaction."""
    arts = {k: v for k, v in (data.get('articles') or {}).items() if v and PLACEHOLDER not in v}
    try:
        topics, courses = _merge_junction(data.get('topics') or [], data.get('courses') or [])
        plans = [_plan_topics([], topics, [], arts), _plan_courses([], courses), _plan_projects([], data.get('projects') or [])]
        if data.get('pricing'):
            plans.append(_plan_pricing(None, data['pricing']))
    except (KeyError, TypeError, ValueError) as e:
        raise StoreError(f'A record is missing or has a bad value ({type(e).__name__}: {e}).') from None
    wipe = [(f'DELETE FROM {t}', []) for t in ('lessons', 'courses', 'projects', 'packages', 'pricing_terms', 'pricing_settings')]
    try:
        _run(wipe + [s for f, _ in plans for s in f] + [s for _, t in plans for s in t])
    except turso.DbError as e:
        raise StoreError(f'The database refused the data: {e}') from None


def read_files(root=ROOT):
    """The content as the files hold it: the four JSON files, plus each lesson's article from its page."""
    data = {}
    for kind, path in FILES.items():
        path = os.path.join(root, os.path.relpath(path, ROOT))
        if not os.path.exists(path):
            data[kind] = None if kind == 'pricing' else []
            continue
        raw = json.load(open(path, encoding='utf-8'))
        data[kind] = raw if kind == 'pricing' else raw.get(kind, [])
    arts = {}
    for t in data['topics']:
        page = os.path.join(root, 'learn', t['slug'], 'index.html')
        if os.path.exists(page):
            m = ARTICLE_RE.search(open(page, encoding='utf-8').read())
            if m and m.group(1).strip() and PLACEHOLDER not in m.group(1):
                arts[t['slug']] = m.group(1)    # exactly as written, so the page is rebuilt byte for byte
    data['articles'] = arts
    return data


def counts():
    conn = db()
    return {t: conn.query(f'SELECT count(*) AS n FROM {t}')[0]['n'] for t in
            ('lessons', 'courses', 'course_lessons', 'projects', 'packages', 'pricing_terms')}
