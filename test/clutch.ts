// how much of the winning-time shooting goes to each team's two leading scorers (vs the rest of the game)
import { boot, realTeams } from './harness';
import { simGame, prep } from '../src/engine/game';
import { Rng } from '../src/rng';
boot();
const season = Number(process.argv[2] ?? 2024);
const teams = realTeams(season), ids = Object.keys(teams), rng = new Rng(7);
// leading scorers: by a full sim season of FGA would be best; use the harness order (best players first)
const stars = new Set<string>(); for (const t of Object.values(teams)) [...t.players].sort((a, b) => prep(b, season).bpm - prep(a, season).bpm).slice(0, 2).forEach(p => stars.add(p.id));   // the two best (by rating)
const c = { win: [0, 0], rest: [0, 0] };
for (let r = 0; r < 2; r++) for (const h of ids) for (const a of ids) {
  if (h === a) continue;
  const res = simGame(teams[h], teams[a], { season, po: false, rng, pbp: true });
  for (const e of res.pbp!) {
    if (!['make2', 'make3', 'miss2', 'miss3', 'blk'].includes(e.k)) continue;
    const pid = e.d?.find(x => x[1] === 'fga')?.[0]; if (!pid) continue;
    const win = (e.p >= 4 && e.c < 300 && Math.abs(e.hs - e.as) <= 10) || e.p > 4;
    const b = win ? c.win : c.rest; b[1]++; if (stars.has(pid)) b[0]++;
  }
}
console.log(`stars' share of FGA – winning time ${(c.win[0] / c.win[1] * 100).toFixed(1)}% (${c.win[1]} shots) · rest of the game ${(c.rest[0] / c.rest[1] * 100).toFixed(1)}%`);
