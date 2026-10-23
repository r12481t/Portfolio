# The database (Turso)

Lessons, courses, case studies and prices now have a home in a Turso database. This page is the whole guide: how it fits together,
how to set it up, how to use it day to day, and what is and is not proven.

## How it fits together

```
 you ──> admin panel ──> Turso database (the master copy of everything stored)
                              │
                              ├──> live function, when a visitor asks for a page ──> no deploy for anything stored
                              │
                              └──> content/*.json + generated pages (an always-current copy, committed to git: your backup)

 hand-written page text, design, code ──> git push ──> Netlify deploy   (the only thing that still needs one)
```

- **The database is the master copy** of lessons (with their articles), courses, case studies, packages and prices. The admin panel
  and the tools read from it and write to it.
- **Everything stored is live without a deploy.** A small Netlify Function reads the database when a page is asked for, and Netlify
  keeps each page for 5 minutes. That covers the Learn list and every lesson, the courses page, the Work page and the home page's
  project list, every case study made in the admin panel, the prices and terms on the Services page and the price summary on the
  home page, and the sitemap. Change any of it in the admin panel and it is live; nothing is committed or deployed. A production
  deploy costs 15 of the free plan's 300 monthly credits.
- **Hand-written pages are still files.** The words, layout and design of the home, services, about, contact and privacy pages,
  and the two hand-built case studies (TAQEN and Classly), are written in HTML. The function reads those pages as frames and fills
  in the live parts; changing the frame itself (a new paragraph, a menu link) is a normal deploy. That is by design: it is design
  and copy, not records.
- **If the database cannot be reached,** a hand-written page is sent exactly as last deployed, never an error. Pages that exist only
  as a record (a lesson, a case study) show a plain "try again in a minute" message, and Netlify may serve its cached copy for up to a day.
- **The JSON files and generated pages are an exact copy of the database.** After every save the tools rewrite them, so git keeps the
  full history of your content for free, and the site can still be rebuilt if the database is ever unreachable.
- **Only a read-only token lives on Netlify**, and only if you turn the live function on. The admin token stays in `.env.local` on your own computer.
- **Undo still works.** It puts the files back and copies them into the database, so one button undoes both.
- **Switched off by default.** With no `.env.local`, every tool behaves exactly as before, using the JSON files.

## Create the database

Turso's screens and commands change from time to time. If something below does not match what you see, their documentation at
https://docs.turso.tech is the authority.

1. Make a free account at https://turso.tech.
2. Create a database (the dashboard's "Create database" button, or in a terminal after installing their command line tool:
   `turso db create curiohatch`). Name it anything. Pick the region closest to you; for this site speed does not matter, because the
   database is only used while you edit.
3. Get its address: the dashboard shows it, or `turso db show curiohatch --url`. It looks like `libsql://curiohatch-yourname.turso.io`.
4. Create a token: the dashboard's token button, or `turso db tokens create curiohatch`. It is a long text starting `eyJ`.
5. Copy `.env.example` to `.env.local` (same folder, the top of the repo) and put the two values in:

```
TURSO_DATABASE_URL=libsql://curiohatch-yourname.turso.io
TURSO_AUTH_TOKEN=the-long-token
```

`.env.local` is in `.gitignore`. **The whole repository is the website**, so a secret in any committed file is published. Never
paste the token into a file other than `.env.local`, into the chat, into an issue, or into Netlify.

### What the free plan gives (checked on turso.tech/pricing on 22 October 2026; check again before you rely on it)
5 GB of storage, 500 million rows read and 10 million rows written per month. This site holds a few hundred rows, so it will use a
tiny fraction. Some older and third-party articles describe different limits, and databases being put to sleep after a quiet spell.
Turso's own pricing page and its announcement of the current plan are the sources to trust, and they describe no sleeping on the
free plan. If your database is ever slow to answer after a quiet spell, look there first. Nothing is lost either way: the files in
git are a full copy.

## Switch it on, in this order

