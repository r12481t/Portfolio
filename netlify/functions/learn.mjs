// The live pages. Everything that comes from stored records is read from the database when a visitor asks for the page and is
// cached at Netlify's edge, so changing a lesson, a course, a price or a case study is a database change and needs no deploy.
// See docs/database.md ("No deploy for anything that is stored").
//
//   whole pages built from a record:        /learn/<slug>/      ?view=lesson&slug=...     (published lessons only)
//                                           /projects/<slug>/   ?view=project&slug=...    (published case studies made in the admin panel)
//   a hand-made page with a live region:    /                   ?view=home      prices summary, featured projects
//                                           /services/          ?view=services  prices and terms
//                                           /work/              ?view=work      project lists
//                                           /courses/           ?view=courses   course list
//                                           /learn/             ?view=index     lesson list
//   /sitemap.xml                                                ?view=sitemap
//
// For the hand-made pages the page itself is still a file in the repository; this function reads it and swaps in the live
// region. If the database cannot be reached, the visitor gets the page exactly as last deployed, never an error.
//
// netlify.toml sends those addresses here. Settings (Netlify, Site configuration, Environment variables):
//   TURSO_DATABASE_URL   libsql://your-database-your-org.turso.io
//   TURSO_READ_TOKEN     a READ-ONLY token (turso db tokens create <db> --read-only). Never the admin token.

import { makeDb, DbUnavailable } from './lib/db.mjs';
import { getLesson, getLibrary, getSitemapSlugs, getCourses, getProjects, getProject, getPricing } from './lib/content.mjs';
import {
  renderLesson, renderLibrary, fillLibrary, renderSitemap, frameFrom, SLUG_RE, fillRegion,
  renderCourses, renderWork, renderHomeProjects, renderPricing, renderPricingTeaser, renderProjectPage,
} from './lib/render.mjs';

// Pages are shared for 5 minutes, and may be served stale for a day while a fresh one is fetched, so a visitor rarely waits on
// the database. A new lesson was never cached, so it appears at once; an edited one within about 5 minutes.
const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=86400, durable';
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

function reply(body, status, type, cache) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': cache, ...SECURITY },
  });
}
const html = (body, status = 200, cache = CACHE_OK) => reply(body, status, 'text/html; charset=utf-8', cache);

// The static pages the site already serves are the source for the page frame, so this function never holds its own copy.
const memo = new Map();
async function staticPage(origin, path) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < 60_000) return hit.text;
  const res = await fetch(origin + path);
  if (!res.ok) throw new Error(`Could not read ${path} from the site (HTTP ${res.status}).`);
  const text = await res.text();
  memo.set(path, { at: Date.now(), text });
  return text;
}

async function notFound(origin) {
  try {
    return html(await staticPage(origin, '/404.html'), 404, 'no-store');
  } catch {
    return html('<!doctype html><title>Not found</title><h1>Not found</h1>', 404, 'no-store');
  }
}

const database = () => makeDb({ url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_READ_TOKEN });

// A hand-made page with live regions. `build(shell)` returns the page with its regions filled from the database. If anything about
// that fails, the page as it was last deployed is sent instead (for a short time), so a database problem never shows as an error.
async function shellView(origin, path, build) {
  const shell = await staticPage(origin, path);
  try {
    return html(await build(shell));
  } catch (e) {
    console.error(`learn function (${path}), serving the deployed page instead:`, e instanceof DbUnavailable ? `database: ${e.message}` : (e && e.stack) || e);
    return html(shell, 200, 'public, s-maxage=60');
  }
}

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...SECURITY } });
  }
  const url = new URL(request.url);
  const origin = process.env.SITE_ORIGIN || url.origin;
  const view = url.searchParams.get('view');
  try {
    const slugOf = () => (url.searchParams.get('slug') || '').replace(/\/+$/, '');
    const badSlug = (slug) => slug.length > 80 || !SLUG_RE.test(slug);
    if (view === 'lesson') {
      const slug = slugOf();
      if (badSlug(slug)) return await notFound(origin);
      const found = await getLesson(database(), slug);
      if (!found) return await notFound(origin);
      const frame = frameFrom(await staticPage(origin, '/404.html'));
      return html(renderLesson(found.lesson, found.article, frame));
    }
    if (view === 'project') {
      const slug = slugOf();
      if (badSlug(slug)) return await notFound(origin);
      const project = await getProject(database(), slug);
      if (!project) return await notFound(origin);
      const frame = frameFrom(await staticPage(origin, '/404.html'));
      return html(renderProjectPage(project, frame));
    }
    if (view === 'index') {
      return await shellView(origin, '/learn/index.html', async (shell) => fillLibrary(shell, renderLibrary(await getLibrary(database()))));
    }
    if (view === 'courses') {
      return await shellView(origin, '/courses/index.html', async (shell) => fillRegion(shell, 'COURSES', renderCourses(await getCourses(database()))));
    }
    if (view === 'work') {
      return await shellView(origin, '/work/index.html', async (shell) => fillRegion(shell, 'PROJECTS', renderWork(await getProjects(database()))));
    }
    if (view === 'services') {
      return await shellView(origin, '/services/index.html', async (shell) => {
        const pricing = await getPricing(database());
        if (!pricing) throw new Error('The database has no prices yet.');
        return fillRegion(shell, 'PRICING', renderPricing(pricing, '../'));
      });
    }
    if (view === 'home') {
      return await shellView(origin, '/index.html', async (shell) => {
        const db = database();
        const [projects, pricing] = await Promise.all([getProjects(db), getPricing(db)]);
        if (!pricing) throw new Error('The database has no prices yet.');
        return fillRegion(fillRegion(shell, 'PRICING-TEASER', renderPricingTeaser(pricing, '')), 'PROJECTS-HOME', renderHomeProjects(projects));
      });
    }
    if (view === 'sitemap') {
      const s = await getSitemapSlugs(database());
      return reply(renderSitemap(s.lessons, s.projects), 200, 'application/xml; charset=utf-8', CACHE_OK);
    }
    return await notFound(origin);
  } catch (e) {
    // Never cache a failure, and never show the visitor why. The cause goes to the function log.
    console.error('learn function:', e instanceof DbUnavailable ? `database: ${e.message}` : (e && e.stack) || e);
    return html('<!doctype html><meta charset="utf-8"><title>Please try again</title><h1>This page is not available right now</h1><p>Please try again in a minute.</p>', 503, 'no-store');
  }
};
