# Admin panel (local)

A small web page that runs on your own computer or phone and edits the site's content, so you do not edit JSON by hand.
It adds and edits **lessons** (with their articles), **courses**, **packages and prices**, and **case studies** (with
screenshots). It uses the same rules as `python tools/site.py check` and rebuilds the same pages as `python tools/site.py sync`.

## Start it

```
python tools/admin.py
```

It prints an address like `http://127.0.0.1:8777/?t=...`. Open that address in a browser on the same device. The long code
at the end is a one-time password for this session; without it nothing works. Stop with `Ctrl+C`. Needs only Python 3.8 or newer.
On a phone, run it in Termux, open the address in the phone's browser, and keep the terminal session running.

## What it can and cannot do

| Can | Cannot |
|---|---|
| Add, edit and archive lessons, courses and case studies | Publish. It never runs git, pushes or deploys. You commit and deploy yourself, after a preview. **Exception once the live lesson function is on (docs/database.md): a published lesson is live without any deploy.** |
| Edit prices, the first-three-client switch and the terms (publish or hide) | Delete a lesson, course or project outright. It archives (the page stays reachable). Remove a package with its button |
| Upload case-study screenshots (PNG, JPG or WebP, up to 3 MB) | Edit the other pages (home text, About, Services text, FAQ). Those are still edited in the HTML files |
| Run the site check and the SEO check, rebuild pages, show your changed files | Manage leads or customers (that is a separate CRM and has not been built) |
| Undo the last change, as many times as there are saved changes | Change a lesson or project address after it exists |

## The five sections

- **Overview:** problems and warnings from the site check, the buttons, a preview link, and the files git sees as changed.
- **Lessons:** one per YouTube video. Fill in the concepts carefully; they are how the panel catches repeats. A new lesson that looks like an existing one is held back with the match shown, and you choose to save it anyway or not. Only `published` lessons appear on `/learn/`. Publishing needs a summary, the video link, the real date and a real article.
- **Courses:** a course shows as "Planned. Not available yet." with no date until it is `available` with a working address.
- **Packages and prices:** edit every number and the scope lists. "Show the first-three-client prices" is the single switch to end that offer. "Publish the terms" stays off until you approve each line.
- **Case studies:** either "make a case study page here" (the panel writes `projects/<slug>/`) or "link to an existing page" (the two hand-built case studies and the template are examples). Featured ones show on the home page.

## Honesty prompts

The panel warns (it does not block) when public text contains words that tend to become claims you cannot back up, such as
"guarantee", "best", percentages, "increase", "customers" or "reviews". Read each warning and keep only what you can show.
Every image needs alt text. A page made here carries `noindex` until its status is `published`.

## Safety

- It listens on `127.0.0.1` only, so other devices on your network cannot reach it.
- Every request needs the session token; requests from other websites and other host names are refused.
- It can only write the content files, lesson articles, case-study pages made here, and uploaded images. Lesson articles that contain scripts, iframes, forms, styles, event handlers or `javascript:` links are refused.
- Every save is backed up under `.admin-backups/` (ignored by git). "Undo last change" restores from there. Delete that folder now and then.
- `tools/admin/` is part of the repository, so a deploy publishes those files. They do nothing without the local server, and `robots.txt` asks search engines to skip `/tools/`.

## Where things are written

| Section | File |
|---|---|
| Lessons | `content/learn/topics.json`, `learn/<slug>/index.html` |
| Courses | `content/courses/courses.json`, `courses/index.html` |
| Packages and prices | `content/pricing.json`, `services/index.html`, `index.html` (home price list) |
| Case studies | `content/projects.json`, `work/index.html`, `index.html` (home projects), `projects/<slug>/index.html`, `assets/work/<slug>/` |

Do not hand-edit the parts between `PRICING`, `PROJECTS`, `TOPICS` and `COURSES` markers; the next rebuild overwrites them.

## Tests

`python tests/admin_test.py` starts the panel in a throwaway copy and checks the security rules, every save path, bad-data
refusals, undo, and the phone-sized interface. It is part of `python tests/run_all.py`.
