/* Curiohatch site script. Shared by the Curiohatch pages only.
   What it does: the menu drawer, scroll reveals, a little depth in the "sky" backgrounds, the click-to-load video
   box, and the inquiry form states.
   Everything here is optional. With JavaScript off, the header menu is a plain list, every block is visible,
   videos are plain links, and the form posts normally. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /* ---------- Drawer ----------
     The header's Menu button (phones and tablets) opens a side panel. Wide screens keep the plain header links.
     Keyboard: Tab stays inside the panel, Escape closes it, focus goes back to the Menu button.
     Links are normal links: nothing waits for an animation before the page changes. */
  function initDrawer() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.nav-toggle');
    var drawer = document.getElementById('drawer');
    if (!header || !toggle || !drawer) return;
    var panel = drawer.querySelector('.drawer-panel');
    var closeButton = drawer.querySelector('.drawer-close');
    var behind = [].slice.call(document.querySelectorAll('.skip-link, .site-header, main, .site-footer'));
    var wide = window.matchMedia('(min-width: 52em)');
    var lastFocus = null;

    header.classList.add('js-nav');
    toggle.hidden = false;
    toggle.setAttribute('aria-controls', 'drawer');

    function isOpen() { return drawer.classList.contains('is-open'); }
    function setBehind(hidden) {
      behind.forEach(function (el) {
        if (hidden) el.setAttribute('inert', ''); else el.removeAttribute('inert');
      });
    }
    function open() {
      if (isOpen()) return;
      lastFocus = document.activeElement;
      drawer.classList.add('is-open');
      root.classList.add('drawer-open');
      toggle.setAttribute('aria-expanded', 'true');
      setBehind(true);
      window.requestAnimationFrame(function () { closeButton.focus(); });
    }
    function close(restoreFocus) {
      if (!isOpen()) return;
      drawer.classList.remove('is-open');
      root.classList.remove('drawer-open');
      toggle.setAttribute('aria-expanded', 'false');
      setBehind(false);
      if (restoreFocus !== false) (lastFocus && document.contains(lastFocus) ? lastFocus : toggle).focus();
    }

    toggle.addEventListener('click', function () { if (isOpen()) close(); else open(); });
    drawer.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-drawer-close]')) { close(); return; }
      var link = t.closest && t.closest('a[href]');
      if (link) {
        // A link to the page we are already on, or to a spot on it: close the panel so the page can scroll.
        var same = link.pathname === window.location.pathname && link.host === window.location.host;
        if (same) close(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var items = [].slice.call(panel.querySelectorAll(FOCUSABLE)).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // Resizing to a wide screen, or coming back with the browser's Back button, must never leave the page locked.
    var onWide = function () { if (wide.matches) close(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    window.addEventListener('pageshow', function (e) { if (e.persisted) close(false); });
  }

  /* ---------- Scroll reveal ----------
     Blocks marked data-reveal that start below the first screen fade in once as they arrive.
     Blocks already on screen are never hidden. If anything fails, everything is shown. */
  function initReveal() {
    var all = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if (!all.length || reduceQuery.matches || !('IntersectionObserver' in window)) return;
    var pending = [];
    var io = null;
    function showAll() {
      pending.forEach(function (el) { el.classList.add('is-in'); });
      if (io) io.disconnect();
    }
    try {
      var vh = window.innerHeight || 800;
      all.forEach(function (el) {
        if (el.getBoundingClientRect().top <= vh * 0.9) return;
        var index = 0, prev = el.previousElementSibling;
        while (prev && index < 4) { if (prev.hasAttribute('data-reveal')) index++; prev = prev.previousElementSibling; }
        el.style.setProperty('--r', index);
        el.classList.add('will-reveal');
        pending.push(el);
      });
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
      pending.forEach(function (el) { io.observe(el); });
      // A quick jump (an in-page link, the End key) can pass blocks without any of them ever being on screen.
      // Anything now above the viewport is shown, so nothing is left invisible behind the reader.
      var sweepQueued = false;
      var sweep = function () {
        sweepQueued = false;
        pending.forEach(function (el) {
          if (!el.classList.contains('is-in') && el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); io.unobserve(el); }
        });
      };
      window.addEventListener('scroll', function () {
        if (!sweepQueued) { sweepQueued = true; window.requestAnimationFrame(sweep); }
      }, { passive: true });
      window.addEventListener('beforeprint', showAll);
      var onReduce = function () { if (reduceQuery.matches) showAll(); };
      if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onReduce);
    } catch (err) { showAll(); }
  }

  /* ---------- Depth in the sky backgrounds ----------
     A few pixels of drift with the pointer and the scroll, only for mouse users, only while the sky is on screen,
     and at most one update per frame. Touch devices and reduced-motion visitors get still backgrounds. */
  function initSky() {
    var skies = [].slice.call(document.querySelectorAll('.sky'));
    if (!skies.length || reduceQuery.matches || !('IntersectionObserver' in window)) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var visible = [];
    var mx = 0, my = 0, queued = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var i = visible.indexOf(entry.target);
        if (entry.isIntersecting && i < 0) visible.push(entry.target);
        if (!entry.isIntersecting && i >= 0) visible.splice(i, 1);
      });
      queue();
    }, { rootMargin: '80px' });
    skies.forEach(function (el) { io.observe(el); });

    function apply() {
      queued = false;
      var vh = window.innerHeight || 800;
      visible.forEach(function (el) {
        var top = el.getBoundingClientRect().top;
        var scroll = Math.max(-1, Math.min(1, -top / vh));
        el.style.setProperty('--px', mx.toFixed(3));
        el.style.setProperty('--py', my.toFixed(3));
        el.style.setProperty('--sy', (scroll * 0.8).toFixed(3));
      });
    }
    function queue() { if (!queued && visible.length) { queued = true; window.requestAnimationFrame(apply); } }
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX / (window.innerWidth || 1) - 0.5;
      my = e.clientY / (window.innerHeight || 1) - 0.5;
      queue();
    }, { passive: true });
    window.addEventListener('scroll', queue, { passive: true });
    var onReduce = function () {
      if (!reduceQuery.matches) return;
      skies.forEach(function (el) { el.style.removeProperty('--px'); el.style.removeProperty('--py'); el.style.removeProperty('--sy'); });
      visible = [];
    };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onReduce);
  }

  /* ---------- Video box ----------
     The page holds a plain YouTube link. Here it gains a Play button. Nothing is requested from YouTube until the
     visitor presses it. */
  function initVideo() {
    [].slice.call(document.querySelectorAll('.video[data-video-id]')).forEach(function (box) {
      var id = box.getAttribute('data-video-id');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--gold video-play';
      button.textContent = 'Play video';
      box.insertBefore(button, box.firstChild);
      button.addEventListener('click', function () {
        var frame = document.createElement('iframe');
        frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
        frame.title = box.getAttribute('data-title') || 'YouTube video';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        box.textContent = '';
        box.appendChild(frame);
        frame.focus();
      });
    });
  }

  /* ---------- Inquiry form ---------- */
  function initForm() {
    var form = document.getElementById('inquiry-form');
    if (!form) return;
    var typeField = form.elements.inquiry_type;
    var urlField = form.elements.website;
    var urlLabelHint = document.getElementById('website-hint');
    var status = document.getElementById('form-status');
    var button = form.querySelector('button[type="submit"]');

    var wanted = new URLSearchParams(window.location.search).get('type');
    if (wanted && typeField.querySelector('option[value="' + wanted + '"]')) typeField.value = wanted;

    function syncUrlRule() {
      var audit = typeField.value === 'audit';
      urlField.required = audit;
      urlField.setAttribute('aria-required', String(audit));
      if (urlLabelHint) urlLabelHint.textContent = audit ? 'Required for a free audit.' : 'Optional unless you want an audit.';
    }
    typeField.addEventListener('change', syncUrlRule);
    syncUrlRule();

    function fieldError(field, message) {
      var slot = document.getElementById(field.id + '-error');
      if (slot) slot.textContent = message;
      if (message) { field.setAttribute('aria-invalid', 'true'); } else { field.removeAttribute('aria-invalid'); }
    }
    function say(message, kind) {
      status.textContent = message;
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
    }
    function normalizeUrl(value) {
      var v = value.trim();
      if (v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
      return v;
    }
    function validUrl(v) {
      try { var u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.indexOf('.') > 0; } catch (e) { return false; }
    }

    form.setAttribute('novalidate', '');
    form.addEventListener('submit', function (e) {
      var problems = [];
      var name = form.elements.name, email = form.elements.email;
      fieldError(name, ''); fieldError(email, ''); fieldError(urlField, '');
      if (!name.value.trim()) { fieldError(name, 'Enter your name.'); problems.push(name); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { fieldError(email, 'Enter an email address we can reply to.'); problems.push(email); }
      var site = normalizeUrl(urlField.value);
      if (urlField.required && !site) { fieldError(urlField, 'Enter your website address so we can run the audit.'); problems.push(urlField); }
      else if (site && !validUrl(site)) { fieldError(urlField, 'That does not look like a website address. Example: example.com'); problems.push(urlField); }
      if (problems.length) { e.preventDefault(); say('Please fix the highlighted fields.', 'error'); problems[0].focus(); return; }
      urlField.value = site;

      if ((form.getAttribute('action') || '').indexOf('{{') !== -1) {
        e.preventDefault();
        say('This form is not connected yet, so nothing was sent.', 'error');
        return;
      }
      if (form.elements._gotcha && form.elements._gotcha.value) { e.preventDefault(); say('Thank you. Your message was sent.', 'ok'); return; }

      e.preventDefault();
      button.disabled = true; form.setAttribute('aria-busy', 'true'); say('Sending...', '');
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('bad response');
          form.reset(); syncUrlRule();
          say('Thank you. Your message was sent. We will reply by email.', 'ok');
        })
        .catch(function () {
          say('Something went wrong and your message may not have been sent. Please try again in a few minutes.', 'error');
        })
        .then(function () { button.disabled = false; form.removeAttribute('aria-busy'); });
    });
  }

  // The drawer, video box and form are needed straight away. Reveals and depth are polish, so they wait until the
  // page has loaded and the browser is idle. Blocks below the first screen are not visible yet anyway.
  function whenIdle(fn) {
    var run = function () { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1000 }); else window.setTimeout(fn, 50); };
    if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
  }
  initDrawer();
  initVideo();
  initForm();
  whenIdle(function () { initReveal(); initSky(); });
})();
