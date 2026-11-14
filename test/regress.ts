// Long regression run: bun test/regress.ts START SEASONS SEED [classMode] > out.jsonl
// One JSON line per season with the league's vital signs, to compare before/after a change.
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import { payroll, askingSalary } from '../src/ai/value';
import { ageIn } from '../src/players';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const [start, seasons, seed] = [+process.argv[2], +process.argv[3], +process.argv[4]];
const lg: any = newLeague(0, seed, undefined, { start, classMode: (process.argv[5] as any) ?? 'real', futureMode: (process.argv[5] as any) === 'fictional' ? 'fictional' : 'shuffle' });
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
for (let y = 0; y < seasons && !lg.ended; y++) {
  const t0 = Date.now();
  while (lg.phase === 'regular' || lg.phase === 'playoffs') simDay(lg);
  const S = lg.season;
  const act = (Object.values(lg.players) as any[]).filter(p => p.tid && !p.retired);
  const ov = act.map(p => shownOvr(p.z, p.id));
  const stars = act.filter(p => shownOvr(p.z, p.id) >= 85).map(p => ({ id: p.id, tid: p.tid }));
  const teams = (Object.values(lg.teams) as any[]).filter(t => t.active);
  const str = teams.map(t => mean(t.roster.map((id: string) => shownOvr(lg.players[id].z, id)).sort((a: number, b: number) => b - a).slice(0, 8)));
  const wins = teams.map(t => t.w / Math.max(1, t.w + t.l));
  runDraftPhase(lg);
  const retired = (Object.values(lg.players) as any[]).filter(p => p.retired === S);
  startNewSeason(lg);
  const N = lg.season;
  const moved = stars.filter(x => lg.players[x.id].tid && lg.players[x.id].tid !== x.tid).length;
  const fa = (lg.fa?.log ?? []).filter((x: any) => ['sign', 'resign'].includes(x.kind) && x.sal && shownOvr(lg.players[x.pid].z, x.pid) >= 78);
  const pays = teams.map(t => payroll(lg, t.tid));
  const ages90 = act.filter(p => shownOvr(p.z, p.id) >= 90).map(p => ageIn(p, S));
  console.log(JSON.stringify({
    S, n80: ov.filter(o => o >= 80).length, n85: ov.filter(o => o >= 85).length, n90: ov.filter(o => o >= 90).length,
    age90: +mean(ages90).toFixed(1), top8sd: +sd(str).toFixed(2), winSd: +sd(wins).toFixed(3),
    pay: +(mean(pays) * 100).toFixed(0), payMax: +(Math.max(...pays) * 100).toFixed(0), payMin: +(Math.min(...pays) * 100).toFixed(0),
    rosterMin: Math.min(...teams.map(t => t.roster.length)), rosterMax: Math.max(...teams.map(t => t.roster.length)),
    retired: retired.length, retAge: +mean(retired.map((p: any) => ageIn(p, S))).toFixed(1),
    starsMoved: moved, stars: stars.length, fa78: fa.length, faOwn: fa.filter((x: any) => x.tid === x.from).length,
    faRatio: +mean(fa.map((x: any) => x.sal / Math.max(0.012, askingSalary(lg.players[x.pid], N)))).toFixed(2),
    secs: Math.round((Date.now() - t0) / 1000),
  }));
}
