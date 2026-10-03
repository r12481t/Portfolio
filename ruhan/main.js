/* ============================================================
   3D loader. The night-desk scene is always tried first, at full quality.
   It falls back to a still picture only when something is clearly wrong,
   and a card on the page says what happened and why.

   Falls back when:
     slow-load     the scene isn't on screen within LIMITS.loadMs
     low-fps       the frame rate averages under LIMITS.fps over LIMITS.fpsSeconds (after a short warm-up)
     load-error    Three.js or the scene threw while starting
     context-lost  the browser reset the graphics process
     software-gpu  the browser draws 3D on the CPU (SwiftShader and friends)
     no-webgl      WebGL isn't available
     save-data     the visitor has Data Saver on (the scene is a big download)

   Reduced-motion visitors get the same room, just without movement ("calm").
   A visitor's own choice always wins: "Turn 3D off" and "Try the 3D scene" live in the footer,
   and are remembered. When a visitor opted in, a slow frame rate only offers the off button.

   Test switches (add to the URL):
     ?debug                          small readout: mode, why, GPU, FPS, load time, cache, errors
     ?simulate=slow|lag|error|context|software|webgl|savedata
                                     shows the loading screen, then the card for that reason, no 3D needed
     ?tier=full | static             force 3D on or off, no monitoring, no caching
     ?timeout=3000  ?fps=40  ?window=4  ?warmup=1   try different limits for this visit only
     ?exposure=1.8                   scene brightness (default 1.55)
     ?motion=full                    pretend the OS "reduce motion" setting is off: full scene motion, smooth scrolling
     ?capture  ?capture=mobile       full scene, downloads scene-poster.webp / scene-poster-mobile.webp after 3s
   ============================================================ */

/* ---------- the numbers to discuss ---------- */
const LIMITS = {
  loadMs: 12000,     // scene not on screen after this long: switch to the still picture
  fps: 20,           // average below this...
  fpsSeconds: 6,     // ...over this many seconds: switch to the still picture
  warmupSeconds: 2,  // ignore the first seconds (shader compile, textures uploading)
  watchSeconds: 60,  // keep watching this long after warm-up, then call the scene settled
  lagMemoryHours: 6, // after a low-fps switch, start on the still picture for this long
};

const KEY = 'ruhan3d.mode.v2';   // v2: the lite tier is gone; older v1 entries are simply ignored
const NOTICE_KEY = 'ruhan3d.notice.dismissed';
const params = new URLSearchParams(location.search);
const num = (name, fallback) => { const v = parseFloat(params.get(name)); return Number.isFinite(v) && v > 0 ? v : fallback; };
LIMITS.loadMs = num('timeout', LIMITS.loadMs);
LIMITS.fps = num('fps', LIMITS.fps);
LIMITS.fpsSeconds = Math.round(num('window', LIMITS.fpsSeconds));
LIMITS.warmupSeconds = num('warmup', LIMITS.warmupSeconds);
const exposure = params.has('exposure') ? parseFloat(params.get('exposure')) : undefined;

/* ---------- memory (localStorage) ---------- */
// manual: the visitor's choice, kept until they undo it.  low-fps: expires, because lag can be temporary.
const memory = {
  read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (!v || !['3d', 'static'].includes(v.mode)) return null;
      const ttl = v.reason === 'manual' ? Infinity : LIMITS.lagMemoryHours * 36e5;
      return Date.now() - v.at < ttl ? v : null;
    } catch (e) { return null; }
  },
  write(mode, reason) { try { localStorage.setItem(KEY, JSON.stringify({ mode, reason, at: Date.now() })); } catch (e) {} },
};

/* ---------- state ---------- */
const info = { gpu: '', cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0 };
const stats = { fps: 0, loadMs: 0, error: '' };
let mode = 'loading';        // loading | 3d | static
let lastReason = '';
let scene = null;
let abandoned = false;       // set when we fall back, so a late import can't start the scene afterwards
let advisory = false;        // the visitor opted in, so lag only offers the off button
let startedAt = performance.now();
let loadTimer = 0;
let cachedFallback = false;

// The OS "reduce motion" setting (on Windows: Settings > Accessibility > Visual effects > Animation effects off).
// It gives a calm scene and instant jumps instead of smooth scrolling. ?motion=full overrides it for testing.
const motionOverride = params.get('motion') === 'full';
const reducedMotion = () => !motionOverride && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

