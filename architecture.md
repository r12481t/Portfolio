# Architecture

The Curiohatch studio site (home, services, builds, work, about, contact, privacy, courses, learn), plus Ruhan Tahlil's personal portfolio in `ruhan/` and shared project pieces in `projects/`. The old Two Desks home page is retired; it is preserved in the `pre-curiohatch` tag.

- **Repo:** https://github.com/r12481t/Portfolio (public, branch: `main`)
- **Live:** https://curiohatch.studio on Netlify, connected to GitHub with automatic deploys. On 2026-10-17 it served the first redesign (the milestone 1 site, checked by loading the home page, the portfolio and a case study); the milestone 2 work (prices, Netlify form) is not published until the owner approves a merge. Netlify serves pages without `.html` (for example `/projects/taqen/case-study`), so canonical and sitemap addresses for those pages are written that way. The old GitHub Pages address (https://r12481t.github.io/Portfolio/) is no longer the home. The domain is used in canonical, social-preview and sitemap addresses. Release steps and rollback: `docs/release-workflow.md`.
- **Naming note:** the repo/root name is the only thing likely to change. Don't hardcode it in paths (see Conventions).
- **Host-agnostic, with one exception:** nothing depends on a particular host except the contact form, which uses Netlify Forms (`docs/contact-form.md`). Moving host means replacing the form handler.
- **Last updated:** 2026-10-17 (pricing, Netlify form, tests and release docs added). Earlier: 2026-10-15, checked against the uploaded zip (no `.git` inside) after the experience redesign; before that, a clone of `main` (last commit 2026-10-11, 47 files).

## Folder tree

