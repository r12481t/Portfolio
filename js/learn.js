/* Learning Library filters. Used by learn/index.html only.
   The list of topics is already in the page (written by tools/site.py from content/learn/topics.json), so search engines
   and visitors without JavaScript see every published topic. This script only adds search, category and tag filters
   by hiding and showing the existing list items. */
(function () {
  'use strict';
  var list = document.getElementById('topic-list');
  var tools = document.getElementById('library-tools');
  if (!list || !tools) return;
  var items = [].slice.call(list.children);
  if (!items.length) return;

  var q = document.getElementById('lib-q');
  var cat = document.getElementById('lib-cat');
  var tagBox = document.getElementById('lib-tags');
  var count = document.getElementById('lib-count');
  var none = document.getElementById('lib-none');
  var reset = document.getElementById('lib-reset');
  var pressed = {};

  var cats = {}, tags = {};
  items.forEach(function (li) {
    if (li.dataset.category) cats[li.dataset.category] = true;
    (li.dataset.tags || '').split('|').forEach(function (t) { if (t) tags[t] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; cat.appendChild(o);
  });
  Object.keys(tags).sort().forEach(function (t) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = t; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      pressed[t] = !pressed[t];
      b.setAttribute('aria-pressed', String(!!pressed[t]));
      apply();
    });
    li.appendChild(b); tagBox.appendChild(li);
  });
  if (!Object.keys(cats).length) cat.parentNode.hidden = true;
  if (!Object.keys(tags).length) tagBox.parentNode.hidden = true;

  var params = new URLSearchParams(window.location.search);
  if (params.get('q')) q.value = params.get('q');
  if (params.get('category') && cats[params.get('category')]) cat.value = params.get('category');

  function apply() {
    var text = q.value.trim().toLowerCase();
    var chosen = Object.keys(pressed).filter(function (t) { return pressed[t]; });
    var shown = 0;
    items.forEach(function (li) {
      var okText = !text || (li.dataset.text || '').indexOf(text) !== -1;
      var okCat = !cat.value || li.dataset.category === cat.value;
      var own = (li.dataset.tags || '').split('|');
      var okTags = chosen.every(function (t) { return own.indexOf(t) !== -1; });
      var ok = okText && okCat && okTags;
      li.hidden = !ok;
      if (ok) shown++;
    });
    var filtered = !!(text || cat.value || chosen.length);
    count.textContent = filtered ? shown + (shown === 1 ? ' topic matches' : ' topics match') : items.length + (items.length === 1 ? ' topic' : ' topics');
    none.hidden = shown !== 0;
    try {
      var next = new URLSearchParams();
      if (text) next.set('q', q.value.trim());
      if (cat.value) next.set('category', cat.value);
      var qs = next.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    } catch (e) { /* the filters still work without the address update */ }
  }
  q.addEventListener('input', apply);
  cat.addEventListener('change', apply);
  reset.addEventListener('click', function () {
    q.value = ''; cat.value = '';
    pressed = {};
    [].slice.call(tagBox.querySelectorAll('button')).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    apply(); q.focus();
  });
  tools.hidden = false;
  apply();
})();
