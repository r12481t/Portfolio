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
