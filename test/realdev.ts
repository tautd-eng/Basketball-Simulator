// Real careers year to year (for comparison with the simulated development): age, minutes, OVR now and next season
import { boot } from './harness';
import { H, shownOvr } from '../src/data';
import { smoothZ } from '../src/players';
import { writeFileSync } from 'fs';
boot();
const rows: any[] = [];
for (const [pid, hp] of Object.entries(H.players) as any[]) {
  const by = new Map<number, any[]>(); for (const s of hp.s) { const a = by.get(s[0]) ?? []; a.push(s); by.set(s[0], a); }
  const yrs = [...by.keys()].sort((a, b) => a - b);
  const born = +String(hp.b).slice(0, 4);
  for (const y of yrs) {
    if (!by.has(y + 1)) continue;
    const m0 = by.get(y)!.reduce((a: number, s: any) => a + s[3], 0), m1 = by.get(y + 1)!.reduce((a: number, s: any) => a + s[3], 0);
    const z0 = by.get(y)!.at(-1)[7], z1 = by.get(y + 1)!.at(-1)[7];
    let s0 = NaN, s1 = NaN; try { s0 = shownOvr(smoothZ(pid, y), pid); s1 = shownOvr(smoothZ(pid, y + 1), pid); } catch {}
    rows.push({ id: pid, name: hp.n, S: y, age: y - born, min: m0, min1: m1, raw0: shownOvr(z0, pid), raw1: shownOvr(z1, pid), sm0: s0, sm1: s1 });
  }
}
writeFileSync('/home/claude/work/prog2/real.json', JSON.stringify(rows));
console.log('rows', rows.length);
