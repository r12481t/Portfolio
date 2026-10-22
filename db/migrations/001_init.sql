-- Curiohatch database schema, migration 001. SQLite dialect, which is what Turso (libSQL) speaks.
--
-- What lives here: everything that used to live in content/*.json and in the lesson pages' article blocks.
--   lessons   <- content/learn/topics.json (+ the article text from learn/<slug>/index.html)
--   courses   <- content/courses/courses.json
--   projects  <- content/projects.json
--   pricing   <- content/pricing.json
-- The visitor-facing site stays static. Pages are generated from these tables by `python tools/site.py sync`, and no
-- visitor ever talks to the database.
--
-- Rules the database enforces on its own, so a bad write fails even if the admin panel has a bug:
--   * statuses are from a fixed list; addresses (slugs) are lowercase words joined by hyphens;
--   * a published lesson has a summary, a YouTube video id, a publish date and an article;
--   * an available course has an address; a lesson address and a project address never change once they exist;
--   * links between records point at records that exist (foreign keys), and deleting a record removes its list rows;
--   * a first-three-client price is below the normal price.
-- Dates are text in YYYY-MM-DD form. Timestamps are UTC text in ISO form. Booleans are 0 or 1.
-- Lists that have an order (tags, links, scope items...) are child tables with a `position` column.
-- Statements end with a semicolon; tools/turso.py splits this file using SQLite's own rule, so the triggers below stay whole.

CREATE TABLE schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- ---------------------------------------------------------------- lessons (the Learn library)
CREATE TABLE lessons (
  id           TEXT PRIMARY KEY CHECK (id GLOB 't[0-9]*'),
  slug         TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
  status       TEXT NOT NULL CHECK (status IN ('planned', 'drafted', 'reviewed', 'published', 'archived')),
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  summary      TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 300),
  category     TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 60),
  video_id     TEXT NOT NULL DEFAULT '' CHECK (video_id = '' OR (length(video_id) = 11 AND video_id NOT GLOB '*[^A-Za-z0-9_-]*')),
  published_at TEXT NOT NULL DEFAULT '' CHECK (published_at = '' OR published_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  updated_at   TEXT NOT NULL DEFAULT '' CHECK (updated_at = '' OR (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND (published_at = '' OR updated_at >= published_at))),
  article_html TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (status <> 'published' OR (summary <> '' AND video_id <> '' AND published_at <> '' AND article_html <> ''))
);

CREATE TRIGGER lessons_address_is_permanent BEFORE UPDATE OF slug ON lessons WHEN NEW.slug <> OLD.slug
BEGIN
  SELECT RAISE(ABORT, 'a lesson address (slug) cannot be changed after it exists');
END;

CREATE TABLE lesson_tags (
  lesson_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL CHECK (position >= 0),
  tag       TEXT    NOT NULL CHECK (tag <> '' AND tag = lower(tag)),
  PRIMARY KEY (lesson_id, position),
  UNIQUE (lesson_id, tag)
);

CREATE TABLE lesson_subtopics (
  lesson_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL CHECK (position >= 0),
  subtopic  TEXT    NOT NULL CHECK (subtopic <> ''),
  PRIMARY KEY (lesson_id, position)
);

CREATE TABLE lesson_concepts (
  lesson_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL CHECK (position >= 0),
  concept   TEXT    NOT NULL CHECK (concept <> ''),
  PRIMARY KEY (lesson_id, position)
);

-- "Before you start" and "Related topics": one lesson pointing at another.
CREATE TABLE lesson_links (
  lesson_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kind      TEXT    NOT NULL CHECK (kind IN ('prerequisite', 'related')),
  position  INTEGER NOT NULL CHECK (position >= 0),
  target_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, kind, target_id),
  CHECK (lesson_id <> target_id)
);
CREATE INDEX lesson_links_target ON lesson_links (target_id);

-- ---------------------------------------------------------------- courses
CREATE TABLE courses (
  id            TEXT PRIMARY KEY CHECK (id GLOB 'c[0-9]*'),
  status        TEXT NOT NULL CHECK (status IN ('planned', 'upcoming', 'available', 'archived')),
  title         TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  summary       TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 300),
  category      TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 60),
  audience      TEXT NOT NULL DEFAULT '' CHECK (length(audience) <= 200),
  level         TEXT NOT NULL DEFAULT '' CHECK (length(level) <= 60),
  duration      TEXT NOT NULL DEFAULT '' CHECK (length(duration) <= 60),
  prerequisites TEXT NOT NULL DEFAULT '' CHECK (length(prerequisites) <= 200),
  url           TEXT NOT NULL DEFAULT '' CHECK (length(url) <= 400),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (status <> 'available' OR url <> '')
);

-- Which lessons belong to which course, in order. This one table replaces the two lists the JSON kept
-- (a course's "lessons" and a lesson's "courses"), so they can never disagree.
CREATE TABLE course_lessons (
  course_id TEXT    NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT    NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (course_id, lesson_id)
);
CREATE INDEX course_lessons_lesson ON course_lessons (lesson_id);

-- ---------------------------------------------------------------- projects (case studies and templates)
CREATE TABLE projects (
  id           TEXT PRIMARY KEY CHECK (id GLOB 'p[0-9]*'),
  slug         TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
  status       TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  project_group TEXT NOT NULL CHECK (project_group IN ('projects', 'templates')),
  page_type    TEXT NOT NULL CHECK (page_type IN ('generated', 'existing')),
  featured     INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order   INTEGER NOT NULL DEFAULT 100,
  tag          TEXT NOT NULL CHECK (length(tag) BETWEEN 1 AND 60),
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  summary      TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 400),
  built_by     TEXT NOT NULL DEFAULT '' CHECK (length(built_by) <= 200),
  built_with   TEXT NOT NULL DEFAULT '' CHECK (length(built_with) <= 200),
  outcome      TEXT NOT NULL DEFAULT '' CHECK (length(outcome) <= 300),
  shows        TEXT NOT NULL DEFAULT '' CHECK (length(shows) <= 600),
  -- only used when page_type is 'generated' (the page is built from these fields):
  look         TEXT NOT NULL DEFAULT 'field' CHECK (look IN ('field', 'path', 'orbit')),
  built        TEXT NOT NULL DEFAULT '' CHECK (length(built) <= 4000),
  role         TEXT NOT NULL DEFAULT '' CHECK (length(role) <= 3000),
  what_happened TEXT NOT NULL DEFAULT '' CHECK (length(what_happened) <= 3000),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TRIGGER projects_address_is_permanent BEFORE UPDATE OF slug ON projects WHEN NEW.slug <> OLD.slug
BEGIN
  SELECT RAISE(ABORT, 'a project address (slug) cannot be changed after it exists');
END;

CREATE TABLE project_links (
  project_id TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position >= 0),
  label      TEXT    NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  href       TEXT    NOT NULL CHECK (length(href) BETWEEN 1 AND 400),
  PRIMARY KEY (project_id, position)
);

CREATE TABLE project_learned (
  project_id TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position >= 0),
  item       TEXT    NOT NULL CHECK (item <> ''),
  PRIMARY KEY (project_id, position)
);

CREATE TABLE project_images (
  project_id TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position >= 0),
  src        TEXT    NOT NULL CHECK (length(src) BETWEEN 1 AND 300),
  alt        TEXT    NOT NULL CHECK (length(alt) BETWEEN 1 AND 200),
  caption    TEXT    NOT NULL DEFAULT '' CHECK (length(caption) <= 200),
  width      INTEGER NOT NULL DEFAULT 0 CHECK (width >= 0),
  height     INTEGER NOT NULL DEFAULT 0 CHECK (height >= 0),
  PRIMARY KEY (project_id, position)
);

-- ---------------------------------------------------------------- packages and prices
-- One row of settings, plus the packages and the terms list.
CREATE TABLE pricing_settings (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  currency_note           TEXT NOT NULL CHECK (length(currency_note) BETWEEN 1 AND 120),
  intro_active            INTEGER NOT NULL CHECK (intro_active IN (0, 1)),
  intro_note              TEXT NOT NULL CHECK (length(intro_note) BETWEEN 1 AND 300),
  not_included_by_default TEXT NOT NULL CHECK (length(not_included_by_default) BETWEEN 1 AND 400),
  terms_approved          INTEGER NOT NULL CHECK (terms_approved IN (0, 1)),
  modified_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE packages (
  id          TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 40 AND id NOT GLOB '*[^a-z0-9-]*'),
  position    INTEGER NOT NULL CHECK (position >= 0),
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  price_type  TEXT NOT NULL CHECK (price_type IN ('starting', 'package')),
  price       INTEGER NOT NULL CHECK (price > 0),
  intro_price INTEGER CHECK (intro_price IS NULL OR (intro_price > 0 AND intro_price < price)),
  summary     TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 200),
  note        TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  cta_label   TEXT NOT NULL CHECK (length(cta_label) BETWEEN 1 AND 60),
  cta_href    TEXT NOT NULL CHECK (length(cta_href) BETWEEN 1 AND 200)
);

CREATE TABLE package_scope (
  package_id TEXT    NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL CHECK (position >= 0),
  item       TEXT    NOT NULL CHECK (item <> ''),
  PRIMARY KEY (package_id, position)
);

CREATE TABLE pricing_terms (
  position INTEGER PRIMARY KEY CHECK (position >= 0),
  item     TEXT NOT NULL CHECK (item <> '')
);
