# Pricing

The prices live in one file, `content/pricing.json`. The Services page and the home page are written from it by
`python tools/site.py sync`, so a number can never differ between pages. `python tools/site.py check` fails if a price
is typed by hand anywhere else.

## Current prices (US dollars)

| Package | Price | First-three-client price | Scope |
|---|---|---|---|
| Website Fixes | Starting at $49 | none | A small, clearly scoped set of improvements to an existing website. Larger fixes and new functionality require a separate quote. |
| Landing Page | $199 | $169 | One responsive landing page. Brand and content customization, clear calls to action, basic on-page SEO, launch testing. |
| Business Website | $399 | $329 | Up to five agreed pages. Responsive layouts for mobile, tablet and desktop, brand customization, agreed contact options, basic on-page SEO, launch testing. |
| Custom-Coded Website | Starting at $699 | Starting at $599 | Custom page layouts and styling, responsive front-end development, agreed interactive features, basic on-page SEO, testing and deployment support. |

"Starting at" prices are labelled "Starting price" and package prices "Package price". The page says that final scope,
timeline, revisions, exclusions and payment terms are agreed in writing before work begins, and that e-commerce,
payment processing, custom backend systems and third-party integrations are not included by default.

If the table and the live page ever disagree, the page (the JSON) is right.

## What is not published

No delivery times, refund or cancellation terms, warranties, payment method, or discounts other than the first-three-client prices.

## Ending the first-three-client offer

When the third eligible paid project is agreed, open `content/pricing.json`, set `"introOffer": {"active": false ...}`,
run `python tools/site.py sync`, and publish. The intro prices and the note disappear and the standard prices stay.
The page never shows a counter or "slots left", and must not be changed to imply that slots are taken.
`check` prints a reminder while the offer is active.

Open decision: what counts as an eligible project (any package? three in total or three per package? when does a project
"count": on agreement or on the deposit?). The page only says "the first three paid projects".

## Terms: drafted, not published

`terms.items` in the JSON holds a proposed list (50% deposit, two revision rounds, client-supplied content, third-party
costs excluded, separate assessment for e-commerce and backends, revised quote for out-of-scope changes, maintenance
separate). `"approved": false` keeps it off the site. To publish exactly that wording, edit it if needed, set
`"approved": true`, run `sync`, and check the new "Scope and terms" block on the preview. Do not add cancellation, refund,
warranty or legal wording without a decision on what it should say.

## Changing a price

Edit the number in `content/pricing.json`, run `python tools/site.py sync`, then `python tools/site.py check`.
`introPrice` must be a whole number below `price`, or `null`.
