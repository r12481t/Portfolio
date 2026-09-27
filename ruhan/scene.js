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
    scene.fog = new THREE.Fog(0x14100c, 6.5, 11); // only touches the far background, desk stays crisp
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
    cpuTower.position.set(-1.15, 0.27, -0.3);
    scene.add(cpuTower);

    const cpuAccent = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x5599ff, transparent: true, opacity: 0.85 })
    );
    cpuAccent.position.set(-1.15, 0.3, -0.119);
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
    // monitor power cable, sagging back to the tower on the left
    makeCable([-0.4, 0.075, -0.42], [-0.75, 0.055, -0.5], [-1.15, 0.12, -0.34]);
    // tower cable dangling off the desk's back-left edge
    makeCable([-1.15, 0.06, -0.15], [-1.3, -0.08, -0.05], [-1.5, -0.32, 0.05], 0.008);
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
    mugBody.position.set(0.75, 0.1, 0.35);
    scene.add(mugBody);
    const mugRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.006, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xb56a52, roughness: 0.4 })
    );
    mugRim.position.set(0.75, 0.145, 0.35);
    mugRim.rotation.x = Math.PI / 2;
    scene.add(mugRim);

    const steamWisps = [0, 1, 2].map((i) => {
      const wisp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xf5efe6, transparent: true, opacity: 0.2 })
      );
      wisp.position.set(0.75 + (i - 1) * 0.02, 0.22 + i * 0.03, 0.35);
      scene.add(wisp);
      return wisp;
    });

    const plantPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.06, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.8 })
    );
    plantPot.position.set(1.0, 0.11, 0.42);
    scene.add(plantPot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f5c3f, roughness: 0.85 });
    [
      { r: 0.09, pos: [1.0, 0.22, 0.42] },
      { r: 0.07, pos: [0.955, 0.255, 0.44] },
      { r: 0.065, pos: [1.045, 0.245, 0.4] },
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

    /* ---------- Framed print on the wall ---------- */
    const printGroup = new THREE.Group();
    printGroup.position.set(-0.85, 1.95, -2.19);
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

    /* ---------- String lights along the window's top edge ---------- */
    const stringCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.42, 2.78, -2.18),
      new THREE.Vector3(0.9, 2.68, -2.18),
      new THREE.Vector3(1.5, 2.6, -2.18),
      new THREE.Vector3(2.1, 2.68, -2.18),
      new THREE.Vector3(2.58, 2.78, -2.18),
    ]);
    const bulbCount = 16;
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.85 });
    const stringBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 8), bulbMat, bulbCount);
    const bulbDummy = new THREE.Object3D();
    for (let i = 0; i < bulbCount; i++) {
      bulbDummy.position.copy(stringCurve.getPoint(i / (bulbCount - 1)));
      bulbDummy.updateMatrix();
      stringBulbs.setMatrixAt(i, bulbDummy.matrix);
    }
    scene.add(stringBulbs);
    const stringGlowLight = new THREE.PointLight(0xffd28a, 0.6, 2, 2);
    stringGlowLight.position.set(1.5, 2.68, -2.1);
    scene.add(stringGlowLight);

    /* ---------- Rain streaks on the window ---------- */
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
    rainTexture.repeat.set(3, 2.2);
    const rainPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.6),
      new THREE.MeshBasicMaterial({ map: rainTexture, transparent: true, opacity: 0.6, depthWrite: false })
    );
    rainPlane.position.set(1.5, 2.0, -2.199);
    scene.add(rainPlane);

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

    /* ---------- Interactivity: click the lamp, click an item to focus, mouse parallax ---------- */
    let lampOn = true;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const lampHitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    lampHitTarget.position.copy(lampLight.position);
    scene.add(lampHitTarget);

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
    document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });

    function loop() {
      if (!running) return;
      const dt = clock.getDelta();
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
