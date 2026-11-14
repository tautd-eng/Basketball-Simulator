// The menus take on the colours of the team you run: the accent (buttons, active tabs, highlights) becomes the
// team's colour, adjusted so it stays readable in light and dark mode. No team (or the main menu): the default.
import { colorsOf } from './art';

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = (c: number[]) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const sat = (c: number[]) => (Math.max(...c) - Math.min(...c)) / 255;

export function applyTeamTheme(tid: string | null | undefined, abbr?: string) {
  const root = document.documentElement;
  if (!tid) { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); root.style.removeProperty('--team2'); root.classList.remove('team-theme'); return; }
  const [p, s] = colorsOf(tid, abbr).map(hex);
  // a grey or near-black primary gives a dull accent: the secondary takes over when it has more colour
  let c = sat(p) < 0.15 && sat(s) > sat(p) + 0.15 ? s : p;
  const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) { if (lum(c) < 0.42) c = mix(c, [255, 255, 255], (0.42 - lum(c)) / 0.6); }
  else { if (lum(c) > 0.55) c = mix(c, [0, 0, 0], (lum(c) - 0.5) / 0.6); }
  const bg = dark ? [21, 29, 44] : [255, 255, 255];
  root.style.setProperty('--accent', toHex(c));
  root.style.setProperty('--accent-soft', toHex(mix(c, bg, dark ? 0.78 : 0.86)));
  root.style.setProperty('--team2', toHex(c === s ? p : s));
  root.classList.add('team-theme');
}
