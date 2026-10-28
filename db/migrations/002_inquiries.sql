-- Contact-form inquiries, migration 002. Lives in the same database as the content, built by `python tools/db.py init`.
-- Visitors' names and email addresses are in this table only: `db.py export`, `backup` and `import` never touch it, so it is not
-- copied into git (the content files are), and importing content never wipes it.
-- Written by netlify/functions/inquiry.mjs, which holds a write token on Netlify (docs/contact-form.md).
-- The database enforces its own rules, so a bad row fails even if the function has a bug. Timestamps are UTC text.

CREATE TABLE inquiries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'archived')),
  inquiry_type  TEXT NOT NULL CHECK (inquiry_type IN ('audit', 'website', 'fixes')),
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email         TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%._%'),
  website       TEXT NOT NULL DEFAULT '' CHECK (length(website) <= 300),
  business_type TEXT NOT NULL DEFAULT '' CHECK (length(business_type) <= 120),
  location      TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 120),
  message       TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 4000),
  CHECK (inquiry_type <> 'audit' OR website <> '')
);

CREATE INDEX inquiries_created ON inquiries (created_at);
CREATE INDEX inquiries_email ON inquiries (email, created_at);
