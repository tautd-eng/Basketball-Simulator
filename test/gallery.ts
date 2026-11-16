// Player sprite gallery (dev only): bun build test/gallery.ts → open gallery.html, screenshot.
import { drawAthleteOutlined as draw, AthPose } from '../src/ui/athlete';
const c = document.createElement('canvas'); c.width = 1400; c.height = 900; document.body.appendChild(c);
const g = c.getContext('2d')!;
const fl = g.createLinearGradient(0, 0, 0, 900); fl.addColorStop(0, '#d9a467'); fl.addColorStop(1, '#c58c50'); g.fillStyle = fl; g.fillRect(0, 0, 1400, 900);
const kits = [{ jersey: '#f4f4f4', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f4' }, { jersey: '#2b3a67', trim: '#9fb5d9', trim2: '#12173f', shorts: '#2b3a67' }, { jersey: '#552583', trim: '#fdb927', trim2: '#2a1240', shorts: '#552583' }];
const bodies = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'beard', band: false, num: 2, ht: 78, build: 0.4, shoe: '#f4f4f4', tat: 2 },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', band: true, num: 7, ht: 84, build: 0.7, shoe: '#222222' },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', band: false, num: 23, ht: 81, build: 0.6, shoe: '#f4f4f4', sleeve: 1 },
  { skin: '#a8754f', hair: 'afro', hairColor: '#1a1410', facial: 'mustache', band: true, num: 33, ht: 80, build: 0.5, socks: '#f2f2f2', sockH: 14 },
];
const poses: [AthPose, string, number][] = [['shootlow', 'side', 0], ['swipe', 'side', 0], ['windmill', 'side', 0.2], ['tomahawk', 'side', 0.8], ['tomahawk', 'side', 0.15], ['fadekick', 'side', 0], ['shh', 'side', 0], ['nightnight', 'front', 0], ['shimmy', 'front', 0], ['stance', 'side', 0]];
poses.forEach(([pose, view, tt], i) => {
  const b: any = bodies[i % 4], k = kits[i % 3];
  const X = 90 + (i % 5) * 270, Y = 400 + Math.floor(i / 5) * 440;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(X, Y, 40, 9, 0, 0, Math.PI * 2); g.fill();
  draw(g, X, Y, { H: 300, face: 1, pose, ph: 1.1, amp: pose === 'run' || pose === 'dribble' ? 0.9 : 0.3, air: ['windmill', 'tomahawk', 'fadekick'].includes(pose), kit: k, body: b, shorts: 0.75, font: '"Press Start 2P", monospace', view: view as any, name: 'SMITH', headU: 3.0, t: tt });
});
(window as any).done = true;