```
Portfolio/
├── index.html              # Curiohatch home page (replaces the old Two Desks home)
├── 404.html                # Not-found page in the Curiohatch design. Served at any address, so its header, footer and links are root-absolute (tools/site.py handles that)
├── sitemap.xml, robots.txt # Written by tools/site.py (sitemap). Only work once the site is served from the domain root
├── css/site.css            # Styles for the Curiohatch pages only (one site: home, services, builds, work, about, contact, privacy, courses, learn)
├── js/site.js              # Menu drawer, scroll reveals, sky depth, click-to-load video, inquiry form states. Everything works without it
├── js/learn.js             # Search and filters for /learn/ only. The list itself is already in the page
├── css/case-taqen.css      # TAQEN case study only (scoped to .case-taqen): lookbook swipe, hang-tag facts, chapters. Loaded after site.css
├── css/case-classly.css    # Classly case study only (scoped to .case-classly): monitor, screen tabs, power-on transition. Loaded after site.css
├── js/case-taqen.js        # TAQEN: shows which design you are on while swiping. Optional
├── js/case-classly.js      # Classly: turns the five screens into tabs and plays the power-on before the demo opens. Optional
├── content/                # The only place facts about lessons and courses are written
│   ├── learn/topics.json   # One record per YouTube video and its lesson page
│   ├── courses/courses.json # One record per course (empty until a real course exists)
│   ├── pricing.json        # Prices, scopes, first-three-client offer switch, unpublished terms draft
│   └── projects.json       # Work page and home projects, and the case studies made by the admin panel
├── tools/admin.py, tools/admin/   # Local-only admin panel (docs/admin-panel.md): lessons, courses, packages, case studies
├── projects/<slug>/        # Case-study pages made by the admin panel (the older ones in projects/taqen, classley and templates are hand-built)
├── assets/work/<slug>/     # Screenshots uploaded through the admin panel
├── tests/                  # Local test suite (python tests/run_all.py): docs/testing.md
├── docs/                   # pricing.md, contact-form.md, release-workflow.md, testing.md, launch-checklist.md, adding-a-learning-topic.md
├── .gitignore
├── tools/site.py           # Optional helper (Python 3, no packages): shared header/drawer/footer, lesson pages, lists, sitemap, checks
├── courses/index.html      # Courses: honest catalog, list written by tools/site.py
├── learn/index.html        # Learning library: list written by tools/site.py
├── learn/<topic-slug>/index.html   # One lesson page per published video (written by tools/site.py; the article part is yours)
├── assets/
│   ├── brand/              # badge-128/480.webp, wordmark-cream-320.webp, favicon.ico, icon-192.png, apple-touch-icon.png, social-preview.jpg
│   └── fonts/              # Space Grotesk and IBM Plex Sans (variable WOFF2, Latin subset) plus their OFL licence files
├── services/index.html         # Free audit, fixes, new websites
├── services/builds/index.html  # How website builds work
├── work/index.html         # Personal and team projects, sample template
├── about/index.html        # Who runs Curiohatch, how projects are handled
├── contact/index.html      # Inquiry form (Netlify Forms). contact/thanks/ is the branded page a no-JavaScript send lands on
├── privacy/index.html      # Privacy policy
├── ruhan/                  # Ruhan's own portfolio
│   ├── Ruhan-portfolio.html
│   ├── style.css
│   ├── main.js             # Loading screen, starts 3D at full quality, falls back to the still picture + explains why
│   ├── scene.js            # The Three.js night-desk scene
│   ├── camera-fit.js       # Plain maths: how to frame the desk on any screen (no Three.js, testable in Node)
│   ├── scene-poster-mobile.webp # Still picture used when 3D is off, portrait. The desktop poster (scene-poster.webp) is not added yet
│   └── services/           # Retired. Redirect stubs plus old files, see below
│       ├── auditnfix.html  # Redirect stub to /services/ (meta refresh and a visible link)
│       ├── builds.html     # Redirect stub to /services/builds/
│       ├── builds.css, builds.js   # Old builds page assets. Nothing loads them now. Kept, not deleted
│       └── services.css, style.css # Never linked by any page. Kept, not deleted (style.css looks like a stray restaurant-template copy)
└── projects/               # Shared: project pieces
    ├── classley/
    │   ├── classley.html   # The demo itself: the working app (sign-in screen first)
    │   ├── case-study.html # Write-up of the project, links to the demo
    │   ├── css/            # classly-styles.css (demo). case-study.css is superseded by ../../css/case-classly.css (kept, unused)
    │   └── js/             # classly-*.js (demo scripts). case-study.js is superseded by ../../js/case-classly.js (kept, unused)
    ├── taqen/              # TAQEN Collection: no demo (the store is on Netlify), so just the write-up
    │   ├── case-study.html
    │   ├── css/case-study.css  # superseded by ../../css/case-taqen.css (kept, unused)
    │   └── img/            # logo-white.png, product-1..3.webp, and `1` (a stray one-byte file, kept)
    └── templates/
        ├── css/base.css, css/landing.css, js/landing.js   # Used by landing-page.html only
        ├── landing-page.html   # Generic one-page local service template
        └── restraunt/          # Four-page restaurant template. The folder is spelled "restraunt" in the repo.
            ├── index.html, menu.html, about.html, contact.html
            ├── style.css       # One stylesheet shared by the four pages (they are one site)
            ├── hero.webp       # In this folder, not in img/. Licensing unconfirmed, so it is not reused
            └── img/            # MISSING in the repo. The pages request 11 files, listed under Open items
```


## What each part does

