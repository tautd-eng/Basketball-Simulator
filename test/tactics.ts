// does a tactic change the outcome? same game (same seed), tactic A vs B – and the average effect over many seeds
import { boot, realTeams } from './harness';
import { simGame } from '../src/engine/game';
import { Rng } from '../src/rng';
boot();
const T = realTeams(2024), H = T[process.argv[2] ?? 'BOS'] ?? Object.values(T)[0], A = T[process.argv[3] ?? 'NYK'] ?? Object.values(T)[1];
const base = { pace: 0, three: 0, crash: 0, press: 0, ...((H as any).tac ?? {}) };
const play = (seed: number, tac: any) => { const h = { ...H, tac: { ...base, ...tac } } as any; const r = simGame(h, A, { season: 2024, po: false, rng: new Rng(seed) }); return [r.home.pts, r.away.pts]; };
console.log('same seed, same tactic twice:', play(1234, {}), play(1234, {}));
const variants: [string, any][] = [['default', {}], ['three +1', { three: 1 }], ['pace +1', { pace: 1 }], ['crash +1', { crash: 1 }], ['press +1', { press: 1 }], ['focus +1 (stars)', { focus: 1 }], ['focus -1 (ball movement)', { focus: -1 }], ['post +1', { post: 1 }], ['phys +1', { phys: 1 }], ['zone +1', { zone: 1 }]];
console.log('same seed 1234:', variants.map(([n, t]) => `${n} ${play(1234, t).join('-')}`).join(' | '));
const N = Number(process.argv[4] ?? 150);
for (const [n, t] of variants) {
  let m = 0, w = 0, pts = 0;
  for (let s = 1; s <= N; s++) { const [a, b] = play(s * 7 + 1, t); m += a - b; w += a > b ? 1 : 0; pts += a; }
  console.log(`${n.padEnd(26)} avg margin ${(m / N).toFixed(2).padStart(6)}  win% ${(w / N * 100).toFixed(1)}  pts ${(pts / N).toFixed(1)}`);
}
