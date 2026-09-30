/* Screen-boot transition for the "Open the live demo" buttons.
   Pressing one plays a ~0.7s power-on animation (see .boot in ../css/case-study.css), then opens the demo.
   Falls back to a plain link when: JS is off, reduced motion is on, or the click is a new-tab click. */
(() => {
  const root = document.documentElement;
  const BOOT_MS = 720; // keep in step with the .boot animation timings in case-study.css
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-boot]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const newTab = e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (e.defaultPrevented || newTab || reduceMotion.matches) return;
      e.preventDefault();
      if (root.classList.contains('is-booting')) return;
      root.classList.add('is-booting');
      setTimeout(() => { location.href = link.href; }, BOOT_MS);
    });
  });

  // Coming back with the browser's back button must not show the finished animation.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) root.classList.remove('is-booting');
  });
})();
