# Analytics (Google Analytics 4)

Measurement id: `G-B29TWFJY0Q`. It is written once, in `js/site.js` (the `ANALYTICS` block). Every Curiohatch page loads that
script, so every Curiohatch page is covered. Not covered: your personal portfolio under `/ruhan/`, the Classly demo,
the two sample templates, and the local admin panel. They do not load `site.js`.

## How it behaves

Google decides whether a site "is receiving data" partly by checking that the tag is on the page when it loads. The first version
of this site only added the tag after a visitor pressed Allow, so Google's check never saw it and reported no data. The tag is now
on every page from the start, using **Google Consent Mode**, with every kind of storage switched off until the visitor says yes.

- **Before a choice:** the tag loads with analytics and advertising storage denied. It sets no cookies and sends only anonymous pings with no cookie identifier. Google's servers still see the visitor's IP address, as with any site that loads a Google script. The privacy page says so.
- **"Allow analytics":** tells the waiting tag that analytics storage is granted. Cookies start, and visits count in full.
- **"No thanks":** remembered in the browser's local storage. The tag stops, the `_ga` cookies are removed, and on later pages the tag does not load at all.
- "Analytics settings" in the footer lets a visitor change their mind.
- A browser that sends the **Global Privacy Control** signal is treated as "No thanks": no notice, and the tag does not load.
- With JavaScript off, nothing loads and nothing asks.
- Advertising storage, ad personalization and Google signals are always off. This site shows no ads.

## What that means for your numbers

Visitors who allow analytics are counted in full. Visitors who have not chosen yet appear only as anonymous pings, which Google can
use to estimate visits. Visitors who refuse are not counted. This is a balance between useful numbers and privacy, and some places
(the UK and EU among them) expect consent before analytics cookies. It is not legal advice; if you want a firm answer for a
particular country, ask someone qualified.

To go back to "nothing reaches Google before a yes", set `loadBeforeChoice: false` in the `ANALYTICS` block in `js/site.js`. Google
will then report "no data" again until someone presses Allow, because it cannot see the tag. If you change it, update the privacy page too.

## Verify it works (I could not)

I cannot see your Google account, so I have not confirmed that the id belongs to your property or that data arrives. After the
site is deployed: open it in a normal browser window, press "Allow analytics", then open the property's **Realtime** report in
Google Analytics and look for your visit. Ad blockers and some privacy browsers block the tag; test without one.

## Settings worth reviewing in your Google Analytics account

Data retention, Google signals and advertising features, and who has access. These are in your account, not in the site code.

## Changing or removing it

- New id: change `id` in the `ANALYTICS` block in `js/site.js` and update the cache number (`?v=`) by running `python tools/site.py chrome` after raising `JS_V` in `tools/site.py`.
- Remove it: delete the `initAnalytics` call at the bottom of `js/site.js`, the "Analytics settings" button in `tools/site.py`, and rewrite the privacy page's analytics paragraphs.
- `python tests/interact.py` checks that the tag loads with all storage denied and no cookie before a choice, that Allow grants analytics storage, that a refusal sticks and stops the tag on later pages, that Global Privacy Control loads nothing, and that the notice stays readable.
