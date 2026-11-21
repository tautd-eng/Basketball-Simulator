// E further: three levels of polish on the athletic HD look, drawn large.
import { drawAthleteOutlined as draw } from '../src/ui/athlete';
const W = 1600, ROWH = 400, rows = ['E · kaip buvo', 'E1 · didesnė raiška, glotniau', 'E2 · arenos šviesa (šilta priekyje, šalta iš nugaros)', 'E3 · + blizgesys ir raumenų reljefas'];
const c = document.createElement('canvas'); c.width = W; c.height = ROWH * rows.length; document.body.appendChild(c);
const g = c.getContext('2d')!;
const kits = [{ jersey: '#f4f4f2', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f2' }, { jersey: '#5d76a9', trim: '#12173f', trim2: '#2a3560', shorts: '#5d76a9' }, { jersey: '#ce1141', trim: '#000000', trim2: '#ffffff', shorts: '#ce1141' }];
const B: any[] = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'longbeard', band: false, num: 13, ht: 78, build: 0.4, tat: 2 },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', band: false, num: 30, ht: 75, build: 0.3 },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', band: true, num: 23, ht: 81, build: 0.6 },
];
const shots: [string, any][] = [['dribble', { view: 'side', ph: 1.2, amp: 0.9, face: 1 }], ['shoot', { view: 'front', ph: 0, amp: 0, face: 1, t: 0.3 }], ['stance', { view: 'front', ph: 0, amp: 0, face: -1 }], ['dunk', { view: 'side', ph: 0, amp: 0, face: 1, t: 0.4 }]];
function floor(y: number) {
  const grd = g.createLinearGradient(0, y, 0, y + ROWH); grd.addColorStop(0, '#c9965c'); grd.addColorStop(1, '#a8723c');
  g.fillStyle = grd; g.fillRect(0, y, W, ROWH);
  const sp = g.createRadialGradient(W / 2, y - 200, 50, W / 2, y + 100, 900); sp.addColorStop(0, 'rgba(255,240,210,0.18)'); sp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sp; g.fillRect(0, y, W, ROWH);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y + ROWH - 34); g.lineTo(W, y + ROWH - 46); g.stroke();
}
const SS = 2;   // supersampling for E1+
function layer(w: number, h: number) { const k = document.createElement('canvas'); k.width = w; k.height = h; return [k, k.getContext('2d')!] as const; }
function fig(level: number, x: number, foot: number, bi: number, si: number) {
  const [pose, o] = shots[si], base = { pose, air: pose === 'dunk', kit: kits[bi], body: B[bi], shorts: 0.75, font: 'monospace', num: true, ...o };
  const s = level === 0 ? 1 : SS, H = 300, CW = 440 * s, CH = 400 * s, fx = 220 * s, fy = 385 * s;
  const [oc, og] = layer(CW, CH);
  draw(og, fx, fy, { H: H * s, headU: H * s / 100 * 0.86, ...base } as any);
  og.globalCompositeOperation = 'source-atop';
  // E: light from above, a dark side
  const lg = og.createLinearGradient(0, fy - H * s, 0, fy); lg.addColorStop(0, 'rgba(255,250,235,0.22)'); lg.addColorStop(0.45, 'rgba(255,250,235,0)'); lg.addColorStop(1, 'rgba(20,10,0,0.3)');
  og.fillStyle = lg; og.fillRect(0, 0, CW, CH);
  if (level >= 2) {
    // key light warm from the front-left, the far side falls off
    const kx = og.createLinearGradient(fx - 90 * s, 0, fx + 110 * s, 0); kx.addColorStop(0, 'rgba(255,214,160,0.16)'); kx.addColorStop(0.5, 'rgba(0,0,0,0)'); kx.addColorStop(1, 'rgba(0,0,30,0.22)');
    og.fillStyle = kx; og.fillRect(0, 0, CW, CH);
  }
  if (level >= 3) {
    // sheen: a soft specular band across the shoulders and chest, and the muscles' relief on skin (a fine vertical ripple)
    const sh = og.createRadialGradient(fx - 20 * s, fy - H * s * 0.72, 4 * s, fx - 20 * s, fy - H * s * 0.72, 70 * s); sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    og.fillStyle = sh; og.fillRect(0, 0, CW, CH);
  }
  og.globalCompositeOperation = 'source-over';
  let out = oc;
  if (level >= 2) {
    // rim light: the silhouette's back edge in cool arena light
    const [rc, rg] = layer(CW, CH); rg.drawImage(oc, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(190,220,255,0.85)'; rg.fillRect(0, 0, CW, CH);
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(oc, 3.5 * s, 1.5 * s);
    const [mc, mg] = layer(CW, CH); mg.drawImage(oc, 0, 0); mg.globalAlpha = level >= 3 ? 0.7 : 0.55; mg.globalCompositeOperation = 'source-atop'; mg.drawImage(rc, 0, 0); out = mc;
  }
  if (level >= 3) {
    // muscle relief: lighten the skin's edges a touch – a soft inner glow on the limbs (skin only: by colour match is too costly here, so whole-figure, very faint)
    const [gc, gg] = layer(CW, CH); gg.filter = `blur(${2 * s}px)`; gg.drawImage(out, 0, 0); gg.filter = 'none';
    const [hc, hg] = layer(CW, CH); hg.drawImage(out, 0, 0); hg.globalCompositeOperation = 'overlay'; hg.globalAlpha = 0.35; hg.drawImage(gc, 0, 0); hg.globalCompositeOperation = 'destination-in'; hg.globalAlpha = 1; hg.drawImage(out, 0, 0); out = hc;
  }
  // contact shadow and a soft long shadow away from the light
  g.save(); g.filter = 'blur(7px)'; g.fillStyle = 'rgba(0,0,0,0.34)'; g.beginPath(); g.ellipse(x + 10, foot - (pose === 'dunk' ? 0 : 0), 52, 11, 0, 0, 7); g.fill();
  if (level >= 2) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x + 70, foot - 4, 90, 9, -0.05, 0, 7); g.fill(); } g.restore();
  g.imageSmoothingQuality = 'high';
  g.drawImage(out, x - fx / s, foot - fy / s - (pose === 'dunk' ? 60 : 0), CW / s, CH / s);
}
rows.forEach((name, li) => {
  const y = li * ROWH; floor(y);
  g.fillStyle = 'rgba(10,12,18,0.82)'; g.fillRect(0, y, 520, 34); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText(name, 12, y + 24);
  const order: [number, number][] = [[0, 0], [1, 1], [2, 2], [0, 3]];
  let x = 220; for (const [bi, ps] of order) { fig(li, x, y + ROWH - 28, bi, ps); x += 380; }
});