```
python tools/db.py ping        # connects and runs one tiny query. If this fails, nothing else will work yet.
python tools/db.py init        # creates the tables
python tools/db.py import      # copies content/*.json and the lesson articles into the database
python tools/db.py status      # shows how many lessons, courses, projects and packages it holds
python tools/db.py check       # compares the database with the files and looks for secrets in the repo; changes nothing
```

After that, use the admin panel and `python tools/site.py sync` exactly as before. Commit and push the changed files as usual.

If you would rather practise first, put `CURIOHATCH_DB=file:content/dev.db` in `.env.local` instead of the two Turso lines. That
makes a database file on your computer (ignored by git) and the same commands work on it.

## No deploy for anything that is stored (the live function)

Why this exists: Netlify's free plan gives 300 credits a month and each production deploy costs 15, so about 20 deploys uses the
whole allowance (preview and branch deploys are free). Without this, every new lesson, price change or case study would be a deploy.

**What it serves.** `netlify/functions/learn.mjs` serves these addresses, wired up in `netlify.toml`:

| Address | What the function does | Published only? |
|---|---|---|
| `/learn/<lesson>/` | builds the whole lesson page | yes: a draft or archived lesson is a 404 |
| `/projects/<case-study>/` | builds the whole case-study page (the ones made in the admin panel) | yes |
| `/learn/`, `/courses/`, `/work/` | takes the hand-written page and fills in the list | yes (courses: available and planned) |
| `/services/` | fills in the prices, the first-three-client offer and the terms | terms only if approved |
| `/` (home page) | fills in the price summary and the featured projects | yes |
| `/sitemap.xml` | lists every public page, every published lesson and case study | yes |

Every page it makes is the same page the Python generator writes. `render.mjs` is a line-for-line port of the Python renderers,
and `tests/function_test.py` renders the same records both ways and requires the output to be identical byte for byte, so the two
cannot drift apart.

### Switch it on

