#!/usr/bin/env python3
"""Curiohatch database tool. Python 3.8+, standard library only. Run it from anywhere; it finds the repo itself.

    python tools/db.py status          Which database is switched on, whether its tables exist, how many records it holds.
    python tools/db.py ping            Connect and run one tiny query. Use this first after you create the Turso database.
    python tools/db.py init            Create the tables (applies every migration in db/migrations/ that is not applied yet).
    python tools/db.py import          Copy the content files into the database (the database is replaced by what the files hold).
    python tools/db.py export          Write the database back out to the content files and rebuild the pages.
    python tools/db.py check           Compare the database with the content files and look for mistakes (changes nothing).
    python tools/db.py backup          Save everything in the database to a dated JSON file in .db-backups/.
    python tools/db.py inquiries list|mark   The contact-form inbox (a table in this database; docs/contact-form.md):
                                       list shows new messages (--all, --limit N), mark ID replied|archived|new.

Switching it on: put these two lines in a file called .env.local at the top of the repo (it is never committed):
    TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
    TURSO_AUTH_TOKEN=the-token-from-turso
Or, for practice with no account, one line:   CURIOHATCH_DB=file:content/dev.db
Without either, every tool keeps using the JSON files exactly as before. Full guide: docs/database.md
"""
import argparse, datetime, importlib.util, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import store, turso

ROOT = store.ROOT
BACKUPS = os.path.join(ROOT, '.db-backups')
# A Turso auth token is a JWT. If one ever lands in a file that gets published, this finds it.
TOKEN_RE = re.compile(r'eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.admin-backups', '.db-backups'}
TEXT_EXT = {'.html', '.js', '.css', '.json', '.md', '.py', '.txt', '.xml', '.toml', '.sql', '.yml', '.yaml', '.example'}


