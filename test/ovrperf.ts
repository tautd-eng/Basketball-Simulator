// Does overall show in the box score? A season, players binned by shown overall: minutes, per-36 production, efficiency, usage.
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const lg = newLeague(0.5, +(process.argv[3] ?? 11), undefined, { start: +(process.argv[2] ?? 2024) });
let d = 0; while (lg.phase === 'regular' && d++ < 400) simDay(lg);
const rows = Object.values(lg.players).filter(p => p.tid && p.cur && (p.cur as any).gp > 20).map(p => ({ p, o: shownOvr(p.z, p.id), s: p.cur as any }));
const bins = [[0, 60], [60, 66], [66, 72], [72, 78], [78, 84], [84, 90], [90, 120]];
console.log('ovr      n   mpg   pts36  fga36  ts%   reb36 ast36  +/-?');
for (const [a, b] of bins) {
  const r = rows.filter(x => x.o >= a && x.o < b); if (!r.length) continue;
  const S = (k: string) => r.reduce((t, x) => t + (x.s[k] ?? 0), 0);
  const min = S('min'), m36 = min / 36;
  const ts = S('pts') / (2 * (S('fga') + 0.44 * S('fta')));
  console.log(`${a}-${b}`.padEnd(8), String(r.length).padStart(3), (min / S('gp')).toFixed(1).padStart(5), (S('pts') / m36).toFixed(1).padStart(6), (S('fga') / m36).toFixed(1).padStart(6), (ts * 100).toFixed(1).padStart(5), ((S('orb') + S('drb')) / m36).toFixed(1).padStart(6), (S('ast') / m36).toFixed(1).padStart(5));
}
const name = (q: string) => rows.find(x => x.p.name.includes(q));
for (const q of ['Edwards', 'James', 'Gilgeous', 'Jokić', 'Bronny']) { const x = rows.filter(y => y.p.name.includes(q)).slice(0, 3); for (const y of x) { const s = y.s; console.log(y.p.name, y.o, 'g', s.gp, 'mpg', (s.min / s.gp).toFixed(1), 'ppg', (s.pts / s.gp).toFixed(1), 'fg', s.fgm + '/' + s.fga); } }
void name;