1. Create a **read-only** token for the live site: `turso db tokens create curiohatch --read-only` (or the dashboard's read-only option).
   This is a second token. Never put the admin token on Netlify.
2. In Netlify (Site configuration, Environment variables) add two variables, available to **Functions**:
   `TURSO_DATABASE_URL` = `libsql://curiohatch-yourname.turso.io` and `TURSO_READ_TOKEN` = the read-only token.
3. **Try it on a deploy preview first** (free): push a branch, open the preview address from the pull request, and check
   `/`, `/services/`, `/work/`, `/courses/`, `/learn/`, one lesson and `/sitemap.xml`. Change a price in the admin panel and
   confirm the preview shows it within about 5 minutes without another push. If anything is wrong, Netlify's Functions log for
   `learn` says what.
4. Merge when the preview is right. From then on, publishing in the admin panel is enough.

### Day to day

- Add or edit anything stored in the admin panel and press Publish. A **new** lesson or case study is live at once (it was never
  cached). An **edit** shows within about 5 minutes.
- You do not need to push. The tools still rewrite the saved copies in the repo (the JSON files and the generated pages). Commit
  them whenever you next deploy something else, or not at all. `netlify.toml` skips a production deploy when a push changes only
  notes, tests, tools, the schema, `content/`, the saved lesson and case-study pages and the sitemap. Careful: the regenerated
  `index.html`, `services/index.html`, `work/index.html` and `courses/index.html` are real pages, so committing them (they change
  whenever a price or project changes) does deploy. Leave them uncommitted unless you are deploying anyway.
- Anything in the hand-written pages' own words still needs a deploy. Batch those.

### What it costs

Netlify's published rates on 22 October 2026: 15 credits per production deploy, 10 credits per GB-hour of function time, 2 credits
per 10,000 requests. Netlify has changed these once already; check netlify.com/pricing. Rendering one page takes a fraction of a
second, so as a ballpark 10,000 *uncached* renders would be about 6 credits (assuming 1 GB for 0.2 s each), against 15 for a single
deploy. Because pages are shared for 5 minutes, far fewer than that actually run.

### If pages 404 or look wrong after a deploy

First, get the site back (this takes about a minute and needs no code):

1. In Netlify open the site, then **Deploys**, pick the last deploy that worked, and choose **Publish deploy**. Visitors get that
   version again straight away. It should not run a new build, so it should not use deploy credits (confirm on Netlify's usage page).
2. Netlify then **locks auto publishing**, so new pushes will not go live by themselves. When the fix is ready, press
   **Start auto publishing** on the Deploys page.

Then find the cause. Each of these is one address typed into a browser:

| Open this | You see | It means |
|---|---|---|
| `https://your-site/.netlify/functions/learn?view=sitemap` | an XML list of addresses | the function is deployed and can read the database |
| the same | Netlify's own "not found" page | the function was not deployed. Check that `netlify/functions/` is in the pushed files and that `netlify.toml` is at the top of the repo |
| the same | "This page is not available right now" | the function runs but cannot read the database: check `TURSO_DATABASE_URL` and `TURSO_READ_TOKEN` in Netlify (a typo, the wrong token, or the admin token on a different database) |
| `https://your-site/services/` | the Services page | working |
| the same | the site's 404 page | the function ran but did not recognise the address; open the browser's developer tools, Network tab, click the page, and read the response headers `X-Curiohatch-View` and `X-Curiohatch-Route` |

`X-Curiohatch-View` says which page the function thought it was serving (`none` means it did not recognise the address) and
`X-Curiohatch-Route` says whether it learned that from the address (`path`) or from the `?view=` in `netlify.toml` (`query`).
A page with neither header is a plain file, not the function's. Netlify's Functions log for `learn` has the rest.

**What this fixed once:** the first release of the live function looked only for `?view=` and gave a 404 for every address that
arrived without it. It now works the address out for itself, whichever way Netlify shows it. If the same symptom ever returns,
send me the two headers and the log line.

### If something goes wrong

- **Turso is unreachable:** hand-written pages are sent as last deployed. A lesson or case study that is not in Netlify's cache gets a
  plain "please try again in a minute" message, never cached. A page already in the cache may be served for up to a day.
- **To switch the live function off:** delete the `[[redirects]]` blocks in `netlify.toml` and deploy once. The static pages then
  serve again, as long as you have regenerated them (`python tools/site.py sync`) and committed them.
- **Security:** a read-only token can read *everything* in this database, drafts included, and anything private you add later. So
  keep this database for public site content only. If you ever store private things (a client list, contact inquiries), give them
  their own Turso database with their own token; the free plan allows several. The function itself sends only SELECTs, and only
  asks for published records, but the token's power is what actually limits the damage of a leak.

## Everyday commands

| Command | What it does |
|---|---|
| `python tools/db.py status` | which database is on, whether its tables exist, how much it holds |
| `python tools/db.py export` | write the database out to the files and rebuild the pages (the database wins) |
| `python tools/db.py import --yes` | replace the database with what the files hold (the files win). Without `--yes` it refuses if the database has content. |
| `python tools/db.py backup` | save everything to a dated JSON file in `.db-backups/` (ignored by git; copy it somewhere safe too) |
| `python tools/db.py check` | differences between database and files, broken links between records, secrets that would be published |

**Which way round do I fix a mismatch?** If you edited a JSON file by hand and want to keep that edit: `import --yes`. If the
database is right and the files are stale: `export`. Day to day this should not happen, because the tools keep them in step. If you
edit a file by hand anyway, `check` tells you.

**Going back to the files only:** put `CURIOHATCH_STORE=json` in `.env.local` (it overrides everything else), or delete `.env.local`.
The files are complete, so nothing is lost.

## What is stored, and what the database refuses on its own

The schema is `db/migrations/001_init.sql`. It is readable; open it.

| Table | Holds |
|---|---|
| `lessons` (+ `lesson_tags`, `lesson_subtopics`, `lesson_concepts`, `lesson_links`) | each Learn lesson, including its article text; "before you start" and "related" links |
| `courses`, `course_lessons` | courses, and which lessons are in each, in order (one table, so a course and a lesson can never disagree) |
| `projects` (+ `project_links`, `project_learned`, `project_images`) | the Work page, templates, and the case studies the admin panel makes |
| `pricing_settings`, `packages`, `package_scope`, `pricing_terms` | packages, prices, the first-three-client offer, the terms draft |
| `schema_migrations` | which migrations have been applied |

Rules the database enforces itself, even if the admin panel had a bug: statuses come from a fixed list; addresses are lowercase
words joined by hyphens; a published lesson has a summary, a video id, a date and an article; an available course has an address; a
lesson or project address can never change once it exists; links between records must point at records that exist, and deleting a
record removes its list rows; a first-three-client price must be below the normal price; every write is all-or-nothing.

**Changing the schema later:** add a new file `db/migrations/002_what_it_does.sql` and run `python tools/db.py init`. Never edit
a migration that has already been applied.

## Security rules for this database

1. The token lives in `.env.local` only. `python tools/db.py check` fails if a token-shaped string or a `.env.local` / `.db` file is
   in the repository; run it before you push.
2. Treat the token like a password. If it was ever pasted anywhere it should not be, create a new one in Turso and invalidate the old one.
3. All values travel as parameters, never pasted into SQL text, so a lesson title cannot change a query.
4. The connection must be HTTPS (the client refuses anything else, except a database on your own computer).
5. Visitors never reach the database directly. The one live function holds a **read-only** token on Netlify, asks only for
   published lessons, sends only SELECTs, and never shows a visitor an error detail. Anything more (a write, private data) gets its
   own narrowly scoped token and its own database, with the checks in `docs/launch-checklist.md` run first.

## What is deliberately not here yet

- **No write-side API.** The only live code reads published records. Nothing a visitor does can change the database, and nothing
  stores what a visitor sends (the contact form still goes to Netlify Forms, as before). The places where more would genuinely help are the contact form (to store inquiries for a client
  list) and anything with accounts or progress (a Learn "mark as done", Classly beyond its browser-only demo). Each would be a
  small Netlify Function with its own token, and, for anything private, its own database. Tell me which you want first.
- **The Classly demo still stores nothing outside the visitor's browser.** That is part of what it promises.
- **Page text is not in the database.** The words and layout of the home, services, about, contact and privacy pages, and the two
  hand-built case studies (TAQEN and Classly), are HTML files. Moving all of that into records would turn the site into a content
  management system: every sentence editable in the admin panel, and the pages built from templates. It is possible, but it is a
  much bigger change that trades the hand-made design for an editor, so I have not done it without asking.

## What has and has not been proven

Proven by `python tests/run_all.py`: the schema and its rules on SQLite; import, export and every save round-trip exactly (all four
content files and every generated page come back byte for byte); all-or-nothing writes; the whole admin-panel suite passing with the
content in a database; the Turso client against a fake server that speaks Turso's HTTP protocol; the secret checks. For the live
function (`tests/function_test.py`, needs Node 18+): every live page (lessons, case studies, the home, services, work, courses and
Learn pages, the sitemap) is identical byte for byte to what the Python generator writes from the same records; drafts and archived
records are never served; bad addresses never reach the database; only SELECTs go out, only with the read token; a database outage
sends hand-written pages as last deployed and a plain uncached 503 for record-only pages; and the skip-deploy rule in `netlify.toml`
behaves correctly in a throwaway git repository (including that a hand-made template page named `index.html` still deploys).
Each of these was also checked by deliberately breaking the code and confirming the test fails.

**Not proven, because nothing in the test environment can reach them:**
- **A real Turso database.** The client follows Turso's published HTTP protocol and fails loudly and safely, but the first real
  connection is its first real test. That is why setup starts with `ping`.
- **Netlify itself.** That the rewrite rules reach the function (in particular the rules that serve the five hand-written frames as
  plain files), that the cache directives behave as documented, that the environment variables reach the function, and that the
  skip-deploy command is honoured. Trying it on a free deploy preview first, as described above, tests all four before anything is live.
