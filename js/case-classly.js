/* Classly case study. Two small extras, both optional: the page reads the same without either.
   1. The five screens become tabs (buttons you can reach with the arrow keys). With JavaScript off they stay stacked.
   2. "Open the live demo" plays a ~0.7s power-on, then opens the demo. Under reduced motion it is a 0.25s fade instead.
      A plain link when JS is off or the click opens a new tab.
   Testing the full animation with reduced motion on: add ?motion=full to the page URL. */
(() => {
  /* ---- tabs ---- */
  const tabs = document.querySelector('[data-tabs]');
  if (tabs) {
    const panels = Array.from(tabs.querySelectorAll('.cl-panel'));
    const list = document.createElement('div');
    list.className = 'cl-tablist';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Classly screens');
    const buttons = panels.map((panel, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cl-tab';
      b.id = 'tab-' + panel.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', panel.id);
      b.textContent = panel.querySelector('h3').textContent;
      b.addEventListener('click', () => select(i, false));
      b.addEventListener('keydown', (e) => {
        const last = buttons.length - 1;
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: last }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        select(Math.max(0, Math.min(last, to)), true);
      });
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', b.id);
      panel.tabIndex = 0;
      list.appendChild(b);
      return b;
    });
    function select(n, focus) {
      panels.forEach((p, i) => { p.hidden = i !== n; });
      buttons.forEach((b, i) => { b.setAttribute('aria-selected', i === n ? 'true' : 'false'); b.tabIndex = i === n ? 0 : -1; });
      if (focus) buttons[n].focus();
    }
    tabs.insertBefore(list, tabs.firstChild);
    tabs.setAttribute('data-ready', '');
    select(0, false);
  }

  /* ---- screen-boot ---- */
  const root = document.documentElement;
  const BOOT_MS = 720;   // keep in step with the .boot-full timings in case-classly.css
  const FADE_MS = 260;   // keep in step with .boot-fade
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const forceFull = new URLSearchParams(location.search).get('motion') === 'full';
  document.querySelectorAll('[data-boot]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const newTab = e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (e.defaultPrevented || newTab) return;
      e.preventDefault();
      if (root.classList.contains('is-booting')) return;
      const fade = reduceMotion.matches && !forceFull;
      root.classList.add('is-booting', fade ? 'boot-fade' : 'boot-full');
      setTimeout(() => { location.href = link.href; }, fade ? FADE_MS : BOOT_MS);
    });
  });
  // Coming back with the browser's back button must not show the finished animation.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) root.classList.remove('is-booting', 'boot-full', 'boot-fade');
  });
})();
