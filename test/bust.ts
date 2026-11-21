import { drawAthleteOutlined as draw } from '../src/ui/athlete';
const c = document.createElement('canvas'); c.width = 1400; c.height = 420; document.body.appendChild(c);
const g = c.getContext('2d')!; g.fillStyle = '#2f6b3a'; g.fillRect(0, 0, 1400, 420);
const kits = [{ jersey: '#f4f4f2', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f2' }, { jersey: '#5d76a9', trim: '#12173f', trim2: '#2a3560', shorts: '#5d76a9' }];
const B = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'longbeard', band: false, num: 13, ht: 78, build: 0.4, tat: 2 },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', band: false, num: 30, ht: 75, build: 0.3 },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', band: true, num: 23, ht: 81, build: 0.6 },
  { skin: '#a8754f', hair: 'afro', hairColor: '#1a1410', facial: 'mustache', band: false, num: 0, ht: 83, build: 0.75 },
  { skin: '#d9a77e', hair: 'buzz', hairColor: '#2a1d14', facial: 'stubble', band: false, num: 7, ht: 80, build: 0.5 },
];
const HU = +(new URLSearchParams(location.search).get('hu') ?? 2.2);
B.forEach((b: any, i) => {
  // render a full figure big, offscreen, and keep the head and shoulders
  const H = 900, oc = document.createElement('canvas'); oc.width = 900; oc.height = 1700;
  const og = oc.getContext('2d')!;
  const h = draw(og, 450, 1650, { H, face: 1, pose: 'stand', ph: 0, amp: 0, air: false, kit: kits[i % 2], body: b, shorts: 0.75, font: 'monospace', view: 'front', headU: H / 100 * HU, num: false } as any);
  const U = H / 100 * HU, top = h.head.y - U * 9, bot = h.head.y + U * 22, w = (bot - top) * 1.1;
  g.drawImage(oc, 450 - w / 2, top, w, bot - top, 40 + i * 270, 20, 200, 200 * (bot - top) / w);
  g.drawImage(oc, 450 - w / 2, top, w, bot - top, 60 + i * 270, 260, 90, 90 * (bot - top) / w);
});
