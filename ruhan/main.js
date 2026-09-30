/* ============================================================
   3D loader with three tiers:
     full   the whole night-desk scene
     lite   no rain, string lights, steam or motes; lower resolution; ~30 fps
     static a pre-rendered poster behind the normal page content

   The tier is picked from what the device reports, then checked
   against real frame rates. The result is cached in localStorage
   so repeat visits skip the guessing. Three.js and scene.js are
   only downloaded when the tier is full or lite.

   Nothing sits on screen while 3D runs well. Only two things appear:
     - when 3D is struggling (measured lag): a small "Turn 3D off" button, for 12 seconds
     - when 3D is off: a "Try the 3D scene" link in the footer

   Test switches (add to the URL):
     ?tier=full | lite | static   force a tier, no monitoring, no caching
     ?capture                     full scene, downloads scene-poster.webp after 3s
     ?capture=mobile              same, saved as scene-poster-mobile.webp
   ============================================================ */

const KEY = 'ruhan3d.tier.v1';
const DAY = 864e5;
const TIERS = ['full', 'lite', 'static'];
const params = new URLSearchParams(location.search);

/* ---------- cache ---------- */
const cache = {
  read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (!v || !TIERS.includes(v.tier)) return null;
      // manual choices stay until the visitor undoes them; a lag-based static result is retried after 3 days
      const ttl = v.reason === 'manual' ? Infinity : v.tier === 'static' ? 3 * DAY : 14 * DAY;
      return Date.now() - v.at < ttl ? v : null;
    } catch (e) { return null; }
  },
  write(tier, reason) {
    try { localStorage.setItem(KEY, JSON.stringify({ tier, reason, at: Date.now() })); } catch (e) {}
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  },
};

/* ---------- capability checks ---------- */
function probeGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return { ok: false };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext(); // release the probe context straight away
    return { ok: true, software: /swiftshader|llvmpipe|software/i.test(name) };
  } catch (e) { return { ok: false }; }
}

function pickTier() {
  const forced = params.get('tier');
  if (params.has('capture')) return { tier: 'full', reason: 'capture', test: true };
  if (TIERS.includes(forced)) return { tier: forced, reason: 'forced', test: true };

  const gpu = probeGpu();
  if (!gpu.ok) return { tier: 'static', reason: 'no-webgl' };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { tier: 'static', reason: 'reduced-motion' };
  if (navigator.connection && navigator.connection.saveData) return { tier: 'static', reason: 'save-data' };
  if (gpu.software) return { tier: 'static', reason: 'software-gpu' };

  const saved = cache.read();
  if (saved) return { tier: saved.tier, reason: saved.reason, cached: true };

  // Only clear signals count as weak. deviceMemory is Chromium-only, so unknown means "assume fine".
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
               (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  return { tier: weak ? 'lite' : 'full', reason: 'heuristic' };
}

/* ---------- state ---------- */
let tier = 'static';
let scene = null;
let fromCache = false;
const LOCKED = ['forced', 'capture', 'no-webgl', 'reduced-motion', 'save-data', 'software-gpu', 'load-error'];

/* ---------- quality controls ---------- */
let offerEl = null;
let offerTimer = 0;
let onLink = null;

function hideOffer() {
  clearTimeout(offerTimer);
  if (!offerEl) return;
  const el = offerEl;
  offerEl = null;
  el.classList.remove('is-in');
  setTimeout(() => el.remove(), 250);
}

// 3D is struggling: offer a way out, then get out of the way
function offerOff() {
  clearTimeout(offerTimer);
  if (!offerEl) {
    offerEl = document.createElement('button');
    offerEl.type = 'button';
    offerEl.className = 'quality-toggle';
    offerEl.textContent = 'Running slowly? Turn 3D off';
    offerEl.addEventListener('click', () => goStatic('manual'));
    document.body.appendChild(offerEl);
    requestAnimationFrame(() => offerEl && offerEl.classList.add('is-in'));
  }
  offerTimer = setTimeout(hideOffer, 12000);
}

// 3D is off: the way back lives in the footer, out of the scene
function offerOn() {
  hideOffer();
  if (onLink) return;
  onLink = document.createElement('button');
  onLink.type = 'button';
  onLink.className = 'footer-link';
  onLink.textContent = 'Try the 3D scene';
  onLink.addEventListener('click', () => { cache.clear(); location.reload(); });
  (document.querySelector('footer') || document.body).appendChild(onLink);
}

/* ---------- tier changes ---------- */
function goStatic(reason) {
  if (scene) scene.stop();
  scene = null;
  tier = 'static';
  document.body.classList.add('no-3d');
  if (reason === 'lag' || reason === 'manual') cache.write('static', reason);
  if (!LOCKED.includes(reason)) offerOn();
}

function degrade() {
  if (tier === 'full') {
    tier = 'lite';
    scene.setQuality('lite');
    cache.write('lite', 'lag');
    offerOff();
  } else if (tier === 'lite') {
    goStatic('lag');
  }
}

/* ---------- frame-rate monitor ---------- */
// Ignores the first second (shader compile, texture upload), then averages 2.5 s windows.
// Two bad windows in a row trigger a step down. After 15 s of good windows the tier counts as settled.
function makeMonitor() {
  const minFps = { full: 40, lite: 22 };
  let warm = 1, sum = 0, n = 0, bad = 0, steady = 0, settled = false;
  return function onFrame(dt) {
    if (settled) return;
    if (dt > 0.5) { sum = 0; n = 0; return; } // tab switch or a one-off hitch, not steady state
    if (warm > 0) { warm -= dt; return; }
    sum += dt; n++;
    if (sum < 2.5) return;
    const fps = n / sum;
    sum = 0; n = 0;
    if (fps < minFps[tier]) {
      steady = 0;
      if (++bad < 2) return;
      bad = 0; warm = 1;
      degrade();
    } else {
      bad = 0;
      steady += 2.5;
      if (steady >= 15) {
        settled = true;
        if (!fromCache) cache.write(tier, 'measured');
      }
    }
  };
}

/* ---------- start ---------- */
async function start() {
  const pick = pickTier();
  fromCache = !!pick.cached;
  tier = pick.tier;

  if (tier === 'static') { goStatic(pick.reason); return; }

  try {
    const { initScene } = await import('./scene.js'); // Three.js only downloads here
    scene = initScene({ tier, onFrame: pick.test ? null : makeMonitor() });
  } catch (e) {
    goStatic('load-error');
    return;
  }

  // a device that already lagged on an earlier visit gets the same offer again
  if (!pick.test && tier === 'lite' && pick.reason === 'lag') offerOff();

  if (params.has('capture')) {
    const name = params.get('capture') === 'mobile' ? 'scene-poster-mobile.webp' : 'scene-poster.webp';
    setTimeout(() => scene && scene.captureStill(name), 3000);
  }
}

start();
