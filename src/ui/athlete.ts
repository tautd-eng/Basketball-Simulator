// Player sprites for the arena view: a small skeleton (hips, knees, ankles,
// shoulders, elbows, hands, head) posed for running, dribbling, defending,
// shooting, jumping, celebrating or sitting, then drawn as crisp pixel shapes
// in canvas pixels — realistic proportions, era kits, skin shading, hair,
// facial hair, socks, shoes, sleeves and knee pads.

export interface Kit { jersey: string; trim: string; trim2: string; shorts: string }
export interface Body {
  skin: string; hair: string; hairColor: string; facial: string; band: boolean; num: number; ht: number;
  build?: number; socks?: string; sockH?: number; shoe?: string; sleeve?: number; knee?: boolean; wrist?: boolean;
  tat?: number; goggles?: boolean; legSleeve?: number; // tattoos (1 one arm, 2 both), goggles, a compression sleeve on one leg (1 front, -1 back)
  // more gear that tells players apart
  bandColor?: string; ninja?: boolean;   // headband colour; tied at the back with two tails
  tights?: string;                       // full-length compression tights under the shorts
  mouthguard?: boolean;                  // hanging out of the side of his mouth
  shoeHigh?: boolean; shoe2?: string; sole?: string;   // high-tops; the accent and the sole colour
  tee?: string;                          // a T-shirt under the jersey
  tape?: string;                         // kinesiology tape on a shoulder
  neckTat?: boolean;
  tips?: string;                         // dyed or bleached hair on top
  teamSocks?: boolean;                   // socks in the team colour
  fingerTape?: boolean;
}
export type AthPose = 'fall' | 'stumble' | 'stand' | 'run' | 'shoot' | 'jump' | 'stance' | 'celebrate' | 'rest' | 'dribble' | 'sit' | 'gather' | 'layup' | 'dunk' | 'hang' | 'hook' | 'block' | 'contest' | 'pass' | 'screen' | 'boxout' | 'reb' | 'follow' | 'fade' | 'goggles' | 'flex' | 'dismay' | 'windmill' | 'tomahawk' | 'fadekick' | 'shh' | 'nightnight' | 'shimmy' | 'land' | 'bpass' | 'shootlow' | 'swipe' | 'chin' | 'protect' | 'backdown' | 'poke' | 'ready' | 'hips';
export interface AthOpts {
  H: number;          // standing height in canvas pixels
  face: number;       // 1 = facing right, -1 = left
  pose: AthPose;
  ph: number;         // stride phase (radians)
  amp: number;        // stride amplitude 0..1 (speed)
  air: boolean;
  kit: Kit; body: Body;
  shorts: number;     // shorts length as a share of the thigh (short 1980s … baggy 2000s)
  font: string;
  num?: boolean;      // draw the jersey number
  view?: 'side' | 'front' | 'back'; // profile, facing the camera, or running away from it
  name?: string;      // surname on the back of the jersey
  suit?: string;      // a coach: suit of this colour (long sleeves and trousers)
  hand?: number;      // dribbling hand (1 = front hand)
  headU?: number;     // head size unit (the same for everybody), defaults to H/100
  crisp?: boolean;    // hard pixel edges (cartoon pixel-art look)
  from?: AthPose;     // the pose he is coming out of
  blend?: number;     // 0 = still in `from`, 1 = fully in `pose`
  t?: number;         // time left in a timed pose (animations that unfold)
  tilt?: number;      // extra lean from speeding up (+, into it) or putting on the brakes (−, sitting back)
}
export interface Hands { front: { x: number; y: number }; back: { x: number; y: number }; head: { x: number; y: number } }

export const shade = (hex: string, f: number) => {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

type Ctx = CanvasRenderingContext2D;
const R = Math.round;
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) { ctx.fillStyle = c; ctx.fillRect(x, y, Math.max(0.8, w), Math.max(0.8, h)); }
/** a tapered limb: a quad with round ends (native paths are fast) */
function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: string) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / l, ny = dx / l, r0 = w0 / 2, r1 = w1 / 2;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
  ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
  ctx.arc(x1, y1, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), dx * ny - dy * nx > 0);
  ctx.lineTo(x0 - nx * r0, y0 - ny * r0);
  ctx.arc(x0, y0, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), dx * ny - dy * nx > 0);
  ctx.fill();
}
/** A limb with volume: lit from the upper left (screen), a darker band along the far edge and a soft highlight
 *  along the near one – drawn inside the limb's own outline, so it is no thicker than a flat one. */
function vlimb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: string, lit = 1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-6;
  let nx = -dy / l, ny = dx / l;
  if (nx * 0.8 + ny * 0.6 < 0) { nx = -nx; ny = -ny; }          // n points away from the light
  limb(ctx, x0, y0, x1, y1, w0, w1, shade(c, 0.74));            // the shadow side
  const k = 0.16;
  limb(ctx, x0 - nx * w0 * k, y0 - ny * w0 * k, x1 - nx * w1 * k, y1 - ny * w1 * k, w0 * 0.7, w1 * 0.7, c);
  if (lit > 0) limb(ctx, x0 - nx * w0 * 0.3, y0 - ny * w0 * 0.3, x1 - nx * w1 * 0.3, y1 - ny * w1 * 0.3, w0 * 0.2, w1 * 0.2, shade(c, 1.12));
}
/** A chain of limb segments with volume (thigh–knee–calf–ankle, shoulder–elbow–wrist): every shadow first,
 *  then every lit part, then the highlight, so the joints show no seams. p = [x, y, width] at each joint. */
let FLAT = false;
/** Flat limbs (no volume shading) – for the faint floor reflections, where nobody sees it. */
export function setFlat(on: boolean) { FLAT = on; }
function vchain(ctx: Ctx, p: [number, number, number][], c: string, lit = 1) {
  if (FLAT) { for (let i = 0; i + 1 < p.length; i++) limb(ctx, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], p[i][2], p[i + 1][2], c); return; }
  const seg = (pass: number) => {
    for (let i = 0; i + 1 < p.length; i++) {
      const [x0, y0, w0] = p[i], [x1, y1, w1] = p[i + 1];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-6;
      let nx = -dy / l, ny = dx / l;
      if (nx * 0.8 + ny * 0.6 < 0) { nx = -nx; ny = -ny; }
      if (pass === 0) limb(ctx, x0, y0, x1, y1, w0, w1, shade(c, 0.74));
      else if (pass === 1) limb(ctx, x0 - nx * w0 * 0.16, y0 - ny * w0 * 0.16, x1 - nx * w1 * 0.16, y1 - ny * w1 * 0.16, w0 * 0.7, w1 * 0.7, c);
      else limb(ctx, x0 - nx * w0 * 0.3, y0 - ny * w0 * 0.3, x1 - nx * w1 * 0.3, y1 - ny * w1 * 0.3, w0 * 0.18, w1 * 0.18, shade(c, 1.12));
    }
  };
  seg(0); seg(1); if (lit > 0 && p[0][2] > 5) seg(2);   // (the highlight only where it can be seen)
}
/** A tapered panel with square ends (cloth: shorts legs), shaded like a limb. */
function vquad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, c: string, lit = 1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1e-6;
  let nx = -dy / l, ny = dx / l;
  if (nx * 0.8 + ny * 0.6 < 0) { nx = -nx; ny = -ny; }
  const q = (k0: number, k1: number, off: number, col: string) => {
    const ox0 = -nx * w0 * off, oy0 = -ny * w0 * off, ox1 = -nx * w1 * off, oy1 = -ny * w1 * off;
    poly(ctx, [[x0 + ox0 + nx * w0 * k0 / 2, y0 + oy0 + ny * w0 * k0 / 2], [x1 + ox1 + nx * w1 * k1 / 2, y1 + oy1 + ny * w1 * k1 / 2], [x1 + ox1 - nx * w1 * k1 / 2, y1 + oy1 - ny * w1 * k1 / 2], [x0 + ox0 - nx * w0 * k0 / 2, y0 + oy0 - ny * w0 * k0 / 2]], col);
  };
  q(1, 1, 0, FLAT ? c : shade(c, 0.78));
  if (!FLAT) { q(0.72, 0.72, 0.14, c); if (lit) q(0.16, 0.16, 0.32, shade(c, 1.1)); }
}
/** An arm (or any limb) as one smooth outline through its joints – no seams at the elbow – shaded inside it:
 *  a soft shadow along the side away from the light, a soft sheen along the lit side. p = [x, y, width]. */
