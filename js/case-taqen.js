/* TAQEN case study: shows which design you are on while you swipe the lookbook (1 of 3, plus dots).
   Pure extra. The designs are plain links in a scrolling row, so with JavaScript off the page works the same. */
(() => {
  const track = document.querySelector('.lookbook');
  const count = document.querySelector('[data-look-count]');
  if (!track || !count || !('IntersectionObserver' in window)) return;
  const items = Array.from(track.children);
  const now = count.querySelector('[data-look-now]');
  const dots = Array.from(count.querySelectorAll('i'));
  const show = (n) => {
    if (now) now.textContent = String(n + 1);
    dots.forEach((d, i) => d.classList.toggle('is-on', i === n));
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) show(items.indexOf(e.target)); });
  }, { root: track, threshold: [0.6, 0.9] });
  items.forEach((li) => io.observe(li));
  show(0);
})();