| Path | Purpose |
|---|---|
| `index.html` | Curiohatch home page, built on `css/site.css`. The old home styles (`index.css`) were no longer linked and were removed; both old files are in the `pre-curiohatch` tag. |
| `content/learn/topics.json`, `content/courses/courses.json` | The single source for the Learning library, lesson pages, Courses page and sitemap. Edit these, then run `python tools/site.py sync`. How to add a lesson: `docs/adding-a-learning-topic.md`. |
| `tools/site.py` | Convenience script, not needed to run the site. `chrome` rewrites the header, menu drawer and footer on every Curiohatch page (they live in the script, not in ten files). `sync` writes the lists, lesson-page frames, prices and sitemap. `new` adds a draft topic and refuses near-duplicates. `covered` lists what has already been taught. `check` validates and changes nothing. |
| `courses/`, `learn/` | Educational area. Not in the header bar, on purpose: the commercial links stay first. They are in the menu drawer and the footer. Nothing is listed until a real video or course exists. |
| `ruhan/` | Everything that belongs to Ruhan's own portfolio. Named after the person, lowercase. |
| `ruhan/Ruhan-portfolio.html` | Ruhan's personal portfolio page. Stays inside `ruhan/`. Its Services section has two cards, Audit and Fix and Website Builds, which link to the Curiohatch pages `../services/` and `../services/builds/`. In the Curiohatch brand (navy room, gold lamp, the wordmark in the nav). Its own `style.css`, never `css/site.css`. The two Curiohatch fonts are self-hosted from `../assets/fonts/`, so the page makes no Google Fonts request. `scene-poster.webp` and `scene-poster-mobile.webp` are the pictures shown when 3D is off; they are renders of the recolored scene, so make them again with `?capture` and `?capture=mobile` whenever the scene's look changes. |
| `ruhan/main.js`, `scene.js`, `camera-fit.js` | 3D. There is one quality level: full. `main.js` shows a loading screen, downloads Three.js, and starts the scene; it never downgrades quietly. It falls back to the still picture only when something is clearly wrong (scene not on screen after 12 s, under 20 fps averaged over 6 s, an error, a GPU reset, software-only graphics, no WebGL, Data Saver) and then shows a card in plain words with a "Try 3D again" button. Technical details only show with `?debug`. The visitor's own choice ("Turn 3D off" / "Try the 3D scene", in the footer) always wins and is remembered. Reduced-motion visitors get the same room without movement. `camera-fit.js` works out the zoom and offset that put the desk on the part of the screen the text doesn't cover. All the numbers are at the top of `main.js` (`LIMITS`). |
| `ruhan/services/` | Retired. `auditnfix.html` and `builds.html` are redirect stubs to the new Services and builds pages. `builds.css`, `builds.js`, `services.css` and `style.css` are kept but nothing loads them. |
| `projects/` | Separate from every person folder. Holds all the projects we do, one subfolder per project. |
| `projects/classley/` | Classly: a browser demo of language-center admin software (registration, class tracking, analytics). Plain HTML and JavaScript. Data is saved in the browser's localStorage, and demo sign-in details sit in client-side code, so it is a demo and not secure authentication. The repo has no database code. Designed by Barshon, who is not part of Curiohatch, and built with Ruhan. The folder and file names use `classley`; the visible name is Classly. |
| `projects/classley/case-study.html` | What it does, how to try it, how it went. In the Curiohatch design (css/site.css, shared header, drawer and footer) plus its own `css/case-classly.css` and `js/case-classly.js`: a drawn monitor (labeled as an illustration, not a screenshot), the five screens as tabs in Classly's own navy and pink, and the screen-boot transition when the demo opens. The wording is unchanged. Links to `classley.html`. |
| `projects/taqen/` | TAQEN Collection: print-on-demand brand for faith-inspired apparel, built by a team of six. Paused in practice (store still online, nothing new added). Only a write-up lives here, `case-study.html`, with its own `css/case-taqen.css` and `js/case-taqen.js`: an editorial lookbook where the three designs swipe on phones, hang-tag facts and numbered chapters. The wording is unchanged. |
| `projects/taqen/case-study.html` | Neutral voice. Credits Ruhan for the website and first designs and describes the other contributors by role, with no names. Links out to the live store, Instagram, Pinterest and Facebook. In the Curiohatch design since 2026-10-18; wording unchanged. |
| `projects/templates/landing-page.html` | Generic one-page template for a trade or clinic: call button that stays on screen, services, three-step process, questions, final call to action. Uses sample text. Loads `css/base.css`, `css/landing.css`, `js/landing.js` and Google Fonts. |
| `projects/templates/restraunt/` | Four-page restaurant template. Booking is a call or WhatsApp button only (no booking system). No JavaScript. Marked `noindex` until a real site replaces it. Its `img/` folder is missing in the repo (see Open items). |

