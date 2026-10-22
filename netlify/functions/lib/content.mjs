// What the live pages read from the database. Published lessons only: a draft is never rendered, whatever address is asked for.

const GROUP = (rows, key) => {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r[key])) out.set(r[key], []);
    out.get(r[key]).push(r);
  }
  return out;
};

export async function getLesson(db, slug) {
  const [lessons] = await db.queryMany([
    ["SELECT id, slug, title, summary, category, video_id, published_at, updated_at, article_html FROM lessons WHERE slug = ? AND status = 'published'", [slug]],
  ]);
  if (!lessons.length) return null;
  const l = lessons[0];
  const [concepts, links, courses] = await db.queryMany([
    ['SELECT concept FROM lesson_concepts WHERE lesson_id = ? ORDER BY position', [l.id]],
    ["SELECT k.kind AS kind, t.slug AS slug, t.title AS title FROM lesson_links k JOIN lessons t ON t.id = k.target_id WHERE k.lesson_id = ? AND t.status = 'published' ORDER BY k.kind, k.position", [l.id]],
    ["SELECT c.title AS title, c.url AS url FROM course_lessons cl JOIN courses c ON c.id = cl.course_id WHERE cl.lesson_id = ? AND c.status = 'available' AND c.url <> '' ORDER BY cl.course_id", [l.id]],
  ]);
  return {
    lesson: {
      slug: l.slug, title: l.title, summary: l.summary, category: l.category, videoId: l.video_id,
      publishedAt: l.published_at, updatedAt: l.updated_at,
      concepts: concepts.map((r) => r.concept),
      prerequisites: links.filter((r) => r.kind === 'prerequisite').map(({ slug: s, title }) => ({ slug: s, title })),
      related: links.filter((r) => r.kind === 'related').map(({ slug: s, title }) => ({ slug: s, title })),
      courses: courses.map(({ title, url }) => ({ title, url })),
    },
    article: l.article_html,
  };
}

export async function getLibrary(db) {
  const [lessons, tags, subs, concepts] = await db.queryMany([
    ["SELECT id, slug, title, summary, category, published_at FROM lessons WHERE status = 'published' ORDER BY published_at DESC, title DESC", []],
    ["SELECT g.lesson_id AS lesson_id, g.tag AS v FROM lesson_tags g JOIN lessons l ON l.id = g.lesson_id WHERE l.status = 'published' ORDER BY g.lesson_id, g.position", []],
    ["SELECT g.lesson_id AS lesson_id, g.subtopic AS v FROM lesson_subtopics g JOIN lessons l ON l.id = g.lesson_id WHERE l.status = 'published' ORDER BY g.lesson_id, g.position", []],
    ["SELECT g.lesson_id AS lesson_id, g.concept AS v FROM lesson_concepts g JOIN lessons l ON l.id = g.lesson_id WHERE l.status = 'published' ORDER BY g.lesson_id, g.position", []],
  ]);
  const t = GROUP(tags, 'lesson_id'), s = GROUP(subs, 'lesson_id'), c = GROUP(concepts, 'lesson_id');
  const list = (m, id) => (m.get(id) || []).map((r) => r.v);
  return lessons.map((l) => ({
    slug: l.slug, title: l.title, summary: l.summary, category: l.category, publishedAt: l.published_at,
    tags: list(t, l.id), subtopics: list(s, l.id), concepts: list(c, l.id),
  }));
}

export async function getSitemapSlugs(db) {
  const [lessons, projects] = await db.queryMany([
    ["SELECT slug FROM lessons WHERE status = 'published' ORDER BY slug", []],
    ["SELECT slug FROM projects WHERE status = 'published' AND page_type = 'generated' ORDER BY slug", []],
  ]);
  return { lessons: lessons.map((r) => r.slug), projects: projects.map((r) => r.slug) };
}

export async function getCourses(db) {
  const [rows] = await db.queryMany([
    ["SELECT status, title, summary, category, audience, level, duration, prerequisites, url FROM courses WHERE status IN ('available', 'planned', 'upcoming') ORDER BY rowid", []],
  ]);
  return rows;
}

// Published projects with their links: what the Work page and the home page list.
export async function getProjects(db) {
  const [projects, links] = await db.queryMany([
    ["SELECT id, slug, project_group, page_type, featured, sort_order, tag, title, summary, built_by, built_with, outcome, shows FROM projects WHERE status = 'published' ORDER BY rowid", []],
    ["SELECT l.project_id AS project_id, l.label AS label, l.href AS href FROM project_links l JOIN projects p ON p.id = l.project_id WHERE p.status = 'published' ORDER BY l.project_id, l.position", []],
  ]);
  const by = GROUP(links, 'project_id');
  return projects.map((r) => ({
    slug: r.slug, group: r.project_group, page: r.page_type, featured: !!r.featured, order: r.sort_order, tag: r.tag, title: r.title,
    summary: r.summary, builtBy: r.built_by, builtWith: r.built_with, outcome: r.outcome, shows: r.shows,
    links: (by.get(r.id) || []).map(({ label, href }) => ({ label, href })),
  }));
}

// One published case study that is built from a record (not the hand-made ones).
export async function getProject(db, slug) {
  const [rows] = await db.queryMany([
    ["SELECT id, slug, tag, title, summary, built_by, built_with, outcome, look, built, role, what_happened FROM projects WHERE slug = ? AND status = 'published' AND page_type = 'generated'", [slug]],
  ]);
  if (!rows.length) return null;
  const r = rows[0];
  const [links, learned, images] = await db.queryMany([
    ['SELECT label, href FROM project_links WHERE project_id = ? ORDER BY position', [r.id]],
    ['SELECT item FROM project_learned WHERE project_id = ? ORDER BY position', [r.id]],
    ['SELECT src, alt, caption, width, height FROM project_images WHERE project_id = ? ORDER BY position', [r.id]],
  ]);
  return {
    slug: r.slug, tag: r.tag, title: r.title, summary: r.summary, builtBy: r.built_by, builtWith: r.built_with, outcome: r.outcome, look: r.look,
    built: r.built, role: r.role, whatHappened: r.what_happened, links, learned: learned.map((x) => x.item), images,
  };
}

export async function getPricing(db) {
  const [settings, packages, scope, terms] = await db.queryMany([
    ['SELECT currency_note, intro_active, intro_note, not_included_by_default, terms_approved FROM pricing_settings WHERE id = 1', []],
    ['SELECT id, name, price_type, price, intro_price, summary, note, cta_label, cta_href FROM packages ORDER BY position', []],
    ['SELECT package_id, item FROM package_scope ORDER BY package_id, position', []],
    ['SELECT item FROM pricing_terms ORDER BY position', []],
  ]);
  if (!settings.length) return null;
  const s = settings[0];
  const sc = GROUP(scope, 'package_id');
  return {
    currencyNote: s.currency_note, introOffer: { active: !!s.intro_active, note: s.intro_note }, notIncludedByDefault: s.not_included_by_default,
    packages: packages.map((r) => ({
      id: r.id, name: r.name, priceType: r.price_type, price: r.price, introPrice: r.intro_price, summary: r.summary,
      scope: (sc.get(r.id) || []).map((x) => x.item), note: r.note, cta: { label: r.cta_label, href: r.cta_href },
    })),
    terms: { approved: !!s.terms_approved, items: terms.map((x) => x.item) },
  };
}