def load_site():
    """tools/site.py, loaded by path (its name would clash with Python's own `site` module)."""
    spec = importlib.util.spec_from_file_location('curiohatch_site', os.path.join(HERE, 'site.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def need_database():
    if not store.active():
        raise SystemExit('The database is not switched on. Add the two Turso lines to .env.local (see: python tools/db.py --help, or docs/database.md).')
    return store.db()


def describe():
    url, _ = store.settings()
    conn = store.db()
    return conn.label if conn.kind == 'remote' else conn.label + ' (practice database on this computer)'


# ---------------------------------------------------------------- commands
def cmd_status(args):
    if not store.active():
        print('Database: OFF. The JSON files in content/ are in use, as before.')
        print('To switch it on, see docs/database.md.')
        return 0
    conn = need_database()
    print('Database: ON ->', describe())
    if not store.schema_ready(conn):
        print('Tables: not created yet. Run: python tools/db.py init')
        return 0
    print('Migrations applied:', ', '.join(str(v) for v in sorted(store.applied_versions(conn))))
    for k, v in store.counts().items():
        print(f'  {k:<15}{v}')
    return 0


def cmd_ping(args):
    conn = need_database()
    t = time.time()
    row = conn.query('SELECT 1 AS ok')[0]
    ms = int((time.time() - t) * 1000)
    print(f'Connected to {describe()}: answered in {ms} ms ({"ok" if row["ok"] == 1 else "unexpected answer"}).')
    return 0


def cmd_init(args):
    conn = need_database()
    applied = store.migrate(conn)
    print('Applied: ' + ', '.join(applied) if applied else 'Tables are already up to date.')
    return 0


def cmd_import(args):
    conn = need_database()
    if not store.schema_ready(conn):
        raise SystemExit('The tables do not exist yet. Run: python tools/db.py init')
    files = store.read_files()
    have = {'lessons': len(files['topics']), 'courses': len(files['courses']), 'projects': len(files['projects']), 'packages': len((files['pricing'] or {}).get('packages', []))}
    now = store.counts()
    existing = now['lessons'] + now['courses'] + now['projects'] + now['packages']
    print('Files hold:   ' + ', '.join(f'{v} {k}' for k, v in have.items()))
    print('Database has: ' + ', '.join(f'{now[k]} {k}' for k in have))
    if existing and not args.yes:
        raise SystemExit('The database already has content, and this would REPLACE it with what the files hold.\nIf the files are the version you want, run it again with --yes. (To go the other way, use: python tools/db.py export)')
    store.reset()
    store.replace_all(files)
    print('Imported. The database now holds ' + ', '.join(f'{v} {k}' for k, v in store.counts().items() if k in have) + '.')
    return 0


def cmd_export(args):
    need_database()
    sc = load_site()
    sc.ensure_db_ready()
    for kind, key in (('topics', 'topics'), ('courses', 'courses'), ('projects', 'projects')):
        path = store.FILES[kind]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sc.write(path, json.dumps({'schema': 1, key: store.load(kind)}, indent=2, ensure_ascii=False) + '\n')
    pricing = store.load('pricing')
    if pricing is not None:
        sc.write(store.FILES['pricing'], json.dumps(pricing, indent=2, ensure_ascii=False) + '\n')
    sc.cmd_sync()
    print('Exported: the content files and the generated pages now match the database.')
    return 0


def cmd_inquiries(args):
    conn = need_database()
    if not any(name == 'inquiries' for _, name, _ in store.migration_files()):
        raise SystemExit('db/migrations/002_inquiries.sql is missing from this folder. Copy it from the zip, then run: python tools/db.py init')
    try:
        conn.query('SELECT 1 FROM inquiries LIMIT 1')
    except turso.DbError as e:
        if 'no such table' in str(e):
            raise SystemExit(f'The inquiries table does not exist in this database ({describe()}). Run: python tools/db.py init')
        raise
    if args.action == 'mark':
        if len(args.rest) != 2 or not args.rest[0].isdigit() or args.rest[1] not in ('new', 'replied', 'archived'):
            raise SystemExit('Usage: python tools/db.py inquiries mark ID new|replied|archived')
        if not conn.query('SELECT id FROM inquiries WHERE id = ?', [int(args.rest[0])]):
            raise SystemExit(f'There is no inquiry number {args.rest[0]}.')
        conn.query('UPDATE inquiries SET status = ? WHERE id = ?', [args.rest[1], int(args.rest[0])])
        print(f'Inquiry {args.rest[0]} is now marked {args.rest[1]}.')
        return 0
    where = '' if args.all else "WHERE status = 'new'"
    rows = conn.query(f'SELECT * FROM inquiries {where} ORDER BY id DESC LIMIT ?', [args.limit])
    if not rows:
        print('No inquiries.' if args.all else 'No new inquiries. (--all shows replied and archived ones too.)')
        return 0
    for r in rows:
        print(f"#{r['id']}  {r['created_at']}  [{r['status']}]  {r['inquiry_type']}")
        print(f"    {r['name']} <{r['email']}>" + (f"   site: {r['website']}" if r['website'] else ''))
        extra = ', '.join(x for x in (r['business_type'], r['location']) if x)
        if extra: print('    ' + extra)
        if r['message']: print('    ' + r['message'][:600].replace('\n', '\n    '))
        print()
    return 0


def cmd_backup(args):
    need_database()
    os.makedirs(BACKUPS, exist_ok=True)
    path = os.path.join(BACKUPS, datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(store.snapshot(), f, indent=2, ensure_ascii=False)
    print('Saved', os.path.relpath(path, ROOT), '(kept out of git; copy it somewhere safe too).')
    return 0


def tracked_files():
    """(files that git tracks, True) or, when git cannot say, (every file that is not obviously private, False)."""
    try:
        out = subprocess.run(['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return [l for l in out.stdout.splitlines() if l], True
    except (OSError, subprocess.SubprocessError):
        pass
    found = []
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        found += [os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/') for n in names]
    return found, False


def cmd_check(args):
    problems, warnings = [], []
    # 1. nothing secret in a file that gets published (the whole repo is the website)
    files, from_git = tracked_files()
    if not from_git:
        warnings.append('git was not found here, so this could not tell whether a private file (.env.local, a .db file) is tracked. Run: git ls-files')
    for rel in files:
        name = os.path.basename(rel)
        private = name == '.env.local' or (name.startswith('.env') and name != '.env.example') or name.endswith(('.db', '.db-wal', '.db-shm', '.sqlite'))
        if private and from_git:
            problems.append(f'{rel} is in the repository, so it would be published. Remove it from git (git rm --cached {rel}) and keep it in .gitignore.')
            continue
        if private:
            continue
        if os.path.splitext(rel)[1].lower() in TEXT_EXT or name == '.env.example':
            path = os.path.join(ROOT, rel)
            try:
                if os.path.getsize(path) < 2_000_000 and TOKEN_RE.search(open(path, encoding='utf-8', errors='ignore').read()):
                    problems.append(f'{rel} contains something that looks like a Turso auth token. Remove it and create a new token in Turso.')
            except OSError:
                pass
    gi = open(os.path.join(ROOT, '.gitignore'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, '.gitignore')) else ''
    for needed in ('.env.local', '*.db', '.db-backups/'):
        if needed not in gi:
            problems.append(f'.gitignore does not list {needed}')
    if not store.active():
        print('Database is OFF, so only the file checks ran.')
    else:
        conn = need_database()
        if not store.schema_ready(conn):
            problems.append('The tables do not exist yet. Run: python tools/db.py init')
        else:
            try:
                bad = conn.query('PRAGMA foreign_key_check')
                if bad:
                    problems.append(f'{len(bad)} link(s) between records point at something that does not exist (foreign key check).')
            except turso.DbError:
                warnings.append('The foreign key check is not available on this server, so it was skipped.')
            files = store.read_files()
            for kind in store.KINDS:
                db_data, f_data = store.load(kind), files[kind]
                if kind == 'pricing':
                    same = (db_data is None and f_data is None) or (db_data is not None and f_data is not None and db_data == store._pricing(f_data))
                    if not same:
                        warnings.append('pricing: the database and content/pricing.json differ.')
                    continue
                shape = store.SHAPERS[kind]
                d, f = {x['id']: x for x in db_data}, {x['id']: shape(x) for x in f_data}
                diff = sorted(i for i in set(d) | set(f) if d.get(i) != f.get(i))
                if diff:
                    warnings.append(f'{kind}: the database and the content file differ for {", ".join(diff[:8])}{" ..." if len(diff) > 8 else ""}.')
            arts = store._articles()
            gone = sorted(s for s in files['articles'] if files['articles'][s].strip() != arts.get(s, '').strip())
            if gone:
                warnings.append(f'lesson articles differ between the database and the pages for: {", ".join(gone[:8])}.')
            if any('differ' in w for w in warnings):
                warnings.append('The database is the master copy. To make the files match it: python tools/db.py export. To make the database match the files instead: python tools/db.py import --yes')
    for w in warnings:
        print('warning:', w)
    for p in problems:
        print('PROBLEM:', p)
    print(f'{len(problems)} problem(s), {len(warnings)} warning(s)')
    return 1 if problems else 0


def main():
    ap = argparse.ArgumentParser(description='Curiohatch database tool', epilog='Guide: docs/database.md')
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name, fn, help_ in (('status', cmd_status, 'show what is switched on and what is in it'), ('ping', cmd_ping, 'test the connection'),
                            ('init', cmd_init, 'create or update the tables'), ('import', cmd_import, 'copy the content files into the database'),
                            ('export', cmd_export, 'write the database out to the content files and rebuild pages'),
                            ('check', cmd_check, 'compare and look for mistakes'), ('backup', cmd_backup, 'save everything to a dated file')):
        p = sub.add_parser(name, help=help_)
        p.set_defaults(fn=fn)
        if name == 'import':
            p.add_argument('--yes', action='store_true', help='replace what the database already holds')
    pi = sub.add_parser('inquiries', help='the contact-form inbox')
    pi.add_argument('action', choices=['list', 'mark'])
    pi.add_argument('rest', nargs='*')
    pi.add_argument('--all', action='store_true', help='include replied and archived inquiries')
    pi.add_argument('--limit', type=int, default=20)
    pi.set_defaults(fn=cmd_inquiries)
    args = ap.parse_args()
    try:
        return args.fn(args)
    except (turso.DbError, store.StoreError) as e:
        print('error:', e, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
