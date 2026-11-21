import { drawAthleteOutlined as draw } from '../src/ui/athlete';
const c = document.createElement('canvas'); c.width = 1600; c.height = 760; document.body.appendChild(c);
const g = c.getContext('2d')!; g.fillStyle = '#c08a50'; g.fillRect(0, 0, 1600, 760);
const kit = { jersey: '#ce1141', trim: '#000000', trim2: '#ffffff', shorts: '#ce1141' };
const body: any = { skin: '#6b4430', hair: 'fade', hairColor: '#1a1410', facial: 'goatee', band: false, num: 23, ht: 79, build: 0.5 };
const P: [string, any][] = [['stand', { view: 'front' }], ['dribble', { view: 'side', ph: 1.2, amp: 0.9 }], ['run', { view: 'side', ph: 2.2, amp: 1 }], ['shoot', { view: 'side', t: 0.3 }], ['stance', { view: 'front' }]];
P.forEach(([pose, o], i) => draw(g, 170 + i * 320, 740, { H: 640, headU: 640 / 100 * 0.86, face: 1, pose, ph: 0, amp: 0, air: false, kit, body, shorts: 0.75, font: 'monospace', num: true, ...o } as any));
