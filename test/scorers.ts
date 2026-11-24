// Who scores how much: league scoring leaders over a few seasons (and one named player in detail)
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import { shownOvr, K } from '../src/data';
import { ageIn } from '../src/players';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const years = +(process.argv[2] ?? 3), seed = +(process.argv[3] ?? 5), start = +(process.argv[4] ?? 2025), who = process.argv[5] ?? 'Wembanyama';
const lg: any = newLeague(+(process.env.DESTINY ?? 0), seed, undefined, { start });
for (let y = 0; y < years; y++) {
  while (lg.phase === 'regular') simDay(lg);
  const S = lg.season;
  const ls = (Object.values(lg.players) as any[]).map(p => ({ p, l: p.cur ?? p.career.find((c: any) => c.s === S && !c.po) })).filter(x => x.l && x.l.gp >= 50);
  ls.sort((a, b) => b.l.pts / b.l.gp - a.l.pts / a.l.gp);
  console.log(`== ${S}: top scorers`);
  for (const { p, l } of ls.slice(0, 8)) console.log(`  ${p.name.padEnd(24)} ${ageIn(p, S)} OVR ${shownOvr(p.z, p.id)} | ${(l.pts / l.gp).toFixed(1)} ppg ${(l.min / l.gp).toFixed(1)} mpg ${(l.fga / l.gp).toFixed(1)} fga ${(l.fta / l.gp).toFixed(1)} fta | usg z ${p.z[K.usg].toFixed(2)} ins ${p.z[K.ins].toFixed(2)} tp ${p.z[K.tp].toFixed(2)}`);
  const w = ls.find(x => x.p.name.includes(who));
  if (w) console.log(`  ${who}: ${(w.l.pts / w.l.gp).toFixed(1)} ppg, OVR ${shownOvr(w.p.z, w.p.id)}, z ` + Object.entries(K).map(([k, i]) => `${k} ${(w.p.z as any)[i as any].toFixed(1)}`).join(' '));
  const pp = ls.map(x => x.l.pts / x.l.gp); console.log(`  players 30+ ppg: ${pp.filter(x => x >= 30).length}, 35+: ${pp.filter(x => x >= 35).length}, 40+: ${pp.filter(x => x >= 40).length}`);
  while (lg.phase === 'playoffs') simDay(lg);
  runDraftPhase(lg); startNewSeason(lg);
}
