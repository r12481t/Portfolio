(function(){
  "use strict";

  /* ============================================================
     ================  EDIT YOUR CONTENT HERE  ==================
     This is the only object you need to touch to change what the
     site says: your name, bio, skills, projects and contact links.
     Nothing below this object needs to change when you edit it.
     Anything marked "placeholder" should be replaced with your
     real info — see the README for exactly where each field shows
     up on the page.
     ============================================================ */
  var CONTENT = {
    name: "Ruhan Tahlil Islam Britto",
    title: "Front-End Web Developer",
    heroLine: "I build clean, fast websites for the web — and I'm just getting started.",
    about: "I'm a beginner web developer based in Bangladesh. HTML and CSS are solid ground for me, and I'm currently learning JavaScript by building real things — including this site and its 3D scene. I take on freelance work now, and I'm aiming to study Computer Science abroad.",
    skills: [
      { name: "HTML", note: "solid" },
      { name: "CSS", note: "solid" },
      { name: "JavaScript", note: "learning" },
      { name: "Git & GitHub", note: "comfortable" },
      { name: "Responsive design", note: "comfortable" },
      { name: "Three.js", note: "used to build this site" }
    ],
    projects: [
      {
        file: "project-1.js",
        name: "Project One — replace with your project name",
        description: "Placeholder — write one or two sentences about what this project does and why it matters.",
        tags: ["HTML", "CSS"],
        live: "#",
        code: "#"
      },
      {
        file: "project-2.js",
        name: "Project Two — replace with your project name",
        description: "Placeholder — write one or two sentences about your second project.",
        tags: ["HTML", "CSS"],
        live: "#",
        code: "#"
      },
      {
        file: "project-3.js",
        name: "Project Three — replace with your project name",
        description: "Placeholder — write one or two sentences about your third project.",
        tags: ["HTML", "CSS"],
        live: "#",
        code: "#"
      }
    ],
    contact: [
      { label: "Email", value: "your-email@example.com", href: "mailto:your-email@example.com" },
      { label: "GitHub", value: "github.com/your-username", href: "https://github.com/your-username" },
      { label: "Fiverr", value: "add your Fiverr or LinkedIn link", href: "#" }
    ]
  };
  /* ================  END OF EDITABLE CONTENT  ================= */


  /* ------------------------------------------------------------
     STEP 1 — Render all real content into the page as plain HTML.
     This runs first and always, in both 3D mode and 2D fallback,
     so every word is readable and reachable with zero dependency
     on WebGL working.
     ------------------------------------------------------------ */
  function renderContent(c){
    document.title = c.name + " — " + c.title;
    document.getElementById("brand-name").textContent = c.name;
    document.getElementById("hero-name").textContent = c.name;
    document.getElementById("hero-title").textContent = c.title;
    document.getElementById("hero-line").textContent = c.heroLine;
    document.getElementById("about-text").textContent = c.about;

    var skillsList = document.getElementById("skills-list");
    c.skills.forEach(function(s){
      var li = document.createElement("li");
      li.className = "skill-tag";
      li.textContent = s.name + " ";
      var note = document.createElement("span");
      note.className = "note";
      note.textContent = "(" + s.note + ")";
      li.appendChild(note);
      skillsList.appendChild(li);
    });

    var projList = document.getElementById("projects-list");
    c.projects.forEach(function(p){
      var card = document.createElement("article");
      card.className = "project-card";

      var file = document.createElement("div");
      file.className = "project-file";
      file.textContent = p.file;
      card.appendChild(file);

      var body = document.createElement("div");
      body.className = "project-body";

      var h3 = document.createElement("h3");
      h3.textContent = p.name;
      body.appendChild(h3);

      var desc = document.createElement("p");
      desc.textContent = p.description;
      body.appendChild(desc);

      var tags = document.createElement("div");
      tags.className = "project-tags";
      p.tags.forEach(function(t){
        var span = document.createElement("span");
        span.textContent = t;
        tags.appendChild(span);
      });
      body.appendChild(tags);

      var links = document.createElement("div");
      links.className = "project-links";
      var live = document.createElement("a");
      live.href = p.live; live.textContent = "Live \u2192";
      var code = document.createElement("a");
      code.href = p.code; code.textContent = "Code \u2192";
      links.appendChild(live); links.appendChild(code);
      body.appendChild(links);

      card.appendChild(body);
      projList.appendChild(card);
    });

    var contactList = document.getElementById("contact-list");
    c.contact.forEach(function(item){
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.href;
      var label = document.createElement("span");
      label.className = "clabel";
      label.textContent = item.label;
      var val = document.createElement("span");
      val.className = "cval";
      val.textContent = item.value;
      a.appendChild(label); a.appendChild(val);
      li.appendChild(a);
      contactList.appendChild(li);
    });
  }
  renderContent(CONTENT);


  /* ------------------------------------------------------------
     STEP 2 — Feature detection.
     We use 3D only if the browser can do WebGL AND the visitor
     hasn't asked the OS for reduced motion. A "Skip 3D" button
     lets anyone opt out by hand at any time, too.
     ------------------------------------------------------------ */
  function supportsWebGL(){
    try{
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl")));
    }catch(e){ return false; }
  }

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var forced2D = false;
  try{ forced2D = localStorage.getItem("portfolio-force-2d") === "1"; }catch(e){}

  // If any CDN script failed to load (or never defined its global for
  // some other reason), treat it exactly like "no WebGL" and fall back
  // to the plain content view instead of showing a broken/blank canvas.
  var libsLoaded = (typeof THREE !== "undefined") &&
    (typeof gsap !== "undefined") && (typeof ScrollTrigger !== "undefined") &&
    !window.__portfolioLibFail;

  var use3D = supportsWebGL() && !prefersReducedMotion && !forced2D && libsLoaded;

  var skipBtn = document.getElementById("skip3d-btn");
  var status = document.getElementById("a11y-status");

  function setMode3D(on){
    document.body.classList.toggle("no-3d", !on);
    skipBtn.setAttribute("aria-pressed", String(!on));
    skipBtn.textContent = on ? "Skip 3D" : "Show 3D";
  }
  setMode3D(use3D);

  // Wraps the two 3D startup calls in a try/catch: if anything in scene
  // construction throws for any reason, fall back to the plain content
  // view instead of leaving a half-built, broken canvas on screen.
  function safeStart3D(){
    try{
      ensureSceneBuilt();
      startRuntime();
    }catch(err){
      console.error("3D scene failed to start, falling back to 2D:", err);
      use3D = false;
      setMode3D(false);
      status.textContent = "The 3D scene couldn't load, so here's the plain content view.";
    }
  }

  skipBtn.addEventListener("click", function(){
    var turningOn = document.body.classList.contains("no-3d");
    if(turningOn){
      if(!supportsWebGL() || !libsLoaded){
        status.textContent = "3D isn't available in this browser. Staying with the plain content view.";
        return;
      }
      use3D = true;
      setMode3D(true);
      safeStart3D();
      status.textContent = "3D scene turned on.";
    } else {
      use3D = false;
      setMode3D(false);
      killScrollAnimation();
      status.textContent = "3D scene turned off. Showing the plain content view.";
    }
    try{ localStorage.setItem("portfolio-force-2d", use3D ? "0" : "1"); }catch(e){}
  });

  if(use3D){
    // Give the browser one frame to paint the readable HTML first,
    // then boot the heavier 3D scene.
    requestAnimationFrame(function(){
      requestAnimationFrame(safeStart3D);
    });
  }


  /* ------------------------------------------------------------
     STEP 3 — The 3D scene.
     Everything is built from Three.js primitives (boxes, cylinders,
     cones, spheres, planes) — no external model files, so the site
     works with zero downloads beyond the three.js/gsap libraries.

     To swap in a real .glb model later, replace the body of
     loadDeskModel() with a THREE.GLTFLoader call that adds the
     loaded model to `deskGroup` instead of the primitive shapes —
     everything else (camera, lights, scroll) stays the same.
     ------------------------------------------------------------ */
  var sceneReady = false;
  var isMobile = window.matchMedia("(max-width: 780px)").matches;

  var renderer, scene, camera;
  var codeCanvas, codeCtx, codeTexture, codeScrollY = 0, codeLines = [];
  var lampLight, screenLight;
  var scrollTriggers = [];

  // Camera "stops" — one per section, in the same order as the
  // page's sections (hero, about, skills, projects, contact).
  // pos = where the camera sits, look = the point it aims at.
  var STOPS = [
    { pos: [0.5, 1.9, 4.8],    look: [-0.4, 1.35, -2.0] },  // hero: wide shot of the room
    { pos: [1.75, 1.6, 1.6],   look: [0.4, 1.25, -2.35] },  // about: moving toward the desk
    { pos: [0.55, 1.68, -1.15],look: [0.4, 1.55, -2.4] },   // skills: close on the monitor
    { pos: [0.5, 1.62, -1.55],look: [0.45, 1.53, -2.4] },   // projects: closer, but stops short of filling the frame
    { pos: [-1.5, 1.95, -0.5], look: [-2.1, 2.0, -3.0] }    // contact: turned to the window
  ];

  // One light "mood" per stop, same order as STOPS. As the camera
  // nears the monitor (skills/projects) the screen glow leads and the
  // lamp eases back; at the wide hero shot and the window-facing
  // contact shot the lamp leads instead. This is what carries the
  // "spotlight follows attention" idea now — replaces a particle
  // effect that tried to do it with floating text and never read
  // cleanly. lamp is lampLight's base intensity (flicker rides on
  // top of it in renderLoop); screen is screenLight's intensity
  // (desktop only — screenLight doesn't exist on mobile).
  var LIGHT_STOPS = [
    { lamp: 1.5, screen: 0.35 }, // hero
    { lamp: 1.5, screen: 0.55 }, // about
    { lamp: 1.15, screen: 1.0 }, // skills
    { lamp: 1.15, screen: 1.0 }, // projects
    { lamp: 1.7, screen: 0.25 }  // contact
  ];

  function ensureSceneBuilt(){
    if(sceneReady) return;
    sceneReady = true;

    var canvasEl = document.getElementById("scene-canvas");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    // Fog only kicks in well beyond the room itself (the room's
    // contents sit roughly 1-9 units from the camera at every stop),
    // so it adds depth to the far background without swallowing the
    // desk/window on the wide hero shot.
    scene.fog = new THREE.Fog(0x05070d, 9, 28);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 40);
    setCameraTo(STOPS[0]);

    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: !isMobile,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    buildLights();
    buildRoom();
    loadDeskModel(); // desk, monitor, lamp, props — primitives today, swappable for a .glb later

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  // Starts (or restarts, after the "Skip 3D" toggle) the scroll-driven
  // camera and the render loop. Kept separate from ensureSceneBuilt()
  // so toggling 3D back on doesn't rebuild the whole scene from scratch.
  function startRuntime(){
    setupScrollCamera();
    requestAnimationFrame(renderLoop);
  }

  function buildLights(){
    // One soft fill light for the whole room, so nothing is pure black
    // even from across the room at the wide "hero" shot.
    // Light colors are kept fairly bright here on purpose — dark
    // surface colors below do the work of keeping the mood "night",
    // and a dark light color on top of dark materials multiplies
    // down to almost nothing, which is a common trap.
    var hemi = new THREE.HemisphereLight(0x5a6a9a, 0x2a2018, 0.65);
    scene.add(hemi);

    // The warm desk lamp — the single "warm accent" light in the scene.
    // Distance is generous so it still reaches the room from the wide
    // hero shot, not just up close.
    lampLight = new THREE.PointLight(0xffb454, 2.2, 11, 2);
    lampLight.position.set(1.85, 1.78, -2.45);
    scene.add(lampLight);

    // A faint cool glow from the monitor screen. Skipped on mobile
    // to keep the light count low, as required for mobile performance.
    // Its intensity is animated per section in applyLightRange().
    if(!isMobile){
      screenLight = new THREE.PointLight(0x6fa8ff, 0.7, 3, 2);
      screenLight.position.set(0.42, 1.55, -2.55);
      scene.add(screenLight);
    }
  }

  function buildRoom(){
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x181c26, roughness: 0.95 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -1);
    scene.add(floor);

    var wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1d29, roughness: 1 });
    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.2), wallMat);
    backWall.position.set(0, 2.6, -3.4);
    scene.add(backWall);

    buildWindow();
  }

  // Bakes a starfield + city skyline into one canvas texture, so the
  // "view outside the window" costs a single draw call instead of
  // dozens of extra 3D objects — cheap on both desktop and mobile.
  function buildWindow(){
    var w = isMobile ? 320 : 640, h = isMobile ? 410 : 820;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#050712");
    sky.addColorStop(0.6, "#0b0e22");
    sky.addColorStop(1, "#15122a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for(var i = 0; i < (isMobile ? 70 : 150); i++){
      var sx = Math.random() * w, sy = Math.random() * h * 0.65;
      var r = Math.random() * 1.3 + 0.2;
      ctx.globalAlpha = Math.random() * 0.6 + 0.3;
      ctx.fillStyle = "#eaf0ff";
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // City skyline silhouette with a few lit windows
    var baseY = h * 0.72;
    var x = -10;
    while(x < w + 10){
      var bw = 18 + Math.random() * 34;
      var bh = 40 + Math.random() * (h * 0.32);
      ctx.fillStyle = "#080a14";
      ctx.fillRect(x, baseY - bh, bw, bh + h);
      // lit windows
      var rows = Math.floor(bh / 14), cols = Math.floor(bw / 10);
      for(var ry = 0; ry < rows; ry++){
        for(var cx = 0; cx < cols; cx++){
          if(Math.random() < 0.35){
            ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,190,120,0.85)" : "rgba(160,190,255,0.6)";
            ctx.fillRect(x + 4 + cx * 10, baseY - bh + 6 + ry * 14, 4, 6);
          }
        }
      }
      x += bw + (6 + Math.random() * 10);
    }

    var tex = new THREE.CanvasTexture(c);
    var glassMat = new THREE.MeshBasicMaterial({ map: tex });
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.7), glassMat);
    glass.position.set(-1.8, 2.3, -3.36);
    scene.add(glass);

    var frameMat = new THREE.MeshStandardMaterial({ color: 0x1a140e, roughness: 0.7 });
    var frameThick = 0.09;
    [
      [0, 1.44, 2.1, frameThick],   // top
      [0, -1.44, 2.1, frameThick],  // bottom
      [-1.14, 0, frameThick, 2.7],  // left
      [1.14, 0, frameThick, 2.7]    // right
    ].forEach(function(f){
      var bar = new THREE.Mesh(new THREE.BoxGeometry(f[2], f[3], 0.08), frameMat);
      bar.position.set(-1.8 + f[0], 2.3 + f[1], -3.34);
      scene.add(bar);
    });
  }

  function loadDeskModel(){
    var deskGroup = new THREE.Group();

    var woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2c1c, roughness: 0.8 });
    var top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.09, 1.1), woodMat);
    top.position.set(0.85, 0.95, -2.65);
    deskGroup.add(top);

    var legMat = woodMat;
    [[-0.3, -2.15], [2.0, -2.15], [-0.3, -3.1], [2.0, -3.1]].forEach(function(p){
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), legMat);
      leg.position.set(p[0], 0.5, p[1]);
      deskGroup.add(leg);
    });

    // Monitor: one box with a bright screen texture on its front face
    var bezelMat = new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.6 });
    buildCodeTexture();
    var screenMat = new THREE.MeshBasicMaterial({ map: codeTexture });
    var monitor = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.62, 0.05),
      [bezelMat, bezelMat, bezelMat, bezelMat, screenMat, bezelMat]
    );
    monitor.position.set(0.5, 1.5, -2.78);
    deskGroup.add(monitor);

    var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.24, 12), bezelMat);
    stand.position.set(0.5, 1.11, -2.78);
    deskGroup.add(stand);

    // Lamp
    var lampMetal = new THREE.MeshStandardMaterial({ color: 0x232733, metalness: 0.4, roughness: 0.35 });
    var lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.03, 16), lampMetal);
    lampBase.position.set(1.85, 0.995, -2.45);
    deskGroup.add(lampBase);
    var lampNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), lampMetal);
    lampNeck.position.set(1.85, 1.4, -2.45);
    lampNeck.rotation.z = 0.18;
    deskGroup.add(lampNeck);
    var lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 14, 1, true), lampMetal);
    lampShade.position.set(1.85, 1.78, -2.45);
    lampShade.rotation.x = Math.PI;
    deskGroup.add(lampShade);
    var bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe3ad, emissive: 0xffb454, emissiveIntensity: 1.4 });
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), bulbMat);
    bulb.position.set(1.85, 1.74, -2.45);
    deskGroup.add(bulb);

    // Small desk props: a mug, a stack of books, a tiny plant
    var mugMat = new THREE.MeshStandardMaterial({ color: 0xb45a3c, roughness: 0.6 });
    var mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.09, 14), mugMat);
    mug.position.set(-0.05, 1.03, -2.5);
    deskGroup.add(mug);

    var bookColors = [0x3c4a6b, 0x6b3c3c, 0x3c6b52];
    for(var i = 0; i < 3; i++){
      var book = new THREE.Mesh(
        new THREE.BoxGeometry(0.28 - i * 0.02, 0.035, 0.19),
        new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.8 })
      );
      book.position.set(1.35, 0.985 + i * 0.037, -2.95);
      deskGroup.add(book);
    }

    var potMat = new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.9 });
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.09, 12), potMat);
    pot.position.set(-0.5, 1.03, -2.95);
    deskGroup.add(pot);
    var leaves = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x3c5a3f, roughness: 0.9 })
    );
    leaves.position.set(-0.5, 1.18, -2.95);
    deskGroup.add(leaves);

    scene.add(deskGroup);
  }

  // A small canvas redrawn on a slow interval to look like code
  // scrolling on the monitor. This is decoration on a 3D mesh, not
  // page text, so it stays purely visual (real page text lives in
  // the HTML sections, per the accessibility requirement).
  var CODE_POOL = [
    "function buildScene() {", "  const desk = new Desk();", "  desk.addLamp();",
    "  return desk;", "}", "", "const camera = new Camera(50);",
    "camera.moveTo(nextStop);", "", "// TODO: swap in a .glb model",
    "export function initScene(canvas) {", "  const renderer = create(canvas);",
    "  renderer.render(scene, camera);", "}", "", "class Portfolio {",
    "  constructor(name) {", "    this.name = name;", "    this.skills = [];",
    "  }", "  addSkill(skill) {", "    this.skills.push(skill);", "  }", "}",
    "", "if (prefersReducedMotion) {", "  showFallback();", "} else {",
    "  startScrollCamera();", "}"
  ];
  function buildCodeTexture(){
    var w = isMobile ? 320 : 512, h = isMobile ? 188 : 300;
    codeCanvas = document.createElement("canvas");
    codeCanvas.width = w; codeCanvas.height = h;
    codeCtx = codeCanvas.getContext("2d");
    codeLines = CODE_POOL.slice();
    codeTexture = new THREE.CanvasTexture(codeCanvas);
    drawCodeFrame();
  }
  function drawCodeFrame(){
    var w = codeCanvas.width, h = codeCanvas.height;
    var lineH = Math.round(h / 16);
    codeCtx.fillStyle = "#0b1420";
    codeCtx.fillRect(0, 0, w, h);
    codeCtx.font = Math.round(lineH * 0.72) + "px monospace";
    codeCtx.textBaseline = "top";
    for(var i = -1; i < 17; i++){
      var line = codeLines[((i % codeLines.length) + codeLines.length) % codeLines.length];
      var y = i * lineH - codeScrollY;
      if(/^\s*(function|class|const|export|if|}|return)/.test(line)){
        codeCtx.fillStyle = "#ffb454";
      } else if(/\/\//.test(line)){
        codeCtx.fillStyle = "#6a7592";
      } else {
        codeCtx.fillStyle = "#bfe3d4";
      }
      codeCtx.fillText(line, 10, y);
    }
    codeTexture.needsUpdate = true;
  }
  var codeFrameCount = 0;
  function updateCodeScroll(){
    codeFrameCount++;
    if(codeFrameCount % 5 !== 0) return; // throttle: redraw ~12x/sec, not every frame
    var lineH = Math.round(codeCanvas.height / 16);
    codeScrollY += 1;
    if(codeScrollY >= lineH){
      codeScrollY = 0;
      codeLines.push(codeLines.shift());
    }
    drawCodeFrame();
  }

  function setCameraTo(stop){
    camera.position.set(stop.pos[0], stop.pos[1], stop.pos[2]);
    camera.lookAt(stop.look[0], stop.look[1], stop.look[2]);
  }

  function lerp(a, b, t){ return a + (b - a) * t; }
  var camState = {
    px: STOPS[0].pos[0], py: STOPS[0].pos[1], pz: STOPS[0].pos[2],
    lx: STOPS[0].look[0], ly: STOPS[0].look[1], lz: STOPS[0].look[2],
    lampBase: LIGHT_STOPS[0].lamp, screenIntensity: LIGHT_STOPS[0].screen
  };
  function applyLightRange(i, t){
    var from = LIGHT_STOPS[i], to = LIGHT_STOPS[i + 1];
    camState.lampBase = lerp(from.lamp, to.lamp, t);
    camState.screenIntensity = lerp(from.screen, to.screen, t);
  }
  function applyRange(from, to, t){
    camState.px = lerp(from.pos[0], to.pos[0], t);
    camState.py = lerp(from.pos[1], to.pos[1], t);
    camState.pz = lerp(from.pos[2], to.pos[2], t);
    camState.lx = lerp(from.look[0], to.look[0], t);
    camState.ly = lerp(from.look[1], to.look[1], t);
    camState.lz = lerp(from.look[2], to.look[2], t);
  }

  /* ------------------------------------------------------------
     Scroll -> camera + light sync, as ONE controller.
     A previous version used one ScrollTrigger per section, each
     writing to shared state independently — they all also fire once
     on creation, and the last one created won, freezing the camera
     at the wrong stop from the very first frame. This version has
     exactly one place that reads scroll progress and exactly one
     place that writes camera/light state, so that class of bug
     can't happen again.
     ------------------------------------------------------------ */
  var sectionBoundsFrac = [0, 0, 0, 0, 0];
  var TRANSITION_FRAC = 0.4; // last 40% of each section's scroll range is the camera move; the rest is a hold

  function computeSectionBounds(){
    var ids = ["hero", "about", "skills", "projects", "contact"];
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    for(var k = 0; k < ids.length; k++){
      var el = document.getElementById(ids[k]);
      var absTop = el.getBoundingClientRect().top + window.scrollY;
      sectionBoundsFrac[k] = absTop / maxScroll;
    }
  }

  function updateSceneProgress(globalT){
    var i = 0;
    for(var k = 0; k < sectionBoundsFrac.length - 1; k++){
      if(globalT >= sectionBoundsFrac[k]) i = k;
    }
    if(i > STOPS.length - 2) i = STOPS.length - 2;

    var segStart = sectionBoundsFrac[i], segEnd = sectionBoundsFrac[i + 1];
    var segLen = Math.max(0.0001, segEnd - segStart);
    var transStart = segEnd - TRANSITION_FRAC * segLen;
    var t = globalT <= transStart ? 0 : (globalT - transStart) / (segEnd - transStart);
    t = Math.min(1, Math.max(0, t));

    applyRange(STOPS[i], STOPS[i + 1], t);
    applyLightRange(i, t);
  }

  function setupScrollCamera(){
    gsap.registerPlugin(ScrollTrigger);
    computeSectionBounds();

    var master = ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: function(self){ updateSceneProgress(self.progress); }
    });
    scrollTriggers.push(master);
    updateSceneProgress(0); // sync immediately, independent of whether/when onUpdate first fires

    // The project cards appear as the Projects section comes into view.
    // gsap.from() + a scrollTrigger config evaluates the correct state
    // immediately (not just on future scroll events), so this is also
    // correct if 3D gets toggled back on while already at that section.
    if(!prefersReducedMotion){
      var reveal = gsap.from(".project-card", {
        opacity: 0, y: 22, duration: 0.5, stagger: 0.1, ease: "power2.out",
        scrollTrigger: {
          trigger: "#projects",
          start: "top 75%",
          toggleActions: "play none none reverse"
        }
      });
      scrollTriggers.push(reveal.scrollTrigger);
    }
  }

  function killScrollAnimation(){
    scrollTriggers.forEach(function(st){ st.kill(); });
    scrollTriggers = [];
  }

  function onResize(){
    if(!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    clearTimeout(onResize._t);
    onResize._t = setTimeout(function(){
      if(typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      computeSectionBounds();
    }, 150);
  }

  var paused = false;
  function onVisibilityChange(){
    paused = document.hidden;
    if(!paused) requestAnimationFrame(renderLoop);
  }

  function renderLoop(){
    if(paused || !use3D) return;
    camera.position.set(camState.px, camState.py, camState.pz);
    camera.lookAt(camState.lx, camState.ly, camState.lz);

    // A tiny amount of flicker on the lamp, like a real desk lamp —
    // subtle on purpose, not a distracting effect. It rides on top
    // of camState.lampBase, which applyLightRange() eases per
    // section (see LIGHT_STOPS above).
    if(lampLight){
      lampLight.intensity = camState.lampBase + Math.sin(Date.now() * 0.006) * 0.04;
    }
    if(screenLight){
      screenLight.intensity = camState.screenIntensity;
    }
    updateCodeScroll();

    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }

})();