## How pages link together

`ruhan/` and `projects/` are **separate sibling folders** at the repo root, next to the Curiohatch page folders. The arrows are clickable links between pages, not folder nesting.

```
index.html ──► services/ ──► services/builds/ ──► projects/templates/landing-page.html
     │              └──► contact/?type=audit | website | fixes
     ├──► work/ ──► projects/taqen/case-study.html ──► the live store (external)
     │         └──► projects/classley/case-study.html ──► projects/classley/classley.html (the demo)
     ├──► about/ ──► ruhan/Ruhan-portfolio.html ──► ../services/ and ../services/builds/
     ├──► learn/ ──► learn/<topic-slug>/ ──► related topics, courses/ (when a course is available)
     ├──► courses/ ──► learn/
     └──► privacy/, contact/

ruhan/services/auditnfix.html ──► services/        (redirect stub)
ruhan/services/builds.html    ──► services/builds/ (redirect stub)
```

Relative links that are in use (all start from the folder the page is in):

| From | To | Link |
|---|---|---|
| `services/builds/index.html` | landing template | `../../projects/templates/landing-page.html` |
| `work/index.html` | TAQEN / Classly case studies | `../projects/taqen/case-study.html`, `../projects/classley/case-study.html` |
| `ruhan/Ruhan-portfolio.html` | Services / builds | `../services/`, `../services/builds/` |
| `ruhan/Ruhan-portfolio.html` | Curiohatch home (footer) | `../index.html` |
| case studies | Curiohatch header, drawer and footer (written by `tools/site.py chrome`) | `../../` |
| `projects/templates/restraunt/*.html` | portfolio (the "Site by" credit) | `../../../ruhan/Ruhan-portfolio.html` |

- Curiohatch pages link to each other with folder links that end in a slash (`services/`), so they need a local web server for preview (for example `python -m http.server`), not a double-clicked file.
- The only absolute links allowed are to other sites (`https://wa.me/...`, a maps link, YouTube), `mailto:` and `tel:`, the canonical and social-preview tags (which must name the final domain), and the single `/` home link on `404.html`.
- If the restaurant folder is ever renamed to `restaurant`, update any link to it.


## Tech stack

- Plain HTML, CSS, JavaScript. No build tooling, no framework.
- Ruhan's 3D scene: Three.js (loaded from a CDN, only when 3D runs). Full quality, with a still-picture fallback. Test switches, added to the URL:
  - `?debug` shows mode, why, GPU, FPS, load time, remembered choice, errors, and whether reduced motion is on.
  - `?simulate=slow|lag|error|context|software|webgl|savedata` plays the loading screen and then the fallback card for that reason, with no 3D needed.
  - `?tier=full|static` forces 3D on or off with no monitoring.
  - `?timeout=3000&fps=40&window=4&warmup=1` try different limits for this visit.
  - `?exposure=1.8` scene brightness (default 1.55).
  - `?motion=full` pretends the system's "reduce motion" setting is off (also works on the Classly page). On Windows that setting is Settings > Accessibility > Visual effects > Animation effects.
  - `?capture` / `?capture=mobile` downloads the still picture for the fallback.
