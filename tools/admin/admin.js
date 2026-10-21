/* Curiohatch admin panel (browser side). Talks only to the local server that served this page.
   All text is inserted with textContent, never as HTML, except the lesson preview, which is a sandboxed frame. */
(function () {
  'use strict';

  var token = new URLSearchParams(location.search).get('t') || sessionStorage.getItem('adminToken') || '';
  if (token) { sessionStorage.setItem('adminToken', token); history.replaceState(null, '', location.pathname); }
  var S = null, view = 'overview', editing = null, busy = false;
  var tabsEl = document.getElementById('tabs'), main = document.getElementById('view'), toastEl = document.getElementById('toast');
  var TABS = [['overview', 'Overview'], ['lessons', 'Lessons'], ['courses', 'Courses'], ['packages', 'Packages and prices'], ['work', 'Case studies']];

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'class') el.className = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }

  function api(path, body) {
    var opts = { headers: { 'X-Admin-Token': token } };
    if (body !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'The server sent something unexpected.' }; }).then(function (j) {
        if (!r.ok && !j.error) j.error = 'Request failed (' + r.status + ').';
        return j;
      });
    });
  }

  var toastTimer;
  function toast(msg, kind) {
    toastEl.textContent = '';
    toastEl.appendChild(h('p', { class: kind || '', text: msg }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.textContent = ''; }, kind === 'err' ? 9000 : 4500);
  }

  function load() {
    return api('/api/state').then(function (s) {
      if (s.error) { main.textContent = ''; main.appendChild(h('div', { class: 'problems', text: s.error })); return; }
      S = s; render();
    });
  }

  function go(v, rec) { view = v; editing = rec === undefined ? null : rec; render(); main.focus(); window.scrollTo(0, 0); }

  function render() {
    tabsEl.textContent = '';
    TABS.forEach(function (t) {
      tabsEl.appendChild(h('button', { type: 'button', 'aria-current': view === t[0] ? 'page' : false, text: t[1], onclick: function () { go(t[0]); } }));
    });
    main.textContent = '';
    ({ overview: vOverview, lessons: vLessons, courses: vCourses, packages: vPackages, work: vWork })[view]();
  }

  /* ---------- form helpers ---------- */
  function fld(spec, value) {
    var id = 'f-' + spec.k + '-' + Math.random().toString(36).slice(2, 7), input, get;
    var type = spec.type || 'text';
    if (type === 'textarea' || type === 'lines' || type === 'code') {
      input = h('textarea', { id: id, class: type === 'code' ? 'code' : '', rows: spec.rows || 4 });
      input.value = type === 'lines' ? (value || []).join('\n') : (value || '');
      get = function () { return type === 'lines' ? input.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : input.value; };
    } else if (type === 'select') {
      var opts = spec.options.map(function (o) { return Array.isArray(o) ? o : [o, o]; });
      input = h('select', { id: id }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      input.value = value || opts[0][0];
      get = function () { return input.value; };
    } else if (type === 'bool') {
      input = h('input', { type: 'checkbox', id: id }); input.checked = !!value;
      get = function () { return input.checked; };
      return { el: h('div', { class: 'card' }, h('label', { class: 'check', for: id }, input, spec.label), spec.help && h('p', { class: 'help', text: spec.help })), get: get, input: input };
    } else if (type === 'checks') {
      var boxes = spec.options.map(function (o) {
        var cb = h('input', { type: 'checkbox', value: o[0] }); cb.checked = (value || []).indexOf(o[0]) !== -1;
        return h('label', { class: 'check' }, cb, o[1]);
      });
      input = h('div', { class: 'checks', id: id, role: 'group', 'aria-label': spec.label }, boxes.length ? boxes : h('p', { class: 'help', text: 'None yet.' }));
      get = function () { return [].slice.call(input.querySelectorAll('input:checked')).map(function (c) { return c.value; }); };
    } else if (type === 'links') {
      input = h('textarea', { id: id, rows: 3, placeholder: 'Label | address' });
      input.value = (value || []).map(function (l) { return l.label + ' | ' + l.href; }).join('\n');
      get = function () {
        return input.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).map(function (line) {
          var i = line.indexOf('|'); return i < 0 ? { label: line, href: '' } : { label: line.slice(0, i).trim(), href: line.slice(i + 1).trim() };
        });
      };
    } else {
      input = h('input', { id: id, type: type === 'int' ? 'number' : type, list: spec.list || false });
      input.value = value === null || value === undefined ? '' : value;
      get = function () { return type === 'int' ? (input.value === '' ? '' : Number(input.value)) : input.value; };
      if (spec.fromUrl) input.addEventListener('blur', function () {
        var m = input.value.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/); if (m) input.value = m[1];
      });
    }
    if (spec.readonly) { input.setAttribute('readonly', ''); input.setAttribute('aria-readonly', 'true'); if (input.tagName === 'SELECT') input.setAttribute('disabled', ''); }
    var wrap = h('div', {}, h('label', { for: id, text: spec.label + (spec.required ? ' (required)' : '') }), spec.help && h('p', { class: 'help', text: spec.help }), input);
    return { el: wrap, get: get, input: input };
  }

  function form(specs, rec) {
    var fields = {}, root = h('div');
    specs.forEach(function (s) { var f = fld(s, rec[s.k]); fields[s.k] = f; root.appendChild(f.el); });
    return { el: root, fields: fields, read: function () { var o = {}; Object.keys(fields).forEach(function (k) { o[k] = fields[k].get(); }); return o; } };
  }

  function busyButton(label, fn, cls) {
    var b = h('button', { type: 'button', class: cls || '', text: label });
    b.addEventListener('click', function () {
      if (busy) return; busy = true; b.disabled = true;
      Promise.resolve(fn()).catch(function (e) { toast(String(e.message || e), 'err'); }).then(function () { busy = false; b.disabled = false; });
    });
    return b;
  }

  function showIssues(res, into) {
    into.textContent = '';
    (res.warnings || []).length && into.appendChild(h('div', { class: 'warnings' }, h('strong', { text: 'Check these (not blocking):' }), h('ul', {}, res.warnings.map(function (w) { return h('li', { text: w }); }))));
  }

  function afterSave(res, okMsg, nextView) {
    if (!res.ok) {
      if (res.similar) return false;
      toast(res.error || 'Not saved.', 'err'); return false;
    }
    toast(okMsg, 'ok');
    return load().then(function () { if (nextView) { go(nextView); } return true; });
  }

  function badge(status) { return h('span', { class: 'badge ' + status, text: status }); }
  function lessonsById() { return (S.topics || []).map(function (t) { return [t.id, t.id + ': ' + t.title + ' (' + t.status + ')']; }); }

  /* ---------- overview ---------- */
  function vOverview() {
    main.appendChild(h('h1', { text: 'Overview' }));
    var p = S.problems || [], w = S.warnings || [];
    main.appendChild(p.length ? h('div', { class: 'problems' }, h('strong', { text: p.length + ' problem(s) to fix before launch:' }), h('ul', {}, p.map(function (x) { return h('li', { text: x }); })))
      : h('div', { class: 'okbox', text: 'No problems found by the site check.' }));
    if (w.length) main.appendChild(h('div', { class: 'warnings' }, h('strong', { text: w.length + ' warning(s):' }), h('ul', {}, w.map(function (x) { return h('li', { text: x }); }))));
    var out = h('pre', { hidden: true });
    function cmd(name, label) { return busyButton(label, function () { return api('/api/run', { action: name }).then(function (r) { out.hidden = false; out.textContent = r.output || r.error || ''; toast(r.ok ? label + ': done.' : label + ': see details below.', r.ok ? 'ok' : 'err'); return load().then(function () { out.hidden = false; }); }); }); }
    main.appendChild(h('div', { class: 'tools' }, cmd('check', 'Run site check'), cmd('seo', 'Run SEO check'), cmd('sync', 'Rebuild pages'),
      S.undo ? busyButton('Undo last change: ' + S.undo, function () { if (!confirm('Undo "' + S.undo + '"?')) return; return api('/api/undo', {}).then(function (r) { toast(r.ok ? 'Undone: ' + r.undone : r.error, r.ok ? 'ok' : 'err'); return load(); }); }, 'danger') : null));
    main.appendChild(out);
    main.appendChild(h('h2', { text: 'What is in the site' }));
    var pub = function (a) { return a.filter(function (x) { return x.status === 'published' || x.status === 'available'; }).length; };
    main.appendChild(h('ul', {},
      h('li', { text: 'Lessons: ' + S.topics.length + ' (' + pub(S.topics) + ' published)' }), h('li', { text: 'Courses: ' + S.courses.length + ' (' + pub(S.courses) + ' available)' }),
      h('li', { text: 'Packages: ' + S.pricing.packages.length + '. First-three-client prices are ' + (S.pricing.introOffer.active ? 'SHOWN' : 'hidden') + '. Terms are ' + (S.pricing.terms.approved ? 'PUBLISHED' : 'not published') + '.' }),
      h('li', { text: 'Case studies and projects: ' + S.projects.length + ' (' + pub(S.projects) + ' published)' })));
    main.appendChild(h('p', {}, h('a', { href: '/preview/', target: '_blank', rel: 'noopener', text: 'Open a preview of the site' }), ' (opens in a new tab; it reads the files as they are now).'));
    main.appendChild(h('h2', { text: 'Not published yet' }));
    main.appendChild(h('p', { text: 'This panel only changes files on this computer. To publish, commit the changed files and deploy as you normally do (see docs/release-workflow.md). Always check a preview first.' }));
    if (S.git) main.appendChild(S.git.length ? h('details', { class: 'card' }, h('summary', { text: S.git.length + ' changed file(s) since your last commit' }), h('pre', { text: S.git.join('\n') })) : h('p', { text: 'No changes since your last commit.' }));
  }

  /* ---------- lessons ---------- */
  function vLessons() {
    if (editing) return lessonEditor(editing === 'new' ? null : editing);
    main.appendChild(h('h1', { text: 'Lessons' }));
    main.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', text: 'Add a lesson', onclick: function () { go('lessons', 'new'); } }),
      h('span', { class: 'help', text: 'One lesson per YouTube video. Lessons are listed on /learn/ only when published.' })));
    if (!S.topics.length) main.appendChild(h('p', { text: 'No lessons yet.' }));
    S.topics.forEach(function (t) {
      main.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('strong', { text: t.title }), ' ', badge(t.status), h('div', { class: 'help', text: t.id + (t.category ? ' / ' + t.category : '') + (t.concepts.length ? ' / teaches: ' + t.concepts.join(', ') : '') })),
        h('button', { type: 'button', text: 'Edit', 'aria-label': 'Edit ' + t.title, onclick: function () { go('lessons', t); } }))));
    });
  }

  var ARTICLE_SNIPPETS = [['Heading', '<h2>Heading</h2>\n'], ['Subheading', '<h3>Subheading</h3>\n'], ['Paragraph', '<p>Text.</p>\n'], ['List', '<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>\n'],
    ['Code', '<pre><code>// code you have run\n</code></pre>\n'], ['Takeaways', '<div class="takeaways"><h2>Key takeaways</h2>\n<ul>\n  <li>Point</li>\n</ul></div>\n']];

  function lessonEditor(t) {
    var isNew = !t, rec = t || { status: 'drafted', subtopics: [], tags: [], concepts: [], prerequisites: [], related: [], courses: [] };
    var cats = Array.from(new Set(S.topics.map(function (x) { return x.category; }).filter(Boolean)));
    main.appendChild(h('h1', { text: isNew ? 'Add a lesson' : 'Edit: ' + rec.title }));
    var others = lessonsById().filter(function (o) { return o[0] !== rec.id; });
    var courseOpts = S.courses.map(function (c) { return [c.id, c.id + ': ' + c.title]; });
    var dl = h('datalist', { id: 'cats' }, cats.map(function (c) { return h('option', { value: c }); }));
    var f = form([
      { k: 'title', label: 'Title', required: true }, { k: 'slug', label: 'Address (slug)', help: 'Lowercase words joined by hyphens. It becomes /learn/<slug>/ and cannot change later.', readonly: !isNew, required: true },
      { k: 'status', label: 'Status', type: 'select', options: S.enums.topicStatuses, help: 'Only "published" appears on the site. Drafted, reviewed and archived pages exist but are hidden.' },
      { k: 'summary', label: 'Summary', type: 'textarea', rows: 3, help: 'One or two sentences, about 160 characters. Used on the card, the page intro and in search results.' },
      { k: 'category', label: 'Category', list: 'cats', help: 'Reuse the exact spelling of an existing category.' },
      { k: 'videoId', label: 'YouTube video link or id', fromUrl: true, help: 'Paste the video link; the 11-character id is picked out for you. Needed to publish.' },
      { k: 'publishedAt', label: 'Published on', type: 'date', help: 'The real date the video went public.' }, { k: 'updatedAt', label: 'Updated on', type: 'date', help: 'Only if the lesson really changed later.' },
      { k: 'concepts', label: 'Concepts taught', type: 'lines', help: 'One per line. These stop you teaching the same thing twice.' },
      { k: 'subtopics', label: 'Subtopics', type: 'lines', help: 'One per line.' }, { k: 'tags', label: 'Tags', type: 'lines', help: 'One per line. They become filter buttons.' },
      { k: 'prerequisites', label: 'Read these lessons first', type: 'checks', options: others }, { k: 'related', label: 'Related lessons', type: 'checks', options: others },
      { k: 'courses', label: 'Part of these courses', type: 'checks', options: courseOpts }
    ], rec);
    var art = fld({ k: 'article', label: 'Article (HTML)', type: 'code', help: 'The lesson text. Must teach something the video does not. Scripts, iframes, forms and inline styles are refused.' }, '');
    var previewBox = h('div'), msg = h('div');
    if (!isNew && rec.status !== 'planned') api('/api/article?slug=' + encodeURIComponent(rec.slug)).then(function (r) { if (r.html !== undefined) art.input.value = r.html; });
    var tools = h('div', { class: 'tools', role: 'group', 'aria-label': 'Insert into the article' }, ARTICLE_SNIPPETS.map(function (s) {
      return h('button', { type: 'button', text: '+ ' + s[0], onclick: function () { var ta = art.input, a = ta.selectionStart; ta.value = ta.value.slice(0, a) + s[1] + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = a + s[1].length; } });
    }));
    tools.appendChild(h('button', { type: 'button', text: 'Preview', onclick: function () {
      previewBox.textContent = '';
      previewBox.appendChild(h('iframe', { class: 'preview', title: 'Article preview', sandbox: '', srcdoc: '<!doctype html><link rel="stylesheet" href="/preview/css/site.css"><main class="band"><div class="wrap"><div class="article">' + art.input.value + '</div></div></main>' }));
    } }));
    function save(allowSimilar) {
      var r = f.read(); r.id = rec.id; if (!isNew) r.slug = rec.slug;
      return api('/api/topic', { record: r, article: art.get(), create: isNew, allowSimilar: !!allowSimilar }).then(function (res) {
        if (res.similar) {
          msg.textContent = '';
          msg.appendChild(h('div', { class: 'warnings' }, h('strong', { text: res.error }), h('ul', {}, res.similar.map(function (s) { return h('li', { text: s.id + ' (' + s.status + ') ' + s.title + ' [' + s.why + ']' }); })),
            busyButton('Save anyway', function () { return save(true); })));
          return;
        }
        return afterSave(res, 'Saved. Pages rebuilt.', 'lessons');
      });
    }
    main.appendChild(dl); main.appendChild(f.el); main.appendChild(art.el); main.appendChild(tools); main.appendChild(previewBox); main.appendChild(msg);
    main.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, busyButton('Save lesson', function () { return save(false); }, 'primary'),
      h('button', { type: 'button', text: 'Cancel', onclick: function () { go('lessons'); } }),
      !isNew && rec.status !== 'archived' ? busyButton('Archive', function () { if (!confirm('Archive this lesson? It disappears from the library but its page stays reachable.')) return; return api('/api/topic/archive', { id: rec.id }).then(function (r) { return afterSave(r, 'Archived.', 'lessons'); }); }, 'danger') : null));
  }

  /* ---------- courses ---------- */
  function vCourses() {
    if (editing) return courseEditor(editing === 'new' ? null : editing);
    main.appendChild(h('h1', { text: 'Courses' }));
    main.appendChild(h('p', { class: 'help', text: 'Only add a course that really exists or is genuinely planned. Planned courses show as "Planned. Not available yet." with no date.' }));
    main.appendChild(h('button', { type: 'button', class: 'primary', text: 'Add a course', onclick: function () { go('courses', 'new'); } }));
    if (!S.courses.length) main.appendChild(h('p', { text: 'No courses yet. The Courses page shows an honest empty state.' }));
    S.courses.forEach(function (c) {
      main.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('strong', { text: c.title }), ' ', badge(c.status), h('div', { class: 'help', text: c.id })),
        h('button', { type: 'button', text: 'Edit', 'aria-label': 'Edit ' + c.title, onclick: function () { go('courses', c); } }))));
    });
  }
  function courseEditor(c) {
    var isNew = !c, rec = c || { status: 'planned' };
    main.appendChild(h('h1', { text: isNew ? 'Add a course' : 'Edit: ' + rec.title }));
    var f = form([{ k: 'title', label: 'Title', required: true }, { k: 'status', label: 'Status', type: 'select', options: S.enums.courseStatuses, help: '"available" needs a working address. Planned and upcoming show no date.' },
      { k: 'summary', label: 'Summary', type: 'textarea', rows: 3, required: true }, { k: 'category', label: 'Category' }, { k: 'audience', label: 'Who it is for' }, { k: 'level', label: 'Level' },
      { k: 'duration', label: 'Length', help: 'Only if verified.' }, { k: 'prerequisites', label: 'Before you start', help: 'Only if verified.' },
      { k: 'url', label: 'Address (when available)', help: 'A page in the site (for example learn/my-course/) or a full web address.' },
      { k: 'lessons', label: 'Lessons in this course', type: 'checks', options: lessonsById() }], rec);
    main.appendChild(f.el);
    main.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, busyButton('Save course', function () { var r = f.read(); r.id = rec.id; return api('/api/course', { record: r, create: isNew }).then(function (res) { return afterSave(res, 'Saved. Pages rebuilt.', 'courses'); }); }, 'primary'),
      h('button', { type: 'button', text: 'Cancel', onclick: function () { go('courses'); } }),
      !isNew && rec.status !== 'archived' ? busyButton('Archive', function () { if (!confirm('Archive this course?')) return; return api('/api/course/archive', { id: rec.id }).then(function (r) { return afterSave(r, 'Archived.', 'courses'); }); }, 'danger') : null));
  }

  /* ---------- packages and prices ---------- */
  function vPackages() {
    var pr = JSON.parse(JSON.stringify(S.pricing));
    main.appendChild(h('h1', { text: 'Packages and prices' }));
    main.appendChild(h('p', { class: 'help', text: 'Prices are written to the Services page and the home page from here. Whole numbers, US dollars unless you change the currency note.' }));
    var g = form([{ k: 'currencyNote', label: 'Currency note', help: 'Shown under the packages.' }, { k: 'notIncludedByDefault', label: 'Not included by default', type: 'textarea', rows: 3, help: 'Shown under the packages.' }], pr);
    var offerOn = fld({ k: 'introActive', type: 'bool', label: 'Show the first-three-client prices', help: 'Turn off when the third eligible paid project is agreed. Never show a counter or imply slots are taken.' }, pr.introOffer.active);
    var offerNote = fld({ k: 'introNote', label: 'First-three-client note', type: 'textarea', rows: 2 }, pr.introOffer.note);
    var termsOn = fld({ k: 'termsApproved', type: 'bool', label: 'Publish the terms', help: 'Only after you approve every line. Do not add cancellation, refund or legal wording without deciding what it should say.' }, pr.terms.approved);
    var termsItems = fld({ k: 'terms', label: 'Terms (one per line)', type: 'lines', rows: 7 }, pr.terms.items);
    main.appendChild(g.el); main.appendChild(offerOn.el); main.appendChild(offerNote.el); main.appendChild(termsOn.el); main.appendChild(termsItems.el);
    main.appendChild(h('h2', { text: 'Packages' }));
    var list = h('div'), pkgForms = [];
    function addPkg(p, open) {
      var f = form([{ k: 'id', label: 'Id', readonly: !p.__new, help: 'Lowercase words joined by hyphens.' }, { k: 'name', label: 'Name' },
        { k: 'priceType', label: 'Price type', type: 'select', options: [['package', 'Package price'], ['starting', 'Starting at']] },
        { k: 'price', label: 'Price (whole number)', type: 'int' }, { k: 'introPrice', label: 'First-three-client price (blank for none)', type: 'int' },
        { k: 'summary', label: 'One-line summary' }, { k: 'scope', label: 'What is included (one per line)', type: 'lines', rows: 5 }, { k: 'note', label: 'Note (optional)' },
        { k: 'ctaLabel', label: 'Button label' }, { k: 'ctaHref', label: 'Button goes to', help: 'For example contact/?type=website or contact/?type=fixes' }],
        Object.assign({}, p, { ctaLabel: (p.cta || {}).label, ctaHref: (p.cta || {}).href }));
      var det = h('details', { class: 'card', open: open }, h('summary', { text: (p.name || 'New package') + (p.price ? ' ($' + p.price + ')' : '') }), f.el,
        h('button', { type: 'button', class: 'danger', text: 'Remove this package', onclick: function () { if (!confirm('Remove this package from the site?')) return; pkgForms = pkgForms.filter(function (x) { return x !== item; }); det.remove(); } }));
      var item = { f: f }; pkgForms.push(item); list.appendChild(det);
    }
    pr.packages.forEach(function (p) { addPkg(p, false); });
    main.appendChild(list);
    main.appendChild(h('button', { type: 'button', text: 'Add a package', onclick: function () { addPkg({ __new: true, priceType: 'package', scope: [] }, true); } }));
    main.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, busyButton('Save prices', function () {
      var out = Object.assign({}, g.read());
      out.introOffer = { active: offerOn.get(), note: offerNote.get() };
      out.terms = { approved: termsOn.get(), items: termsItems.get() };
      out.packages = pkgForms.map(function (x) { var r = x.f.read(); return { id: r.id, name: r.name, priceType: r.priceType, price: r.price, introPrice: r.introPrice === '' ? null : r.introPrice, summary: r.summary, scope: r.scope, note: r.note, cta: { label: r.ctaLabel, href: r.ctaHref } }; });
      if (out.terms.approved && !confirm('Publish the terms? They will appear on the Services page once you deploy.')) return;
      return api('/api/pricing', { pricing: out }).then(function (res) { return afterSave(res, 'Saved. Services and home pages rebuilt.', 'packages'); });
    }, 'primary')));
  }

  /* ---------- case studies ---------- */
  function vWork() {
    if (editing) return projectEditor(editing === 'new' ? null : editing);
    main.appendChild(h('h1', { text: 'Case studies and projects' }));
    main.appendChild(h('p', { class: 'help', text: 'These appear on the Work page, and featured ones on the home page. Label each for what it is. Do not invent results, clients or numbers.' }));
    main.appendChild(h('button', { type: 'button', class: 'primary', text: 'Add a case study', onclick: function () { go('work', 'new'); } }));
    S.projects.forEach(function (p) {
      main.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('strong', { text: p.title }), ' ', badge(p.status), h('div', { class: 'help', text: p.tag + ' / ' + p.group + ' / ' + (p.page === 'generated' ? 'page made here' : 'existing page') + (p.featured ? ' / on home page' : '') })),
        h('button', { type: 'button', text: 'Edit', 'aria-label': 'Edit ' + p.title, onclick: function () { go('work', p); } }))));
    });
  }

  function projectEditor(p) {
    var isNew = !p, rec = p || { status: 'draft', group: 'projects', page: 'generated', featured: false, order: 100, links: [], learned: [], images: [] };
    var images = (rec.images || []).map(function (x) { return Object.assign({}, x); });
    main.appendChild(h('h1', { text: isNew ? 'Add a case study' : 'Edit: ' + rec.title }));
    var f = form([
      { k: 'title', label: 'Title', required: true }, { k: 'slug', label: 'Address (slug)', readonly: !isNew, required: true, help: 'Becomes /projects/<slug>/ for a page made here. Cannot change later.' },
      { k: 'status', label: 'Status', type: 'select', options: S.enums.projectStatuses, help: 'Only "published" appears on the Work page. A draft page is hidden from search engines and from the site lists.' },
      { k: 'group', label: 'Where it is listed', type: 'select', options: [['projects', 'Personal and team projects'], ['templates', 'Sample templates']] },
      { k: 'page', label: 'Page', type: 'select', readonly: !isNew, options: [['generated', 'Make a case study page here'], ['existing', 'Link to a page that already exists']] },
      { k: 'tag', label: 'Label', required: true, help: 'Say what it is, for example "Team project, paused", "Browser demo", "Concept project", "Client project (with permission)".' },
      { k: 'summary', label: 'Summary', type: 'textarea', rows: 3, required: true }, { k: 'builtBy', label: 'Built by', help: 'Describe roles accurately. Do not imply a bigger team.' },
      { k: 'builtWith', label: 'Built with' }, { k: 'outcome', label: 'Outcome', help: 'The honest result, including when there was none.' },
      { k: 'shows', label: 'What this shows', type: 'textarea', rows: 3, help: 'Shown in the openable details on the card.' },
      { k: 'links', label: 'Links', type: 'links', help: 'One per line: Label | address. An address is a page in the site (projects/x/page.html) or a web address.' },
      { k: 'featured', label: 'Show on the home page', type: 'bool', help: 'Up to three featured projects are shown.' }, { k: 'order', label: 'Order (1 first)', type: 'int' }
    ], rec);
    var gen = form([{ k: 'look', label: 'Look of the page', type: 'select', options: [['field', 'Starfield (stars scattered across the top)'], ['path', 'Path (a winding line, for journeys and process)'], ['orbit', 'Orbit (rings, for systems and tools)']], help: 'Changes the top of the page, so each case study can feel like its own. Same brand either way.' },
      { k: 'built', label: 'What was built', type: 'textarea', rows: 6, help: 'Plain paragraphs. A blank line starts a new paragraph.' },
      { k: 'role', label: 'Our part', type: 'textarea', rows: 4, help: 'Who did what, without claiming more than was done.' },
      { k: 'whatHappened', label: 'What happened', type: 'textarea', rows: 4 }, { k: 'learned', label: 'What we learned (one per line)', type: 'lines', rows: 4 }], rec);
    var genBox = h('div', {}, h('h2', { text: 'Case study page' }), gen.el);
    var imgBox = h('div'), imgList = h('div');
    function drawImages() {
      imgList.textContent = '';
      images.forEach(function (im, i) {
        var alt = h('input', { type: 'text', value: im.alt || '', 'aria-label': 'Alt text for ' + im.src, oninput: function () { im.alt = alt.value; } });
        var cap = h('input', { type: 'text', value: im.caption || '', 'aria-label': 'Caption for ' + im.src, oninput: function () { im.caption = cap.value; } });
        imgList.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' }, h('img', { class: 'thumb', src: '/preview/' + im.src, alt: '' }), h('code', { text: im.src })),
          h('label', { text: 'Alt text (describe the image; required)' }), alt, h('label', { text: 'Caption (optional)' }), cap,
          h('button', { type: 'button', class: 'danger', text: 'Remove from this page', onclick: function () { images.splice(i, 1); drawImages(); } })));
      });
    }
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'imgfile' });
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      var slug = f.fields.slug.get().trim();
      var rd = new FileReader();
      rd.onload = function () {
        api('/api/image', { slug: slug, filename: fl.name, data: String(rd.result).split(',')[1] }).then(function (r) {
          if (!r.ok) { toast(r.error, 'err'); return; }
          images.push({ src: r.src, width: r.width, height: r.height, alt: '', caption: '' }); drawImages();
          toast('Image added. Write its alt text.' + (r.warnings && r.warnings.length ? ' ' + r.warnings[0] : ''), r.warnings && r.warnings.length ? '' : 'ok');
          file.value = '';
        });
      };
      rd.readAsDataURL(fl);
    });
    imgBox.appendChild(h('h3', { text: 'Screenshots' })); imgBox.appendChild(h('p', { class: 'help', text: 'Only real screenshots of real work. PNG, JPG or WebP, under 3 MB (WebP around 1200 pixels wide is best). Enter the address above first.' }));
    imgBox.appendChild(h('label', { for: 'imgfile', text: 'Add an image' })); imgBox.appendChild(file); imgBox.appendChild(imgList); genBox.appendChild(imgBox); drawImages();
    function sync() { genBox.hidden = f.fields.page.get() !== 'generated'; }
    f.fields.page.input.addEventListener('change', sync); sync();
    main.appendChild(f.el); main.appendChild(genBox);
    main.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, busyButton('Save case study', function () {
      var r = Object.assign(f.read(), gen.read()); r.id = rec.id; r.images = images; if (!isNew) { r.slug = rec.slug; r.page = rec.page; }
      return api('/api/project', { record: r, create: isNew }).then(function (res) { return afterSave(res, 'Saved. Pages rebuilt.', 'work'); });
    }, 'primary'), h('button', { type: 'button', text: 'Cancel', onclick: function () { go('work'); } }),
      !isNew && rec.status !== 'archived' ? busyButton('Archive', function () { if (!confirm('Archive this project? It leaves the Work page; a made page stays reachable.')) return; return api('/api/project/archive', { id: rec.id }).then(function (r) { return afterSave(r, 'Archived.', 'work'); }); }, 'danger') : null));
  }

  if (!token) { main.textContent = ''; main.appendChild(h('div', { class: 'problems', text: 'Open the full address printed in the terminal (it ends with ?t= and a code).' })); }
  else load();
})();