/* ---------- loading screen ---------- */
const loader = document.getElementById('loader');
const loaderBar = loader && loader.querySelector('.loader-bar span');
const loaderLabel = document.getElementById('loader-label');

function setStage(label, fraction) {
  if (loaderLabel) loaderLabel.textContent = label;
  if (loaderBar) loaderBar.style.transform = 'scaleX(' + fraction + ')';
}
function endLoading() {
  document.documentElement.classList.remove('is-loading');
  if (!loader) return;
  loader.classList.add('is-done');
  setTimeout(() => loader.remove(), 700);
}

/* ---------- capability checks ---------- */
function probeGpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return { ok: false, name: 'none' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();   // release the probe context straight away
    return { ok: true, name, software: /swiftshader|llvmpipe|software/i.test(name) };
  } catch (e) { return { ok: false, name: 'error' }; }
}

// Decide what to start with. Returns { mode, reason, ... }.
function pickStart() {
  const simulate = params.get('simulate');
  if (simulate) return { mode: 'simulate', reason: simulate };
  if (params.has('capture')) return { mode: '3d', reason: 'capture', test: true };
  const forced = params.get('tier');
  if (forced === 'static') return { mode: 'static', reason: 'forced', test: true };
  if (forced === 'full' || forced === 'lite') return { mode: '3d', reason: 'forced', test: true };

  const gpu = probeGpu();
  info.gpu = gpu.name || '';
  if (!gpu.ok) return { mode: 'static', reason: 'no-webgl' };

  const saved = memory.read();
  if (saved && saved.reason === 'manual') return { mode: saved.mode, reason: 'manual', chosen: true };   // the visitor's choice beats the rules

  if (gpu.software) return { mode: 'static', reason: 'software-gpu' };
  if (navigator.connection && navigator.connection.saveData) return { mode: 'static', reason: 'save-data' };
  if (saved && saved.mode === 'static') return { mode: 'static', reason: saved.reason, cached: true };
  return { mode: '3d', reason: 'default' };
}

/* ---------- the card that explains a fallback ---------- */
const NOTICES = {
  'slow-load':    (d) => `The 3D scene took more than ${Math.round(d.limitMs / 1000)} seconds to load, usually because of a slow connection. This is a still picture of it instead.`,
  'low-fps':      (d) => d.cached
                    ? 'Last time, this device ran the scene too slowly, so 3D is off for a few hours. This is a still picture instead.'
                    : `Your device drew the scene at about ${d.fps} frames per second over ${d.seconds} seconds. That's too choppy to be pleasant, so this is a still picture instead.`,
  'software-gpu': () => 'Your browser is drawing 3D on the processor instead of the graphics card, which is too slow for this scene. Turning on hardware acceleration in the browser settings usually fixes that. This is a still picture instead.',
  'no-webgl':     () => "Your browser couldn't start WebGL, which the 3D scene needs. This is a still picture instead.",
  'load-error':   () => 'The scene hit an error while starting, so this is a still picture instead.',
  'context-lost': () => 'Your browser reset its graphics process and the 3D scene stopped. This is a still picture instead. Reloading the page usually brings it back.',
  'save-data':    () => "Data Saver is on, so the 3D scene wasn't downloaded. This is a still picture instead.",
};
const NO_RETRY = ['no-webgl'];

function showNotice(reason, detail) {
  const make = NOTICES[reason];
  if (!make) return;
  try { if (sessionStorage.getItem(NOTICE_KEY) === reason) return; } catch (e) {}
  const card = el('aside', 'notice');
  card.setAttribute('role', 'status');
  card.appendChild(el('p', 'notice-title', '3D scene switched off'));
  card.appendChild(el('p', 'notice-body', make(detail)));
  const meta = [];
  if (detail.gpu) meta.push('graphics: ' + detail.gpu);
  if (detail.message) meta.push(detail.message);
  if (meta.length) card.appendChild(el('p', 'notice-meta mono', meta.join(' | ')));
  const actions = el('div', 'notice-actions');
  if (!NO_RETRY.includes(reason)) {
    const retry = el('button', 'notice-btn notice-btn-primary', reason === 'software-gpu' ? 'Try 3D anyway' : 'Try 3D again');
    retry.type = 'button';
    retry.addEventListener('click', () => { memory.write('3d', 'manual'); location.reload(); });
    actions.appendChild(retry);
  }
  const close = el('button', 'notice-btn', 'Dismiss');
  close.type = 'button';
  close.addEventListener('click', () => {
    try { sessionStorage.setItem(NOTICE_KEY, reason); } catch (e) {}
    card.classList.remove('is-in');
    setTimeout(() => card.remove(), 300);
  });
  actions.appendChild(close);
  card.appendChild(actions);
  document.body.appendChild(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));
}

