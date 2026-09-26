import { initScene } from './scene.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let webglOK = true;
try {
  const test = document.createElement('canvas');
  webglOK = !!(window.WebGLRenderingContext &&
    (test.getContext('webgl') || test.getContext('experimental-webgl')));
} catch (e) { webglOK = false; }

if (!webglOK || prefersReducedMotion) {
  document.body.classList.add('no-3d');
} else {
  initScene();
}
