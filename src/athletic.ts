// Athleticism: burst, speed, leaping and strength for a player's size (z: 0 = a typical NBA player his size, ±1 ≈ one
// standard deviation among rotation players). From the real data (dunks, shots at the rim, free-throw rate … corrected
// for size and role), the NBA combine where measured, and a scout's review of the 1,700 best players (prep/ath).
//
// A player's ratings already contain what his athleticism did for him on the court. So athleticism acts:
//  • in the games, through MISMATCHES (who he meets): an explosive slasher against a slow defender, a quick guard
//    against a plodding big on the break – centred so a player's season against the league stays what his ratings say;
//  • over a career: it rises a little to the early 20s and fades from the late 20s; the skills built on it (finishing,
//    drawing fouls, rebounding, blocks, steals, defence) fade with it, more so for a player who leaned on it; severe
//    leg injuries take some of it for good;
//  • on draft boards: scouts see it well – a raw athlete is a bet on growth, a polished non-athlete a safer floor.
import { H, K, NK, ratingOf } from './data';
import { hash01 } from './rng';

/** Skills that lean on athleticism: their change per unit of athleticism (z per z). */
export const AW: number[] = (() => {
  const w = new Array(NK).fill(0);
  w[K.ins] = 0.22; w[K.drw] = 0.25; w[K.orb] = 0.22; w[K.drb] = 0.08; w[K.blk] = 0.2; w[K.stl] = 0.15; w[K.def] = 0.15;
  return w;
})();

/** Athleticism by age, relative to his peak: up a little to 22, flat to 26, then fading – faster past 30. */
export function athAge(age: number): number {
  if (age <= 19) return -0.15;
  if (age <= 22) return -0.15 + 0.05 * (age - 19);
  if (age <= 26) return 0;
  // 27–28: -0.06 a year, 29–30: -0.09, 31–32: -0.12, 33+: -0.15
  let v = 0;
  for (let a = 27; a <= age; a++) v -= a <= 28 ? 0.06 : a <= 30 ? 0.09 : a <= 32 ? 0.12 : 0.15;
  return v;
}
/** the yearly change at an age (from age-1 to age) */
export const athStep = (age: number) => athAge(age) - athAge(age - 1);

/** His peak athleticism (from the data; a player outside it gets a stable draw of his own). */
export function athPeak(pid: string): number {
  const base = pid.split('~')[0];
  const a = H.players[base]?.a;
  // a generated copy of a real player (pid~year) is his own man: the original's build, give or take
  const jitter = base !== pid ? (hash01(pid + 'ath') - 0.5) * 0.8 : 0;
  if (a != null) return a + jitter;
  // unknown player: a normal draw (sd like the league's)
  const u = Math.min(0.999, Math.max(0.001, hash01(pid + 'ath')));
  return 0.6 * Math.sqrt(2) * erfinv(2 * u - 1);
}
function erfinv(x: number) {
  const a = 0.147, l = Math.log(1 - x * x), t = 2 / (Math.PI * a) + l / 2;
  return Math.sign(x) * Math.sqrt(Math.sqrt(t * t - l / a) - t);
}

/** A player's athleticism now (set when he enters the league; older saves get it here). */
export function athOf(p: { id: string; ath?: number; born: number }, season?: number): number {
  if (p.ath == null) p.ath = athPeak(p.id) + athAge(Math.floor((season ?? 2000) - p.born));
  return p.ath;
}

/**
 * The mismatch between an attacker's and a defender's athleticism, centred: zero on average against the league for
 * either man, so it only moves who beats whom, not anybody's season. Bigger gaps count more than proportionally.
 */
const sq = (x: number) => x * Math.abs(x) / 2;
// m(a) = E[sq(a - X)], X ~ N(0, s): the average mismatch of an athleticism a against the league
const S = 0.78;
const M_TAB = (() => { const t: number[] = []; for (let i = 0; i <= 120; i++) { const a = -3 + i * 0.05; let s = 0, w = 0; for (let j = -40; j <= 40; j++) { const x = j / 10 * S; const ww = Math.exp(-0.5 * (j / 10) ** 2); s += ww * sq(a - x); w += ww; } t.push(s / w); } return t; })();
const mOf = (a: number) => { const x = Math.max(-3, Math.min(3, a)); const i = Math.min(119, Math.floor((x + 3) / 0.05)); const f = (x + 3) / 0.05 - i; return M_TAB[i] * (1 - f) + M_TAB[i + 1] * f; };
export function mismatch(att: number, def: number): number {
  return sq(att - def) - mOf(att) + mOf(def);
}

/** the league's average on the floor (players are a little past their peak) and spread, for the 0–100 rating */
const MEAN = -0.09, SD = 0.78;
/** Athleticism on the 0–100 scale of the other ratings (50 = the league's average, for his size). */
export function athRating(p: { id: string; ath?: number; born: number }, season?: number): number {
  return ratingOf((athOf(p, season) - MEAN) / SD);
}
/** Where he is on his athletic arc. */
export function athPhase(age: number): string {
  return age <= 21 ? 'still filling out' : age <= 26 ? 'at his athletic peak' : age <= 29 ? 'starting to lose a step' : age <= 32 ? 'fading' : 'well past his athletic peak';
}

/**
 * Stamina (z, the player's "endur"): from real minutes against players of the same quality (Iverson, DeRozan high;
 * load-managed stars low), with a little of his own draw; a player outside the data gets a draw.
 */
export function staOf(pid: string): number {
  const base = pid.split('~')[0];
  const own = (hash01(pid + 'e') - 0.5) * 3.2;   // the old per-player draw (sd ~0.9)
  const d = H.players[base]?.sta;
  return d == null ? own : Math.round((0.75 * d + 0.3 * own) * 100) / 100;
}
/** Stamina on the 0–100 scale. */
export const staRating = (p: { endur: number }) => ratingOf(p.endur / 1.0);
/** The minutes he can play in a game before heavy legs set in. */
export const STA = { cap: 37, capK: 1.5, minCap: 33, maxCap: 41 };
export const staCap = (endur: number) => Math.max(STA.minCap, Math.min(STA.maxCap, STA.cap + STA.capK * endur));
