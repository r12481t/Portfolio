// The live lesson pages. Each function here is a line-for-line port of its Python twin in tools/site.py
// (render_topic with absolute=True, render_library, render_sitemap). tests/function_test.py renders the same lessons both ways
// and requires the two to match byte for byte, so the static pages and the live pages cannot drift apart.

export const DOMAIN = 'https://curiohatch.studio';
export const YOUTUBE = 'https://www.youtube.com/@curiohatchstudio';
export const SITEMAP_PAGES = ['', 'services/', 'services/builds/', 'work/', 'about/', 'contact/', 'privacy/', 'courses/', 'learn/', 'projects/taqen/case-study', 'projects/classley/case-study'];
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

export function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// JSON the way Python's json.dumps(ensure_ascii=False) writes it: a space after every comma and colon.
function pyJson(v) {
  if (Array.isArray(v)) return '[' + v.map(pyJson).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + pyJson(x)).join(', ') + '}';
  return JSON.stringify(v);
}

// The page frame (header, footer, and the css/js version numbers) comes from a static page the site already serves, so a
// menu change is made in one place (tools/site.py) and reaches these pages too.
export function frameFrom(html404) {
  const block = (name) => {
    const m = html404.match(new RegExp(`<!-- CHROME:${name}:START -->[\\s\\S]*?<!-- CHROME:${name}:END -->`));
    if (!m) throw new Error(`The page frame has no ${name} block.`);
    return m[0];
  };
  const v = (re) => { const m = html404.match(re); if (!m) throw new Error('The page frame has no version number.'); return m[1]; };
  return { header: block('HEADER'), footer: block('FOOTER'), cssV: v(/css\/site\.css\?v=(\d+)/), jsV: v(/js\/site\.js\?v=(\d+)/) };
}

