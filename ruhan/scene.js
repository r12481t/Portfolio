/* ============================================================
   Night-desk scene. Camera stays fixed (only a tiny breathing
   sway, desktop mouse parallax, and click-to-focus zoom).
   Canvas is position:fixed to the viewport, so it renders as
   the backdrop for the entire page, not just the hero.

   Room: the desk sits flush against the back wall. The window
   is on that wall to the left of the monitor, above the CPU.
   ============================================================ */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export function initScene() {
  const canvas = document.getElementById('scene');
  const isMobile = window.innerWidth < 780;

    // Cap the actual rendered resolution to a fixed pixel budget instead of a flat device-class
    // guess. A desktop browser window is usually far larger in CSS pixels than a phone screen, so
    // the old "isMobile ? 1.5 : 2" cap could render several times more pixels on desktop even
    // though desktop hardware (especially a laptop's integrated GPU) isn't necessarily faster.
    // This keeps fill-rate roughly constant across screen sizes instead of ballooning on desktop.
    const targetPixels = isMobile ? 1.6e6 : 2.3e6;
    const cssArea = Math.max(window.innerWidth * window.innerHeight, 1);
    const dpr = window.devicePixelRatio || 1;
    const budgetRatio = Math.sqrt(targetPixels / cssArea);
    const pixelRatio = Math.max(1, Math.min(dpr, isMobile ? 1.5 : 2, budgetRatio));

    const renderer = new THREE.WebGLRenderer({
      canvas, alpha: false,
      antialias: pixelRatio < 1.5,          // supersampling from a higher pixel ratio already smooths edges
      powerPreference: 'high-performance',  // ask laptops to use the discrete GPU instead of the integrated one
    });
    renderer.setClearColor(0x14100c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.setPixelRatio(pixelRatio);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x14100c, 6.5, 11); // fades the far left of the room, desk stays crisp
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(2.4, 1.5, 4.6);
    camera.lookAt(-0.4, 0.4, 0);
    const cameraBase = new THREE.Vector3(2.4, 1.5, 4.6);
    const lookBase = new THREE.Vector3(-0.4, 0.4, 0);

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener('resize', resize);

    // sRGB-correct canvas textures (used for everything added in the room/tower/sky)
    function canvasTex(c) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    /* ---------- Room layout ---------- */
    const wallZ = -0.81;   // wall is flush with the desk's back edge (desk back edge is z = -0.8)
    const floorY = -1.45;
    const win = { x0: -3.4, x1: -1.5, y0: 0.66, y1: 1.8 };   // left of the monitor, above the CPU
    win.cx = (win.x0 + win.x1) / 2;
    win.cy = (win.y0 + win.y1) / 2;
    win.w = win.x1 - win.x0;
    win.h = win.y1 - win.y0;
    const lampX = -0.95, lampZ = 0.6, lampTopX = lampX - 0.15;

    /* ---------- Lights ---------- */
    scene.add(new THREE.AmbientLight(0x323c52, 1.15));
    scene.add(new THREE.HemisphereLight(0x8fb0d8, 0x1a140f, 0.55));
    const lampLight = new THREE.PointLight(0xffb066, 6, 6, 2);
    lampLight.position.set(lampTopX, 0.86, lampZ);
    scene.add(lampLight);
    const windowLight = new THREE.PointLight(0x4d6ea3, 2.2, 8, 2);
    windowLight.position.set(win.cx, win.cy, 0.3);
    scene.add(windowLight);

    /* ---------- Desk, legs, floor, wall ---------- */
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.85 })
    );
    desk.position.set(-0.4, 0, 0);
    scene.add(desk);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.8 });
    [[-1.94, -0.74], [1.14, -0.74], [-1.94, 0.74], [1.14, 0.74]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, -0.06 - floorY, 0.08), legMat);
      leg.position.set(lx, (-0.06 + floorY) / 2, lz);
      scene.add(leg);
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 16),
      new THREE.MeshStandardMaterial({ color: 0x120e0b, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-1.5, floorY, wallZ + 8);
    scene.add(floor);

    // back wall with a real opening for the window
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-12.5, floorY);
    wallShape.lineTo(9.5, floorY);
    wallShape.lineTo(9.5, floorY + 7.5);
    wallShape.lineTo(-12.5, floorY + 7.5);
    wallShape.lineTo(-12.5, floorY);
    const wallHole = new THREE.Path();
    wallHole.moveTo(win.x0, win.y0);
    wallHole.lineTo(win.x0, win.y1);
    wallHole.lineTo(win.x1, win.y1);
    wallHole.lineTo(win.x1, win.y0);
    wallHole.lineTo(win.x0, win.y0);
    wallShape.holes.push(wallHole);
    const wall = new THREE.Mesh(
      new THREE.ShapeGeometry(wallShape),
      new THREE.MeshStandardMaterial({ color: 0x342d28, roughness: 0.95 })
    );
    wall.position.z = wallZ;
    scene.add(wall);

    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.12, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.8 })
    );
    baseboard.position.set(-1.5, floorY + 0.06, wallZ + 0.015);
    scene.add(baseboard);

    /* ---------- Screen: real syntax-highlighted code ---------- */
    const codeCanvas = document.createElement('canvas');
    codeCanvas.width = 400; codeCanvas.height = 280;
    const codeCtx = codeCanvas.getContext('2d');
    const codeTexture = new THREE.CanvasTexture(codeCanvas);

    const codeFont = "12px 'Courier New', monospace";
    const codeLineHeight = 15;
    const linesPerScreen = 16;
    const codeFG = '#c9d1d9';
    const codeKeyword = '#7fb3ff';
    const codeString = '#e9c46a';
    const codeComment = '#6b7280';
    const codeNumber = '#f2a75a';
    const codePunct = '#b5a898';
    const keywordRe = /^(import|from|export|function|const|let|var|new|return|if|else|for|of|in|class|extends|null|true|false|typeof)$/;
    const tokenRe = /(\/\/[^\n]*)|('[^']*'|"[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z0-9_$])/g;

    function tokenColor(tok) {
      if (tok.startsWith('//')) return codeComment;
      if (tok[0] === "'" || tok[0] === '"') return codeString;
      if (/^\d/.test(tok)) return codeNumber;
      if (keywordRe.test(tok)) return codeKeyword;
      if (/^[{}()[\];,.:=<>+\-*/]$/.test(tok)) return codePunct;
      return codeFG;
    }

    const codeSource = [
      "import * as THREE from 'three';",
      "",
      "function initScene() {",
      "  const scene = new THREE.Scene();",
      "  const camera = new THREE.Camera();",
      "",
      "  const lamp = new THREE.PointLight(",
      "    0xffb066, 6, 6",
      "  );",
      "  scene.add(lamp);",
      "",
      "  function loop() {",
      "    renderer.render(scene, camera);",
      "    requestAnimationFrame(loop);",
      "  }",
      "",
      "  loop();",
      "}",
      "",
      "export { initScene };",
      "",
      "// built by Ruhan Tahlil Islam Britto",
      "console.log('portfolio loaded');",
      "",
    ];
    let codeScrollIndex = 0;
    let cursorVisible = true;

    function drawCode() {
      codeCtx.fillStyle = '#0b1018';
      codeCtx.fillRect(0, 0, codeCanvas.width, codeCanvas.height);
      codeCtx.font = codeFont;
      codeCtx.textBaseline = 'top';
      let cursorX = 10, cursorY = 10;
      for (let i = 0; i < linesPerScreen; i++) {
        const line = codeSource[(codeScrollIndex + i) % codeSource.length];
        const y = 10 + i * codeLineHeight;
        let x = 10;
        const tokens = line.match(tokenRe) || [];
        tokens.forEach((tok) => {
          codeCtx.fillStyle = tokenColor(tok);
          codeCtx.fillText(tok, x, y);
          x += codeCtx.measureText(tok).width;
        });
        if (line.trim().length > 0) { cursorX = x + 2; cursorY = y; }
      }
      if (cursorVisible) {
        codeCtx.fillStyle = codeFG;
        codeCtx.fillRect(cursorX, cursorY + 1, 6, codeLineHeight - 4);
      }
      codeTexture.needsUpdate = true;
    }
    drawCode();

    /* ---------- PC rig: centered on the camera's look-at point ---------- */
    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.02, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    );
    standBase.position.set(-0.4, 0.065, -0.35);
    scene.add(standBase);

    const standNeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.22, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    );
    standNeck.position.set(-0.4, 0.185, -0.35);
    scene.add(standNeck);

    const monitorBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.85, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 })
    );
    monitorBody.position.set(-0.4, 0.72, -0.35);
    scene.add(monitorBody);

    const monitorScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.7),
      new THREE.MeshBasicMaterial({ map: codeTexture })
    );
    monitorScreen.position.set(-0.4, 0.72, -0.31);
    scene.add(monitorScreen);

    // soft glow bleed around the screen edges + a power LED on the bottom bezel
    const screenHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.06, 0.76),
      new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.18 })
    );
    screenHalo.position.set(-0.4, 0.72, -0.305);
    scene.add(screenHalo);
    const monitorLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dffb0 })
    );
    monitorLed.position.set(-0.4, 0.32, -0.318);
    scene.add(monitorLed);

    // Bounce light off the screen so it actually lights the desk below it
    const screenGlow = new THREE.PointLight(0x6fa8ff, 1.3, 2.4, 2);
    screenGlow.position.set(-0.4, 0.55, 0.05);
    scene.add(screenGlow);

    /* ---------- Second monitor, angled in beside the first ---------- */
    const stand2Base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.02, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    );
    stand2Base.position.set(0.6, 0.065, -0.32);
    scene.add(stand2Base);

    const stand2Neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.16, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
    );
    stand2Neck.position.set(0.6, 0.155, -0.32);
    scene.add(stand2Neck);

    const monitor2Body = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.62, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 })
    );
    monitor2Body.position.set(0.6, 0.545, -0.32);
    monitor2Body.rotation.y = -0.32;
    scene.add(monitor2Body);

    const monitor2Screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 0.51),
      new THREE.MeshBasicMaterial({ map: codeTexture })
    );
    monitor2Screen.position.set(0.589, 0.545, -0.287);
    monitor2Screen.rotation.y = -0.32;
    scene.add(monitor2Screen);

    const screen2Halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.57),
      new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.16 })
    );
    screen2Halo.position.set(0.594, 0.545, -0.283);
    screen2Halo.rotation.y = -0.32;
    scene.add(screen2Halo);
    const monitor2Led = new THREE.Mesh(
      new THREE.SphereGeometry(0.005, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dffb0 })
    );
    monitor2Led.position.set(0.591, 0.25, -0.293);
    scene.add(monitor2Led);

    /* ---------- Keyboard: raised individual keycaps + subtle backlight ---------- */
    const keyboardGroup = new THREE.Group();
    keyboardGroup.position.set(-0.55, 0.07, 0.25);
    scene.add(keyboardGroup);

    const keyboardBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.015, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 })
    );
    keyboardGroup.add(keyboardBase);

    const keySize = 0.028, keyHeight = 0.012;
    const keyGeo = new THREE.BoxGeometry(keySize, keyHeight, keySize);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.5 });
    const keyCols = 13, keyRows = 3;
    const pitchX = 0.036, pitchZ = 0.034;
    const startX = -(keyCols - 1) * pitchX / 2;
    const startZ = -(keyRows - 1) * pitchZ / 2 - 0.02;
    const keycaps = new THREE.InstancedMesh(keyGeo, keyMat, keyCols * keyRows);
    const dummy = new THREE.Object3D();
    let ki = 0;
    for (let r = 0; r < keyRows; r++) {
      for (let c = 0; c < keyCols; c++) {
        dummy.position.set(startX + c * pitchX, 0.0075 + keyHeight / 2, startZ + r * pitchZ);
        dummy.updateMatrix();
        keycaps.setMatrixAt(ki++, dummy.matrix);
      }
    }
    keyboardGroup.add(keycaps);

    // lighter inset "dish" on each keycap top, for a beveled look without extra geometry cost
    const keyTopMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.4 });
    const keyTops = new THREE.InstancedMesh(
      new THREE.BoxGeometry(keySize * 0.72, 0.002, keySize * 0.72), keyTopMat, keyCols * keyRows
    );
    let kti = 0;
    for (let r = 0; r < keyRows; r++) {
      for (let c = 0; c < keyCols; c++) {
        dummy.position.set(startX + c * pitchX, 0.0075 + keyHeight + 0.001, startZ + r * pitchZ);
        dummy.updateMatrix();
        keyTops.setMatrixAt(kti++, dummy.matrix);
      }
    }
    keyboardGroup.add(keyTops);

    const spacebar = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, keyHeight, 0.028),
      keyMat
    );
    spacebar.position.set(0, 0.0075 + keyHeight / 2, 0.05);
    keyboardGroup.add(spacebar);

    // subtle RGB underglow along the front edge
    const keyGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x4d8fff, transparent: true, opacity: 0.55 })
    );
    keyGlow.position.set(0, -0.004, 0.09);
    keyGlow.rotation.x = -Math.PI / 2;
    keyboardGroup.add(keyGlow);
    const keyGlowLight = new THREE.PointLight(0x4d8fff, 0.35, 0.4, 2);
    keyGlowLight.position.set(0, 0.02, 0.09);
    keyboardGroup.add(keyGlowLight);

    const wristRest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.42, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 })
    );
    wristRest.rotation.z = Math.PI / 2;
    wristRest.position.set(0, -0.001, 0.12);
    keyboardGroup.add(wristRest);

    const mouse = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.03, 0.06, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.55 })
    );
    mouse.rotation.x = Math.PI / 2;
    mouse.position.set(-0.05, 0.075, 0.27);
    scene.add(mouse);

    const scrollWheel = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.02, 0.004),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 })
    );
    scrollWheel.rotation.x = Math.PI / 2;
    scrollWheel.position.set(-0.05, 0.1, 0.26);
    scene.add(scrollWheel);

    const deskMat = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.006, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
    );
    deskMat.position.set(-0.42, 0.062, 0.26);
    scene.add(deskMat);

    /* ---------- CPU tower: a proper mid-tower PC case ---------- */
    const towerW = 0.27, towerH = 0.52, towerD = 0.48;
    const towerX = -1.25, towerZ = -0.5;
    const towerBaseY = 0.08;                       // rests on four small feet
    const towerY = towerBaseY + towerH / 2;
    const towerFront = towerZ + towerD / 2;        // faces the user (+z)
    const towerRight = towerX + towerW / 2;        // glass side panel faces the monitor / camera (+x)
    const towerTop = towerBaseY + towerH;

    const cpuTower = new THREE.Mesh(
      new THREE.BoxGeometry(towerW, towerH, towerD),
      new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55 })
    );
    cpuTower.position.set(towerX, towerY, towerZ);
    scene.add(cpuTower);

    const footMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.05), footMat);
      foot.position.set(towerX + sx * (towerW / 2 - 0.03), 0.07, towerZ + sz * (towerD / 2 - 0.05));
      scene.add(foot);
    });

    // front panel: drive bay, power button, USB ports, perforated mesh intake with a fan glow behind it
    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = 100; frontCanvas.height = 200;
    const fCtx = frontCanvas.getContext('2d');
    fCtx.fillStyle = '#1a1b20'; fCtx.fillRect(0, 0, 100, 200);
    fCtx.fillStyle = '#0c0d10'; fCtx.fillRect(12, 12, 76, 12);
    fCtx.fillStyle = '#2a2c34'; fCtx.fillRect(14, 17, 48, 2);
    fCtx.strokeStyle = '#4d8fff'; fCtx.lineWidth = 2;
    fCtx.beginPath(); fCtx.arc(50, 44, 8, 0, Math.PI * 2); fCtx.stroke();
    fCtx.fillStyle = '#0c0d10';
    fCtx.beginPath(); fCtx.arc(50, 44, 5, 0, Math.PI * 2); fCtx.fill();
    fCtx.fillStyle = '#050506'; fCtx.fillRect(16, 41, 10, 5); fCtx.fillRect(74, 41, 10, 5);
    fCtx.fillStyle = '#0b0c10'; fCtx.fillRect(10, 62, 80, 128);
    const fanGlow = fCtx.createRadialGradient(50, 128, 4, 50, 128, 54);
    fanGlow.addColorStop(0, 'rgba(77,143,255,0.9)');
    fanGlow.addColorStop(1, 'rgba(77,143,255,0)');
    fCtx.fillStyle = fanGlow; fCtx.fillRect(10, 62, 80, 128);
    fCtx.strokeStyle = 'rgba(11,12,16,0.85)'; fCtx.lineWidth = 1.6;
    for (let x = 12; x < 90; x += 4) { fCtx.beginPath(); fCtx.moveTo(x, 62); fCtx.lineTo(x, 190); fCtx.stroke(); }
    for (let y = 64; y < 190; y += 4) { fCtx.beginPath(); fCtx.moveTo(10, y); fCtx.lineTo(90, y); fCtx.stroke(); }
    const cpuFront = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.5),
      new THREE.MeshBasicMaterial({ map: canvasTex(frontCanvas) })
    );
    cpuFront.position.set(towerX, towerY, towerFront + 0.001);
    scene.add(cpuFront);

    // vertical LED strip down the front edge (pulses in the loop)
    const cpuAccent = new THREE.Mesh(
      new THREE.PlaneGeometry(0.008, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x5599ff, transparent: true, opacity: 0.85 })
    );
    cpuAccent.position.set(towerX - towerW / 2 + 0.012, towerY, towerFront + 0.003);
    scene.add(cpuAccent);

    // tempered-glass side panel: front fans, CPU cooler, GPU, rear fan, PSU shroud
    function drawFan(ctx, cx, cy, r, ring) {
      const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.5);
      g.addColorStop(0, ring + '66');
      g.addColorStop(1, ring + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d0f15';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ring; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#20232f';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 4, a, a + 0.45); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#07080b';
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    const sideCanvas = document.createElement('canvas');
    sideCanvas.width = 176; sideCanvas.height = 192;
    const sCtx = sideCanvas.getContext('2d');
    sCtx.fillStyle = '#090a0f'; sCtx.fillRect(0, 0, 176, 192);
    sCtx.fillStyle = '#10121a'; sCtx.fillRect(58, 8, 110, 148);
    sCtx.strokeStyle = '#1c2030'; sCtx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { sCtx.beginPath(); sCtx.moveTo(62, 20 + i * 22); sCtx.lineTo(164, 20 + i * 22); sCtx.stroke(); }
    drawFan(sCtx, 30, 36, 26, '#4d8fff');
    drawFan(sCtx, 30, 96, 26, '#4d8fff');
    drawFan(sCtx, 30, 156, 26, '#4d8fff');
    drawFan(sCtx, 150, 34, 20, '#a06bff');
    sCtx.fillStyle = '#171a24'; sCtx.fillRect(86, 44, 38, 38);
    sCtx.strokeStyle = '#ff5fa8'; sCtx.lineWidth = 2;
    sCtx.beginPath(); sCtx.arc(105, 63, 13, 0, Math.PI * 2); sCtx.stroke();
    sCtx.fillStyle = '#0b0c12'; sCtx.beginPath(); sCtx.arc(105, 63, 8, 0, Math.PI * 2); sCtx.fill();
    sCtx.fillStyle = '#171a22'; sCtx.fillRect(64, 104, 106, 34);
    sCtx.fillStyle = '#2ee6c5'; sCtx.fillRect(64, 104, 106, 3);
    drawFan(sCtx, 92, 123, 12, '#2ee6c5');
    drawFan(sCtx, 140, 123, 12, '#2ee6c5');
    sCtx.fillStyle = '#0d0e13'; sCtx.fillRect(58, 162, 116, 24);
    sCtx.fillStyle = '#1d2030'; sCtx.fillRect(66, 172, 40, 2);
    const sheen = sCtx.createLinearGradient(0, 0, 176, 192);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    sCtx.fillStyle = sheen; sCtx.fillRect(0, 0, 176, 192);
    const cpuSide = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.48),
      new THREE.MeshBasicMaterial({ map: canvasTex(sideCanvas) })
    );
    cpuSide.rotation.y = Math.PI / 2;
    cpuSide.position.set(towerRight + 0.001, towerY, towerZ);
    scene.add(cpuSide);

    // top vent slits
    const ventCanvas = document.createElement('canvas');
    ventCanvas.width = 64; ventCanvas.height = 110;
    const vnCtx = ventCanvas.getContext('2d');
    vnCtx.fillStyle = '#101115'; vnCtx.fillRect(0, 0, 64, 110);
    vnCtx.fillStyle = '#050506';
    for (let i = 8; i < 102; i += 7) vnCtx.fillRect(8, i, 48, 3);
    const cpuVentTop = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.36),
      new THREE.MeshBasicMaterial({ map: canvasTex(ventCanvas) })
    );
    cpuVentTop.rotation.x = -Math.PI / 2;
    cpuVentTop.position.set(towerX, towerTop + 0.001, towerZ);
    scene.add(cpuVentTop);

    /* ---------- Cable clutter: curved, sagging runs that follow the desk ---------- */
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
    const whiteCableMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 });
    function makeCable(points, radius, mat) {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 16, radius || 0.007, 6, false), mat || cableMat);
      scene.add(tube);
      return tube;
    }
    // keyboard USB: meanders left of the monitor stand and over the back edge
    makeCable([[-0.55, 0.079, 0.155], [-0.6, 0.072, 0.06], [-0.68, 0.069, -0.04], [-0.63, 0.068, -0.2],
               [-0.7, 0.068, -0.4], [-0.65, 0.068, -0.6], [-0.69, 0.066, -0.78], [-0.69, 0.0, -0.83]]);
    // mouse cable: S-curve back between the two monitors
    makeCable([[-0.05, 0.08, 0.213], [-0.03, 0.072, 0.13], [0.03, 0.069, 0.03], [0.0, 0.068, -0.1],
               [0.07, 0.068, -0.25], [0.14, 0.068, -0.45], [0.1, 0.066, -0.68], [0.12, 0.0, -0.83]]);
    // phone charging cable (white)
    makeCable([[0.093, 0.071, 0.264], [0.14, 0.069, 0.16], [0.24, 0.068, 0.07], [0.29, 0.068, -0.08],
               [0.36, 0.068, -0.22], [0.41, 0.068, -0.4], [0.38, 0.067, -0.62], [0.4, 0.0, -0.83]], 0.005, whiteCableMat);
    const phonePlug = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.006, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5 })
    );
    phonePlug.position.set(0.096, 0.069, 0.262);
    phonePlug.rotation.y = 0.3;
    scene.add(phonePlug);
    // lamp power cable, winding between the mat and the tower
    makeCable([[-0.96, 0.085, 0.5], [-1.03, 0.07, 0.42], [-1.05, 0.068, 0.28], [-1.0, 0.068, 0.12],
               [-1.06, 0.068, -0.05], [-1.0, 0.068, -0.25], [-0.98, 0.068, -0.45], [-1.03, 0.066, -0.65], [-1.01, 0.0, -0.83]]);
    // monitor -> tower video cable, dips under the monitor chin and crosses behind
    makeCable([[-0.42, 0.3, -0.4], [-0.45, 0.16, -0.42], [-0.52, 0.07, -0.5], [-0.72, 0.068, -0.58],
               [-0.9, 0.068, -0.66], [-1.02, 0.068, -0.7], [-1.12, 0.12, -0.73], [-1.2, 0.2, -0.75]]);
    // second monitor cable
    makeCable([[0.62, 0.24, -0.37], [0.64, 0.14, -0.42], [0.72, 0.07, -0.5], [0.86, 0.068, -0.58],
               [0.98, 0.068, -0.68], [1.02, 0.0, -0.83]]);
    // tower power cord: loops out and hangs off the desk's left edge
    makeCable([[-1.25, 0.1, -0.745], [-1.42, 0.069, -0.7], [-1.62, 0.069, -0.52], [-1.82, 0.069, -0.6],
               [-1.96, 0.066, -0.48], [-2.03, -0.15, -0.45], [-2.03, -0.8, -0.45]], 0.009);

    /* ---------- Phone ---------- */
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.006, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.4 })
    );
    phoneBody.position.set(0.12, 0.063, 0.35);
    phoneBody.rotation.y = 0.3;
    scene.add(phoneBody);

    const phoneCanvas = document.createElement('canvas');
    phoneCanvas.width = 80; phoneCanvas.height = 160;
    const phCtx = phoneCanvas.getContext('2d');
    phCtx.fillStyle = '#0d1b2e'; phCtx.fillRect(0, 0, 80, 160);
    phCtx.fillStyle = '#1a2f4a';
    for (let i = 0; i < 5; i++) phCtx.fillRect(10, 24 + i * 22, 60, 14);
    phCtx.fillStyle = '#4d8fd6';
    phCtx.fillRect(10, 24, 60, 14);
    phCtx.fillStyle = '#0a0a0a';
    phCtx.beginPath(); phCtx.arc(40, 9, 3, 0, Math.PI * 2); phCtx.fill();
    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.155),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(phoneCanvas), transparent: true, opacity: 0.95 })
    );
    phoneScreen.rotation.set(-Math.PI / 2, 0, 0.3);
    phoneScreen.position.set(0.12, 0.067, 0.35);
    scene.add(phoneScreen);

    const phoneGlow = new THREE.PointLight(0x5f8fd6, 0.5, 0.7, 2);
    phoneGlow.position.set(0.12, 0.13, 0.35);
    scene.add(phoneGlow);

    /* ---------- Mug + steam ---------- */
    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.09, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5 })
    );
    mugBody.position.set(0.75, 0.1, 0.35);
    scene.add(mugBody);
    const mugRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.006, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xb56a52, roughness: 0.4 })
    );
    mugRim.position.set(0.75, 0.145, 0.35);
    mugRim.rotation.x = Math.PI / 2;
    scene.add(mugRim);

    const mugHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5 })
    );
    mugHandle.position.set(0.8, 0.1, 0.35);
    mugHandle.rotation.y = Math.PI / 2;
    scene.add(mugHandle);

    const mugLogoCanvas = document.createElement('canvas');
    mugLogoCanvas.width = 64; mugLogoCanvas.height = 64;
    const mlCtx = mugLogoCanvas.getContext('2d');
    mlCtx.fillStyle = '#f0e6d8';
    mlCtx.font = 'bold 34px sans-serif';
    mlCtx.textAlign = 'center'; mlCtx.textBaseline = 'middle';
    mlCtx.fillText('R', 32, 34);
    const mugLogo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 0.035),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mugLogoCanvas), transparent: true })
    );
    mugLogo.position.set(0.75, 0.1, 0.403);
    scene.add(mugLogo);

    // soft round steam puffs (camera-facing sprites instead of hard-edged white bars)
    const steamCanvas = document.createElement('canvas');
    steamCanvas.width = 64; steamCanvas.height = 64;
    const stCtx = steamCanvas.getContext('2d');
    const stGrad = stCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    stGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    stGrad.addColorStop(1, 'rgba(255,255,255,0)');
    stCtx.fillStyle = stGrad; stCtx.fillRect(0, 0, 64, 64);
    const steamTex = canvasTex(steamCanvas);
    const steamWisps = [0, 1, 2].map((i) => {
      const wisp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0.2, depthWrite: false }));
      wisp.scale.set(0.06, 0.06, 1);
      wisp.position.set(0.75 + (i - 1) * 0.012, 0.19, 0.35);
      scene.add(wisp);
      return wisp;
    });

    /* ---------- Plant ---------- */
    const plantPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.06, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.8 })
    );
    plantPot.position.set(1.0, 0.11, 0.42);
    scene.add(plantPot);

    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.058, 20),
      new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 0.95 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(1.0, 0.161, 0.42);
    scene.add(soil);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.008, 0.13, 8),
      new THREE.MeshStandardMaterial({ color: 0x3d5233, roughness: 0.8 })
    );
    stem.position.set(1.0, 0.225, 0.42);
    scene.add(stem);

    const leafGreens = [0x3f5c3f, 0x4a6b45, 0x35533a];
    [
      { r: 0.09, pos: [1.0, 0.22, 0.42] },
      { r: 0.07, pos: [0.955, 0.255, 0.44] },
      { r: 0.065, pos: [1.045, 0.245, 0.4] },
    ].forEach(({ r, pos }, i) => {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12),
        new THREE.MeshStandardMaterial({ color: leafGreens[i], roughness: 0.85 })
      );
      leaf.position.set(...pos);
      scene.add(leaf);
    });

    /* ---------- Desk lamp: weighted base, leaning arm, shade opening downward ---------- */
    const lampMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 20), lampMetal);
    lampBase.position.set(lampX, 0.085, lampZ);
    scene.add(lampBase);
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.92, 12), lampMetal);
    lampArm.position.set(lampX - 0.075, 0.565, lampZ);
    lampArm.rotation.z = Math.atan(0.15 / 0.91);
    scene.add(lampArm);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.2, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xffb066, emissiveIntensity: 1.4, side: THREE.DoubleSide })
    );
    lampShade.position.set(lampTopX, 0.93, lampZ);
    scene.add(lampShade);

    const lampCord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    lampCord.position.set(lampTopX + 0.1, 0.8, lampZ + 0.03);
    scene.add(lampCord);
    const lampCordTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    lampCordTip.position.set(lampCord.position.x, 0.765, lampCord.position.z);
    scene.add(lampCordTip);

    /* ---------- Window on the wall: frame, mullions, sill, glass, rain, condensation ---------- */
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.7 });
    const fw = 0.06;
    [
      [win.w, fw, win.cx, win.y1 - fw / 2],
      [win.w, fw, win.cx, win.y0 + fw / 2],
      [fw, win.h, win.x0 + fw / 2, win.cy],
      [fw, win.h, win.x1 - fw / 2, win.cy],
      [0.035, win.h - 2 * fw, win.cx, win.cy],
      [win.w - 2 * fw, 0.035, win.cx, win.cy],
    ].forEach(([w, h, x, y]) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
      bar.position.set(x, y, wallZ + 0.03);
      scene.add(bar);
    });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(win.w + 0.14, 0.04, 0.16), frameMat);
    sill.position.set(win.cx, win.y0 - 0.02, wallZ + 0.08);
    scene.add(sill);

    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(win.w - 2 * fw, win.h - 2 * fw),
      new THREE.MeshBasicMaterial({ color: 0x8fb0e0, transparent: true, opacity: 0.05, depthWrite: false, fog: false })
    );
    windowGlass.position.set(win.cx, win.cy, wallZ + 0.004);
    scene.add(windowGlass);

    /* ---------- Rain streaks on the glass ---------- */
    const rainCanvas = document.createElement('canvas');
    rainCanvas.width = 128; rainCanvas.height = 256;
    const rCtx = rainCanvas.getContext('2d');
    rCtx.strokeStyle = 'rgba(210,225,245,0.4)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 128, y = Math.random() * 256, len = 14 + Math.random() * 34;
      rCtx.lineWidth = 0.6 + Math.random() * 0.7;
      rCtx.beginPath();
      rCtx.moveTo(x, y);
      rCtx.lineTo(x - 2, y + len);
      rCtx.stroke();
    }
    const rainTexture = new THREE.CanvasTexture(rainCanvas);
    rainTexture.wrapS = THREE.RepeatWrapping;
    rainTexture.wrapT = THREE.RepeatWrapping;
    rainTexture.repeat.set(2.4, 1.5);
    const rainPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(win.w - 2 * fw, win.h - 2 * fw),
      new THREE.MeshBasicMaterial({ map: rainTexture, transparent: true, opacity: 0.6, depthWrite: false, fog: false })
    );
    rainPlane.position.set(win.cx, win.cy, wallZ + 0.006);
    scene.add(rainPlane);

    // faint condensation blooming in the bottom corners of the glass
    const condCanvas = document.createElement('canvas');
    condCanvas.width = 128; condCanvas.height = 128;
    const cnCtx = condCanvas.getContext('2d');
    const cnGrad = cnCtx.createRadialGradient(64, 64, 5, 64, 64, 60);
    cnGrad.addColorStop(0, 'rgba(220,230,245,0.35)');
    cnGrad.addColorStop(1, 'rgba(220,230,245,0)');
    cnCtx.fillStyle = cnGrad;
    cnCtx.fillRect(0, 0, 128, 128);
    const condMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(condCanvas), transparent: true, depthWrite: false, fog: false });
    const cond1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), condMat);
    cond1.position.set(win.x0 + 0.3, win.y0 + 0.22, wallZ + 0.008);
    scene.add(cond1);
    const cond2 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), condMat);
    cond2.position.set(win.x1 - 0.28, win.y0 + 0.2, wallZ + 0.008);
    scene.add(cond2);

    /* ---------- The view outside: painted night sky, moon, skyline (only visible through the window) ---------- */
    const skyW = 6, skyH = 4, skyCX = win.cx - 1.4, skyCY = win.cy;
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512; skyCanvas.height = 384;
    const skCtx = skyCanvas.getContext('2d');
    const toU = (x) => ((x - (skyCX - skyW / 2)) / skyW) * 512;
    const toV = (y) => (((skyCY + skyH / 2) - y) / skyH) * 384;
    const skyG = skCtx.createLinearGradient(0, 0, 0, 384);
    skyG.addColorStop(0, '#060a1a');
    skyG.addColorStop(0.55, '#111a36');
    skyG.addColorStop(1, '#2a2440');
    skCtx.fillStyle = skyG;
    skCtx.fillRect(0, 0, 512, 384);
    for (let i = 0; i < 70; i++) {
      skCtx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`;
      skCtx.fillRect(170 + Math.random() * 230, 100 + Math.random() * 100, 1.5, 1.5);
    }
    const moonU = toU(-3.35), moonV = toV(1.72);
    const moonGlow = skCtx.createRadialGradient(moonU, moonV, 2, moonU, moonV, 40);
    moonGlow.addColorStop(0, 'rgba(239,230,200,0.35)');
    moonGlow.addColorStop(1, 'rgba(239,230,200,0)');
    skCtx.fillStyle = moonGlow; skCtx.fillRect(moonU - 40, moonV - 40, 80, 80);
    skCtx.fillStyle = '#efe6c8';
    skCtx.beginPath(); skCtx.arc(moonU, moonV, 12, 0, Math.PI * 2); skCtx.fill();
    skCtx.fillStyle = '#0e152d';
    skCtx.beginPath(); skCtx.arc(moonU + 5, moonV - 3, 11, 0, Math.PI * 2); skCtx.fill();
    function paintSkyline(color, minTop, maxTop, lit) {
      let x = skyCX - skyW / 2;
      while (x < skyCX + skyW / 2) {
        const w = 0.16 + Math.random() * 0.2;
        const top = minTop + Math.random() * (maxTop - minTop);
        skCtx.fillStyle = color;
        skCtx.fillRect(toU(x), toV(top), (w / skyW) * 512 + 1, 384 - toV(top));
        if (lit) {
          for (let wy = top - 0.05; wy > -0.7; wy -= 0.06) {
            for (let wx = x + 0.03; wx < x + w - 0.03; wx += 0.05) {
              if (Math.random() < 0.3) {
                skCtx.fillStyle = `rgba(255,210,138,${0.35 + Math.random() * 0.5})`;
                skCtx.fillRect(toU(wx), toV(wy), 2, 3);
              }
            }
          }
        }
        x += w + (Math.random() < 0.3 ? 0.03 : 0);
      }
    }
    paintSkyline('#131a30', 1.05, 1.55, false);
    paintSkyline('#090c17', 0.65, 1.25, true);
    const skyBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(skyW, skyH),
      new THREE.MeshBasicMaterial({ map: canvasTex(skyCanvas), fog: false })
    );
    skyBackdrop.position.set(skyCX, skyCY, wallZ - 1.2);
    scene.add(skyBackdrop);

    // twinkling city lights + stars sitting just in front of the backdrop
    const cityLights = [];
    const cityCount = isMobile ? 16 : 28;
    for (let i = 0; i < cityCount; i++) {
      const light = new THREE.Mesh(
        new THREE.PlaneGeometry(0.02 + Math.random() * 0.03, 0.02 + Math.random() * 0.03),
        new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.5 + Math.random() * 0.5, fog: false })
      );
      light.position.set(-4.7 + Math.random() * 2.4, 0.55 + Math.random() * 0.65, wallZ - 1.15);
      cityLights.push(light);
      scene.add(light);
    }

    const starCount = isMobile ? 24 : 40;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = -4.7 + Math.random() * 2.4;
      starPos[i * 3 + 1] = 1.1 + Math.random() * 0.9;
      starPos[i * 3 + 2] = wallZ - 1.15;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.75, fog: false });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    /* ---------- String lights along the top of the window ---------- */
    const stringZ = wallZ + 0.08;
    const stringCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(win.x0 + 0.05, win.y1 - 0.02, stringZ),
      new THREE.Vector3(win.x0 + 0.5, win.y1 - 0.12, stringZ),
      new THREE.Vector3(win.cx, win.y1 - 0.18, stringZ),
      new THREE.Vector3(win.x1 - 0.5, win.y1 - 0.12, stringZ),
      new THREE.Vector3(win.x1 - 0.05, win.y1 - 0.02, stringZ),
    ]);
    const bulbCount = 14;
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.85 });
    const stringBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 8), bulbMat, bulbCount);
    const bulbDummy = new THREE.Object3D();
    for (let i = 0; i < bulbCount; i++) {
      bulbDummy.position.copy(stringCurve.getPoint(i / (bulbCount - 1)));
      bulbDummy.updateMatrix();
      stringBulbs.setMatrixAt(i, bulbDummy.matrix);
    }
    scene.add(stringBulbs);
    const stringWire = new THREE.Mesh(
      new THREE.TubeGeometry(stringCurve, 40, 0.004, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
    );
    scene.add(stringWire);
    const stringGlowLight = new THREE.PointLight(0xffd28a, 0.6, 2, 2);
    stringGlowLight.position.set(win.cx, win.y1 - 0.2, wallZ + 0.4);
    scene.add(stringGlowLight);

    /* ---------- Wall clock ---------- */
    const clockGroup = new THREE.Group();
    clockGroup.position.set(0.15, 1.6, wallZ + 0.03);
    scene.add(clockGroup);
    clockGroup.add(new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x18120d, roughness: 0.6 })
    ));
    const clockRim = new THREE.Mesh(
      new THREE.RingGeometry(0.155, 0.175, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a2c1f, roughness: 0.5 })
    );
    clockRim.position.z = 0.001;
    clockGroup.add(clockRim);
    function makeClockHand(length, width) {
      const hand = new THREE.Mesh(
        new THREE.PlaneGeometry(width, length),
        new THREE.MeshBasicMaterial({ color: 0xd8c9a8 })
      );
      hand.position.set(0, length / 2, 0.002);
      const pivot = new THREE.Group();
      pivot.add(hand);
      return pivot;
    }
    const hourHand = makeClockHand(0.08, 0.014);
    hourHand.rotation.z = -(10 / 12) * Math.PI * 2;
    clockGroup.add(hourHand);
    const minuteHand = makeClockHand(0.12, 0.009);
    minuteHand.rotation.z = -(42 / 60) * Math.PI * 2;
    clockGroup.add(minuteHand);

    const secondHand = makeClockHand(0.14, 0.004);
    secondHand.children[0].material.color.set(0xe07a4f);
    clockGroup.add(secondHand);

    const tickMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.006, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xd8c9a8 }),
      12
    );
    const tickDummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      tickDummy.position.set(Math.sin(a) * 0.135, Math.cos(a) * 0.135, 0.002);
      tickDummy.rotation.z = -a;
      tickDummy.updateMatrix();
      tickMesh.setMatrixAt(i, tickDummy.matrix);
    }
    clockGroup.add(tickMesh);

    /* ---------- Framed print on the wall ---------- */
    const printGroup = new THREE.Group();
    printGroup.position.set(-0.3, 1.9, wallZ + 0.02);
    scene.add(printGroup);
    printGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.36, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.6 })
    ));
    const printCanvas = document.createElement('canvas');
    printCanvas.width = 128; printCanvas.height = 96;
    const pCtx = printCanvas.getContext('2d');
    const pGrad = pCtx.createLinearGradient(0, 0, 0, 96);
    pGrad.addColorStop(0, '#2b2f45');
    pGrad.addColorStop(1, '#5a3d38');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 128, 96);
    pCtx.fillStyle = 'rgba(10,8,10,0.85)';
    pCtx.beginPath();
    pCtx.moveTo(0, 70); pCtx.lineTo(30, 40); pCtx.lineTo(50, 58); pCtx.lineTo(75, 25);
    pCtx.lineTo(100, 55); pCtx.lineTo(128, 45); pCtx.lineTo(128, 96); pCtx.lineTo(0, 96);
    pCtx.closePath();
    pCtx.fill();
    printGroup.add(new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.3),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(printCanvas) })
    ).translateZ(0.011));

    // Dust motes drifting through the lamp light, for atmosphere
    const moteCount = isMobile ? 18 : 36;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = -1.7 + Math.random() * 2.4;
      motePos[i * 3 + 1] = 0.15 + Math.random() * 1.1;
      motePos[i * 3 + 2] = -0.3 + Math.random() * 1.0;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ color: 0xffcf9e, size: 0.012, transparent: true, opacity: 0.5 });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    /* ---------- Vignette (screen-space overlay, always fills the frame) ---------- */
    const vignetteCanvas = document.createElement('canvas');
    vignetteCanvas.width = 512; vignetteCanvas.height = 512;
    const vCtx = vignetteCanvas.getContext('2d');
    const vGrad = vCtx.createRadialGradient(256, 256, 130, 256, 256, 360);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
    vCtx.fillStyle = vGrad;
    vCtx.fillRect(0, 0, 512, 512);
    const vignetteMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(vignetteCanvas),
      transparent: true, depthTest: false, depthWrite: false,
    });
    const vignetteDist = 1;
    const vignettePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vignetteMat);
    vignettePlane.position.set(0, 0, -vignetteDist);
    vignettePlane.renderOrder = 999;
    camera.add(vignettePlane);
    scene.add(camera);
    function resizeVignette() {
      const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * vignetteDist;
      const w = h * camera.aspect;
      vignettePlane.geometry.dispose();
      vignettePlane.geometry = new THREE.PlaneGeometry(w, h);
    }
    resizeVignette();
    window.addEventListener('resize', resizeVignette);

    /* ---------- Interactivity: click the lamp, click an item to focus, mouse parallax ---------- */
    let lampOn = true;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    // generous invisible hit box around the whole lamp, so it's easy to tap on a phone
    const lampHitTarget = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 1.05, 0.36),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lampHitTarget.position.set(lampX - 0.07, 0.56, lampZ);
    scene.add(lampHitTarget);
    lampHitTarget.updateMatrixWorld(true);

    const clickables = [monitorScreen, monitor2Screen, mugBody, plantPot, cpuTower, phoneBody, keyboardBase];
    let focusTargetPos = null;
    let focusAmount = 0;
    let focusHoldUntil = 0;

    function onSceneClick(e) {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.intersectObject(lampHitTarget).length) {
        lampOn = !lampOn;
        return;
      }
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length) {
        focusTargetPos = hits[0].object.getWorldPosition(new THREE.Vector3());
        focusHoldUntil = clock.elapsedTime + 2.4;
      }
    }
    canvas.addEventListener('click', onSceneClick);

    let parallaxTargetX = 0, parallaxTargetY = 0;
    let parallaxX = 0, parallaxY = 0;
    if (!isMobile) {
      window.addEventListener('mousemove', (e) => {
        parallaxTargetX = ((e.clientX / window.innerWidth) * 2 - 1) * 0.12;
        parallaxTargetY = -((e.clientY / window.innerHeight) * 2 - 1) * 0.06;
      });
    }

    const clock = new THREE.Clock();
    let codeTimer = 0;
    let cursorTimer = 0;
    let nextFlickerAt = 4 + Math.random() * 5;
    let flickerEndAt = 0;
    let running = true;
    let rafId = 0;
    // pause while the tab is hidden; cancel the queued frame first so switching apps never stacks extra loops
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      cancelAnimationFrame(rafId);
      if (running) { clock.getDelta(); loop(); }
    });

    function loop() {
      if (!running) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;

      // idle camera breathing + mouse parallax + click-to-focus zoom
      parallaxX += (parallaxTargetX - parallaxX) * Math.min(dt * 3, 1);
      parallaxY += (parallaxTargetY - parallaxY) * Math.min(dt * 3, 1);
      const breatheX = Math.sin(t * 0.18) * 0.018;
      const breatheY = Math.cos(t * 0.13) * 0.01;
      const basePos = new THREE.Vector3(
        cameraBase.x + breatheX + parallaxX,
        cameraBase.y + breatheY + parallaxY,
        cameraBase.z
      );
      if (focusTargetPos) {
        const wantFocus = t < focusHoldUntil ? 1 : 0;
        focusAmount += (wantFocus - focusAmount) * Math.min(dt * 2.5, 1);
        const dir = focusTargetPos.clone().sub(basePos).normalize();
        camera.position.copy(basePos).addScaledVector(dir, 1.3 * focusAmount);
        camera.lookAt(lookBase.clone().lerp(focusTargetPos, focusAmount));
        if (focusAmount < 0.01 && wantFocus === 0) focusTargetPos = null;
      } else {
        camera.position.copy(basePos);
        camera.lookAt(lookBase);
      }

      if (t > nextFlickerAt && t > flickerEndAt) {
        flickerEndAt = t + 0.12 + Math.random() * 0.1;
        nextFlickerAt = flickerEndAt + 5 + Math.random() * 7;
      }
      if (lampOn) {
        const flickerMul = t < flickerEndAt ? 0.3 + Math.random() * 0.4 : 1;
        lampLight.intensity = (6.6 + Math.sin(t * 3) * 0.4) * flickerMul;
        lampShade.material.emissiveIntensity = 1.4;
      } else {
        lampLight.intensity = 0.02;
        lampShade.material.emissiveIntensity = 0.05;
      }
      screenGlow.intensity = 1.2 + Math.sin(t * 5) * 0.1;
      phoneGlow.intensity = 0.45 + Math.sin(t * 2.2) * 0.08;
      keyGlowLight.intensity = 0.3 + Math.sin(t * 1.5) * 0.08;
      keyGlow.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.15;
      stringGlowLight.intensity = 0.5 + Math.sin(t * 0.9) * 0.15;
      bulbMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.1;
      rainTexture.offset.y -= dt * 0.6;
      starMat.opacity = 0.65 + Math.sin(t * 0.6) * 0.15;
      cityLights.forEach((l, i) => { l.material.opacity = 0.5 + Math.sin(t * 0.8 + i) * 0.3; });
      steamWisps.forEach((w, i) => {
        const ph = (t * 0.12 + i / 3) % 1;
        w.position.y = 0.19 + ph * 0.16;
        w.position.x = 0.75 + (i - 1) * 0.008 + Math.sin(t * 0.9 + i * 2) * 0.012;
        w.material.opacity = Math.sin(ph * Math.PI) * 0.22;
        const s = 0.05 + ph * 0.06;
        w.scale.set(s, s, 1);
      });
      cpuAccent.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.25;
      secondHand.rotation.z = -((t % 60) / 60) * Math.PI * 2;

      const motePositions = motes.geometry.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        motePositions[i * 3 + 1] += dt * 0.03;
        if (motePositions[i * 3 + 1] > 1.3) motePositions[i * 3 + 1] = 0.15;
      }
      motes.geometry.attributes.position.needsUpdate = true;
      moteMat.opacity = 0.4 + Math.sin(t * 0.7) * 0.15;

      let needsRedraw = false;
      codeTimer += dt;
      if (codeTimer > 1.4) {
        codeTimer = 0;
        codeScrollIndex = (codeScrollIndex + 1) % codeSource.length;
        needsRedraw = true;
      }
      cursorTimer += dt;
      if (cursorTimer > 0.5) {
        cursorTimer = 0;
        cursorVisible = !cursorVisible;
        needsRedraw = true;
      }
      if (needsRedraw) drawCode();

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    }
    loop();
}
