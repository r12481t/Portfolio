/* ============================================================
   Night-desk scene. FIXED camera, no scroll-driven movement.
   Canvas is position:fixed to the viewport, so it renders as
   the backdrop for the entire page, not just the hero.
   Falls back to a CSS-only starfield if WebGL is unavailable
   or the visitor prefers reduced motion. No manual toggle.

   Updated: PC/monitor rig re-centered on the camera's look-at
   point, scene brightened a touch, screen now shows real
   syntax-highlighted code scrolling by, and mouse / desk mat /
   monitor stand / CPU tower props added around the desk.
   ============================================================ */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export function initScene() {
  const canvas = document.getElementById('scene');
  const isMobile = window.innerWidth < 780;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x14100c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    const pixelCap = isMobile ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(2.4, 1.5, 4.6);
    camera.lookAt(-0.4, 0.4, 0);

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener('resize', resize);

    // Brighter ambient/fill so the room reads clearly without losing the night mood
    scene.add(new THREE.AmbientLight(0x323c52, 1.15));
    scene.add(new THREE.HemisphereLight(0x8fb0d8, 0x1a140f, 0.55));
    const lampLight = new THREE.PointLight(0xffb066, 6, 6, 2);
    lampLight.position.set(-1.5, 1.1, 0.6);
    scene.add(lampLight);
    const windowLight = new THREE.PointLight(0x4d6ea3, 2.0, 8, 2);
    windowLight.position.set(1.6, 2, -1.5);
    scene.add(windowLight);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.85 })
    );
    desk.position.set(-0.4, 0, 0);
    scene.add(desk);

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

    // Bounce light off the screen so it actually lights the desk below it
    const screenGlow = new THREE.PointLight(0x6fa8ff, 1.3, 2.4, 2);
    screenGlow.position.set(-0.4, 0.55, 0.05);
    scene.add(screenGlow);

    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 })
    );
    keyboard.position.set(-0.55, 0.07, 0.25);
    scene.add(keyboard);

    const mouse = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.03, 0.06, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.55 })
    );
    mouse.rotation.x = Math.PI / 2;
    mouse.position.set(-0.05, 0.075, 0.27);
    scene.add(mouse);

    const deskMat = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.006, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
    );
    deskMat.position.set(-0.42, 0.062, 0.26);
    scene.add(deskMat);

    const cpuTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.42, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.6 })
    );
    cpuTower.position.set(1.0, 0.27, -0.2);
    scene.add(cpuTower);

    const cpuAccent = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x5599ff, transparent: true, opacity: 0.85 })
    );
    cpuAccent.position.set(1.0, 0.3, -0.019);
    scene.add(cpuAccent);

    /* ---------- Cable clutter ---------- */
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
    function makeCable(p0, p1, p2, radius) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...p0), new THREE.Vector3(...p1), new THREE.Vector3(...p2)
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius || 0.007, 6, false), cableMat);
      scene.add(tube);
      return tube;
    }
    // monitor power cable, sagging back to the tower
    makeCable([-0.4, 0.075, -0.42], [0.3, 0.06, -0.55], [1.0, 0.12, -0.36]);
    // tower cable dangling off the desk's back-right edge
    makeCable([1.0, 0.06, -0.15], [1.15, -0.08, -0.05], [1.3, -0.32, 0.05], 0.008);
    // keyboard cable running back to the monitor stand
    makeCable([-0.55, 0.075, 0.16], [-0.5, 0.07, -0.05], [-0.42, 0.065, -0.3], 0.005);

    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.006, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.4 })
    );
    phoneBody.position.set(0.12, 0.063, 0.35);
    phoneBody.rotation.y = 0.3;
    scene.add(phoneBody);

    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.155),
      new THREE.MeshBasicMaterial({ color: 0x1a2f4a, transparent: true, opacity: 0.92 })
    );
    phoneScreen.rotation.set(-Math.PI / 2, 0, 0.3);
    phoneScreen.position.set(0.12, 0.067, 0.35);
    scene.add(phoneScreen);

    const phoneGlow = new THREE.PointLight(0x5f8fd6, 0.5, 0.7, 2);
    phoneGlow.position.set(0.12, 0.13, 0.35);
    scene.add(phoneGlow);

    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.09, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5 })
    );
    mugBody.position.set(0.3, 0.1, 0.3);
    scene.add(mugBody);
    const mugRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.006, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xb56a52, roughness: 0.4 })
    );
    mugRim.position.set(0.3, 0.145, 0.3);
    mugRim.rotation.x = Math.PI / 2;
    scene.add(mugRim);

    const steamWisps = [0, 1, 2].map((i) => {
      const wisp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xf5efe6, transparent: true, opacity: 0.2 })
      );
      wisp.position.set(0.3 + (i - 1) * 0.02, 0.22 + i * 0.03, 0.3);
      scene.add(wisp);
      return wisp;
    });

    const plantPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.06, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.8 })
    );
    plantPot.position.set(0.85, 0.11, 0.15);
    scene.add(plantPot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f5c3f, roughness: 0.85 });
    [
      { r: 0.09, pos: [0.85, 0.22, 0.15] },
      { r: 0.07, pos: [0.805, 0.255, 0.17] },
      { r: 0.065, pos: [0.895, 0.245, 0.13] },
    ].forEach(({ r, pos }) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), leafMat);
      leaf.position.set(...pos);
      scene.add(leaf);
    });

    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    lampBase.position.set(-1.5, 0.06, 0.6);
    scene.add(lampBase);
    const lampArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    lampArm.position.set(-1.5, 0.6, 0.6);
    lampArm.rotation.z = 0.25;
    scene.add(lampArm);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.18, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xffb066, emissiveIntensity: 1.4, side: THREE.DoubleSide })
    );
    lampShade.position.copy(lampLight.position);
    lampShade.rotation.x = Math.PI;
    scene.add(lampShade);

    /* ---------- Window in the background ---------- */
    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x0a1220, transparent: true, opacity: 0.5 })
    );
    windowGlass.position.set(1.5, 2.0, -2.2);
    scene.add(windowGlass);

    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.24, 1.64, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x1a140f })
    );
    windowFrame.position.set(1.5, 2.0, -2.22);
    scene.add(windowFrame);

    /* ---------- Wall clock ---------- */
    const clockGroup = new THREE.Group();
    clockGroup.position.set(0.4, 2.3, -2.19);
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

    const cityLights = [];
    const cityCount = isMobile ? 10 : 18;
    for (let i = 0; i < cityCount; i++) {
      const light = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04 + Math.random() * 0.05, 0.04 + Math.random() * 0.05),
        new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.5 + Math.random() * 0.5 })
      );
      light.position.set(0.7 + Math.random() * 1.5, 1.3 + Math.random() * 1.0, -2.15);
      cityLights.push(light);
      scene.add(light);
    }

    const starCount = isMobile ? 140 : 380;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = 0.5 + Math.random() * 4;
      starPos[i * 3 + 1] = 2.6 + Math.random() * 2.5;
      starPos[i * 3 + 2] = -3 - Math.random() * 3;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.75 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

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

    const clock = new THREE.Clock();
    let codeTimer = 0;
    let cursorTimer = 0;
    let nextFlickerAt = 4 + Math.random() * 5;
    let flickerEndAt = 0;
    let running = true;
    document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });

    function loop() {
      if (!running) return;
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      if (t > nextFlickerAt && t > flickerEndAt) {
        flickerEndAt = t + 0.12 + Math.random() * 0.1;
        nextFlickerAt = flickerEndAt + 5 + Math.random() * 7;
      }
      const flickerMul = t < flickerEndAt ? 0.3 + Math.random() * 0.4 : 1;
      lampLight.intensity = (6.6 + Math.sin(t * 3) * 0.4) * flickerMul;
      screenGlow.intensity = 1.2 + Math.sin(t * 5) * 0.1;
      phoneGlow.intensity = 0.45 + Math.sin(t * 2.2) * 0.08;
      starMat.opacity = 0.65 + Math.sin(t * 0.6) * 0.15;
      cityLights.forEach((l, i) => { l.material.opacity = 0.5 + Math.sin(t * 0.8 + i) * 0.3; });
      steamWisps.forEach((w, i) => {
        w.position.y = 0.22 + i * 0.03 + Math.sin(t * 0.8 + i) * 0.01;
        w.material.opacity = 0.18 + Math.sin(t * 1.1 + i * 2) * 0.08;
      });
      cpuAccent.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.25;

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
      requestAnimationFrame(loop);
    }
    loop();
}
