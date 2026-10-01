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

   A visitor's own choice always wins: "Turn 3D off" and "Try the 3D scene"
   are remembered and beat every automatic rule below. When the visitor opted
   in, the frame-rate monitor only offers the off button, it never switches
   the scene down by itself.

   Test switches (add to the URL):
     ?debug                       small readout: tier, why, GPU, FPS, cache, errors
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
      // manual choices stay until the visitor undoes them. Lag results expire sooner, because lag can be
      // temporary (a busy PC, battery saver, a background tab) and shouldn't lock 3D out for days.
      const ttl = v.reason === 'manual' ? Infinity
        : v.reason === 'lag' ? (v.tier === 'static' ? 6 * 36e5 : 3 * DAY)
        : 14 * DAY;
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
    if (!gl) return { ok: false, name: 'none' };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext(); // release the probe context straight away
    return { ok: true, name, software: /swiftshader|llvmpipe|software/i.test(name) };
  } catch (e) { return { ok: false, name: 'error' }; }
}

const info = { gpu: '', cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0 };

function pickTier() {
  const forced = params.get('tier');
  if (params.has('capture')) return { tier: 'full', reason: 'capture', test: true };
  if (TIERS.includes(forced)) return { tier: forced, reason: 'forced', test: true };

  const gpu = probeGpu();
  info.gpu = gpu.name || '';
  if (!gpu.ok) return { tier: 'static', reason: 'no-webgl' };

  // the visitor's own choice beats every automatic rule below
  const saved = cache.read();
  if (saved && saved.reason === 'manual') return { tier: saved.tier, reason: 'manual', cached: true, chosen: true };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { tier: 'static', reason: 'reduced-motion' };
  if (navigator.connection && navigator.connection.saveData) return { tier: 'static', reason: 'save-data' };
  if (gpu.software) return { tier: 'static', reason: 'software-gpu' };

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
const LOCKED = ['forced', 'capture', 'no-webgl']; // nothing to offer: no 3D possible, or a test switch is on
let lastReason = '';
let loadError = '';

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
  onLink.addEventListener('click', () => { cache.write('full', 'manual'); location.reload(); });
  (document.querySelector('footer') || document.body).appendChild(onLink);
}

/* ---------- tier changes ---------- */
function goStatic(reason) {
  lastReason = reason;
  console.info('[3d] static, reason:', reason, loadError || '');
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
// Ignores the first 2 s (shader compile, texture upload, page still loading), then averages 2.5 s windows.
// Three bad windows in a row trigger a step down. After 15 s of good windows the tier counts as settled.
// Windows where the tab was hidden are thrown away, so a background tab can't count as lag.
const stats = { fps: 0, bad: 0 };
function makeMonitor(advisory) {
  const minFps = { full: 34, lite: 16 };
  let warm = 2, sum = 0, n = 0, bad = 0, steady = 0, settled = false;
  document.addEventListener('visibilitychange', () => { sum = 0; n = 0; bad = 0; });
  return function onFrame(dt) {
    if (settled || document.hidden) return;
    if (dt > 0.5) { sum = 0; n = 0; return; } // tab switch or a one-off hitch, not steady state
    if (warm > 0) { warm -= dt; return; }
    sum += dt; n++;
    if (sum < 2.5) return;
    const fps = n / sum;
    sum = 0; n = 0;
    stats.fps = Math.round(fps);
    if (fps < minFps[tier]) {
      steady = 0;
      stats.bad = ++bad;
      if (bad < 3) return;
      bad = 0; warm = 2;
      if (advisory) { settled = true; offerOff(); return; } // the visitor chose 3D: offer, don't override
      degrade();
    } else {
      bad = 0; stats.bad = 0;
      steady += 2.5;
      if (steady >= 15) {
        settled = true;
        if (!fromCache) cache.write(tier, 'measured');
      }
    }
  };
}

/* ---------- ?debug readout ---------- */
function debugReadout(pick) {
  if (!params.has('debug')) return;
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;max-width:92vw;' +
    'font:12px/1.5 ui-monospace,monospace;color:#f5efe6;background:rgba(13,10,8,.92);border:1px solid #f2a75a;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);
  const saved = (() => { try { return localStorage.getItem(KEY); } catch (e) { return 'unreadable'; } })();
  const paint = () => {
    box.textContent = [
      'tier:    ' + tier + (tier !== pick.tier ? '  (started ' + pick.tier + ')' : ''),
      'why:     ' + (lastReason || pick.reason) + (pick.cached ? '  (from cache)' : ''),
      'gpu:     ' + (info.gpu || 'unknown'),
      'cores:   ' + info.cores + '   memory: ' + (info.memory || 'unknown') + ' GB',
      'reduced motion: ' + window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      'fps:     ' + (stats.fps || 'measuring') + '   bad windows: ' + stats.bad,
      'cache:   ' + (saved || 'empty'),
      loadError ? 'error:   ' + loadError : '',
    ].filter(Boolean).join('\n');
  };
  paint();
  setInterval(paint, 1000);
}

/* ---------- start ---------- */
async function start() {
  const pick = pickTier();
  fromCache = !!pick.cached;
  tier = pick.tier;
  console.info('[3d] start:', pick.tier, '| reason:', pick.reason, pick.cached ? '| from cache' : '', '| gpu:', info.gpu || 'unknown');
  debugReadout(pick);

  if (tier === 'static') { goStatic(pick.reason); return; }

  try {
    const { initScene } = await import('./scene.js?v=2'); // Three.js only downloads here
    scene = initScene({ tier, onFrame: pick.test ? null : makeMonitor(!!pick.chosen) });
  } catch (e) {
    loadError = String((e && e.message) || e);
    console.error('[3d] could not start the scene:', e);
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