- Curiohatch pages: no libraries (the menu drawer, reveals, depth and the analytics choice are plain JavaScript in `js/site.js`). Google Analytics 4 (id in the `ANALYTICS` block) is on every page in Google Consent Mode, with storage off until the visitor allows it (`docs/analytics.md`); the privacy page describes it. Cross-page transitions use the browser's own `@view-transition` rule; browsers without it just navigate normally. Two variable WOFF2 fonts (Space Grotesk, IBM Plex Sans) are self-hosted from `assets/fonts/`, so the pages make no third-party requests on load. Only the contact form posts to an outside service. The landing template still loads Google Fonts, and the restaurant template uses system fonts only, because a client owns it. Pictures are WebP with `width` and `height` written on the tag.
- Contact form: a Netlify Forms form named `inquiry` (`data-netlify`, honeypot `_gotcha`). `js/site.js` posts it, urlencoded, to `/` and shows success only on a success response. The recipient email is set in the Netlify dashboard, not in the code. Delivery is not verified until a real test message arrives: `docs/contact-form.md`. `python tools/site.py check` fails if any `{{` placeholder returns.
- Reduced motion: the 3D scene still runs but calm; links jump instead of scrolling; the Classly demo button fades. On the Curiohatch pages reduced motion turns off every animation and transition, the drifting backgrounds, the scroll reveals and the page transition; content appears at once and the drawer opens without sliding.
- Hosting: Netlify (publishes the repository root, no build step). `tests/`, `tools/`, `docs/` and `content/` are therefore public addresses; `robots.txt` asks search engines to skip them. Keep nothing private in them.

## CSS ownership (read this before adding a stylesheet)

Two pages in the same folder must never be able to change each other.

1. **A stylesheet belongs to one page, or to one folder that is one site.** `builds.css` styles `builds.html` only. `restraunt/style.css` styles the four restaurant pages, which are one site.
2. **Name it after what it styles.** In a folder that holds several pages (`ruhan/services/`), use the page name: `builds.css`, `auditnfix.css`. Do not use a generic name such as `service.css` or `style.css` there, because it looks shared and the next page will link it by mistake.
3. **Never link another page's CSS or JS.** If two pages need the same thing, copy it. Shared styles belong to the home page only (`index.css`).
4. **Scope pages that share a folder.** Put a class on the `<html>` tag (`class="page-builds"`) and start every rule with it, including the colour tokens, which live on that class instead of `:root`. Prefix animation names (`builds-rise`). Then even a wrong link cannot leak styles.
5. **Scope the script too.** `builds.js` is one closed function and returns at once unless `<html>` has `page-builds`.
6. **Template folders handed to a client are the exception.** `restraunt/` is not scoped, because the client owns the whole site and one plain stylesheet is easier to edit.
7. **Cache busting:** pages link their own CSS/JS with a version, like `builds.css?v=5`. Bump the number in the HTML when you change the file.

8. **The Curiohatch pages share one stylesheet, on purpose.** `css/site.css` styles home, services, builds, work, about, contact, privacy, courses, learn, the two case studies, the 404 page and the case-study pages the admin panel makes, which are one site. It is not linked from the portfolio or the templates, and they never link it. The two hand-built case studies add one more stylesheet each, loaded after `site.css` and scoped to a class on their `<html>` tag: `css/case-taqen.css` (`.case-taqen`, with `js/case-taqen.js` for the swipe counter) and `css/case-classly.css` (`.case-classly`, with `js/case-classly.js` for the screen tabs and the power-on transition). That is how each case study gets its own personality inside the same brand. A case study the admin panel makes picks one of three hero looks (starfield, path or orbit) instead.

Known issue: none open. The audit page's old stylesheet naming problem went away when that page became a redirect stub. `ruhan/services/services.css` and `style.css` remain unlinked.

## Conventions

