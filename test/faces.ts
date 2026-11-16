import { drawAthleteOutlined as draw } from '../src/ui/athlete';
const c = document.createElement('canvas'); c.width = 1400; c.height = 600; document.body.appendChild(c);
const g = c.getContext('2d')!; g.fillStyle = '#c58c50'; g.fillRect(0, 0, 1400, 600);
const kit = { jersey: '#f4f4f4', trim: '#007ac1', trim2: '#ef3b24', shorts: '#f4f4f4' };
const B = [
  { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'longbeard', band: false, num: 13, ht: 78, build: 0.4, tat: 2 },
  { skin: '#e8c3a0', hair: 'parted', hairColor: '#6b4a2a', facial: 'none', band: false, num: 30, ht: 75, build: 0.3 },
  { skin: '#3d2618', hair: 'dreads', hairColor: '#120d0a', facial: 'goatee', band: true, num: 23, ht: 81, build: 0.6 },
  { skin: '#a8754f', hair: 'afro', hairColor: '#1a1410', facial: 'mustache', band: false, num: 0, ht: 83, build: 0.75 },
  { skin: '#d9a77e', hair: 'buzz', hairColor: '#2a1d14', facial: 'stubble', band: false, num: 7, ht: 80, build: 0.5 },
];
B.forEach((b: any, i) => {
  for (const [j, view] of (['front', 'side'] as const).entries()) draw(g, 140 + i * 280 + j * 120 - 60, 1250, { H: 1000, face: 1, pose: 'stand', ph: 0, amp: 0, air: false, kit, body: b, shorts: 0.75, font: 'monospace', view, headU: 10 });
});
