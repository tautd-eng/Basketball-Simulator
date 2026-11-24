// Does the engine turn each rating into the stat it stands for? Sim one season at destiny 0 (ratings = real season)
// and compare each player's box-score rate with the real rate his rating encodes.
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { setEraCal } from '../src/engine/game';
import { rate, K, H } from '../src/data';
import cal from '../src/engine/eracal.json';
import { writeFileSync } from 'fs';
boot(); setEraCal(cal as any);
const start = +(process.argv[2] ?? 1995), seed = +(process.argv[3] ?? 5);
const lg: any = newLeague(0, seed, undefined, { start });
const z0 = new Map<string, number[]>((Object.values(lg.players) as any[]).map(p => [p.id, p.z.slice()]));
while (lg.phase === 'regular') simDay(lg);
const S = start;
const OBS: [string, number, (l: any) => number, (l: any) => number, string][] = [
  ['2P%', K.ins, l => l.fgm - l.tpm, l => l.fga - l.tpa, 'logit'],
  ['3P%', K.tp, l => l.tpm, l => l.tpa, 'logit'],
  ['FT%', K.ft, l => l.ftm, l => l.fta, 'logit'],
  ['FTA/FGA', K.drw, l => l.fta, l => l.fga, 'log'],
  ['3PA/FGA', K.tpr, l => l.tpa, l => l.fga, 'logit'],
  ['usage/min', K.usg, l => l.fga + 0.44 * l.fta + l.tov, l => l.min, 'log'],
  ['TOV/action', K.tov, l => l.tov, l => l.fga + 0.44 * l.fta + l.ast + l.tov, 'logit'],
  ['AST/min', K.ast, l => l.ast, l => l.min, 'log'],
  ['ORB/min', K.orb, l => l.orb, l => l.min, 'log'],
  ['DRB/min', K.drb, l => l.drb, l => l.min, 'log'],
  ['STL/min', K.stl, l => l.stl, l => l.min, 'log'],
  ['BLK/min', K.blk, l => l.blk, l => l.min, 'log'],
  ['PF/min', K.pf, l => l.pf, l => l.min, 'log'],
];
const out: any[] = [];
for (const p of Object.values(lg.players) as any[]) {
  const l = p.cur ?? p.career.find((c: any) => c.s === S && !c.po);
  const L = p.career.filter((c: any) => c.s === S && !c.po).reduce((a: any, c: any) => { for (const k in c) if (typeof c[k] === 'number') a[k] = (a[k] ?? 0) + c[k]; return a; }, {} as any);
  const LL = L.min ? L : (p.cur ?? {});
  if (!LL.min || LL.min < 800 || !z0.has(p.id)) continue;
  out.push({ id: p.id, name: p.name, pos: p.pos, min: LL.min, z: z0.get(p.id), obs: OBS.map(([n, k, num, den]) => [num(LL), den(LL), rate(k, z0.get(p.id)![k], S)]) });
}
writeFileSync(`/home/claude/work/prog2/statfit_${start}_${seed}.json`, JSON.stringify({ names: OBS.map(o => o[0]), tf: OBS.map(o => o[4]), rows: out }));
console.log('players', out.length);
