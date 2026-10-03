/* camera-fit.js
   Works out how to frame the night-desk scene on any screen.
   Plain maths, no Three.js, so it can be tested in Node.

   The camera never moves. Two things change per screen:
     fov     zooms in or out until the part of the room we care about fits its "stage"
     offset  slides the picture inside the canvas so that part sits in the stage
   The stage is the part of the screen the page text doesn't cover.
   It has to match the layout in style.css: same WIDE_QUERY, same text column. */

// Wide screens: text on the left, desk on the right. Everything else: desk on top, text below.
// Keep this identical to the media query in style.css.
export const WIDE_QUERY = '(min-aspect-ratio: 23/20) and (min-width: 820px)';

// The camera's resting pose, in room units.
export const POSE = { position: [2.4, 1.5, 4.6], target: [-0.4, 0.4, 0] };

// Boxes in room units, [x, y, z] min and max.
//   essential: must stay fully in view (monitors, CPU tower, lamp, desk top)
//   full:      the whole composition, including the wall clock and framed print above the monitors
// On wide screens the scene zooms in until the essentials fill the stage, but never more than FULL_CROP times
// the zoom at which the full composition fits. So a short, wide window crops a little of the wall and floor
// instead of shrinking the desk. The window sits left of the boxes, partly behind the text column.
export const FOCUS = {
  wide:   { essential: { min: [-1.55, 0.00, -0.81], max: [1.30, 1.30, 0.60] },
            full:      { min: [-1.55, -0.10, -0.81], max: [1.30, 2.20, 0.60] } },
  narrow: { essential: { min: [-1.50, -0.05, -0.81], max: [0.30, 1.30, 0.60] } },   // phones: monitor, tower, lamp
};
const FULL_CROP = 1.3;

const PAD = 1.04;            // a little air for the idle sway and mouse parallax
const FOV_MIN = 14, FOV_MAX = 70;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Where a box lands on screen, as tangent coordinates (x / depth, y / depth) seen from the resting pose.
// Tangent coordinates don't depend on the fov, which is what makes the fit a one-line division.
export function project(box, pose = POSE) {
  const fwd = unit(sub(pose.target, pose.position));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
    const d = sub([x, y, z], pose.position);
    const depth = dot(d, fwd);
    const tx = dot(d, right) / depth, ty = dot(d, up) / depth;
    x0 = Math.min(x0, tx); x1 = Math.max(x1, tx); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
  }
  return { x0, x1, y0, y1 };
}

// The part of the screen the scene should fill, in CSS pixels.
// Keep in step with style.css: wide stage starts at 40% of the width (the text column ends before it),
// narrow stage ends at 56% of the height (--stage-bottom, where .hero-copy's text begins).
export function stageFor(w, h, wide, navH = 76) {
  const top = navH + 12;
  return wide
    ? { x0: w * 0.40, x1: w * 0.97, y0: top, y1: h * 0.95 }
    : { x0: w * 0.02, x1: w * 0.98, y0: top - 4, y1: h * 0.56 };
}

// Returns { fov, offsetX, offsetY, stage, f }. Feed fov and the offsets to camera.fov and camera.setViewOffset.
export function computeFit({ w, h, wide, navH = 76, pose = POSE }) {
  const stage = stageFor(w, h, wide, navH);
  const sw = stage.x1 - stage.x0, sh = stage.y1 - stage.y0;
  const focus = wide ? FOCUS.wide : FOCUS.narrow;
  const ess = project(focus.essential, pose);
  const size = (t) => [(t.x1 - t.x0) * PAD, (t.y1 - t.y0) * PAD];
  const [ew, eh] = size(ess);
  // f = pixels per tangent unit. Hard cap: the essentials must fit the stage both ways.
  let f = Math.min(sw / ew, sh / eh);
  if (focus.full) {
    const [fw, fh] = size(project(focus.full, pose));
    f = Math.min(f, Math.min(sw / fw, sh / fh) * FULL_CROP);
  }
  let fov = 2 * Math.atan((h / 2) / f) * 180 / Math.PI;
  fov = Math.min(FOV_MAX, Math.max(FOV_MIN, fov));
  f = (h / 2) / Math.tan(fov * Math.PI / 360);          // re-derive in case the fov was clamped
  // Place the essentials in the stage.
  //   wide:   centred, sat a little low so the wall clock and print above show more than the floor below
  //   narrow: pinned to the top, because the page text starts right under the stage (see .hero-copy in style.css)
  const cx = w / 2 + ((ess.x0 + ess.x1) / 2) * f, cy = h / 2 - ((ess.y0 + ess.y1) / 2) * f;
  const boxH = (ess.y1 - ess.y0) * f;
  const slack = Math.max(0, sh - boxH);
  const top = wide ? stage.y0 + slack / 2 + Math.min(0.08 * sh, slack / 2) : stage.y0 + Math.min(4, slack);
  const dx = (stage.x0 + stage.x1) / 2 - cx, dy = top - (cy - boxH / 2);
  // setViewOffset moves the window, so the picture moves the opposite way
  return { fov, offsetX: -dx, offsetY: -dy, stage, f };
}

// Where a world point lands on screen after the fit (CSS pixels). Used by tests and the ?debug readout.
export function toScreen(p, fit, w, h, pose = POSE) {
  const fwd = unit(sub(pose.target, pose.position));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const d = sub(p, pose.position);
  const depth = dot(d, fwd);
  return [w / 2 + (dot(d, right) / depth) * fit.f - fit.offsetX, h / 2 - (dot(d, up) / depth) * fit.f - fit.offsetY];
}
