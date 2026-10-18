# Launch checklist

Tick each item only after you have seen it with your own eyes. Order matters: items 1 to 3 block launch.

## Blocking

- [ ] **Preview exists and works.** A pull request produced a Netlify Deploy Preview address, and it loads (docs/release-workflow.md).
- [ ] **Contact form delivers.** A real test message appears in Netlify Forms and arrives in the inbox (docs/contact-form.md). Until then the form is unverified.
- [ ] **Pricing wording approved by the owner**, read on a phone: the prices, "Starting at", the first-three-client prices, the exclusions line, "All prices are in US dollars".
- [ ] **First-three-client rule decided**: what counts as an eligible project, and who ends the offer and when.
- [ ] **Terms decision**: approve, change or drop the draft terms (`terms.approved` in `content/pricing.json`). Decide how clients pay before publishing a deposit line.
- [ ] **Audit turnaround approved**: "1 to 2 business days, Monday to Friday, not counting US federal holidays" appears on the home, Services, Work and Contact pages.
- [ ] **YouTube channel link confirmed.** The footer and menu link to `https://www.youtube.com/@curiohatchstudio`. I could not verify it. Open it yourself.
- [ ] **Privacy page read.** It now names Netlify as the form handler and host, and describes the video box. Confirm it matches reality.

## Check on the preview

- [ ] Home, Services (prices), Work, About, Contact, Courses, Learn load; the menu opens, closes with Escape, and returns focus.
- [ ] Every price button leads to the contact page with the right type selected.
- [ ] `/ruhan/ruhan-portfolio` loads (it does on the live site today, and the canonical tag uses it). Also try `/ruhan/Ruhan-portfolio.html`.
- [ ] The old project addresses still work: `/projects/taqen/case-study.html`, `/projects/classley/case-study.html`, `/ruhan/services/auditnfix.html`.
- [ ] Safari on an iPhone (or any real phone), plus one other browser.
- [ ] Share the home page address in a chat app and look at the preview image.

## After going live

- [ ] Real form test again from the live address.
- [ ] Open `https://curiohatch.studio/sitemap.xml` and `robots.txt`; submit the sitemap in Google Search Console if you use it. Indexing takes time; do not expect it at once.
- [ ] Note the date, and keep the previous Netlify deploy for rollback.

## Not blocking

- Project screenshots for Classly and TAQEN; the Curiohatch email address on the contact page (add it only once it exists and works); a redirect from the old lowercase portfolio address.
