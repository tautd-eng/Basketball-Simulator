// Pose bench (dev only): bun build test/posebench.ts --outfile …; the URL hash lists poses: #stance,run,ready
import { drawAthleteOutlined as draw, AthPose } from '../src/ui/athlete';
const W = 1400, Hh = 900;
const c = document.createElement('canvas'); c.width = W; c.height = Hh; document.body.appendChild(c);
const g = c.getContext('2d')!;
const fl = g.createLinearGradient(0, 0, 0, Hh); fl.addColorStop(0, '#d9a467'); fl.addColorStop(1, '#c58c50'); g.fillStyle = fl; g.fillRect(0, 0, W, Hh);
const kits = [{ jersey: '#f4f4f4', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f4' }, { jersey: '#2b3a67', trim: '#9fb5d9', trim2: '#12173f', shorts: '#2b3a67' }];
const bodies: any[] = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'longbeard', num: 13, ht: 78, build: 0.4, shoe: '#d23a2a', shoe2: '#1c1c1c', sole: '#1c1c1c' },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', num: 30, ht: 75, build: 0.3, shoe: '#f2c230', shoe2: '#1d3a8a' },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', num: 23, ht: 81, build: 0.6, shoe: '#1c1c1c', shoe2: '#f2c230' },
];
const q = new URLSearchParams(location.search);
const poses = (q.get('p') ?? 'stance,run,ready').split(',') as AthPose[];
const views = ['side', 'front', 'back'] as const;
const amp = Number(q.get('amp') ?? 0.3), ph = Number(q.get('ph') ?? 1.1);
// big row per pose: side, front, back at H=200; then game size H=60 row
poses.forEach((pose, i) => {
  views.forEach((view, j) => {
    const X = 120 + j * 230 + (i % 2) * 700, Y = 260 + Math.floor(i / 2) * 330;
    const b = bodies[(i + j) % 3], k = kits[(i + j) % 2];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(X, Y, 30, 7, 0, 0, Math.PI * 2); g.fill();
    draw(g, X, Y, { H: 200, face: 1, pose, ph, amp, air: false, kit: k, body: b, shorts: 0.75, font: 'bold 20px sans-serif', num: true, view } as any);
    // game size beside it
    draw(g, X + 95, Y, { H: 60, face: 1, pose, ph, amp, air: false, kit: k, body: b, shorts: 0.75, font: 'bold 8px sans-serif', num: true, view } as any);
  });
  g.fillStyle = '#222'; g.font = 'bold 16px sans-serif'; g.fillText(pose, 20 + (i % 2) * 700, 60 + Math.floor(i / 2) * 330);
});
const phs = q.get('phs');
if (phs) { g.fillStyle = fl; g.fillRect(0, 0, W, Hh); const ps = phs.split(',').map(Number); const pz = poses[0];
  ps.forEach((ph2, i) => { const X = 90 + (i % 6) * 220, Y = 300 + Math.floor(i / 6) * 380; g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(X, Y, 30, 7, 0, 0, Math.PI * 2); g.fill();
    draw(g, X, Y, { H: 230, face: 1, pose: pz, ph: ph2, amp, air: false, kit: kits[0], body: bodies[i % 3], shorts: 0.75, font: 'bold 20px sans-serif', num: true, view: (q.get('view') ?? 'side') as any } as any); }); }
(window as any).done = true;
