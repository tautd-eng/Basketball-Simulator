import { drawAthleteOutlined as draw } from '../src/ui/athlete';
const c = document.createElement('canvas'); c.width = 1400; c.height = 900; document.body.appendChild(c);
const g = c.getContext('2d')!; g.fillStyle = '#c58c50'; g.fillRect(0, 0, 1400, 900);
const kit = { jersey: '#1d428a', trim: '#ffc72c', trim2: '#0b1f4d', shorts: '#1d428a' };
const b: any = { skin: '#7a4e34', hair: 'fade', hairColor: '#1a1410', facial: 'beard', band: false, num: 30, ht: 80, build: 0.55, shoe: '#f4f4f4', tat: 1 };
const P: [string, string, number][] = [['stand', 'front', 0], ['stand', 'side', 0], ['run', 'side', 0.9], ['dribble', 'side', 0.5], ['shoot', 'side', 0]];
P.forEach(([pose, view, amp], i) => draw(g, 150 + i * 280, 860, { H: 760, face: 1, pose: pose as any, ph: 1.1, amp, air: false, kit, body: b, shorts: 0.8, font: 'monospace', view: view as any, headU: 7.6 }));
