// Style sketches: the same three players in three moments, drawn five ways.
import { drawAthleteOutlined as draw, setFlat } from '../src/ui/athlete';
const W = 1500, ROWH = 300, styles = ['A · Dabartinis', 'B · Pikselinis (Hoop Land)', 'C · Didelės galvos (PFD)', 'D · Komiksas / cel', 'E · Atletiškas HD'];
const c = document.createElement('canvas'); c.width = W; c.height = ROWH * styles.length + 10; document.body.appendChild(c);
const g = c.getContext('2d')!;
const kits = [{ jersey: '#f4f4f2', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f2' }, { jersey: '#5d76a9', trim: '#12173f', trim2: '#2a3560', shorts: '#5d76a9' }, { jersey: '#ce1141', trim: '#000000', trim2: '#ffffff', shorts: '#ce1141' }];
const B: any[] = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'longbeard', band: false, num: 13, ht: 78, build: 0.4, tat: 2 },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', band: false, num: 30, ht: 75, build: 0.3 },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', band: true, num: 23, ht: 81, build: 0.6 },
];
const shots: [string, any][] = [['dribble', { view: 'side', ph: 1.2, amp: 0.9, face: 1 }], ['shoot', { view: 'front', ph: 0, amp: 0, face: 1, t: 0.3 }], ['stance', { view: 'front', ph: 0, amp: 0, face: -1 }]];
function floor(y: number) {
  const grd = g.createLinearGradient(0, y, 0, y + ROWH); grd.addColorStop(0, '#c9965c'); grd.addColorStop(1, '#b07a42');
  g.fillStyle = grd; g.fillRect(0, y, W, ROWH);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y + ROWH - 40); g.lineTo(W, y + ROWH - 52); g.stroke();
}
function shadow(x: number, y: number, w: number) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, 7); g.fill(); }
function fig(style: number, x: number, foot: number, bi: number, si: number) {
  const [pose, o] = shots[si], body = B[bi], kit = kits[bi];
  const base = { pose, air: false, kit, body, shorts: 0.75, font: 'monospace', num: true, ...o };
  if (style === 0) { shadow(x, foot, 34); draw(g, x, foot, { H: 210, ...base } as any); return; }
  if (style === 1) {   // drawn tiny, flat and crisp, blown up 4× with nearest-neighbour: real pixels
    const s = 4, oc = document.createElement('canvas'); oc.width = 80; oc.height = 80; const og = oc.getContext('2d')!;
    setFlat(true); draw(og, 40, 76, { H: 52, crisp: true, ...base, num: false } as any); setFlat(false);
    shadow(x, foot, 34); g.imageSmoothingEnabled = false; g.drawImage(oc, x - 40 * s, foot - 76 * s, 80 * s, 80 * s); g.imageSmoothingEnabled = true; return;
  }
  if (style === 2) { shadow(x, foot, 30); draw(g, x, foot, { H: 160, headU: 160 / 100 * 3.1, ...base } as any); return; }
  const oc = document.createElement('canvas'); oc.width = 360; oc.height = 300; const og = oc.getContext('2d')!;
  if (style === 3) {   // flat colour, heavy ink line, a hard rim light
    setFlat(true); draw(og, 180, 290, { H: 215, ...base } as any); setFlat(false);
    const ink = document.createElement('canvas'); ink.width = 360; ink.height = 300; const ig = ink.getContext('2d')!;
    ig.drawImage(oc, 0, 0); ig.globalCompositeOperation = 'source-in'; ig.fillStyle = '#14100c'; ig.fillRect(0, 0, 360, 300);
    shadow(x, foot, 34);
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, 3], [-3, 3], [3, -3]]) g.drawImage(ink, x - 180 + dx, foot - 290 + dy);
    g.drawImage(oc, x - 180, foot - 290);
    const rim = document.createElement('canvas'); rim.width = 360; rim.height = 300; const rg = rim.getContext('2d')!;
    rg.drawImage(oc, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = 'rgba(255,248,220,0.32)'; rg.fillRect(0, 0, 360, 300);
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(oc, -3, 3);
    g.drawImage(rim, x - 180, foot - 290); return;
  }
  // E: leaner proportions (smaller head, longer legs), arena light from above, soft contact shadow
  draw(og, 180, 290, { H: 232, headU: 232 / 100 * 0.86, ...base } as any);
  og.globalCompositeOperation = 'source-atop';
  const lg = og.createLinearGradient(0, 40, 0, 290); lg.addColorStop(0, 'rgba(255,250,235,0.22)'); lg.addColorStop(0.45, 'rgba(255,250,235,0)'); lg.addColorStop(1, 'rgba(20,10,0,0.28)');
  og.fillStyle = lg; og.fillRect(0, 0, 360, 300);
  const sh = og.createLinearGradient(100, 0, 260, 0); sh.addColorStop(0, 'rgba(0,0,0,0.18)'); sh.addColorStop(0.6, 'rgba(0,0,0,0)'); og.fillStyle = sh; og.fillRect(0, 0, 360, 300);
  g.save(); g.filter = 'blur(6px)'; shadow(x + 8, foot, 40); g.restore();
  g.drawImage(oc, x - 180, foot - 290);
}
styles.forEach((name, si) => {
  const y = si * ROWH; floor(y);
  g.fillStyle = 'rgba(10,12,18,0.82)'; g.fillRect(0, y, 300, 34); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText(name, 12, y + 24);
  let x = 130;
  for (let k = 0; k < 3; k++) for (let b = 0; b < 3; b++) { if ((k + b) % 3 !== 0 && b > 0 && k > 0 && false) continue; }
  const order: [number, number][] = [[0, 0], [1, 1], [2, 2], [0, 1], [2, 0]];
  for (const [bi, ps] of order) { fig(si, x, y + ROWH - 30, bi, ps); x += 290; }
});
