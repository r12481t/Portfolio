/* ============================================================
   Night-desk scene. FIXED camera, no scroll-driven movement.
   Canvas is position:fixed to the viewport, so it renders as
   the backdrop for the entire page, not just the hero.
   Falls back to a CSS-only starfield if WebGL is unavailable
   or the visitor prefers reduced motion. No manual toggle.
   ============================================================ */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

export function initScene() {
  const canvas = document.getElementById('scene');
  const isMobile = window.innerWidth < 780;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x0d0a08, 1);
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

    scene.add(new THREE.AmbientLight(0x1a2233, 0.6));
    const lampLight = new THREE.PointLight(0xffb066, 6, 6, 2);
    lampLight.position.set(-1.1, 1.1, 0.6);
    scene.add(lampLight);
    const windowLight = new THREE.PointLight(0x4d6ea3, 1.4, 8, 2);
    windowLight.position.set(1.6, 2, -1.5);
    scene.add(windowLight);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.85 })
    );
    desk.position.set(-0.4, 0, 0);
    scene.add(desk);

    const codeCanvas = document.createElement('canvas');
    codeCanvas.width = 256; codeCanvas.height = 192;
    const codeCtx = codeCanvas.getContext('2d');
    const codeTexture = new THREE.CanvasTexture(codeCanvas);
    const lineTones = ['#f2a75a', '#7fb3ff', '#b5a898', '#e9c46a'];
    let codeLines = Array.from({ length: 14 }, randomCodeLine);
    function randomCodeLine() {
      return { w: 30 + Math.random() * 170, tone: lineTones[Math.floor(Math.random() * lineTones.length)] };
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    }
    function drawCode() {
      codeCtx.fillStyle = '#0b1018';
      codeCtx.fillRect(0, 0, codeCanvas.width, codeCanvas.height);
      codeLines.forEach((line, i) => {
        codeCtx.fillStyle = line.tone;
        codeCtx.globalAlpha = 0.85;
        roundRect(codeCtx, 10, 10 + i * 13, line.w, 5, 2.5);
      });
      codeCtx.globalAlpha = 1;
      codeTexture.needsUpdate = true;
    }
    drawCode();

    const monitorBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.85, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 })
    );
    monitorBody.position.set(-1.05, 0.75, -0.35);
    scene.add(monitorBody);

    const monitorScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.7),
      new THREE.MeshBasicMaterial({ map: codeTexture })
    );
    monitorScreen.position.set(-1.05, 0.75, -0.31);
    scene.add(monitorScreen);

    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 })
    );
    keyboard.position.set(-1.0, 0.07, 0.25);
    scene.add(keyboard);

    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.09, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.5 })
    );
    mugBody.position.set(-0.45, 0.1, 0.3);
    scene.add(mugBody);
    const mugRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.006, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xb56a52, roughness: 0.4 })
    );
    mugRim.position.set(-0.45, 0.145, 0.3);
    mugRim.rotation.x = Math.PI / 2;
    scene.add(mugRim);

    const steamWisps = [0, 1, 2].map((i) => {
      const wisp = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xf5efe6, transparent: true, opacity: 0.2 })
      );
      wisp.position.set(-0.45 + (i - 1) * 0.02, 0.22 + i * 0.03, 0.3);
      scene.add(wisp);
      return wisp;
    });

    const plantPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.06, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.8 })
    );
    plantPot.position.set(0.55, 0.11, 0.15);
    scene.add(plantPot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f5c3f, roughness: 0.85 });
    [
      { r: 0.09, pos: [0.55, 0.22, 0.15] },
      { r: 0.07, pos: [0.505, 0.255, 0.17] },
      { r: 0.065, pos: [0.595, 0.245, 0.13] },
    ].forEach(({ r, pos }) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), leafMat);
      leaf.position.set(...pos);
      scene.add(leaf);
    });

    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    lampBase.position.set(-1.1, 0.06, 0.6);
    scene.add(lampBase);
    const lampArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    lampArm.position.set(-1.1, 0.6, 0.6);
    lampArm.rotation.z = 0.25;
    scene.add(lampArm);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.18, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xffb066, emissiveIntensity: 1.4, side: THREE.DoubleSide })
    );
    lampShade.position.copy(lampLight.position);
    lampShade.rotation.x = Math.PI;
    scene.add(lampShade);

    const windowGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x0a1220, transparent: true, opacity: 0.55 })
    );
    windowGlass.position.set(1.5, 2.0, -2.2);
    scene.add(windowGlass);

    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.24, 1.64, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x1a140f })
    );
    windowFrame.position.set(1.5, 2.0, -2.22);
    scene.add(windowFrame);

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

    const clock = new THREE.Clock();
    let codeTimer = 0;
    let running = true;
    document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });

    function loop() {
      if (!running) return;
      const t = clock.getElapsedTime();

      lampLight.intensity = 5.6 + Math.sin(t * 3) * 0.4;
      starMat.opacity = 0.65 + Math.sin(t * 0.6) * 0.15;
      cityLights.forEach((l, i) => { l.material.opacity = 0.5 + Math.sin(t * 0.8 + i) * 0.3; });
      steamWisps.forEach((w, i) => {
        w.position.y = 0.22 + i * 0.03 + Math.sin(t * 0.8 + i) * 0.01;
        w.material.opacity = 0.18 + Math.sin(t * 1.1 + i * 2) * 0.08;
      });

      codeTimer += clock.getDelta();
      if (codeTimer > 2) {
        codeTimer = 0;
        codeLines.shift();
        codeLines.push(randomCodeLine());
        drawCode();
      }

      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();
}