// t: { slug, title, summary, category, videoId, publishedAt, updatedAt, concepts: [], prerequisites: [{slug,title}],
//      related: [{slug,title}], courses: [{title,url}] }   (only published lessons are ever passed in)
export function renderLesson(t, article, frame) {
  const P = '/';
  const up = '/learn/';
  const canonical = `${DOMAIN}/learn/${t.slug}/`;
  const title = t.title;
  const summary = t.summary || '';
  const data = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description: summary,
    datePublished: t.publishedAt, dateModified: t.updatedAt || t.publishedAt, mainEntityOfPage: canonical,
    publisher: { '@type': 'Organization', name: 'Curiohatch' },
  };
  const ld = '<script type="application/ld+json">' + pyJson(data).replace(/<\//g, '<\\/') + '</script>\n';
  const crumbs = `<p class="crumbs"><a href="${up}">Learning library</a>` + (t.category ? ` &middot; ${esc(t.category)}` : '') + '</p>';
  let meta = `<p class="topic-meta">Published <time datetime="${t.publishedAt}">${prettyDate(t.publishedAt)}</time>`;
  if (t.updatedAt && t.updatedAt !== t.publishedAt) meta += ` &middot; Updated <time datetime="${t.updatedAt}">${prettyDate(t.updatedAt)}</time>`;
  meta += '</p>';
  let video = '';
  if (t.videoId) {
    const vid = t.videoId;
    video = `<div class="video" data-video-id="${esc(vid)}" data-title="${esc(title)}">\n` +
      `  <p>Playing the video loads it from YouTube. <a href="https://www.youtube.com/watch?v=${esc(vid)}">Watch on YouTube instead</a></p>\n</div>\n`;
  }
  const side = [];
  if (t.concepts.length) side.push('<h2>Concepts covered</h2>\n<ul>' + t.concepts.map((c) => `<li>${esc(c)}</li>`).join('') + '</ul>');
  const links = (xs) => '<ul>' + xs.map((x) => `<li><a href="${up}${esc(x.slug)}/">${esc(x.title)}</a></li>`).join('') + '</ul>';
  if (t.prerequisites.length) side.push('<h2>Before you start</h2>\n' + links(t.prerequisites));
  if (t.related.length) side.push('<h2>Related topics</h2>\n' + links(t.related));
  if (t.courses.length) side.push('<h2>Part of a course</h2>\n<ul>' + t.courses.map((c) => `<li><a href="${esc(c.url)}">${esc(c.title)}</a></li>`).join('') + '</ul>');
  side.push(`<h2>More from Curiohatch</h2>\n<ul><li><a href="${up}">All topics</a></li><li><a href="${P}courses/">Courses</a></li><li><a href="${YOUTUBE}">YouTube channel</a></li></ul>`);
  const sideHtml = side.join('\n');
  const ogTitle = esc(`${title} | Curiohatch Learn`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- FRAME:HEAD:START (written by tools/site.py from content/learn/topics.json; edit the JSON, not this block) -->
<title>${ogTitle}</title>
<meta name="description" content="${esc(summary)}">
<meta name="theme-color" content="#011022">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Curiohatch">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${DOMAIN}/assets/brand/social-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${ld}<!-- FRAME:HEAD:END -->
<link rel="icon" href="${P}assets/brand/favicon.ico" sizes="48x48">
<link rel="icon" href="${P}assets/brand/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="${P}assets/brand/apple-touch-icon.png">
<link rel="preload" href="${P}assets/fonts/space-grotesk-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${P}assets/fonts/ibm-plex-sans-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.className+=' js'</script>
<link rel="stylesheet" href="${P}css/site.css?v=${frame.cssV}">
</head>
<body>
${frame.header}
<main id="main">
<!-- FRAME:TOP:START (generated; edit the JSON) -->
<div class="sky sky--field band--navy">
  <div class="wrap page-head">
    ${crumbs}
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(summary)}</p>
    ${meta}
  </div>
</div>
<!-- FRAME:TOP:END -->
<section class="band horizon">
  <div class="wrap topic-layout">
    <article class="article">
      <!-- FRAME:VIDEO:START (generated; edit the JSON) -->
      ${video}<!-- FRAME:VIDEO:END -->
      <!-- ARTICLE:START -->${article}<!-- ARTICLE:END -->
    </article>
    <aside class="side" aria-label="About this topic">
      <!-- FRAME:SIDE:START (generated; edit the JSON) -->
      ${sideHtml}
      <!-- FRAME:SIDE:END -->
    </aside>
  </div>
</section>
</main>
${frame.footer}
<script src="${P}js/site.js?v=${frame.jsV}" defer></script>
</body>
</html>
`;
}

// cards: [{ slug, title, summary, category, publishedAt, tags: [], subtopics: [], concepts: [] }], already in display order
export function renderLibrary(cards) {
  if (!cards.length) {
    return '<div class="empty" id="library-empty">\n' +
      '  <h2>No topics are published yet</h2>\n' +
      '  <p>Each Curiohatch video will get a written lesson here, with the video, the explanation, the key ideas and links to related lessons. Nothing has been published yet, so this list is empty.</p>\n' +
      `  <p>The videos come first. You can find them on <a href="${YOUTUBE}">the Curiohatch YouTube channel</a>.</p>\n` +
      '</div>';
  }
  const card = (t) => {
    const haystack = [t.title, t.summary, t.category, t.tags.join(' '), t.subtopics.join(' '), t.concepts.join(' ')].join(' ').toLowerCase();
    const cat = t.category ? `<p class="tag">${esc(t.category)}</p>` : '';
    return `<li data-category="${esc(t.category || '')}" data-tags="${esc(t.tags.join('|'))}" data-text="${esc(haystack)}">\n` +
      `  <article class="card">\n    ${cat}\n    <h3><a href="${esc(t.slug)}/">${esc(t.title)}</a></h3>\n` +
      `    <p>${esc(t.summary)}</p>\n` +
      `    <p class="card-meta">Published <time datetime="${t.publishedAt}">${prettyDate(t.publishedAt)}</time></p>\n  </article>\n</li>`;
  };
  return `<h2>All topics</h2>\n<ul class="cards" id="topic-list">\n${cards.map(card).join('\n')}\n</ul>`;
}

// Puts the library into the static /learn/ page, between its TOPICS markers.
export function fillLibrary(shell, libraryHtml) {
  const pat = /<!-- TOPICS:START -->[\s\S]*?<!-- TOPICS:END -->/;
  if (!pat.test(shell)) throw new Error('The learn page has no TOPICS markers.');
  return shell.replace(pat, () => `<!-- TOPICS:START -->\n${libraryHtml}\n<!-- TOPICS:END -->`);
}

export function renderSitemap(lessonSlugs, projectSlugs) {
  const urls = SITEMAP_PAGES.map((p) => `${DOMAIN}/${p}`)
    .concat(lessonSlugs.map((s) => `${DOMAIN}/learn/${s}/`), projectSlugs.map((s) => `${DOMAIN}/projects/${s}/`));
  const body = urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ---------------------------------------------------------------- courses, work, case studies, prices
// Ports of course_card, render_courses, render_plate, render_work, render_home_projects, render_project_page, render_plan,
// render_pricing and render_pricing_teaser in tools/site.py. The regions use the same relative prefixes as the static pages
// (they are served at the same addresses); whole pages (lessons, case studies) use root-absolute ones.

const GENERATED_MARK = '<!-- GENERATED:PROJECT -->';

function courseCard(c) {
  let tag, title;
  if (c.status === 'available') {
    tag = 'Available';
    title = `<a href="${esc(c.url)}">${esc(c.title)}</a>`;
  } else {
    tag = 'Planned. Not available yet.';
    title = esc(c.title);
  }
  const facts = [];
  if (c.audience) facts.push(['For', c.audience]);
  if (c.level) facts.push(['Level', c.level]);
  if (c.duration) facts.push(['Length', c.duration]);
  if (c.prerequisites) facts.push(['Before you start', c.prerequisites]);
  const meta = facts.length
    ? '<dl class="proj-meta" style="color:var(--muted)">' + facts.map(([k, v]) => `<dt style="color:var(--navy)">${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>'
    : '';
  const cat = c.category ? `<p class="card-meta">${esc(c.category)}</p>` : '';
  return `<li>\n  <article class="card">\n    <p class="tag">${tag}</p>\n    <h3>${title}</h3>\n    <p>${esc(c.summary)}</p>\n    ${meta}\n    ${cat}\n  </article>\n</li>`;
}

export function renderCourses(courses) {
  const live = courses.filter((c) => c.status === 'available');
  const plan = courses.filter((c) => c.status === 'planned' || c.status === 'upcoming');
  if (!live.length && !plan.length) {
    return '<div class="empty" id="courses-empty">\n' +
      '  <h3>No courses yet</h3>\n' +
      '  <p>No Curiohatch course exists yet, so there is nothing to enrol in and nothing to buy. When one is ready it will be listed here with what it covers, who it is for and how to start.</p>\n' +
      '  <p>In the meantime, the <a href="../learn/">Learning library</a> collects the written lessons that go with each video.</p>\n' +
      '</div>';
  }
  const out = [];
  if (live.length) out.push('<h2>Available now</h2>\n<ul class="cards">\n' + live.map(courseCard).join('\n') + '\n</ul>');
  if (plan.length) out.push('<h2 style="margin-top:3rem">Planned</h2>\n<p class="prose">These are plans. They are not available yet, and no release date is promised.</p>\n<ul class="cards">\n' + plan.map(courseCard).join('\n') + '\n</ul>');
  return out.join('\n');
}

const linkHref = (href, P) => (/^(https?:|mailto:|#)/.test(href) ? href : P + href);
const effectiveLinks = (p) => (p.page === 'generated' ? [{ label: 'Read the case study', href: `projects/${p.slug}/` }] : []).concat(p.links);
const paragraphs = (text) => (text || '').trim().split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

function renderPlate(p, P, home = false) {
  const links = effectiveLinks(p);
  const first = links.length ? links[0].href : '';
  const title = first ? `<a href="${esc(linkHref(first, P))}">${esc(p.title)}</a>` : esc(p.title);
  const meta = [];
  if (p.builtBy && !home) meta.push(['Built by', p.builtBy]);
  if (p.builtWith) meta.push(['Built with', p.builtWith]);
  if (p.outcome) meta.push(['Outcome', p.outcome]);
  const dl = meta.length ? '<dl class="proj-meta">' + meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>\n        ' : '';
  const shows = p.shows ? `<details><summary>What this shows</summary><div><p>${esc(p.shows)}</p></div></details>\n        ` : '';
  const lk = links.length ? '<div class="links">' + links.map((l) => `<a href="${esc(linkHref(l.href, P))}">${esc(l.label)}</a>`).join('') + '</div>\n        ' : '';
  const html = `<article class="proj">\n        <p class="tag">${esc(p.tag)}</p>\n        <h3>${title}</h3>\n        <p>${esc(p.summary)}</p>\n        ${dl}${shows}${lk}</article>`;
  return html.split('\n        </article>').join('\n      </article>');
}

// projects: published projects only, with links, as the database holds them
function publishedProjects(projects, group) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return projects.filter((p) => !group || p.group === group)
    .map((p, i) => [p, i]).sort(([a, i], [b, j]) => cmp(a.order, b.order) || cmp(a.title, b.title) || i - j).map(([p]) => p);
}

export function renderWork(projects) {
  const P = '../';
  const projs = publishedProjects(projects, 'projects'), tmpl = publishedProjects(projects, 'templates');
  if (!projs.length && !tmpl.length) {
    return '<section class="band horizon">\n  <div class="wrap">\n    <div class="empty">\n      <h2>No projects are listed yet</h2>\n' +
      '      <p>Projects will appear here when there is something real to show, labelled for what it is.</p>\n    </div>\n  </div>\n</section>';
  }
  const out = [];
  let first = true;
  if (projs.length) {
    const plates = projs.map((p) => renderPlate(p, P)).join('\n      ');
    out.push('<section class="band horizon">\n  <div class="wrap">\n    <div data-reveal><h2>Personal and team projects</h2>\n' +
      '    <p class="prose">Each project has its own page that says what was built, who built it and what happened. Open the details on any card to see what the project shows.</p></div>\n' +
      `    <div class="showcase" data-reveal>\n      ${plates}\n    </div>\n  </div>\n</section>`);
    first = false;
  }
  if (tmpl.length) {
    const plates = tmpl.map((p) => renderPlate(p, P)).join('\n      ');
    const cls = 'band band--cream2' + (first ? ' horizon' : '');
    out.push(`<section class="${cls}">\n  <div class="wrap" data-reveal>\n    <h2>Sample templates</h2>\n    <div class="showcase">\n      ${plates}\n    </div>\n  </div>\n</section>`);
  }
  return out.join('\n\n');
}

export function renderHomeProjects(projects) {
  const feat = publishedProjects(projects, 'projects').filter((p) => p.featured).slice(0, 3);
  if (!feat.length) return '<p class="prose">No projects are listed yet.</p>';
  return feat.map((p) => renderPlate(p, '', true)).join('\n      ');
}

// p: a published generated project with links, learned and images
export function renderProjectPage(p, frame) {
  const P = '/';
  const canonical = `${DOMAIN}/projects/${p.slug}/`;
  const title = p.title, summary = p.summary || '';
  const look = ['field', 'path', 'orbit'].includes(p.look) ? p.look : 'field';
  const body = [];
  for (const img of p.images) {
    const cap = img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : '';
    const dims = img.width && img.height ? ` width="${Math.trunc(img.width)}" height="${Math.trunc(img.height)}"` : '';
    body.push(`<figure class="shot"><img src="${P}${esc(img.src)}" alt="${esc(img.alt || '')}"${dims} loading="lazy">${cap}</figure>`);
  }
  const section = (h, text) => {
    const ps = paragraphs(text);
    if (ps.length) body.push(`<h2>${h}</h2>\n` + ps.map((x) => `<p>${esc(x)}</p>`).join('\n'));
  };
  section('What was built', p.built);
  section('Our part', p.role);
  section('What happened', p.whatHappened);
  if (p.learned.length) body.push('<h2>What we learned</h2>\n<ul>' + p.learned.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>');
  const meta = [];
  if (p.builtBy) meta.push(['Built by', p.builtBy]);
  if (p.builtWith) meta.push(['Built with', p.builtWith]);
  if (p.outcome) meta.push(['Outcome', p.outcome]);
  let side = meta.map(([k, v]) => `<h2>${esc(k)}</h2><p>${esc(v)}</p>`).join('');
  if (p.links.length) side += '<h2>Links</h2><ul>' + p.links.map((l) => `<li><a href="${esc(linkHref(l.href, P))}">${esc(l.label)}</a></li>`).join('') + '</ul>';
  side += `<h2>More</h2><ul><li><a href="${P}work/">All work</a></li><li><a href="${P}contact/?type=audit">Get a free website audit</a></li></ul>`;
  const og = esc(`${title} | Curiohatch`);
  return `<!doctype html>
<html lang="en">
${GENERATED_MARK}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${og}</title>
<meta name="description" content="${esc(summary)}">
<meta name="theme-color" content="#011022">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Curiohatch">
<meta property="og:title" content="${og}">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${DOMAIN}/assets/brand/social-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${P}assets/brand/favicon.ico" sizes="48x48">
<link rel="icon" href="${P}assets/brand/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="${P}assets/brand/apple-touch-icon.png">
<link rel="preload" href="${P}assets/fonts/space-grotesk-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${P}assets/fonts/ibm-plex-sans-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.className+=' js'</script>
<link rel="stylesheet" href="${P}css/site.css?v=${frame.cssV}">
</head>
<body>
${frame.header}
<main id="main">
<div class="sky sky--${look} band--navy">
  <div class="wrap page-head">
    <p class="crumbs"><a href="${P}work/">Work</a> &middot; ${esc(p.tag)}</p>
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(summary)}</p>
  </div>
</div>
<section class="band horizon">
  <div class="wrap topic-layout">
    <article class="article">
${body.join('\n')}
    </article>
    <aside class="side" aria-label="About this project">
${side}
    </aside>
  </div>
</section>
</main>
${frame.footer}
<script src="${P}js/site.js?v=${frame.jsV}" defer></script>
</body>
</html>
`;
}

const money = (n) => '$' + Number(n).toLocaleString('en-US');

function renderPlan(p, introOn, P) {
  const starting = p.priceType === 'starting';
  const tag = starting ? 'Starting price' : 'Package price';
  const fromHtml = starting ? '<span class="plan-from">Starting at</span> ' : '';
  let intro = '';
  if (introOn && p.introPrice) {
    const lead = starting ? 'Starting at ' : '';
    intro = `<p class="plan-intro"><strong>${lead}${money(p.introPrice)}</strong> first-three-client price</p>\n    `;
  }
  const scope = p.scope.length ? '<ul class="stars">' + p.scope.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>\n    ' : '';
  const note = p.note ? `<p class="plan-note">${esc(p.note)}</p>\n    ` : '';
  const cta = p.cta;
  return `<li class="plan" id="plan-${esc(p.id)}">\n  <article>\n    <p class="tag">${tag}</p>\n    <h3>${esc(p.name)}</h3>\n` +
    `    <p class="plan-price">${fromHtml}<span class="plan-amount">${money(p.price)}</span></p>\n    ${intro}` +
    `<p class="plan-summary">${esc(p.summary)}</p>\n    ${scope}${note}` +
    `<a class="btn btn--line plan-cta" href="${P}${esc(cta.href)}">${esc(cta.label)}<span class="sr-only"> for ${esc(p.name)}</span></a>\n  </article>\n</li>`;
}

export function renderPricing(pr, P) {
  const introOn = !!pr.introOffer.active;
  const plans = pr.packages.map((p) => renderPlan(p, introOn, P)).join('\n');
  const offer = introOn ? `<p class="prose">${esc(pr.introOffer.note)}</p>\n    ` : '';
  let terms = '';
  if (pr.terms.approved) {
    const items = pr.terms.items.map((t) => `<li>${esc(t)}</li>`).join('');
    terms = `\n    <h3 id="terms" style="margin-top:2.5rem">Scope and terms</h3>\n    <ul class="stars prose">${items}</ul>`;
  }
  return `<h2>Prices</h2>
    <p class="prose">Start with the free audit. Then choose the package that fits, or ask for fixes. These are starting scopes, not unlimited-work agreements. Final scope, timeline, revisions, exclusions and payment terms are agreed in writing before any work begins.</p>
    ${offer}<ul class="plans">
${plans}
    </ul>
    <p class="prose" style="margin-top:2rem">${esc(pr.notIncludedByDefault)}</p>
    <p class="muted prose">${esc(pr.currencyNote)}</p>${terms}
    <div class="btn-row"><a class="btn btn--gold" href="${P}contact/?type=audit">Get a free website audit</a></div>`;
}

export function renderPricingTeaser(pr, P) {
  const items = pr.packages.map((p) => `<li><strong>${esc(p.name)}</strong>, ${p.priceType === 'starting' ? 'from ' : ''}${money(p.price)}</li>`).join('');
  return `<h2>Prices</h2>
    <p class="prose">The audit is free. After that, fixes and websites have published prices, and the scope is agreed in writing before work begins.</p>
    <ul class="stars prose">${items}</ul>
    <p style="margin-top:1rem"><a href="${P}services/#pricing">See what each package includes</a></p>`;
}

// Replaces what sits between <!-- TAG:START --> and <!-- TAG:END --> in a static page (the twin of replace_between).
export function fillRegion(shell, tag, body) {
  const pat = new RegExp(`<!-- ${tag}:START -->[\\s\\S]*?<!-- ${tag}:END -->`);
  if (!pat.test(shell)) throw new Error(`The page has no ${tag} markers.`);
  return shell.replace(pat, () => `<!-- ${tag}:START -->\n${body}\n<!-- ${tag}:END -->`);
}