1. **New person:** create a lowercase folder at the repo root named after them (`ruhan/`, `<name>/`). Their own portfolio files stay inside it.
1b. **Cache busting:** pages link their own CSS/JS with a version, like `style.css?v=4`. When you change one of those files, bump the number in the HTML. `main.js` loads `scene.js?v=4` and `scene.js` loads `camera-fit.js?v=3` the same way, and the page preloads `scene.js?v=4`; bump all of them together.
2. **New project:** create `projects/<project-name>/` with the demo/entry HTML (named after the project) plus `css/` and `js/` subfolders, like `classley/`. Give it a `case-study.html` if it needs a write-up. The demo and the write-up are two separate files. Write the project page neutrally (no "I", no personal contact section).
2a. **Shared header, menu drawer and footer live in `tools/site.py`.** To change a menu link or a footer group, edit it there and run `python tools/site.py chrome`. Do not hand-edit the blocks between `<!-- CHROME:... -->` markers; the next run overwrites them. A new Curiohatch page needs the two marker pairs (or the old plain header and footer, which the script adopts) and an entry in `STATIC_PAGES`.
2b. **New service content:** services are pages of the Curiohatch site (`services/`, `services/builds/`). Add a section to the existing page, or a new folder with an `index.html` that uses `css/site.css` and the same header and footer. Do not add pages under `ruhan/services/`.
2c. **New template:** add it to `projects/templates/` (a single file for a one-pager, a folder for a multi-page site). Only link it from the builds or work page after the files are in the repo. Use sample text that is clearly a placeholder, keep `noindex`, and write plain-language comments that say what to replace.
3. **Use relative links, never root-absolute ones.** The site is served under `/Portfolio/`, so `href="/projects/..."` breaks. Count the folders up from the page you are editing: `ruhan/services/builds.html` needs `../../projects/...` to reach `projects/`. Never write the repo name in a URL. This also survives a rename and a host change. Two exceptions: the canonical and social-preview tags name the final domain, and `404.html` has one root-absolute home link, because a 404 page can be served from any depth. That link is correct only once the custom domain is connected.
4. **Keep each person, project, service page and template self-contained.** Don't reach into another folder for CSS or JS.
5. **Content edits:** placeholders (project links, socials, resume) live in the person's own HTML. Don't list skills that aren't real. No fake reports, sample scores or testimonials. Keep prices and claims modest and honest.
6. **Folder names:** lowercase, no spaces. (The restaurant template folder is spelled `restraunt` in the repo today.)
7. **Wide vs narrow layout is defined in two places that must match:** the media query in `ruhan/style.css` and `WIDE_QUERY` / `stageFor()` in `ruhan/camera-fit.js`. Change one, change the other.
8. **Sections on the portfolio have no background.** The scene shows through; a light shade (`.veil`) and a soft text shadow keep text readable. Don't add panels or backdrop blur over the canvas. Project cards are the one exception, and they are plain translucent boxes.
9. **Interaction and motion rules (services pages and templates):**
   - No grey or blue tap flash and no blue text selection: `-webkit-tap-highlight-color: transparent` and an amber `::selection`.
   - The focus outline shows for keyboard users only (`:focus-visible`), never after a click or a tap. Never remove it entirely.
   - Spacing uses the 8px scale only (4, 8, 16, 24, 32, 48, 64). Five text sizes. One sans font plus mono.
   - Motion: quick feedback 150ms, cards and menus 250 to 400ms, nothing over 500ms (the hero line drawing, 1.4 seconds, plays once and is the only exception), leaving faster than arriving. Only `transform` and `opacity` are animated, except the card slide-open, which grows a grid row.
   - Everything that animates also works without animation. A `prefers-reduced-motion` block switches it off.
   - Progressive enhancement: a tiny inline script adds `js` to `<html>`. Cards start closed only when that class is present, so with JavaScript off every card shows open and the add-ons show as a table.
10. **Pictures:** WebP, `width` and `height` on every `<img>`, real `alt` text, `loading="lazy"` below the first screen. A hero picture is a CSS background on the whole band, so a missing file leaves the colour and the words, never an empty gap.
11. **Writing style:** plain language, no em dashes, no decorative pills, dots or short lines before labels, no AI-sounding copy. Comment code in plain words so it can be learned from.

