// Progression data: per player and summer – age, minutes, OVR before/after and the summer's change by cause (devWhy)
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import { performanceShift, DEV } from '../src/league/health';
import { bpmOf, H } from '../src/data';
import { shownOvr } from '../src/data';
import { ageIn } from '../src/players';
import cal from '../src/engine/eracal.json';
import { writeFileSync } from 'fs';
boot(); setEraCal(cal as any);
const years = +(process.argv[2] ?? 4), seed = +(process.argv[3] ?? 5), start = +(process.argv[4] ?? 1995), out = process.argv[5] ?? '/home/claude/work/prog/rows.json';
if (process.env.NOISE) (DEV as any).noise = +process.env.NOISE;
const lg: any = newLeague(0, seed, undefined, { start });
const league: any[] = [];
const rows: any[] = [];
for (let y = 0; y < years; y++) {
  const t0 = Date.now();
  while (lg.phase === 'regular' || lg.phase === 'playoffs') simDay(lg);
  const S = lg.season;
  const perf = performanceShift(lg, S);
  const before = new Map<string, any>();
  for (const p of Object.values(lg.players) as any[]) {
    if (p.retired || p.entered > S || !p.tid && !p.career.some((c: any) => c.s === S)) continue;
    const reg = p.career.filter((c: any) => c.s === S && !c.po);
    const min = reg.reduce((a: number, c: any) => a + c.min, 0), gp = reg.reduce((a: number, c: any) => a + c.gp, 0);
    const po = p.career.filter((c: any) => c.s === S && c.po).reduce((a: number, c: any) => a + c.min, 0);
    const pf = perf.get(p.id);
    before.set(p.id, { id: p.id, name: p.name, pos: p.pos, S, age: ageIn(p, S), ovr0: shownOvr(p.z, p.id), min, gp, po, tid: p.tid, pot: p.dev?.pot ?? null, inj: p.injury ?? 0, z: p.z.map((v: number) => Math.round(v * 1000) / 1000), pg: pf ? Math.round(pf.ovrGain * 100) / 100 : null, pdz: pf ? pf.dz.map((v: number) => Math.round(v * 1000) / 1000) : null });
  }
  runDraftPhase(lg);
  startNewSeason(lg);
  for (const [id, r] of before) {
    const p = lg.players[id]; if (!p || p.retired) continue;
    r.ovr1 = shownOvr(p.z, p.id); r.why = p.devWhy ?? null; r.pot = p.dev?.pot ?? r.pot; r.flop = p.dev?.flop ?? null;
    rows.push(r);
  }
  const act = (Object.values(lg.players) as any[]).filter(p => !p.retired && p.tid).map(p => shownOvr(p.z, p.id)).sort((a, b) => b - a);
  league.push({ S: S + 1, top10: act.slice(0, 10).reduce((a, b) => a + b, 0) / 10, top50: act.slice(0, 50).reduce((a, b) => a + b, 0) / 50, mean: act.reduce((a, b) => a + b, 0) / act.length, n90: act.filter(x => x >= 90).length, n85: act.filter(x => x >= 85).length });
  writeFileSync(out, JSON.stringify({ rows, league, keys: H.keys }));
  console.log(`season ${S} done in ${((Date.now() - t0) / 1000).toFixed(0)}s, rows ${rows.length}`);
}