function smoothLimb(ctx: Ctx, p: [number, number, number][], c: string, lit = 1) {
  const n = p.length, L: [number, number][] = [], Rr: [number, number][] = [], N: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b2 = p[Math.min(n - 1, i + 1)];
    const dx = b2[0] - a[0], dy = b2[1] - a[1], l = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / l, ny = dx / l; N.push([nx, ny]);
    L.push([p[i][0] + nx * p[i][2] / 2, p[i][1] + ny * p[i][2] / 2]); Rr.push([p[i][0] - nx * p[i][2] / 2, p[i][1] - ny * p[i][2] / 2]);
  }
  const path = () => {
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(L[i][0], L[i][1], (L[i][0] + L[i + 1][0]) / 2, (L[i][1] + L[i + 1][1]) / 2);
    ctx.lineTo(L[n - 1][0], L[n - 1][1]);
    const e = p[n - 1], ang = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]);
    ctx.arc(e[0], e[1], e[2] / 2, ang, ang + Math.PI, Math.cos(ang) * N[n - 1][0] + Math.sin(ang) * N[n - 1][1] < 0);
    for (let i = n - 2; i > 0; i--) ctx.quadraticCurveTo(Rr[i][0], Rr[i][1], (Rr[i][0] + Rr[i - 1][0]) / 2, (Rr[i][1] + Rr[i - 1][1]) / 2);
    ctx.lineTo(Rr[0][0], Rr[0][1]);
    const s0 = p[0], a0 = Math.atan2(Rr[0][1] - s0[1], Rr[0][0] - s0[0]);
    ctx.arc(s0[0], s0[1], s0[2] / 2, a0, a0 + Math.PI, Math.cos(a0) * -N[0][0] + Math.sin(a0) * -N[0][1] < 0);
    ctx.closePath();
  };
  path(); ctx.fillStyle = c; ctx.fill();
  if (FLAT) return;
  ctx.save(); path(); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // shadow side / lit side, per joint (the normal flipped to point away from the light, upper left)
  const off = (k: number) => p.map((q, i) => { let [nx, ny] = N[i]; if (nx * 0.8 + ny * 0.6 < 0) { nx = -nx; ny = -ny; } return [q[0] + nx * q[2] * k, q[1] + ny * q[2] * k] as [number, number]; });
  const stroke = (pts: [number, number][], width: number, col: string, a: number) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
  const wAvg = p.reduce((a, q) => a + q[2], 0) / n;
  stroke(off(0.42), wAvg * 0.55, shade(c, 0.74), 0.9);
  stroke(off(0.3), wAvg * 0.3, shade(c, 0.86), 0.6);
  if (lit) stroke(off(-0.24), wAvg * 0.16, shade(c, 1.12), 0.55);
  ctx.restore();
}
/** filled polygon */
function poly(ctx: Ctx, pts: [number, number][], c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
/** ellipse, optionally only the part inside the band ya..yb, xa..xb */
function oval(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string, ya = -1e9, yb = 1e9, xa = -1e9, xb = 1e9) {
  ctx.fillStyle = c;
  const clip = ya > -1e8 || yb < 1e8 || xa > -1e8 || xb < 1e8;
  if (clip) {
    ctx.save(); ctx.beginPath();
    const l = Math.max(xa, cx - rx - 1), r = Math.min(xb, cx + rx + 1), t = Math.max(ya, cy - ry - 1), b = Math.min(yb, cy + ry + 1);
    if (r <= l || b <= t) { ctx.restore(); return; }
    ctx.rect(l, t, r - l, b - t); ctx.clip();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill();
  if (clip) ctx.restore();
}

/** Draws the player with feet at (X, Y) and returns where his hands and head are. */
export function drawAthlete(ctx: Ctx, X: number, Y: number, o: AthOpts): Hands {
  const u = o.H / 100, f = o.face || 1;
  const view = o.view ?? 'side';
  const side = view === 'side';
  const sx = side ? 1 : 0.3;                 // swing seen across (profile) or foreshortened (front/back)
  const b = o.body, build = b.build ?? 0.5;
  const skin = b.skin, skinD = shade(skin, 0.8), skinDD = shade(skin, 0.66), skinL = shade(skin, 1.13);
  const k = o.kit;
  const pose = o.pose;
  // ---- skeleton
  const Lt = 24 * u, Ls = 24 * u, Lu = 16.5 * u, Lf = 15.5 * u, torso = 31 * u;
  const amp = Math.min(1, o.amp);
  const ps = o.ph, pb = o.ph + Math.PI;
  const air = o.air;
  /** joint angles for a pose (blended with the previous pose for a few frames, so nothing snaps) */
  const rigOf = (pose: AthPose) => {
    let hipY = -50 * u, lean = 0;
    let thA = 0.04, bdA = 0.06, thB = -0.04, bdB = 0.06;      // A = front leg, B = back leg
    let uA = 0.12, fA = 0.3, uB = -0.12, fB = 0.1;             // arm angles: 0 = hanging, + = forward, π = straight up
    let spreadA = 0, spreadB = 0;                               // arms out to the side (front/back views)
    let splay = 0;                                              // knees and feet apart (seen from the front/back)
    const runLegs = () => {
      thA = 0.62 * amp * Math.sin(ps); bdA = amp * (0.2 + 1.25 * Math.max(0, Math.cos(ps))) + 0.06;
      thB = 0.62 * amp * Math.sin(pb); bdB = amp * (0.2 + 1.25 * Math.max(0, Math.cos(pb))) + 0.06;
      hipY -= 2 * u * amp * Math.abs(Math.sin(ps));
      lean = 0.14 * amp;
    };
    switch (pose) {
      case 'run':
        runLegs();
        uA = -0.6 * amp * Math.sin(ps); fA = uA + 0.9 * amp + 0.25;
        uB = -0.6 * amp * Math.sin(pb); fB = uB + 0.9 * amp + 0.25;
        break;
      case 'dribble':
        if (amp > 0.15) runLegs(); else { thA = 0.18; bdA = 0.45; thB = -0.15; bdB = 0.3; hipY += 3 * u; lean = 0.12; }
        uA = 0.35; fA = 0.75;
        uB = 0.55 + 0.2 * amp; fB = 1.25; spreadB = 0.5;
        break;
      case 'stand':
        hipY += 0.5 * u * (1 + Math.sin(ps)); // breathing
        uA = 0.12 + 0.03 * Math.sin(ps); uB = -0.12 - 0.03 * Math.sin(ps); fA = uA + 0.22; fB = uB + 0.18;   // arms loose, a little bend at the elbow
        splay = 0.07; spreadA = 0.1; spreadB = 0.1; thA = 0.05; bdA = 0.1; thB = -0.03; bdB = 0.08;   // feet under the shoulders, knees unlocked
        break;
      case 'stance':
        hipY += 0.6 * u * Math.sin(ps * 1.6); // bouncing on his toes
        hipY += 11 * u; lean = 0.34;
        // a defensive slide: low, both knees bent over the toes, the feet push apart and come back together
        { const sl = amp > 0.12 ? 0.2 * Math.sin(ps) * Math.min(1, amp * 2) : 0; thA = 0.72 + sl; bdA = 1.05; thB = 0.42 + sl; bdB = 0.86; }   // sitting down in it: both knees out over the toes, shins slanted back
        // active hands, elbows bent: the front one up at shoulder height in the passing lane, the other low by the
        // hip to swipe at the dribble – and they never stop moving
        { const hw = Math.sin(ps * 1.4), hw2 = Math.sin(ps * 1.1 + 1.3);
          uA = 0.62 + 0.1 * hw; fA = 2.25 + 0.18 * hw2; uB = 0.38 + 0.06 * hw2; fB = 1.25 + 0.12 * hw; spreadA = 0.6; spreadB = 0.75; splay = 0.42; }
        break;
      case 'shoot':
        thA = 0.12; bdA = air ? 0.45 : 0.25; thB = -0.05; bdB = air ? 0.55 : 0.2;
        // the set point: the shooting elbow under the ball, the forearm straight up; the guide hand on the side of it
        uA = Math.PI - 0.62; fA = Math.PI - 0.08; spreadA = -0.42;   // (seen from the front: the ball over his forehead)
        uB = Math.PI - 1.2; fB = Math.PI - 0.3; spreadB = 0.2;
        lean = -0.04;
        break;
      case 'jump':
        thA = 0.2; bdA = 0.6; thB = -0.1; bdB = 0.5;
        uA = Math.PI - 0.2; fA = Math.PI - 0.1; uB = Math.PI - 0.45; fB = Math.PI - 0.2;
        break;
      case 'celebrate':
        thA = 0.15; bdA = 0.2; thB = -0.1; bdB = 0.1;
        uA = Math.PI - 0.55; fA = Math.PI - 0.15; uB = -(Math.PI - 0.55); fB = -(Math.PI - 0.15); spreadA = 0.5; spreadB = 0.5;
        break;
      case 'goggles': // three fingers up, the other hand an eye-goggle
        thA = 0.15; bdA = 0.2; thB = -0.1; bdB = 0.1;
        uA = Math.PI - 0.25; fA = Math.PI - 0.05; spreadA = 0.4;
        uB = 2.1; fB = 3.9; spreadB = 0.2;
        break;
      case 'flex': // and-one: both arms bent, fists up
        thA = 0.3; bdA = 0.35; thB = -0.25; bdB = 0.3; hipY += 2 * u;
        uA = 1.55; fA = Math.PI - 0.15; uB = -1.55; fB = -(Math.PI - 0.15); spreadA = 0.9; spreadB = 0.9;
        break;
      case 'dismay': // hands on the head after a big miss
        thA = 0.05; bdA = 0.1; thB = -0.05; bdB = 0.1; lean = -0.05;
        uA = 2.45; fA = 4.0; uB = -2.45; fB = -4.0; spreadA = 0.7; spreadB = 0.7;
        break;
      case 'rest':
        hipY += 5 * u; lean = 0.62;
        thA = 0.25; bdA = 0.55; thB = -0.1; bdB = 0.35;
        uA = 0.55; fA = 0.2; uB = 0.35; fB = 0.15;
        break;
      case 'gather': // dip before the jump, ball at the chest
        hipY += 6 * u; lean = 0.1;
        thA = 0.35; bdA = 0.8; thB = -0.1; bdB = 0.65;
        uA = 0.55; fA = 1.9; uB = 0.45; fB = 1.75;
        break;
      case 'follow': // follow-through: shooting arm up, wrist snapped down
        thA = 0.15; bdA = air ? 0.5 : 0.25; thB = -0.05; bdB = air ? 0.6 : 0.2;
        uA = Math.PI - 0.38; fA = Math.PI - 0.95; uB = Math.PI - 1.2; fB = Math.PI - 0.9; spreadA = -0.3; spreadB = 0.3;
        break;
      case 'fade': // fadeaway: leaning back, arms high
        thA = 0.35; bdA = 0.55; thB = 0.2; bdB = 0.7; lean = -0.32;
        uA = Math.PI - 0.15; fA = Math.PI + 0.05; uB = Math.PI - 0.5; fB = Math.PI - 0.2;
        break;
      case 'layup': // one knee driving up, ball hand extended to the rim
        thA = 1.25; bdA = 1.6; thB = -0.25; bdB = 0.35; lean = -0.05;
        uA = Math.PI - 0.28; fA = Math.PI - 0.12; uB = 0.9; fB = 1.5;
        break;
      case 'dunk': // both arms over the head, body arched
        thA = 0.55; bdA = 1.2; thB = 0.35; bdB = 1.1; lean = -0.12;
        uA = Math.PI - 0.05; fA = Math.PI + 0.25; uB = Math.PI - 0.2; fB = Math.PI + 0.1;
        break;
      case 'windmill': { // the ball sweeps in a full circle on the way up: down, back, over the top and through
        const w = Math.max(0, Math.min(1, 1 - (o.t ?? 0) / 1.05));
        thA = 0.6; bdA = 1.25; thB = 0.4; bdB = 1.15; lean = -0.1;
        uA = 0.45 - w * 4.1; fA = uA - 0.12; uB = Math.PI - 0.5; fB = Math.PI - 0.3;
        break;
      }
      case 'tomahawk': { // cocked far behind the head, then hammered down through the rim
        const w = Math.max(0, Math.min(1, 1 - (o.t ?? 0) / 1.05));
        thA = 0.7; bdA = 1.3; thB = 0.25; bdB = 1.0; lean = -0.22 + 0.2 * Math.max(0, w - 0.55);
        uA = w < 0.55 ? Math.PI + 0.8 : Math.PI + 0.8 - (w - 0.55) / 0.45 * 1.25; fA = uA + 0.45 * (w < 0.55 ? 1 : 1 - (w - 0.55) / 0.45);
        uB = 0.9; fB = 1.35;
        break;
      }
      case 'fadekick': // the one-legged fadeaway: leaning back, the front knee kicked out
        thA = 1.15; bdA = 0.25; thB = 0.12; bdB = 0.55; lean = -0.4;
        uA = Math.PI - 0.12; fA = Math.PI + 0.06; uB = Math.PI - 0.55; fB = Math.PI - 0.25;
        break;
      case 'shh': // a finger to the lips for the crowd
        thA = 0.1; bdA = 0.15; thB = -0.08; bdB = 0.1; lean = -0.06;
        uA = 0.55; fA = Math.PI + 0.25; uB = -0.08; fB = 0.08;
        break;
      case 'nightnight': // hands together by the tilted head: put them to sleep
        thA = 0.1; bdA = 0.2; thB = -0.06; bdB = 0.12; lean = -0.1;
        uA = 2.25; fA = 3.85; uB = 2.05; fB = 3.7; spreadA = 0.3; spreadB = 0.3;
        break;
      case 'shimmy': // shoulders shaking, arms out
        thA = 0.2; bdA = 0.4; thB = -0.15; bdB = 0.35; hipY += 3 * u; lean = 0.1 * Math.sin(ps * 2.2);
        uA = 1.25 + 0.3 * Math.sin(ps * 2.2); fA = 2.35; uB = -1.25 + 0.3 * Math.sin(ps * 2.2); fB = -2.35; spreadA = 0.95; spreadB = 0.95;
        break;
      case 'shootlow': // a poor shooter's push: the ball from in front of his face, elbows out, barely leaving the floor
        thA = 0.14; bdA = air ? 0.35 : 0.3; thB = -0.06; bdB = air ? 0.4 : 0.25; hipY += 2 * u;
        uA = 1.6; fA = 2.75; uB = 1.45; fB = 2.6; spreadA = 0.85; spreadB = 0.85;
        lean = 0.02;
        break;
      case 'swipe': // a lunge with a low reach at the ball
        hipY += 9 * u; lean = 0.5;
        thA = 0.85; bdA = 1.25; thB = -0.35; bdB = 0.35;
        uA = 1.25; fA = 1.4; uB = -0.4; fB = -0.2; spreadA = 0.5;
        break;
      case 'chin': // the rebound chinned: ball under the chin, elbows out, knees bent
        hipY += 5 * u; lean = 0.08; splay = 0.3;
        thA = 0.3; bdA = 0.6; thB = -0.2; bdB = 0.45;
        uA = 0.75; fA = 2.75; uB = 0.6; fB = 2.6; spreadA = 0.3; spreadB = 0.3;
        break;
      case 'protect': // dribbling low under pressure, the off arm out as a bar between the ball and his man
        hipY += 6 * u + 0.6 * u * Math.sin(ps * 2); lean = 0.24;
        thA = 0.32; bdA = 0.62; thB = -0.2; bdB = 0.45;
        uA = 0.25; fA = 0.6; uB = 0.95; fB = 1.75; spreadB = 0.6;   // the off arm bent, a forearm bar
        break;
      case 'backdown': // backing his man down: low, wide, leaning back into him, the ball on the far side
        hipY += 7 * u; lean = -0.22 + 0.06 * Math.sin(ps * 2); splay = 0.35;
        thA = 0.35; bdA = 0.7; thB = -0.35; bdB = 0.55;
        uA = 0.45; fA = 0.75; uB = -0.85; fB = -0.55; spreadB = 0.7;
        break;
      case 'poke': // a quick reach at the ball from his stance
        hipY += 11 * u; lean = 0.42;
        thA = 0.72; bdA = 1.22; thB = 0.02; bdB = 0.72;
        uA = 1.35; fA = 1.5; uB = 0.5; fB = 0.9; spreadA = 0.7; spreadB = 0.7; splay = 0.42;
        break;
      case 'ready': // off the ball, shot-ready: knees soft, hands up at the chest for the catch
        hipY += 3.5 * u + 0.4 * u * Math.sin(ps); lean = 0.1;
        thA = 0.2; bdA = 0.42; thB = -0.12; bdB = 0.32; splay = 0.18;
        uA = 0.42; fA = 2.05; uB = 0.36; fB = 1.9; spreadA = 0.3; spreadB = 0.3;   // elbows in, palms out for the catch
        break;
      case 'hips': // a dead ball: hands on his hips, catching his breath
        hipY += 0.5 * u * (1 + Math.sin(ps)); lean = -0.03;
        thA = 0.06; bdA = 0.1; thB = -0.06; bdB = 0.1; splay = 0.1;
        uA = -0.45; fA = 0.75; uB = -0.45; fB = 0.75; spreadA = 0.8; spreadB = 0.8;
        break;
      case 'land': // coming down: knees and hips soak it up, arms out for balance
        hipY += 7 * u; lean = 0.14;
        thA = 0.45; bdA = 0.95; thB = -0.02; bdB = 0.7;
        uA = 0.55; fA = 0.95; uB = 0.35; fB = 0.7; spreadA = 0.55; spreadB = 0.55; splay = 0.25;
        break;
      case 'bpass': // the ball whipped around his back to the man beside him
        thA = 0.3; bdA = 0.45; thB = -0.25; bdB = 0.3; lean = 0.1;
        uA = 0.35; fA = 0.75; uB = -1.05; fB = -0.35; spreadB = 0.4;
        break;
      case 'hang': // hanging on the rim
        thA = 0.25; bdA = 0.5; thB = 0.1; bdB = 0.6; lean = 0.05;
        uA = Math.PI - 0.15; fA = Math.PI - 0.05; uB = Math.PI - 0.25; fB = Math.PI - 0.1;
        break;
      case 'hook': // sweeping hook: shooting arm high over the head, the other shielding
        thA = 0.9; bdA = 1.2; thB = -0.15; bdB = 0.3; lean = -0.18;
        uA = Math.PI - 0.55; fA = Math.PI - 0.25; uB = 1.35; fB = 1.6; spreadB = 0.9;
        break;
      case 'block': case 'reb':
        thA = 0.25; bdA = 0.7; thB = -0.05; bdB = 0.6;
        uA = Math.PI - 0.12; fA = Math.PI - 0.04; uB = pose === 'reb' ? Math.PI - 0.3 : 0.6; fB = pose === 'reb' ? Math.PI - 0.15 : 1.1;
        break;
      case 'contest': // a hand up in the shooter's face (on a closeout he is still running at him)
        hipY += 4 * u; lean = 0.08;
        thA = 0.3; bdA = 0.55; thB = -0.3; bdB = 0.3;
        if (amp > 0.3 && !air) { runLegs(); lean = 0.05; }
        uA = Math.PI - 0.15; fA = Math.PI - 0.08; uB = -0.6; fB = -0.9; spreadB = 0.8;
        break;
      case 'pass': // both arms pushed out toward the target (on the move the legs keep running)
        thA = 0.3; bdA = 0.45; thB = -0.25; bdB = 0.3; lean = 0.14;
        if (amp > 0.3 && !air) runLegs();
        uA = 1.45; fA = 1.6; uB = 1.3; fB = 1.5;
        break;
      case 'screen': // feet set wide, arms crossed in front
        hipY += 3 * u; thA = 0.22; bdA = 0.35; thB = -0.22; bdB = 0.35;
        uA = 0.35; fA = 1.75; uB = 0.25; fB = 1.9; splay = 0.22;
        break;
      case 'fall': // on the floor after taking the charge: sitting back, legs out, hands behind him
        hipY = -9 * u; lean = -0.75;
        thA = 1.45; bdA = 0.25; thB = 1.3; bdB = 0.45;
        uA = -0.9; fA = -0.5; uB = -1.1; fB = -0.7;
        break;
      case 'stumble': // knocked off balance: leaning back, arms out
        hipY += 4 * u; lean = -0.35;
        thA = 0.5; bdA = 0.45; thB = -0.4; bdB = 0.25;
        uA = 1.7; fA = 2.1; uB = -1.4; fB = -1.8; spreadA = 1.2; spreadB = 1.2;
        break;
      case 'boxout': // low, wide, arms out, backside into the man
        hipY += 8 * u; lean = 0.2;
        thA = 0.55; bdA = 0.9; thB = -0.55; bdB = 0.4;
        uA = 1.15; fA = 2.55; uB = -1.15; fB = -2.55; spreadA = 1.25; spreadB = 1.25; splay = 0.4;   // elbows wide, forearms up: the 'chicken wings'
        break;
      case 'sit':
        hipY = -22 * u; lean = -0.05;
        thA = Math.PI / 2 - 0.08; bdA = Math.PI / 2 - 0.05; thB = Math.PI / 2 - 0.12; bdB = Math.PI / 2 - 0.1;
        uA = 0.35; fA = 1.3; uB = 0.25; fB = 1.2;
        break;
    }
    return { hipY, lean, thA, bdA, thB, bdB, uA, fA, uB, fB, spreadA, spreadB, splay };
  };
  const R0 = rigOf(pose);
  const R1 = o.from && o.from !== pose && (o.blend ?? 1) < 1 ? rigOf(o.from) : null;
  const bl = R1 ? Math.max(0, Math.min(1, o.blend ?? 1)) : 1, e = bl * bl * (3 - 2 * bl);
  const mixR = (key: keyof typeof R0) => (R1 ? R1[key] + (R0[key] - R1[key]) * e : R0[key]);
  const hipY = mixR('hipY'), lean = mixR('lean') + (o.tilt ?? 0);
  const thA = mixR('thA'), bdA = mixR('bdA'), thB = mixR('thB'), bdB = mixR('bdB');
  const uA = mixR('uA'), fA = mixR('fA'), uB = mixR('uB'), fB = mixR('fB'), spreadA = mixR('spreadA'), spreadB = mixR('spreadB'), splay = side ? 0 : mixR('splay');
  const hx = X, hy = Y + hipY;
  const legSide = (s: number) => side ? s * 2.6 * u * f : s * 4 * u * (view === 'back' ? -1 : 1);
  const leg = (s: number, th: number, bd: number) => {
    const h = { x: hx + legSide(s), y: hy };
    // seen from the front a wide stance shows: the knees out over the toes, the feet apart
    const so = s * (view === 'back' ? -1 : 1);
    const kn = { x: h.x + Math.sin(th) * Lt * f * sx + so * Math.sin(splay) * Lt, y: h.y + Math.cos(th) * Lt * Math.cos(splay * 0.6) };
    const sa = th - bd;
    const an = { x: kn.x + Math.sin(sa) * Ls * f * sx + so * Math.sin(splay * 0.45) * Ls, y: kn.y + Math.cos(sa) * Ls };
    return { h, kn, an, sa };
  };
  const LA = leg(1, thA, bdA), LB = leg(-1, thB, bdB);
  if (pose !== 'sit' && !air) {
    const low = Math.max(LA.an.y, LB.an.y) + 2.6 * u;
    const dy = Y - low;
    for (const L of [LA, LB]) { L.h.y += dy; L.kn.y += dy; L.an.y += dy; }
  }
  const hipC = { x: hx, y: (LA.h.y + LB.h.y) / 2 };
  const leanX = Math.sin(lean) * torso * f * sx;
  const sh = { x: hipC.x + leanX, y: hipC.y - Math.cos(lean) * torso };
  const shW = (17.5 + 5 * build) * u * (side ? 0.92 : 1.08), hipW = (12 + 2 * build) * u * (side ? 1 : 1.15);
  const lw = 1.0 + 0.28 * build;
  const shoulder = (s: number) => side ? { x: sh.x + s * shW * 0.42 * f, y: sh.y + 1.5 * u } : { x: sh.x + s * shW * 0.47 * (view === 'back' ? -1 : 1), y: sh.y + 1.5 * u };
  const arm = (s: number, ua: number, fa: number, spread: number) => {
    const s0 = shoulder(s);
    const out = side ? 0 : s * (view === 'back' ? -1 : 1);
    const ex = side ? Math.sin(ua) * Lu * f : Math.sin(ua) * Lu * 0.3 * f + out * (Math.sin(Math.min(1.4, spread + 0.12)) * Lu * 0.9);
    const el = { x: s0.x + ex, y: s0.y + Math.cos(side ? ua : Math.max(ua, spread)) * Lu };
    const fx = side ? Math.sin(fa) * Lf * f : Math.sin(fa) * Lf * 0.3 * f + out * Math.sin(Math.min(1.5, spread * 1.1 + 0.15)) * Lf * 0.9;
    const ha = { x: el.x + fx, y: el.y + Math.cos(side ? fa : Math.max(fa, spread)) * Lf };
    return { s0, el, ha };
  };
  let AA = arm(1, uA, fA, spreadA), AB = arm(-1, uB, fB, spreadB);
  // hands on the hips, seen from the front: elbows out, the hands back on the hip bones
  if (!side && pose === 'hips' && !R1) {
    const hip = (s: number, A: typeof AA) => { const so = s * (view === 'back' ? -1 : 1); return { s0: A.s0, el: { x: A.s0.x + so * 0.62 * Lu, y: A.s0.y + 0.72 * Lu }, ha: { x: hx + so * (hipW / 2 + 0.5 * u), y: Y + hipY - 1 * u } }; };
    AA = hip(1, AA); AB = hip(-1, AB);
  }
  // heads are about the same size on everybody: a seven-footer is tall in the legs and the body, not the head
  const uh = o.headU ?? u;
  const head = { x: sh.x + Math.sin(lean) * 4 * u * f * sx, y: sh.y - 4.2 * u - 7 * uh + (side ? 0 : Math.sin(lean) * 2 * u) };

  // ---- parts
  const drawLeg = (L: typeof LA, back: boolean) => {
    const sk = back ? skinD : skin;
    const thW = 9.1 * u * lw, knW = 6.0 * u * lw;   // an athlete's thighs (the quads carry him)
    // calf: thicker below the knee, thin at the ankle
    const cx = L.kn.x + (L.an.x - L.kn.x) * 0.3, cy = L.kn.y + (L.an.y - L.kn.y) * 0.3;
    // hip – thigh – above the knee – knee – the calf's belly – the lower calf – ankle: one smooth outline
    const LP = (t: number, a: { x: number; y: number }, c: { x: number; y: number }) => [a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t];
    const [t1x, t1y] = LP(0.45, L.h, L.kn), [t2x, t2y] = LP(0.82, L.h, L.kn), [c2x, c2y] = LP(0.72, L.kn, L.an);
    smoothLimb(ctx, [[L.h.x, L.h.y, thW], [t1x, t1y, thW * 0.96], [t2x, t2y, thW * 0.8], [L.kn.x, L.kn.y, knW], [cx, cy, 7.3 * u * lw], [c2x, c2y, 4.8 * u * lw], [L.an.x, L.an.y, 3.6 * u]], sk, back ? 0 : 1);
    if (!back) limb(ctx, L.kn.x - 0.7 * u, L.kn.y - 0.4 * u, L.kn.x + 0.7 * u, L.kn.y - 0.4 * u, 1.3 * u, 1.3 * u, skinD); // kneecap
    if (b.legSleeve && (b.legSleeve > 0) === !back) { limb(ctx, L.h.x + (L.kn.x - L.h.x) * 0.55, L.h.y + (L.kn.y - L.h.y) * 0.55, L.kn.x, L.kn.y, 7.4 * u * lw, 5.8 * u * lw, back ? '#161616' : '#222'); limb(ctx, L.kn.x, L.kn.y, cx, cy, 5.8 * u * lw, 6.4 * u * lw, back ? '#161616' : '#222'); limb(ctx, cx, cy, L.an.x, L.an.y, 6.4 * u * lw, 4.2 * u, back ? '#161616' : '#222'); }
    if (b.tights) { const tc = back ? shade(b.tights, 0.8) : b.tights; smoothLimb(ctx, [[L.h.x, L.h.y, thW * 1.03], [t1x, t1y, thW], [L.kn.x, L.kn.y, knW * 1.06], [cx, cy, 7.1 * u * lw], [L.an.x, L.an.y - 1.5 * u, 4.2 * u]], tc, back ? 0 : 1); }
    if (b.knee) limb(ctx, L.kn.x, L.kn.y - 1.2 * u, L.kn.x + Math.sin(L.sa) * 4 * u * f * sx, L.kn.y + 4 * u, 6.4 * u, 5.8 * u, back ? '#222' : '#333');
    // socks (tube socks with stripes in the early years)
    const sockH = (b.sockH ?? 6) * u;
    const sxk = L.an.x - Math.sin(L.sa) * sockH * f * sx, syk = L.an.y - Math.cos(L.sa) * sockH;
    const sc = b.teamSocks ? k.jersey === '#f4f4f4' || k.jersey === '#ffffff' ? k.trim : k.jersey : b.socks ?? '#f2f2f2';
    { const scol = sc === '#f2f2f2' || sc === '#f4f4f4' ? '#e6e6e3' : sc; limb(ctx, sxk, syk, L.an.x, L.an.y, 4.1 * u * Math.min(1.12, lw), 3.7 * u, back ? shade(scol, 0.86) : scol); limb(ctx, sxk - 2 * u, syk + 0.3 * u, sxk + 2 * u, syk + 0.3 * u, 0.6 * u, 0.6 * u, shade(scol, 0.82)); }   // the sock, a ribbed cuff on top
    if (sockH > 9 * u) for (const t of [0.12, 0.3]) { const yy = syk + (L.an.y - syk) * t, xx = sxk + (L.an.x - sxk) * t; limb(ctx, xx - 2.3 * u, yy, xx + 2.3 * u, yy, 1.1 * u, 1.1 * u, t < 0.2 ? k.trim : k.trim2 === '#ffffff' ? k.trim : shade(k.trim, 0.7)); }
    // shoe: upper, toe cap, sole, laces, accent stripe
    const shoe = b.shoe ?? '#f4f4f4';
    const dir = side ? f : (L === LA ? 0.35 : -0.35) * (view === 'back' ? -1 : 1);
    const len = side ? 6.6 * u : 3.8 * u;
    const toe = L.an.x + len * Math.sign(dir || 1) * (side ? 1 : Math.abs(dir) * 2.6), heel = L.an.x - (side ? 2.2 * u * f : 1.6 * u * Math.sign(dir || 1));
    const fy = L.an.y + 2.8 * u;
    const sh2 = back ? shade(shoe, 0.82) : shoe;
    const hiT = b.shoeHigh ? 2.4 * u : 0;   // a high-top's collar comes up over the ankle
    // the shoe's upper: a rounded heel counter, the collar, laces sloping down to a rounded toe box
    ctx.fillStyle = sh2; ctx.beginPath();
    if (side) {
      ctx.moveTo(heel, fy);
      ctx.quadraticCurveTo(heel - 0.6 * u * f, fy - 1.8 * u, heel + 0.2 * u * f, L.an.y - 0.8 * u - hiT);
      ctx.lineTo(L.an.x + 1.6 * u * f, L.an.y - 1.1 * u - hiT * 0.7);
      ctx.quadraticCurveTo(L.an.x + 3.4 * u * f, fy - 2.6 * u, toe - 0.4 * u * f, fy - 2.1 * u);
      ctx.quadraticCurveTo(toe + 0.9 * u * f, fy - 1.6 * u, toe + 0.5 * u * f, fy);
    } else {
      // from the front: the toe box, wider than the ankle, round on top
      ctx.moveTo(L.an.x - 2.9 * u, fy);
      ctx.lineTo(L.an.x - 2.5 * u, fy - 1.6 * u);
      ctx.quadraticCurveTo(L.an.x - 2.2 * u, L.an.y - 1.1 * u - hiT, L.an.x, L.an.y - 1.1 * u - hiT);
      ctx.quadraticCurveTo(L.an.x + 2.2 * u, L.an.y - 1.1 * u - hiT, L.an.x + 2.5 * u, fy - 1.6 * u);
      ctx.lineTo(L.an.x + 2.9 * u, fy);
    }
    ctx.closePath(); ctx.fill();
    if (!side && !back) limb(ctx, L.an.x - 1.6 * u, L.an.y - 0.9 * u - hiT, L.an.x + 1.6 * u, L.an.y - 0.9 * u - hiT, 0.5 * u, 0.5 * u, shade(shoe, 0.7));   // the collar, from the front
    const x0 = side ? Math.min(heel, toe) : L.an.x - 2.9 * u, w0 = side ? Math.abs(toe - heel) + 0.5 * u : 5.8 * u;
    rect(ctx, x0, fy - 1.5 * u, w0, 1.5 * u, back ? '#8e8e8e' : b.sole ?? (shoe === '#f4f4f4' ? '#d6d6d6' : '#ececec'));
    if (!back) rect(ctx, x0, fy - 1.5 * u, w0, 0.45 * u, shade(shoe, 0.7));   // the line where the upper meets the sole
    if (!back && side) limb(ctx, heel, L.an.y - 1 * u - hiT, L.an.x + 2 * u * f, L.an.y - 1.2 * u - hiT * 0.7, 0.6 * u, 0.6 * u, shade(shoe, 0.72));   // the collar
    if (!back && side) {
      limb(ctx, L.an.x + 0.4 * u * f, L.an.y - 0.6 * u, L.an.x + 2.6 * u * f, fy - 2.2 * u, 0.6 * u, 0.6 * u, shade(shoe, 0.6));
      limb(ctx, heel + 1.2 * u * f, fy - 2.2 * u, toe - 1.6 * u * f, fy - 1.6 * u, 0.9 * u, 0.9 * u, b.shoe2 ?? (shoe === '#f4f4f4' ? k.trim : '#f4f4f4'));
    }
  };
  const drawShorts = (L: typeof LA, back: boolean) => {
    const t = o.shorts;
    const ex = L.h.x + (L.kn.x - L.h.x) * t, ey = L.h.y + (L.kn.y - L.h.y) * t;
    const col = back ? shade(k.shorts, 0.82) : k.shorts;
    const w1 = (9.2 + 1.6 * t) * u * lw;
    // a leg of the shorts: square at the hem, a little flare, not a sack
    if (o.suit) limb(ctx, L.h.x, L.h.y - 1 * u, ex, ey, 9.6 * u * lw, w1, col);
    else { vquad(ctx, L.h.x, L.h.y - 2.2 * u, ex, ey, 10.2 * u * lw, w1, col, back ? 0 : 1); }
    if (o.suit) { limb(ctx, L.h.x, L.h.y, L.kn.x, L.kn.y, 6.4 * u * lw, 5.6 * u * lw, col); limb(ctx, L.kn.x, L.kn.y, L.an.x, L.an.y + 1.4 * u, 5.6 * u * lw, 5.2 * u * lw, col); return; }
    if (!back) {
      // side stripe, hem and a fold
      const ox = (side ? -f : (L === LA ? 1 : -1)) * w1 * 0.36;
      limb(ctx, L.h.x + ox, L.h.y, ex + ox, ey - 0.6 * u, 1.5 * u, 1.5 * u, k.trim);
      { const dl = Math.hypot(ex - L.h.x, ey - L.h.y) || 1, nx = -(ey - L.h.y) / dl, ny = (ex - L.h.x) / dl, bx = (ex - L.h.x) / dl, by = (ey - L.h.y) / dl;
        limb(ctx, ex + nx * w1 * 0.46 - bx * 0.6 * u, ey + ny * w1 * 0.46 - by * 0.6 * u, ex - nx * w1 * 0.46 - bx * 0.6 * u, ey - ny * w1 * 0.46 - by * 0.6 * u, 0.9 * u, 0.9 * u, shade(k.shorts, 0.72)); }   // the hem
      limb(ctx, L.h.x - ox * 0.4, L.h.y + 3 * u, ex - ox * 0.3, ey - 1.5 * u, 0.7 * u, 0.7 * u, shade(k.shorts, 0.86));
    }
  };
  const drawArm = (A: typeof AA, back: boolean) => {
    const sk = back ? skinD : skin;
    const w = 5.3 * u * lw;
    const sleeve = !!b.sleeve && ((b.sleeve > 0) === !back);
    const sc = o.suit ? (back ? shade(o.suit, 0.8) : o.suit) : sleeve ? (back ? '#1b1b1b' : '#262626') : sk;
    if (o.suit) {
      limb(ctx, A.s0.x, A.s0.y, A.el.x, A.el.y, w * 1.05, w * 0.8, sc);
      const mx = A.el.x + (A.ha.x - A.el.x) * 0.8, my = A.el.y + (A.ha.y - A.el.y) * 0.8;
      limb(ctx, A.el.x, A.el.y, mx, my, w * 0.85, w * 0.8, sc);
      limb(ctx, mx, my, A.ha.x, A.ha.y, w * 0.6, w * 0.55, sk);
      return;
    }
    // forearm: thicker near the elbow
    const mx = A.el.x + (A.ha.x - A.el.x) * 0.3, my = A.el.y + (A.ha.y - A.el.y) * 0.3;
    // shoulder – biceps – elbow – the forearm's belly – wrist, one smooth outline
    const at = (a: { x: number; y: number }, c: { x: number; y: number }, t: number) => [a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t];
    const [b1x, b1y] = at(A.s0, A.el, 0.4), [w1x, w1y] = at(A.el, A.ha, 0.86);
    smoothLimb(ctx, [[A.s0.x, A.s0.y, w * 1.1], [b1x, b1y, w * 1.08], [A.el.x, A.el.y, w * 0.72], [mx, my, w * 0.9], [w1x, w1y, w * 0.58], [A.ha.x, A.ha.y, w * 0.54]], sc, back || sleeve ? 0 : 1);
    // a T-shirt under the jersey: a short sleeve over the top of the arm
    if (b.tee) { const tx = A.s0.x + (A.el.x - A.s0.x) * 0.42, ty = A.s0.y + (A.el.y - A.s0.y) * 0.42; limb(ctx, A.s0.x, A.s0.y, tx, ty, w * 1.16, w * 1.08, back ? shade(b.tee, 0.82) : b.tee); }
    // kinesiology tape: two strips down the shoulder
    if (b.tape && !back && !b.tee) for (const o2 of [-0.18, 0.18]) { const ox = (A.el.y - A.s0.y) / Lu * w * o2, oy = -(A.el.x - A.s0.x) / Lu * w * o2; limb(ctx, A.s0.x + ox, A.s0.y + oy, A.s0.x + (A.el.x - A.s0.x) * 0.5 + ox, A.s0.y + (A.el.y - A.s0.y) * 0.5 + oy, 0.7 * u, 0.7 * u, b.tape); }
    if (b.tat && !sleeve && (b.tat >= 2 || !back)) {
      // ink: a sleeve of tattoos over the upper arm (and the forearm for a full sleeve) – a shaded patch with line work
      const ink = shade(skin, 0.58), line = shade(skin, 0.4);
      const P = (a: { x: number; y: number }, c: { x: number; y: number }, t: number) => ({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t });
      ctx.save(); ctx.globalAlpha = 0.5;
      { const a = P(A.s0, A.el, 0.22), c = P(A.s0, A.el, 0.92); limb(ctx, a.x, a.y, c.x, c.y, w * 0.86, w * 0.7, ink); }
      if (b.tat >= 2) { const a = P(A.el, A.ha, 0.1), c = P(A.el, A.ha, 0.7); limb(ctx, a.x, a.y, c.x, c.y, w * 0.7, w * 0.6, ink); }
      ctx.restore();
      void line;
    }
    if (b.wrist) { const wx = A.el.x + (A.ha.x - A.el.x) * 0.8, wy = A.el.y + (A.ha.y - A.el.y) * 0.8; limb(ctx, wx, wy, A.ha.x - (A.ha.x - A.el.x) * 0.1, A.ha.y - (A.ha.y - A.el.y) * 0.1, w * 0.86, w * 0.86, k.trim); }
    // hand with fingers toward the end of the forearm
    // the hand: a palm along the forearm, the fingers beyond it, the thumb to the side
    const fl = Math.hypot(A.ha.x - A.el.x, A.ha.y - A.el.y) || 1, dx = (A.ha.x - A.el.x) / fl, dy = (A.ha.y - A.el.y) / fl, ang = Math.atan2(dy, dx);
    const hc0 = back ? skinD : skin, hcS = back ? shade(skinD, 0.9) : shade(skin, 0.86);
    const E = (cx2: number, cy2: number, rx2: number, ry2: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx2, cy2, rx2, ry2, ang, 0, Math.PI * 2); ctx.fill(); };
    const hx2 = A.ha.x + dx * 3.1 * u, hy2 = A.ha.y + dy * 3.1 * u;
    { const tx = -dy * (side ? f : 1), ty = dx * (side ? f : 1); E(A.ha.x + dx * 1.2 * u + tx * 0.9 * u, A.ha.y + dy * 1.2 * u + ty * 0.9 * u, 0.85 * u, 0.5 * u, hcS); }
    E(A.ha.x + dx * 1.7 * u, A.ha.y + dy * 1.7 * u, 2.3 * u, 1.3 * u, hc0);
    if (!back) E(A.ha.x + dx * 2.6 * u, A.ha.y + dy * 2.6 * u, 1.2 * u, 1.05 * u, shade(skin, 0.93));
    if (b.fingerTape && !back) E(hx2 + dx * 0.4 * u, hy2 + dy * 0.4 * u, 1.0 * u, 0.5 * u, '#f2f2f2');
  };
  const drawTorso = () => {
    const s1 = shoulder(1), s2 = shoulder(-1);
    const lit = side ? (f > 0 ? s2 : s1) : (s1.x < s2.x ? s1 : s2);
    // the trapezius sloping from the neck to the shoulders, then the deltoids (the jersey straps sit on them)
    if (view !== 'back' || true) for (const S0 of [s1, s2]) {
      const dir = Math.sign(S0.x - sh.x) || 1;
      poly(ctx, [[sh.x + dir * 2.2 * u, sh.y - 3.4 * u], [S0.x - dir * 0.5 * u, S0.y - 1.3 * u], [S0.x, S0.y + 1.2 * u], [sh.x, sh.y + 1.2 * u]], S0 === lit ? skin : skinD);
    }
    oval(ctx, s1.x, s1.y + 0.9 * u, 3.1 * u * lw, 3.2 * u, s1 === lit ? skin : skinD);
    oval(ctx, s2.x, s2.y + 0.9 * u, 3.1 * u * lw, 3.2 * u, s2 === lit ? skin : skinD);
    if (!FLAT) { const L0 = lit; oval(ctx, L0.x - 0.6 * u, L0.y, 1.6 * u, 1.3 * u, skinL); }
    const wl = { x: hipC.x - hipW / 2, y: hipC.y - 1 * u }, wr = { x: hipC.x + hipW / 2, y: hipC.y - 1 * u };
    const tl = { x: sh.x - shW / 2 + 3 * u, y: sh.y - 0.5 * u }, tr = { x: sh.x + shW / 2 - 3 * u, y: sh.y - 0.5 * u };
    const al = { x: sh.x - shW / 2 + 1.2 * u, y: sh.y + 7.5 * u }, ar = { x: sh.x + shW / 2 - 1.2 * u, y: sh.y + 7.5 * u };
    // the jersey lit from the upper left: a soft gradient across the chest (flat in the floor reflection)
    if (!FLAT) {
      const gx = ctx.createLinearGradient(sh.x - shW / 2, sh.y, sh.x + shW / 2, hipC.y);
      gx.addColorStop(0, shade(k.jersey, 1.07)); gx.addColorStop(0.55, k.jersey); gx.addColorStop(1, shade(k.jersey, 0.86));
      // the jersey: straps over the shoulders, armholes cut in a curve, the sides falling straight from the lats
      ctx.fillStyle = gx; ctx.beginPath();
      ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
      ctx.quadraticCurveTo(tr.x - 0.6 * u, ar.y - 2.4 * u, ar.x, ar.y);
      ctx.quadraticCurveTo(ar.x + 0.3 * u, (ar.y + wr.y) / 2, wr.x + 0.6 * u, wr.y + 1.5 * u);
      ctx.lineTo(wl.x - 0.6 * u, wl.y + 1.5 * u);
      ctx.quadraticCurveTo(al.x - 0.3 * u, (al.y + wl.y) / 2, al.x, al.y);
      ctx.quadraticCurveTo(tl.x + 0.6 * u, al.y - 2.4 * u, tl.x, tl.y);
      ctx.closePath(); ctx.fill();
    } else poly(ctx, [[tl.x, tl.y], [tr.x, tr.y], [ar.x, ar.y], [wr.x + 0.6 * u, wr.y + 1.5 * u], [wl.x - 0.6 * u, wl.y + 1.5 * u], [al.x, al.y]], k.jersey);
    // light from the upper left: shade the right side, highlight the left, folds at the waist
    const dark = shade(k.jersey, 0.8), light = shade(k.jersey, 1.08);
    poly(ctx, [[tr.x - 1.2 * u, tr.y + 1], [ar.x, ar.y], [wr.x + 0.6 * u, wr.y + 1.5 * u], [wr.x - 2.6 * u, wr.y + 1.5 * u], [ar.x - 3.2 * u, ar.y + 2 * u], [tr.x - 2.6 * u, tr.y + 1]], dark);
    limb(ctx, al.x + 2 * u, al.y + 1 * u, wl.x + 2 * u, wl.y - 2 * u, 1.2 * u, 1.2 * u, light);
    for (const t of [0.35, 0.62]) limb(ctx, wl.x + hipW * t, wl.y - 6 * u, wl.x + hipW * t + 0.8 * u, wl.y + 0.5 * u, 0.6 * u, 0.6 * u, dark);
    // armholes, collar
    limb(ctx, tl.x, tl.y, al.x, al.y, 1.4 * u, 1.4 * u, k.trim);
    limb(ctx, tr.x, tr.y, ar.x, ar.y, 1.4 * u, 1.4 * u, k.trim);
    const nx = sh.x + (side ? 0.8 * u * f : 0);
    if (view !== 'back') {
      oval(ctx, nx, sh.y + 0.5 * u, 2.8 * u, 3.4 * u, skinD, -1e9, sh.y + 3.8 * u);
      limb(ctx, nx - 3.4 * u, sh.y - 0.3 * u, nx, sh.y + 4.8 * u, 1.4 * u, 1.4 * u, k.trim);
      limb(ctx, nx + 3.4 * u, sh.y - 0.3 * u, nx, sh.y + 4.8 * u, 1.4 * u, 1.4 * u, k.trim);
    } else limb(ctx, nx - 3.6 * u, sh.y, nx + 3.6 * u, sh.y, 1.4 * u, 1.4 * u, k.trim);
    // waistband
    limb(ctx, wl.x - 0.6 * u, wl.y + 1.4 * u, wr.x + 0.6 * u, wr.y + 1.4 * u, 2.6 * u, 2.6 * u, k.shorts);
    limb(ctx, wl.x - 0.6 * u, wl.y + 0.4 * u, wr.x + 0.6 * u, wr.y + 0.4 * u, 0.7 * u, 0.7 * u, k.trim);
    // number (and the name on the back)
    if (o.num !== false && pose !== 'sit') {
      const big = view === 'back';
      const ty = sh.y + (big ? 15 : 13) * u + Math.sin(lean) * 2 * u;
      const tx = sh.x + (side ? 1.5 * u * f : 0);
      const fs = Math.max(8, R((big ? 13.5 : 11) * u));
      ctx.font = `800 ${fs}px "IBM Plex Sans", "Arial Narrow", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = k.trim2; ctx.fillText(String(b.num), R(tx + Math.max(1, u * 0.7)), R(ty + Math.max(1, u * 0.7)));
      ctx.fillStyle = k.trim; ctx.fillText(String(b.num), R(tx), R(ty));
      if (big && o.name) { ctx.font = `${Math.max(6, R(3.6 * u))}px ${o.font}`; ctx.fillStyle = k.trim; ctx.fillText(o.name, R(tx), R(sh.y + 6.2 * u)); }
    }
  };

  // ---- draw back to front
  if (side) {
    drawArm(AB, true);
    drawLeg(LB, true);
    drawShorts(LB, true);
    drawLeg(LA, false);
    drawTorso();
    drawShorts(LA, false);
  } else {
    drawLeg(LB, false); drawLeg(LA, false);
    drawShorts(LB, false); drawShorts(LA, false);
    drawTorso();
  }
  // neck and head
  smoothLimb(ctx, [[sh.x + (side ? 0.5 * u * f : 0), sh.y + 1 * u, 5.6 * u], [head.x + (side ? -0.3 * u * f : 0), head.y + 5 * u, 4.4 * u]], skinD, 0);
  if (view !== 'back') limb(ctx, sh.x + (side ? 1.4 * u * f : 0), sh.y, head.x + (side ? 1.4 * u * f : 0), head.y + 5 * u, 1.1 * u, 1.1 * u, skinDD);
  if (b.tee && view !== 'back') limb(ctx, sh.x - 2.6 * u, sh.y + 0.4 * u, sh.x + 2.6 * u, sh.y + 0.4 * u, 1.2 * u, 1.2 * u, b.tee);
  if (b.neckTat && view !== 'back') { const ink = shade(skin, 0.55); oval(ctx, sh.x + (side ? 1.2 * u * f : 1.2 * u), sh.y - 1.6 * u, 1.1 * u, 0.9 * u, ink); oval(ctx, sh.x + (side ? 0.2 * u * f : -1.4 * u), sh.y - 2.6 * u, 0.7 * u, 0.6 * u, ink); }
  drawHead(ctx, head.x, head.y, uh, f, b, skin, skinD, skinL, k, view);
  if (side) drawArm(AA, false); else { drawArm(AB, false); drawArm(AA, false); }
  return { front: AA.ha, back: AB.ha, head: { x: head.x, y: head.y - 8 * uh } };
}

function drawHead(ctx: Ctx, cx: number, cy: number, u: number, f: number, b: Body, skin: string, skinD: string, skinL: string, k: Kit, view: 'side' | 'front' | 'back') {
  // a human head: a skull a little taller than wide, a jaw that narrows to the chin, the face lit from the upper left
  const rx = 5.5 * u, ry = 6.6 * u;
  const hc = b.hairColor, hcL = shade(hc, 1.35), hcD = shade(hc, 0.72);
  const style = b.hair;
  const side = view === 'side', back = view === 'back';
  const fx = side ? f : 0;                                   // which way the face points
  const jw = 0.82 + 0.12 * (b.build ?? 0.5);                 // a heavier man has a heavier jaw
  const shadow = shade(skin, 0.84), deep = shade(skin, 0.7), hi = shade(skin, 1.09);
  // hair mass behind the head
  if (style === 'afro' || style === 'fro') oval(ctx, cx - 0.6 * u * fx, cy - 2.4 * u, rx + 2.6 * u, ry + 1.2 * u, hc);
  if (style === 'dreads') for (let i = 0; i < 7; i++) { const sxx = side ? -f * (1.2 + i * 0.85) : (i - 3) * 1.8; limb(ctx, cx + sxx * u, cy - 3 * u, cx + sxx * 1.12 * u, cy + (5.5 + (i % 3) * 1.6) * u, 1.6 * u, 1.3 * u, i % 2 ? hcD : hc); }
  // the skull and the jaw (one path), filled, then the shadow side clipped from it
  const head = () => {
    ctx.beginPath();
    if (side) {
      const F = (x: number) => cx + f * x;
      ctx.moveTo(F(-rx * 0.95), cy - 0.5 * u);
      ctx.bezierCurveTo(F(-rx * 1.05), cy - ry * 1.15, F(rx * 0.95), cy - ry * 1.2, F(rx * 0.98), cy - 2.2 * u);   // crown to brow
      ctx.lineTo(F(rx * 0.92), cy - 0.6 * u);                                                                    // the eye socket
      ctx.lineTo(F(rx + 1.5 * u), cy + 2.1 * u);                                                                 // the nose tip
      ctx.lineTo(F(rx * 0.98), cy + 2.6 * u);
      ctx.lineTo(F(rx * 1.02), cy + 4.4 * u);                                                                    // the lips
      ctx.lineTo(F(rx * 0.86 * jw), cy + 5.9 * u);                                                               // the chin
      ctx.quadraticCurveTo(F(rx * 0.2), cy + 6.4 * u, F(-rx * 0.35), cy + 4.6 * u);                              // under the jaw to its angle
      ctx.lineTo(F(-rx * 0.62), cy + 1.6 * u);
      ctx.closePath();
    } else {
      ctx.moveTo(cx - rx, cy - 0.4 * u);
      ctx.bezierCurveTo(cx - rx * 1.02, cy - ry * 1.22, cx + rx * 1.02, cy - ry * 1.22, cx + rx, cy - 0.4 * u);
      ctx.bezierCurveTo(cx + rx * 0.98, cy + 2.4 * u, cx + rx * 0.8 * jw, cy + 4.6 * u, cx + 1.6 * u, cy + 6.3 * u);
      ctx.quadraticCurveTo(cx, cy + 6.8 * u, cx - 1.6 * u, cy + 6.3 * u);
      ctx.bezierCurveTo(cx - rx * 0.8 * jw, cy + 4.6 * u, cx - rx * 0.98, cy + 2.4 * u, cx - rx, cy - 0.4 * u);
      ctx.closePath();
    }
  };
  head(); ctx.fillStyle = skin; ctx.fill();
  ctx.save(); head(); ctx.clip();
  if (back) { ctx.fillStyle = shadow; ctx.fillRect(cx, cy - ry * 1.4, rx * 1.3, ry * 2.6); }
  else if (side) {
    // the far side of the skull and under the cheekbone in shadow, the forehead and the cheek catching the light
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(cx - f * rx * 0.55, cy + 1 * u, rx * 0.75, ry * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    oval(ctx, cx + f * rx * 0.35, cy + 2.6 * u, rx * 0.42, 1.2 * u, shade(skin, 0.92));
    oval(ctx, cx + f * rx * 0.45, cy - 3.6 * u, rx * 0.4, 1.3 * u, hi);
    oval(ctx, cx + f * rx * 0.55, cy + 1.2 * u, 1.3 * u, 0.9 * u, hi);
  } else {
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(cx + rx * 0.95, cy + 0.6 * u, rx * 0.55, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    oval(ctx, cx - rx * 0.35, cy - 3.8 * u, rx * 0.42, 1.3 * u, hi);                  // forehead
    oval(ctx, cx - rx * 0.5, cy + 1.6 * u, 1.3 * u, 1.0 * u, hi);                     // cheekbone
    oval(ctx, cx + rx * 0.45, cy + 2.8 * u, 1.3 * u, 1.6 * u, shade(skin, 0.9));      // under the far cheekbone
    oval(ctx, cx, cy + 6.4 * u, 1.9 * u, 0.6 * u, shade(skin, 0.9));                  // under the chin
  }
  ctx.restore();
  // ears
  if (side) { oval(ctx, cx - f * 1.4 * u, cy + 0.9 * u, 1.15 * u, 1.85 * u, shadow); oval(ctx, cx - f * 1.3 * u, cy + 1.0 * u, 0.5 * u, 0.95 * u, deep); }
  else if (!back) { oval(ctx, cx - rx - 0.2 * u, cy + 0.8 * u, 1.0 * u, 1.75 * u, skin); oval(ctx, cx + rx + 0.2 * u, cy + 0.8 * u, 1.0 * u, 1.75 * u, shadow); }
  else { oval(ctx, cx - rx - 0.2 * u, cy + 0.8 * u, 1.0 * u, 1.75 * u, shadow); oval(ctx, cx + rx + 0.2 * u, cy + 0.8 * u, 1.0 * u, 1.75 * u, shadow); }
  // hair: a cap following the skull down to the hairline (over the ears at the back and the sides)
  const cap = (lift: number, line: number, temple = 1) => {
    if (back) { oval(ctx, cx, cy - lift - 0.6 * u, rx + 0.35 * u, ry + 0.3 * u, hc, -1e9, cy + 2.4 * u); return; }
    oval(ctx, cx - fx * 0.3 * u, cy - lift - 0.6 * u, rx + 0.35 * u, ry + 0.3 * u, hc, -1e9, cy - line);
    if (side) oval(ctx, cx, cy - lift - 0.6 * u, rx + 0.35 * u, ry + 0.3 * u, hc, -1e9, cy - 0.2 * u, f > 0 ? -1e9 : cx + 1.4 * u, f > 0 ? cx - 1.4 * u : 1e9);
    else if (temple) { oval(ctx, cx - rx + 0.5 * u, cy - 1.3 * u, 0.9 * u, 2.0 * u, hc); oval(ctx, cx + rx - 0.5 * u, cy - 1.3 * u, 0.9 * u, 2.0 * u, hc); }
    // a sheen where the light hits the hair
    oval(ctx, cx - (side ? -f * 0.6 : 1.6) * u, cy - ry * 0.95, rx * 0.4, 0.7 * u, hcL, -1e9, 1e9);
  };
  const clumps = (n: number, r: number) => { for (let i = 0; i < n; i++) { const a = Math.PI * (0.1 + 0.8 * i / (n - 1)); oval(ctx, cx - Math.cos(a) * (rx + 1.2 * u) - fx * 0.5 * u, cy - 2 * u - Math.sin(a) * (ry + 0.6 * u), r * u, r * 0.9 * u, i % 2 ? hcD : hc); } };
  switch (style) {
    case 'bald': oval(ctx, cx - (fx || -0.6) * 1.4 * u, cy - 4.9 * u, 1.8 * u, 0.8 * u, hi); break;
    case 'afro': case 'fro': oval(ctx, cx, cy - 1.8 * u, rx + 1.4 * u, ry + 0.4 * u, hc, -1e9, back ? cy + 3 * u : cy - 2.6 * u); clumps(7, 1.5); break;
    case 'dreads': cap(0.5 * u, 2.4 * u); for (let i = 0; i < 5; i++) limb(ctx, cx + (i - 2) * 2 * u, cy - ry - 0.2 * u, cx + (i - 2) * 2.2 * u - fx * 1.2 * u, cy - 3 * u, 0.6 * u, 0.6 * u, hcD); break;
    case 'cornrows': cap(-0.1 * u, 3.2 * u); for (let i = -2; i <= 2; i++) limb(ctx, cx + i * 1.6 * u, cy - 6.6 * u, cx + i * 1.9 * u - fx * 1.5 * u, cy - 1.8 * u, 0.45 * u, 0.45 * u, hcL); break;
    case 'flattop': cap(0, 3 * u); ctx.fillStyle = hc; ctx.fillRect(cx - rx * 0.92, cy - ry - 2.6 * u, rx * 1.84, 3.4 * u); oval(ctx, cx, cy - ry - 2.5 * u, rx * 0.9, 0.5 * u, hcL); break;
    case 'spiky': case 'quiff': cap(0.6 * u, 2.8 * u); for (let i = 0; i < 4; i++) limb(ctx, cx + (i - 1.5) * 2 * u, cy - ry + 0.6 * u, cx + (i - 1.2) * 2 * u + fx * 1.1 * u, cy - ry - 1.8 * u, 1.6 * u, 0.6 * u, i % 2 ? hcL : hc); break;
    case 'bun': cap(0, 3 * u); oval(ctx, cx - fx * 1.6 * u, cy - ry - 1.4 * u, 2.2 * u, 2 * u, hc); oval(ctx, cx - fx * 2 * u, cy - ry - 1.9 * u, 0.8 * u, 0.6 * u, hcL); break;
    case 'mop': case 'curly': cap(0.7 * u, 2.2 * u); clumps(6, 1.3); break;
    case 'parted': cap(0.3 * u, 2.8 * u); limb(ctx, cx + (fx || 0.4) * 1.4 * u, cy - ry - 0.4 * u, cx + (fx || 0.4) * 0.6 * u, cy - ry + 2.2 * u, 0.4 * u, 0.4 * u, back ? hcD : shade(hc, 1.6)); break;
    case 'buzz': case 'fade': {
      // short on top, faded to skin on the sides
      cap(-0.3 * u, 3.4 * u, 0);
      if (!back) {
        // the faded sides: a shadow of hair over the temples and above the ears, never across the face
        ctx.save(); ctx.globalAlpha = 0.45;
        if (side) oval(ctx, cx - f * rx * 0.3, cy - 0.9 * u, rx * 0.75, ry * 0.5, hc, cy - 2.6 * u, cy + 0.4 * u, f > 0 ? -1e9 : cx + 0.6 * u, f > 0 ? cx - 0.6 * u : 1e9);
        else { oval(ctx, cx - rx * 0.9, cy - 1 * u, 0.9 * u, 1.8 * u, hc); oval(ctx, cx + rx * 0.9, cy - 1 * u, 0.9 * u, 1.8 * u, hc); }
        ctx.restore();
      }
      break;
    }
    default: cap(0.2 * u, 3 * u);
  }
  if (b.tips && !['bald', 'buzz', 'fade'].includes(style)) oval(ctx, cx, cy - ry * 0.8, rx * 0.85, ry * 0.32, b.tips, -1e9, cy - ry * 0.6);
  if (b.band) {
    const bc = b.bandColor === 'team' ? (k.jersey === '#f4f4f4' || k.jersey === '#ffffff' ? k.trim : k.jersey) : b.bandColor ?? '#f4f4f4';
    limb(ctx, cx - rx - 0.2 * u, cy - 3.3 * u, cx + rx + 0.2 * u, cy - 3.3 * u, 1.7 * u, 1.7 * u, bc);
    if (b.ninja) { const bx = side ? cx - f * (rx + 0.2 * u) : cx + (back ? 0 : rx * 0.9); limb(ctx, bx, cy - 3.3 * u, bx - (side ? f : 0.4) * 2.6 * u, cy - 0.6 * u, 1.0 * u, 0.6 * u, bc); limb(ctx, bx, cy - 3.3 * u, bx - (side ? f : 0.4) * 1.8 * u, cy + 0.4 * u, 0.9 * u, 0.5 * u, shade(bc, 0.85)); }
  }
  if (back) return;
  // the face: brows, almond eyes under a shadowed brow, the nose by its shading, lips
  const brow = shade(hc === '#9a9a9a' ? '#5a5a5a' : hc, 0.8);
  const eye = (ex: number, w = 1, far = false) => {
    oval(ctx, ex, cy - 0.5 * u, 1.35 * u * w, 0.8 * u, far ? deep : shadow);                    // the socket
    oval(ctx, ex, cy - 0.1 * u, 0.95 * u * w, 0.48 * u, '#f1ebe2');                              // the white
    const ix = ex + (side ? f * 0.3 * u : 0.05 * u);
    oval(ctx, ix, cy - 0.1 * u, 0.5 * u * w, 0.5 * u, '#2b1a10');                               // the iris
    limb(ctx, ex - 1.0 * u * w, cy - 0.45 * u, ex + 1.0 * u * w, cy - 0.5 * u, 0.42 * u, 0.36 * u, shade(skin, 0.45));   // upper lid
    rect(ctx, ix - 0.25 * u, cy - 0.35 * u, 0.22 * u, 0.22 * u, '#ffffff');                     // a catch-light
    limb(ctx, ex - (side ? f * 1.1 : 1.3) * u * w, cy - 1.55 * u, ex + (side ? f * 1.2 : 1.3) * u * w, cy - (side ? 1.9 : 1.75) * u, 0.75 * u, 0.5 * u, brow);
  };
  if (side) eye(cx + f * 3.4 * u, 0.8); else { eye(cx - 2.2 * u); eye(cx + 2.2 * u, 1, true); }
  if (b.goggles) { limb(ctx, cx - rx, cy - 0.3 * u, cx + rx, cy - 0.3 * u, 2.6 * u, 2.6 * u, '#1d1d22'); if (side) oval(ctx, cx + f * 3.3 * u, cy - 0.3 * u, 1.6 * u, 1.3 * u, '#7fb6d9'); else { oval(ctx, cx - 2.2 * u, cy - 0.3 * u, 1.55 * u, 1.25 * u, '#7fb6d9'); oval(ctx, cx + 2.2 * u, cy - 0.3 * u, 1.55 * u, 1.25 * u, '#7fb6d9'); } }
  // nose: a lit bridge, a shadow down its far side, nostrils
  if (side) { oval(ctx, cx + f * (rx + 0.5 * u), cy + 2.3 * u, 0.6 * u, 0.4 * u, deep); limb(ctx, cx + f * (rx - 0.2 * u), cy - 0.2 * u, cx + f * (rx + 0.9 * u), cy + 1.7 * u, 0.4 * u, 0.4 * u, hi); }
  else {
    limb(ctx, cx - 0.2 * u, cy - 0.2 * u, cx - 0.3 * u, cy + 1.9 * u, 0.45 * u, 0.55 * u, hi);
    limb(ctx, cx + 0.6 * u, cy + 0.2 * u, cx + 0.9 * u, cy + 2.1 * u, 0.6 * u, 0.8 * u, shadow);
    oval(ctx, cx - 0.7 * u, cy + 2.45 * u, 0.42 * u, 0.26 * u, deep); oval(ctx, cx + 0.7 * u, cy + 2.45 * u, 0.42 * u, 0.26 * u, deep);
  }
  const fac = b.facial;
  const mx = side ? cx + f * (rx - 0.2 * u) : cx, mw = side ? 1.2 * u : 2.0 * u, my = cy + 3.9 * u;
  // facial hair follows the jaw (clipped to the head's outline)
  ctx.save(); head(); ctx.clip();
  if (fac === 'beard' || fac === 'longbeard') {
    ctx.fillStyle = hc; ctx.beginPath();
    if (side) { ctx.moveTo(cx - f * rx * 0.2, cy + 0.6 * u); ctx.lineTo(cx + f * rx * 0.6, cy + 2.2 * u); ctx.lineTo(cx + f * rx * 1.2, cy + 3.2 * u); ctx.lineTo(cx + f * rx * 1.2, cy + 9 * u); ctx.lineTo(cx - f * rx * 0.8, cy + 9 * u); ctx.closePath(); }
    else { ctx.moveTo(cx - rx * 1.1, cy + 0.6 * u); ctx.lineTo(cx - rx * 0.55, cy + 2.4 * u); ctx.lineTo(cx + rx * 0.55, cy + 2.4 * u); ctx.lineTo(cx + rx * 1.1, cy + 0.6 * u); ctx.lineTo(cx + rx * 1.1, cy + 9 * u); ctx.lineTo(cx - rx * 1.1, cy + 9 * u); ctx.closePath(); }
    ctx.fill();
    oval(ctx, mx, my + 0.3 * u, mw * 0.9, 0.9 * u, shade(skin, 0.75));   // the mouth shows through
  } else if (fac === 'stubble') { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = hc; ctx.fillRect(cx - rx * 1.2, cy + 2.4 * u, rx * 2.4, 6 * u); ctx.restore(); }
  ctx.restore();
  if (fac === 'longbeard') { ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(cx + fx * 1.4 * u, cy + 6.4 * u, (side ? 2.6 : 3.4) * u, 2.2 * u, 0, 0, Math.PI * 2); ctx.fill(); }
  if (fac === 'goatee' || fac === 'chin') oval(ctx, cx + fx * (rx * 0.75), cy + 5.5 * u, 1.5 * u, 1.2 * u, hc);
  if (fac === 'mustache' || fac === 'goatee' || fac === 'beard' || fac === 'longbeard') limb(ctx, mx - mw * 0.7, my - 0.5 * u, mx + mw * 0.7, my - 0.5 * u, 0.7 * u, 0.7 * u, hc);
  // lips: a dark line between them, a fuller lower lip in light
  const lipD = shade(skin, 0.55), lipL = mixHex(shade(skin, 0.86), '#b8605a', 0.22);
  oval(ctx, mx, my + 0.55 * u, mw * 0.5, 0.36 * u, lipL);
  limb(ctx, mx - mw * 0.55, my + 0.15 * u, mx + mw * 0.55, my + 0.15 * u, 0.32 * u, 0.32 * u, lipD);
  if (b.mouthguard) oval(ctx, mx + (side ? f * mw * 0.5 : mw * 0.5), my + 0.3 * u, 0.8 * u, 0.5 * u, '#f6f6f2');
}

const mixHex = (a: string, b: string, t: number) => {
  if (!a.startsWith('#') || !b.startsWith('#')) return a;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** The player with a dark pixel outline (drawn through an off-screen buffer). */
let bufA: HTMLCanvasElement | null = null, bufB: HTMLCanvasElement | null = null;
export function drawAthleteOutlined(ctx: Ctx, X: number, Y: number, o: AthOpts, line = 'rgba(20,14,12,0.62)'): Hands {
  if (typeof document === 'undefined') return drawAthlete(ctx, X, Y, o);
  const W = Math.ceil(o.H * (o.crisp ? 2.2 : 1.4)) + 8, Hh = Math.ceil(o.H * (o.crisp ? 1.9 : 1.45)) + 8;
  if (!bufA) { bufA = document.createElement('canvas'); bufB = document.createElement('canvas'); }
  for (const c of [bufA, bufB!]) if (c.width < W || c.height < Hh) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, Hh); }
  const a = bufA.getContext('2d')!, bb = bufB!.getContext('2d')!;
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, W, Hh);
  const ox = Math.round(W / 2), oy = Hh - 4;
  const fx = X - Math.round(X), fy = Y - Math.round(Y);
  let hands: Hands;
  if (o.crisp) { a.save(); a.translate(ox + fx, 0); a.scale(1.18, 1); hands = drawAthlete(a, 0, oy + fy, o); a.restore(); const wx = (p: { x: number; y: number }) => ({ x: ox + fx + p.x * 1.18, y: p.y }); hands = { front: wx(hands.front), back: wx(hands.back), head: wx(hands.head) }; }
  else hands = drawAthlete(a, ox + fx, oy + fy, o);
  if (o.crisp) {
    // pixel art: every pixel either there or not (no soft anti-aliased edges)
    const im = a.getImageData(0, 0, W, Hh), px = im.data;
    for (let i = 3; i < px.length; i += 4) px[i] = px[i] < 110 ? 0 : 255;
    a.putImageData(im, 0, 0);
  }
  bb.setTransform(1, 0, 0, 1, 0, 0); bb.globalCompositeOperation = 'source-over'; bb.clearRect(0, 0, W, Hh);
  bb.drawImage(bufA, 0, 0);
  bb.globalCompositeOperation = 'source-in'; bb.fillStyle = line; bb.fillRect(0, 0, W, Hh);
  bb.globalCompositeOperation = 'source-over';
  const x0 = Math.round(X) - ox, y0 = Math.round(Y) - oy;
  const t = Math.max(1, Math.round(o.H / 130));   // a fine contour, not a cartoon's ink line
  for (const [dx, dy] of [[-t, 0], [t, 0], [0, -t], [0, t]]) ctx.drawImage(bufB!, 0, 0, W, Hh, x0 + dx, y0 + dy, W, Hh);
  ctx.drawImage(bufA, 0, 0, W, Hh, x0, y0, W, Hh);
  const sh = (p: { x: number; y: number }) => ({ x: p.x + x0, y: p.y + y0 });
  return { front: sh(hands.front), back: sh(hands.back), head: sh(hands.head) };
}
