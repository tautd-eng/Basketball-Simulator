// Fantasy draft sanity: who goes where, reaches and steals (pick vs overall rank), ages, positions per team.
import { boot } from './harness';
import { newLeague } from '../src/league/league';
import { fantasyAdvance, fantasyValue } from '../src/league/fantasy';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import { ageIn } from '../src/players';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
for (const start of (process.argv[2] ?? '1980,2000,2024').split(',').map(Number)) {
  const lg: any = newLeague(0, 11, undefined, { start, fantasy: true });
  const S = lg.season;
  const pool = (Object.values(lg.players) as any[]).filter(p => !p.tid && !p.retired && !p.stash);
  const ov = new Map(pool.map(p => [p.id, shownOvr(p.z, p.id)]));
  const val = new Map(pool.map(p => [p.id, fantasyValue(lg, p)]));
  const byOvr = [...pool].sort((a, b) => ov.get(b.id)! - ov.get(a.id)!).map(p => p.id);
  fantasyAdvance(lg, true);
  const picks = lg.fantasy.picks;
  console.log(`\n=== ${start} (season ${S}) pool ${pool.length}, picks ${picks.length}, teams ${lg.fantasy.order.length}`);
  console.log(picks.slice(0, 30).map((k: any) => { const p = lg.players[k.pid]; return `${k.pick}.${lg.teams[k.tid].abbr} ${p.name} ${ov.get(p.id)} ${Math.floor(ageIn(p, S))}y (#${byOvr.indexOf(p.id) + 1})`; }).join('\n'));
  // reaches: picked within the first 60 though ranked 40+ places lower by overall; steals: top-30 overall still there after pick 60
  const reach = picks.filter((k: any) => k.pick <= 60 && byOvr.indexOf(k.pid) + 1 - k.pick >= 40).map((k: any) => { const p = lg.players[k.pid]; return `${k.pick}:${p.name} ${ov.get(p.id)} ${Math.floor(ageIn(p, S))}y #${byOvr.indexOf(k.pid) + 1}`; });
  const late = picks.filter((k: any) => k.pick > 60 && byOvr.indexOf(k.pid) < 30).map((k: any) => { const p = lg.players[k.pid]; return `${k.pick}:${p.name} ${ov.get(p.id)} ${Math.floor(ageIn(p, S))}y #${byOvr.indexOf(k.pid) + 1}`; });
  console.log('big reaches (top 60, 40+ below):', reach.join(' | ') || '-');
  console.log('top-30 overall going after pick 60:', late.join(' | ') || '-');
  // teams: best-8 overall spread, positions
  const teams = lg.fantasy.order.map((tid: string) => { const r = lg.teams[tid].roster.map((id: string) => lg.players[id]); const o = r.map((p: any) => shownOvr(p.z, p.id)).sort((a: number, b: number) => b - a);
    const big = r.filter((p: any) => /C|F-C|C-F/.test(p.pos)).length, g = r.filter((p: any) => /^G/.test(p.pos)).length; return { tid, top8: o.slice(0, 8).reduce((a: number, b: number) => a + b, 0) / 8, big, g, n: r.length, age: r.reduce((a: number, p: any) => a + ageIn(p, S), 0) / r.length }; });
  const t8 = teams.map((t: any) => t.top8); console.log('top-8 avg overall: min', Math.min(...t8).toFixed(1), 'max', Math.max(...t8).toFixed(1), '| rosters', Math.min(...teams.map((t: any) => t.n)), '-', Math.max(...teams.map((t: any) => t.n)), '| teams with <2 bigs:', teams.filter((t: any) => t.big < 2).length, '| <2 guards:', teams.filter((t: any) => t.g < 2).length, '| avg age', (teams.reduce((a: number, t: any) => a + t.age, 0) / teams.length).toFixed(1));
  // value order vs overall order in round 1
  const r1 = picks.slice(0, lg.fantasy.order.length); console.log('round 1 avg age', (r1.reduce((a: number, k: any) => a + ageIn(lg.players[k.pid], S), 0) / r1.length).toFixed(1), '| avg overall', (r1.reduce((a: number, k: any) => a + ov.get(k.pid)!, 0) / r1.length).toFixed(1));
}
