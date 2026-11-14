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
  const VARS = ['--accent', '--accent-soft', '--team2', '--team1', '--bg', '--surface', '--sunk', '--line', '--head-bg', '--head-ink', '--team2-ink'];
  if (!tid) { for (const v of VARS) root.style.removeProperty(v); root.classList.remove('team-theme'); return; }
  const [p, s] = colorsOf(tid, abbr).map(hex);
  // a grey or near-black primary gives a dull accent: the secondary takes over when it has more colour
  let c = sat(p) < 0.15 && sat(s) > sat(p) + 0.15 ? s : p;
  const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) { if (lum(c) < 0.42) c = mix(c, [255, 255, 255], (0.42 - lum(c)) / 0.6); }
  else { if (lum(c) > 0.55) c = mix(c, [0, 0, 0], (lum(c) - 0.5) / 0.6); }
  const bg = dark ? [21, 29, 44] : [255, 255, 255];
  root.style.setProperty('--accent', toHex(c));
  root.style.setProperty('--accent-soft', toHex(mix(c, bg, dark ? 0.78 : 0.86)));
  const other = c === s ? p : s;
  root.style.setProperty('--team2', toHex(other));
  root.style.setProperty('--team1', toHex(p));
  root.style.setProperty('--team2-ink', lum(other) > 0.6 ? '#111111' : '#ffffff');
  // the whole page takes the team's tint: background, panels, insets and lines
  const base = dark ? { bg: [13, 19, 32], surface: [21, 29, 44], sunk: [17, 24, 39], line: [37, 48, 72] } : { bg: [238, 241, 246], surface: [255, 255, 255], sunk: [246, 248, 251], line: [217, 223, 233] };
  const tint = (b: number[], t: number) => toHex(mix(b, p, t));
  root.style.setProperty('--bg', tint(base.bg, dark ? 0.16 : 0.13));
  root.style.setProperty('--surface', tint(base.surface, dark ? 0.08 : 0.035));
  root.style.setProperty('--sunk', tint(base.sunk, dark ? 0.12 : 0.07));
  root.style.setProperty('--line', tint(base.line, dark ? 0.22 : 0.18));
  // the header in the team's own colour, its text readable on it
  const head = dark ? mix(p, [0, 0, 0], 0.35) : p;
  root.style.setProperty('--head-bg', toHex(head));
  root.style.setProperty('--head-ink', lum(head) > 0.6 ? '#111111' : '#ffffff');
  root.classList.add('team-theme');
}