/* ---------- small controls ---------- */
// "Turn 3D off" / "Try the 3D scene": in the footer, out of the way of the scene.
function renderFooterControl() {
  const slot = document.querySelector('[data-3d-control]');
  if (!slot) return;
  slot.textContent = '';
  const b = el('button', 'footer-link');
  b.type = 'button';
  if (mode === '3d') {
    b.textContent = 'Turn 3D off';
    b.addEventListener('click', () => goStatic('manual'));
  } else {
    b.textContent = 'Try the 3D scene';
    b.addEventListener('click', () => { memory.write('3d', 'manual'); location.reload(); });
  }
  slot.appendChild(b);
}

// Only for visitors who opted in and then see lag: offer the way out for 12 seconds, then get out of the way.
let offerEl = null, offerTimer = 0;
function offerOff() {
  clearTimeout(offerTimer);
  if (!offerEl) {
    offerEl = el('button', 'quality-toggle', 'Running slowly? Turn 3D off');
    offerEl.type = 'button';
    offerEl.addEventListener('click', () => goStatic('manual'));
    document.body.appendChild(offerEl);
    requestAnimationFrame(() => offerEl && offerEl.classList.add('is-in'));
  }
  offerTimer = setTimeout(() => {
    if (!offerEl) return;
    const n = offerEl; offerEl = null; n.classList.remove('is-in'); setTimeout(() => n.remove(), 250);
  }, 12000);
}

/* ---------- switching to the still picture ---------- */
function goStatic(reason, detail = {}) {
  if (mode === 'static' && lastReason === reason) return;
  abandoned = true;
  clearTimeout(loadTimer);
  lastReason = reason;
  console.info('[3d] still picture, reason:', reason, detail.message || '');
  if (scene) { try { scene.stop(); } catch (e) {} scene = null; }
  mode = 'static';
  document.body.classList.remove('scene-on');
  document.body.classList.add('no-3d');
  endLoading();
  if (reason === 'manual') memory.write('static', 'manual');
  if (reason === 'low-fps') memory.write('static', 'low-fps');
  renderFooterControl();
  if (reason !== 'manual' && reason !== 'forced') showNotice(reason, { gpu: info.gpu, ...detail });
}

/* ---------- frame-rate monitor ---------- */
// Ignores the first warm-up seconds, then keeps one frame-rate reading per second. When the last
// LIMITS.fpsSeconds readings average under LIMITS.fps, 3D switches off. Hidden-tab time never counts.
function makeMonitor() {
  let warm = LIMITS.warmupSeconds, acc = 0, frames = 0, watched = 0;
  const readings = [];
  const reset = () => { acc = 0; frames = 0; readings.length = 0; };
  document.addEventListener('visibilitychange', reset);
  return function onFrame(dt) {
    if (mode !== '3d' || document.hidden) return;
    if (dt > 0.5) { reset(); return; }          // tab switch or a one-off hitch, not steady state
    if (warm > 0) { warm -= dt; return; }
    if (watched > LIMITS.watchSeconds) return;  // settled
    acc += dt; frames++; watched += dt;
    if (acc < 1) return;
    stats.fps = Math.round(frames / acc);
    readings.push(frames / acc);
    acc = 0; frames = 0;
    if (readings.length > LIMITS.fpsSeconds) readings.shift();
    if (readings.length < LIMITS.fpsSeconds) return;
    const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
    if (avg >= LIMITS.fps) return;
    readings.length = 0;
    if (advisory) { offerOff(); return; }       // the visitor chose 3D: offer, don't override
    goStatic('low-fps', { fps: Math.round(avg), seconds: LIMITS.fpsSeconds });
  };
}