## Pricing

Prices are published from one file, `content/pricing.json` (Fixes from $49, Landing Page $199, Business Website $399, Custom-Coded Website from $699, with first-three-client prices of $169, $329 and from $599 while `introOffer.active` is true). `tools/site.py sync` writes them into `services/index.html` and the home page between `PRICING` markers; never type a price by hand (`check` fails). The terms draft in the same file stays unpublished until `terms.approved` is true. Details: `docs/pricing.md`. The older discarded figures stay off the site. No delivery times are published. The one published timeline is the free audit: 1 to 2 business days, defined on `services/index.html` as Monday to Friday, not counting US federal holidays *(wording awaiting approval)*.

## Making a client site from a template

1. Copy the template folder (or file) into a new, separate project. Do not edit the template in place.
2. Replace every sample line, price, number, address, map link and `tel:`/`wa.me` link. The comments in each file say where.
3. Replace the pictures with the client's own photos (WebP, with real `alt` text and `width`/`height`). Keep the same file names, or change the names in the HTML and in `style.css` (the restaurant hero is set there).
4. Delete the `noindex` line on every page and the "Site by" credit unless the client agrees to keep it.
5. Fill in the real title and description on each page.

## Open items

- [ ] Launch gates (blocking): see `docs/launch-checklist.md`. Main items: a Deploy Preview from a pull request, a real contact-form test message received, owner approval of the pricing wording, the first-three-client rule, the terms draft, the audit wording, and the YouTube link.
- [ ] The domain is connected and the old site opens; confirm canonical and social-preview tags render on the preview and then on the live site.
- [ ] Approve the audit business-day wording on `services/index.html`. The home, contact and work pages repeat "1 to 2 business days"; they must change together with it.
- [ ] Learning library: the YouTube channel link in `tools/site.py` (`YOUTUBE`) is the handle the site already used; confirm it. Keep the first lesson's article at 300+ words that add to the video; `check` warns below that.
- [ ] `sitemap.xml` and `robots.txt` only take effect when the site is served at a domain root (`curiohatch.studio`); on the `/Portfolio/` project URL search engines ignore them.
- [ ] Pricing decisions: what counts as an eligible first-three-client project; whether "$" means US dollars everywhere (the page says so); how clients pay (no method is published); whether to publish the terms draft.
- [ ] Restaurant template: the missing `img/` folder. Requested files: `hero.webp` (1600x900); `dish-soup.webp`, `dish-plate.webp`, `dish-burger.webp`, `about-kitchen.webp` (960x720); `logo-mark.svg`, `about-kitchen.svg`, `dish-soup.svg`, `dish-plate.svg`, `dish-cake.svg`, `dish-drinks.svg`. Original illustrations are prepared and waiting for approval. After adding them, change the four WebP alt texts in `restraunt/index.html` to describe illustrations, and re-add the restaurant template to the work or builds page.
- [ ] Classly sample-data names (`projects/classley/js/classly-data.js`): confirm they are fictional, or approve an exception to anonymize them.
- [ ] Classly database code: if it turns up, a MySQL description can be added to the case study, checked for secrets.
- [ ] Check the TAQEN store link before launch.
- [ ] `ruhan/Ruhan-portfolio.html` still says "online store" and "e-commerce" in the Website Builds card.
- [ ] Make `scene-poster.webp` (open the portfolio with `?capture` in a normal PC window). Until it exists, desktop shows the phone picture, which looks blurry when enlarged.
- [ ] Check the scene's brightness on a real PC (`?debug&exposure=1.55`, try 1.4 to 1.9) and the framing at your usual window size.
- [ ] Add a Pinterest board screenshot to `projects/taqen/img/` and uncomment the figure in `projects/taqen/case-study.html`.
- [ ] Add Classly screenshots to `projects/classley/img/` and uncomment the figure in `case-study.html`.
- [ ] Add a short README pointing here.
