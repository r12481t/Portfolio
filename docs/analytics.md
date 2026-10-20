# Analytics (Google Analytics 4)

Measurement id: `G-B29TWFJY0Q`. It is written once, in `js/site.js` (the `ANALYTICS` block). Every Curiohatch page loads that
script, so every Curiohatch page is covered. Not covered: your personal portfolio under `/ruhan/`, the Classly demo,
the two sample templates, and the local admin panel. They do not load `site.js`.

## How it behaves

- **Nothing goes to Google until the visitor presses "Allow analytics".** On a first visit a small notice at the bottom of the screen asks. "No thanks" and "Allow analytics" both remember the choice in the browser's local storage.
- "Analytics settings" in the footer lets a visitor change their mind. Choosing "No thanks" after allowing switches the tag off and removes the `_ga` cookies.
- A browser that sends the **Global Privacy Control** signal is treated as "No thanks": no notice, no analytics.
- With JavaScript off, nothing loads and nothing asks.
- The privacy page describes all of this. It no longer says the site has no analytics.

## What that means for your numbers

Only visitors who press Allow are counted, so GA will show fewer visits than really happened. That is the cost of asking first. It
is the safer setting for a business that wants international clients, because some places (the UK and EU among them) expect
consent before analytics cookies. This is not legal advice; if you want a firm answer for a particular country, ask someone qualified.

To load analytics for everyone without asking, set `askFirst: false` in `js/site.js`. I do not recommend that. If you do, update
the privacy page to match and check the rules for your visitors' countries.

## Verify it works (I could not)

I cannot see your Google account, so I have not confirmed that the id belongs to your property or that data arrives. After the
site is deployed: open it in a normal browser window, press "Allow analytics", then open the property's **Realtime** report in
Google Analytics and look for your visit. Ad blockers and some privacy browsers block the tag; test without one.

## Settings worth reviewing in your Google Analytics account

Data retention, Google signals and advertising features, and who has access. These are in your account, not in the site code.

## Changing or removing it

- New id: change `id` in the `ANALYTICS` block in `js/site.js` and update the cache number (`?v=`) by running `python tools/site.py chrome` after raising `JS_V` in `tools/site.py`.
- Remove it: delete the `initAnalytics` call at the bottom of `js/site.js`, the "Analytics settings" button in `tools/site.py`, and rewrite the privacy page's analytics paragraphs.
- `python tests/interact.py` checks that nothing is requested from Google before consent, that Allow loads the right id, that a refusal sticks, and that the notice stays readable.
