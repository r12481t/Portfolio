/* Screen-boot transition for the "Open the live demo" buttons.
   Pressing one plays a ~0.7s power-on animation (see .boot in ../css/case-study.css), then opens the demo.
   If the visitor's system asks for reduced motion, it plays a 0.25s fade instead of nothing, so the click still
   gets feedback. Plain link when JS is off or the click opens a new tab.
   Testing: add ?motion=full to the page URL to play the full animation even if your system has reduced motion on
   (on Windows that is Settings > Accessibility > Visual effects > Animation effects switched off). */
(() => {
  const root = document.documentElement;
  const BOOT_MS = 720;  // keep in step with the .boot-full timings in case-study.css
  const FADE_MS = 260;  // keep in step with .boot-fade
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
