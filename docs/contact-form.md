# Contact form (Netlify Forms)

The form on `/contact/` is a Netlify Forms form named `inquiry`: `data-netlify="true"`, a hidden spam-trap field called
`_gotcha` (`netlify-honeypot`), and `method="POST"`. `js/site.js` validates it, then sends a urlencoded POST to `/` with
`form-name=inquiry`. With JavaScript off, the browser posts the form normally and Netlify shows its own thank-you page.

No email address, endpoint or secret is in the code. The recipient is set in the Netlify dashboard.

## Honest states

- The page says "Thank you. Your message was sent." only when the server answered with success.
- Any other answer, including running the site on your own computer, shows "Something went wrong and your message may
  not have been sent." Locally that is expected, because a plain file server cannot accept the POST.
- Success means Netlify accepted the message. It does not prove an email reached you. Only a received test message does.

## What you must do in Netlify (I cannot do these)

1. Check the plan. Open **Usage & billing**. As far as I could confirm (secondary sources summarising Netlify's docs, not
   your account), accounts created from September 4, 2025 use credit plans where form submissions are free and
   unlimited, while older accounts are on legacy plans with 100 submissions per site per month and automatic billing
   for more. Confirm which one you have.
2. Make sure the form is detected. In the site's **Forms** tab, enable form detection if it asks, and deploy. After a deploy that
   contains the page, a form named `inquiry` should be listed. If it is not listed, nothing will be collected.
3. Add the notification. **Forms > Form notifications > Add notification > Email**, and enter the Curiohatch email once
   it exists and works. Netlify sends from `formresponses@netlify.com`, so check spam folders.
4. Send a real test from the live address and confirm two things: the submission appears under Forms, and the email arrives.
5. Only then tick the form off in `docs/launch-checklist.md`.

Unverified: whether Deploy Previews collect submissions on your plan. If the Forms tab shows nothing after a preview
test, do not conclude the form is broken; run the real test after production is deployed, then roll back if it fails.

## Spam

The honeypot is the only protection in the code. Netlify also filters spam on its side. If spam gets through, Netlify's
reCAPTCHA option needs a small code change; ask before adding it.

## Fields

`inquiry_type` (audit, website, fixes), `name`, `email`, `website`, `trade`, `city_state`, `message`, `_gotcha`.
`?type=audit|website|fixes` in the address preselects the type. If you add a field, add it to the HTML only; the script
sends everything in the form.
