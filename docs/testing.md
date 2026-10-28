# Running the tests locally

One command runs everything: `python tests/run_all.py`

Setup, once:
```
pip install playwright
playwright install chromium
cd tests && npm install axe-core && cd ..     # only for the accessibility scan; it is skipped if missing
```

| Step | What it checks |
|---|---|
| content and pricing check | `tools/site.py check`: lesson and course records, pricing numbers, hand-typed prices, form attributes, generated files up to date, shared header and footer up to date |
| SEO and metadata | canonical and social URLs on the production domain and mapping to real files, unique titles, one h1, sitemap and robots, structured data matches the page. Runs twice: on the real site and on a copy with sample lessons published |
| admin panel | `tools/admin.py` in a throwaway copy: localhost and token security, every save path, bad data refused, undo, generated files, phone-sized interface |
| database layer | `tests/db_test.py`: the schema's own rules, import and export round trips, all-or-nothing writes, the Turso client against a fake server speaking its protocol, `db.py`, and the secret-file checks. Touches no real database |
| live lesson function | `tests/function_test.py` (needs Node 18+; skipped with a note without it): every page the Netlify function renders (lessons, case studies, home, services, work, courses, Learn, sitemap) is byte-identical to the Python generator's; drafts and archived records never served; bad addresses never reach the database; only SELECTs with the read token; a database outage sends hand-made pages as deployed and record-only pages an uncached 503; `netlify.toml` routes; the skip-deploy rule in a throwaway git repo. Fake database, no Netlify |
| contact function | `tests/inquiry_test.py` (needs Node 18+; skipped with a note without it): a valid message is stored and answered ok; a no-JavaScript post is stored and redirected; bad input, a filled trap field, other websites, wrong methods and oversize bodies store nothing; 3 per email and 40 in total per hour; a database that is down, rejects the token or is not configured never gives a false "sent"; one INSERT with the write token and no visitor details in the log; the database's own rules; importing content leaves inquiries alone. Fake database, no Netlify |
| admin panel with the content in a database | the same admin suite as above, run with `CURIOHATCH_TEST_DB=1` so the content lives in a throwaway local database; ends by checking the database and the files still agree after every save and undo |
| lesson and pricing tooling | draft privacy, duplicate guard, bad data refused, ending the intro offer, publishing terms, in a throwaway copy |
| interaction, form, pricing | menu drawer and focus, reveals, reduced motion, no-JavaScript, keyboard, form success and failure states (the network is simulated), pricing cards, labels and links |
| learning library | filters, empty and no-result states, topic page, video box (nothing sent to YouTube before Play), courses, using sample data |
| link, overflow and console crawl | every page and internal link, horizontal overflow at 360, 390, 768 and 1280 px, console errors; once normally and once with reduced motion |
| accessibility scan | axe-core on every page at two widths plus a sample lesson page |

Individual scripts also run alone, for example `python tests/interact.py` or `python tests/crawl.py --shots out`.
Performance, lab only: `python tests/perf.py before=/path/to/old now=.`

## What these tests cannot tell you

They run in headless Chromium only. They do not test Safari, Firefox, real phones or screen readers. They simulate the form's
network answers, so they cannot show that a message reaches your inbox. They do not test the Netlify build or a Deploy
Preview. Do those by hand with `docs/launch-checklist.md`. A scan with no violations does not prove the site is accessible.