/* ---------- ?debug readout ---------- */
function debugReadout(pick) {
  if (!params.has('debug')) return;
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;max-width:92vw;' +
    'font:12px/1.5 ui-monospace,monospace;color:#f5efe6;background:rgba(13,10,8,.92);border:1px solid #f2a75a;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);
  const saved = () => { try { return localStorage.getItem(KEY) || 'empty'; } catch (e) { return 'unreadable'; } };
  const paint = () => {
    box.textContent = [
      'mode:    ' + mode + (mode === 'static' ? '  (started ' + pick.mode + ')' : ''),
      'why:     ' + (lastReason || pick.reason) + (pick.cached || cachedFallback ? '  (from memory)' : ''),
      'gpu:     ' + (info.gpu || 'unknown'),
      'cores:   ' + info.cores + '   memory: ' + (info.memory || 'unknown') + ' GB',
      'reduced motion: ' + window.matchMedia('(prefers-reduced-motion: reduce)').matches +
        (motionOverride ? '  (ignored: ?motion=full)' : reducedMotion() ? '  (calm scene, instant scrolling)' : ''),
      'fps:     ' + (stats.fps || 'measuring') + '   limit: ' + LIMITS.fps + ' over ' + LIMITS.fpsSeconds + ' s',
      'load:    ' + (stats.loadMs ? Math.round(stats.loadMs) + ' ms' : 'waiting') + '   limit: ' + LIMITS.loadMs + ' ms',
      'memory:  ' + saved(),
      stats.error ? 'error:   ' + stats.error : '',
    ].filter(Boolean).join('\n');
  };
  paint();
  setInterval(paint, 1000);
}

/* ---------- in-page links scroll, they don't jump ---------- */
// Uses the browser's own smooth scroll (so it stays smooth while the scene renders), and respects reduced motion.
// Lands the section below the fixed nav (scroll-padding-top in style.css) and moves keyboard focus to it.
function smoothAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip-link') || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    try { history.pushState(null, '', '#' + id); } catch (err) {}
    if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
  });
}
smoothAnchors();

/* ---------- start ---------- */
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function start() {
  const pick = pickStart();
  cachedFallback = !!pick.cached;
  advisory = !!pick.chosen && pick.mode === '3d';
  console.info('[3d] start:', pick.mode, '| reason:', pick.reason, '| gpu:', info.gpu || 'unknown');
  debugReadout(pick);

  // preview a card without needing a real failure: loading screen, then the fallback
  if (pick.mode === 'simulate') {
    const samples = {
      slow: ['slow-load', { limitMs: LIMITS.loadMs }], lag: ['low-fps', { fps: 14, seconds: LIMITS.fpsSeconds }],
      error: ['load-error', { message: 'Example error message' }], context: ['context-lost', {}],
      software: ['software-gpu', { gpu: 'Google SwiftShader' }], webgl: ['no-webgl', {}], savedata: ['save-data', {}],
    };
    const s = samples[pick.reason] || samples.slow;
    setStage('Building the room', 0.6);
    try { sessionStorage.removeItem(NOTICE_KEY); } catch (e) {}
    setTimeout(() => goStatic(s[0], s[1]), 1800);
    return;
  }

  if (pick.mode === 'static') { goStatic(pick.reason, { cached: pick.cached }); return; }

  // from here: 3D, behind the loading screen
  mode = 'loading';
  startedAt = performance.now();
  setStage('Loading the scene', 0.15);
  loadTimer = setTimeout(() => goStatic('slow-load', { limitMs: LIMITS.loadMs }), LIMITS.loadMs);

  try {
    const { initScene } = await import('./scene.js?v=3');   // Three.js only downloads here
    if (abandoned) return;                                   // gave up while it was still downloading
    setStage('Building the room', 0.6);
    await nextPaint();                                       // let the loading screen repaint before the heavy part
    if (abandoned) return;
    scene = initScene({
      calm: reducedMotion(),
      exposure,
      onFrame: pick.test ? null : makeMonitor(),
      onReady() {
        if (abandoned || mode !== 'loading') return;
        stats.loadMs = performance.now() - startedAt;
        if (!pick.test && stats.loadMs > LIMITS.loadMs) { goStatic('slow-load', { limitMs: LIMITS.loadMs }); return; }
        clearTimeout(loadTimer);
        mode = '3d';
        setStage('Ready', 1);
        document.body.classList.add('scene-on');
        renderFooterControl();
        setTimeout(endLoading, 250);
      },
      onContextLost() { goStatic('context-lost'); },
    });
  } catch (e) {
    stats.error = String((e && e.message) || e);
    console.error('[3d] could not start the scene:', e);
    goStatic('load-error', { message: stats.error.slice(0, 120) });
    return;
  }

  if (params.has('capture')) {
    const name = params.get('capture') === 'mobile' ? 'scene-poster-mobile.webp' : 'scene-poster.webp';
    setTimeout(() => scene && scene.captureStill(name), 3000);
  }
}

start();
