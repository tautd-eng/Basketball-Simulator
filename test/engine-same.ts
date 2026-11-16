// The engine must give exactly the same games: a fingerprint of 40 days of a league (scores, box lines, play-by-play kinds).
import { boot } from './harness';
import { newLeague, simDay, playSingle } from '../src/league/league';
import { setEraCal } from '../src/engine/game';
import cal from '../src/engine/eracal.json';
import { createHash } from 'crypto';
boot(); setEraCal(cal as any);
const h = createHash('sha1');
for (const [start, seed] of [[2026, 5], [1995, 11]] as const) {
  const lg: any = newLeague(0, seed, undefined, { start, classMode: 'real', futureMode: 'shuffle' });
  // a few games with play-by-play (the path the viewer uses), then plain sim days
  for (let i = 0; i < 3; i++) { const g = lg.schedule.find((x: any) => x.day === lg.day && !x.done); const r = playSingle(lg, g.home, g.away); h.update(JSON.stringify(r!.pbp.map((e: any) => [e.k, e.s, e.t, e.hs, e.as]))); r!.commit(); }
  for (let d = 0; d < 40; d++) simDay(lg);
  h.update(JSON.stringify(lg.schedule.filter((g: any) => g.done).map((g: any) => [g.home, g.away, g.hs, g.as])));
  h.update(JSON.stringify(Object.values(lg.players).filter((p: any) => p.cur?.gp).map((p: any) => [p.id, p.cur.pts, p.cur.fga, p.cur.ast, p.cur.reb ?? p.cur.drb, p.cur.min.toFixed(2)])));
}
console.log(h.digest('hex'));
