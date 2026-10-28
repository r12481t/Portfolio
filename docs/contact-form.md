# Contact form (stored in a database)

The form on `/contact/` sends what a visitor types to `netlify/functions/inquiry.mjs`, a small Netlify Function. The function checks
it and writes one row to the `inquiries` table of your existing Turso database. It is not Netlify Forms any more.

```
 visitor ──> /contact/ form ──> /.netlify/functions/inquiry ──> inquiries table (your Turso database)
                                   checks the fields, the trap field,          │
                                   the hourly limits, then INSERT              └──> you read it: python tools/db.py inquiries list
```

## Why Netlify Forms failed (very likely)

`netlify.toml` sends `/` to the page function with `force = true`, and that function answers every POST with 405. The old form
posted to `/`, so the post was refused before Netlify Forms could see it, and the page showed "Something went wrong". I could not
check this on the live site (that needs the Network tab on the real address); it matches the code exactly. The new form posts to its own
address, which no page rule touches, so the problem cannot come back that way.

## Honest states

- The page says "Thank you. Your message was sent." only when the function answered `{ok:true}`, which it does only after the
  database confirmed the row was stored. A reply that is anything else, including a page that was rewritten, a 405, a database that
  is down or a missing setting, shows "Something went wrong and your message may not have been sent."
- Running the site on your own computer shows that failure message. That is expected: a plain file server cannot accept the post.
- With JavaScript off, the form posts to the same function, which stores the message and sends the browser to `/contact/thanks/`.
  If the message could not be stored the visitor gets a small error page with a link back, never the thank-you page.

## Set it up (I cannot do these; they need your accounts)

Turso's screens and commands change from time to time. If something here does not match, https://docs.turso.tech is the authority.

1. **Create the table.** From the repo, with your usual `.env.local`: `python tools/db.py init`. It applies migration 002 and leaves
   everything else alone.
2. **Make a write token.** `turso db tokens create curiohatch` (no `--read-only`), or the dashboard's token button.
3. **Netlify settings.** Site configuration > Environment variables. `TURSO_DATABASE_URL` is already there for the page function.
   Add `TURSO_WRITE_TOKEN` with the token from step 2 (mark it secret if Netlify offers that). Optionally add
   `SITE_ORIGIN=https://curiohatch.studio`, so posts from other websites are refused. A function reads its settings when it starts,
   so deploy after adding them.
4. **Deploy**, then send a real test from the live address and run `python tools/db.py inquiries list`. The row should be there.
   Then tick the form off in `docs/launch-checklist.md`. If the page says it failed, Netlify's function log (Logs > Functions >
   inquiry) names the cause (for example a missing setting); it never contains the visitor's details.

The old `inquiry` form may still be listed in Netlify's **Forms** tab. Any messages that did arrive there are still there; nothing new
will. You can disable form detection once you have checked it for old messages.

### The trade-off of one database

A Turso token cannot be limited to one table: it is read-only or full access. So the write token on Netlify can, if it ever leaks,
change or delete lessons, courses and prices, not only add inquiries. What limits that: the token exists only in Netlify's settings
(never in the repo or the browser), the function runs one fixed INSERT built from checked values and nothing a visitor sends is ever
run as SQL, and the content is copied into git as JSON after every save, so lessons, courses, projects and prices can be rebuilt
(`python tools/db.py import`). Inquiries are not in that copy and not in `db.py backup`, so a deleted inquiry is gone unless you
saved it from the Turso dashboard. If you ever want the token's reach cut, a separate database is the fix, and I can write that.

## Reading and handling the inbox

```
python tools/db.py inquiries list                  new messages, newest first (--all includes replied and archived, --limit N)
python tools/db.py inquiries mark 7 replied        or archived, or new again
```

**Nothing emails you when a message arrives.** The contact page promises a reply within 1 to 2 business days of an audit request,
so check the inbox on a routine (the Turso dashboard also shows the table). If you want an email on every message, that is a
small addition to the function using an email service, and it needs an account with one; ask before I add it.

## Spam and limits

In the code: a hidden field people never see (`_gotcha`; a filled one is answered "ok" and stored nowhere), at most 3 messages per
email address and 40 in total per hour (a 4th gets "Too many messages", and the check and the insert are one statement), size limits
(20 KB body, 4000 characters of message), and a refusal of posts from other websites. The database also refuses malformed rows on its
own (`db/migrations/002_inquiries.sql`). There is no CAPTCHA. If spam gets through, tell me and I will add one; that needs a small code change and
an account with the CAPTCHA provider.

## Fields

`inquiry_type` (audit, website, fixes), `name`, `email`, `website`, `business_type`, `location`, `message`, `_gotcha`.
`?type=audit|website|fixes` in the address preselects the type. Email addresses are stored in lowercase. To add a field: add it to the
HTML, to `LIMITS` and the `INSERT` in `inquiry.mjs`, and to a new migration in `db/migrations/` (an existing table needs an `ALTER TABLE`, which
I would write for you).

## What is and is not proven

Tested locally (`python tests/inquiry_test.py`, and the form states in `python tests/interact.py .`): storing, refusing, the limits,
failure handling and the client messages, against a fake database. **Not tested:** Netlify actually running the function, Turso's real
service, and whether the Netlify settings are right. The first live test message is the real test. I have not confirmed what a
function call costs in Netlify credits on your plan; at a handful of messages a day it should be tiny, but check Usage & billing
after a few days of real use.
