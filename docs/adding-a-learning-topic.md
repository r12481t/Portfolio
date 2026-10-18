# Adding a video and its lesson to the Learning library

The easiest way is the local admin panel (`python tools/admin.py`, see `docs/admin-panel.md`). This page explains the files
underneath it, for when you prefer the command line or need to fix something by hand.

Every published YouTube video gets one lesson page at `/learn/<topic-slug>/`. The facts about each lesson are written
once, in `content/learn/topics.json`. A small script (`tools/site.py`) turns those records into the pages, the
library list and the sitemap. The script needs Python 3 and nothing else. The website itself does not need it.

You can run it from the repo folder in any terminal:

```
python tools/site.py covered [WORDS]                  # what is already covered?
python tools/site.py new SLUG "Title of the lesson"   # start a draft
python tools/site.py sync                             # write pages, lists, sitemap
python tools/site.py check                            # report problems, change nothing
```

## The short version

0. Before you plan a video, run `python tools/site.py covered` (or add a word, such as `covered loops`). It lists every
   topic that is not archived, with its status and the concepts it teaches.
1. `python tools/site.py new what-is-a-variable "What is a variable?"`
   This adds a draft record with the next free id (`t001`, `t002`, ...) and creates `learn/what-is-a-variable/index.html`.
   Drafts are not listed, not in the sitemap and carry `noindex`.
2. Open `content/learn/topics.json` and fill in the record (field list below). Leave `status` as `drafted`.
3. Open `learn/what-is-a-variable/index.html` and write the lesson between `<!-- ARTICLE:START -->` and
   `<!-- ARTICLE:END -->`. Only that part is yours. Everything else on the page is rewritten from the JSON each time you run `sync`.
4. Run `python tools/site.py sync`, then open the page with `python -m http.server` and read it on a phone-sized window.
5. When the video is live on YouTube: set `videoId`, set `publishedAt`, set `status` to `published`, run `sync`, then `check`.
6. Commit the changed files. Nothing goes live until you publish the repo yourself.

## The record

| Field | What to put | Notes |
|---|---|---|
| `id` | `t001`, `t002`, ... | Never change it and never reuse it. Other records point to it. `new` picks the next one. |
| `slug` | `what-is-a-variable` | Lowercase words joined by hyphens. It is the page address, so changing it breaks links. Pick it once. |
| `status` | `planned`, `drafted`, `reviewed`, `published` or `archived` | See "Statuses" below. |
| `title` | The lesson title | Also the page `<h1>` and the search title. |
| `summary` | One or two sentences, about 160 characters | Used in the library card, the page intro and the search description. `check` warns past 170. |
| `category` | One main topic, for example `JavaScript basics` | Shown as a label and used by the category filter. Reuse the exact spelling. |
| `subtopics` | List of smaller topics covered | Searchable. Not shown on the page. |
| `tags` | Short lower-case words | Become filter chips on `/learn/`. |
| `concepts` | The ideas this lesson teaches | Shown as "Concepts covered". This is also the record that stops you repeating a topic by accident. |
| `videoId` | The 11 characters after `watch?v=` | Required to publish. Not the whole link. |
| `publishedAt` | `2026-10-20` | The real date the video went public. Required to publish. |
| `updatedAt` | `2026-10-27` or empty | Set it only when the lesson really changed. Not earlier than `publishedAt`. |
| `prerequisites` | Ids of lessons to read first | Shown only when those lessons are published. |
| `related` | Ids of related lessons | Shown only when those lessons are published. Link both ways. |
| `courses` | Ids from `courses.json` | Shown only when that course is `available` and has a working `url`. |

Do not invent any of these. Leave a field empty rather than guess.

## Avoiding repeats

The records are the memory of what has been taught. Three guards use them:

- `new` refuses a topic whose title, slug or concepts look like one already recorded, and shows the match. If it really is
  different, add `--allow-similar`.
- `check` warns when two topics share a concept or have very close titles, so a repeat that slipped in is noticed.
- The `concepts` and `subtopics` fields are what make this work. Fill them in carefully and use the same wording each time.

The guards compare words. They do not understand meaning, so they will miss a repeat that uses different words. Read
`covered` yourself too.

## Statuses

| Status | Page exists | Listed on /learn/ | In sitemap | Indexable |
|---|---|---|---|---|
| `planned` | no (a record only, to remember the idea) | no | no | n/a |
| `drafted` | yes | no | no | no (`noindex`) |
| `reviewed` | yes | no | no | no (`noindex`) |
| `published` | yes | yes | yes | yes |
| `archived` | yes | no | no | no (`noindex`) |

`check` refuses a `published` record that has no real `videoId`, no date, or an article that is still the placeholder.
That is deliberate: a draft must never appear as a published lesson.

## Writing the article

The article should teach something the video cannot, such as a worked example, a diagram, the code in text form that
a reader can copy, common mistakes, and a short "Key takeaways" box. It must be worth reading on its own. `check`
warns when an article is under 300 words, because a thin page that only repeats the video helps no one.

- Use `<h2>` for sections and `<h3>` for parts of a section. The page title is already the only `<h1>`.
- Wrap code in `<pre><code>...</code></pre>`. Only publish code you have run.
- Put images in `learn/<slug>/` or a shared folder, as WebP, with `width`, `height` and real `alt` text.
- For the takeaways box use `<div class="takeaways"><h2>Key takeaways</h2><ul>...</ul></div>`.

## The video box

If `videoId` is set, the page shows a "Play video" box. Nothing is requested from YouTube until the visitor presses it,
so the page stays fast and no tracker loads on its own. The box also keeps a plain "Watch on YouTube" link for visitors
without JavaScript. The privacy page already describes this.

## Retiring or renaming

- To take a lesson down, set `status` to `archived` and run `sync`. The page stays reachable for old links but is no longer listed.
- Do not rename a published slug. If you must, keep the old folder with a short page that links to the new one.

## Courses

`content/courses/courses.json` works the same way. It is empty now because no course exists. Statuses are `planned`,
`upcoming`, `available` and `archived`. A `planned` or `upcoming` course is shown with the label "Planned. Not available
yet." and no date. An `available` course needs a `url` that works. Do not add sign-up, payment or progress controls
to the Courses page until the thing behind them exists and has been tested.

## Connecting this to the YouTube pipeline later

Today the catalog is a file you edit. `topics.json` is plain JSON with stable ids, so a script in the video
pipeline can read it to list what is already covered (`category`, `subtopics`, `concepts`) and can append a record after
a video is published. Nothing on the website reads from the pipeline, and nothing here assumes it can. Add that
only when there is a supported way to do it, and check what it writes with `python tools/site.py check`.

## What the script cannot do from a phone

You can edit `topics.json` and an article from a phone in any text editor. The pages, list and sitemap are only rebuilt
when someone runs `sync` on a computer with Python. If that becomes a problem, a GitHub Action could run it on every
commit. That changes how the site is published, so it needs the owner's approval first.

## Before the first lesson goes live

- Confirm the YouTube channel link (`YOUTUBE` near the top of `tools/site.py`). It has not been verified.
- Run `python tools/site.py check` and fix every `PROBLEM`.
- Open the lesson page, the library and the Courses page on a phone-sized window, with and without JavaScript.
- Check the page's text and the video agree.
