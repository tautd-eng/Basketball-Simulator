// Player development with variety, and a league-level guard against rating
// inflation or deflation over the decades.
//
// Variety: every player has hidden traits (potential, early/late peak,
// volatility). Year-to-year noise is mean-reverting (an AR(1) process), so a
// lucky season does not compound into a permanent random walk.
//
// Guard: after each off-season the league's rotation players are compared with
// the real league of that season (same measure on real data). Systematic drift
// in any skill, or a talent spread that is too wide or too flat, is pulled back
// part of the way. With the destiny slider at 100% the sim already follows the
// real careers, so the guard does almost nothing there.
import { H, NK, K, agingIndex, bpmOf, ovrOf, LAST_SEASON, FIRST_SEASON, era, shownOvr, shownFromRaw, histShown } from '../data';
import { Rng } from '../rng';
import { League, Player, StatLine, emptyLine, addLine } from '../types';
import { ageIn, realTarget, snapRatings } from '../players';
import { athOf, athStep, AW } from '../athletic';
import { zClamp } from '../ai/value';
import { roleOf } from '../archetypes';
import { posNum } from '../engine/game';

export const DEV = { idio: 0.4, noise: 0.21, ar: 0.55, maxOvrStep: 8, soft: 2.7, maxSkillStep: 0.5, primeDrop: 2.5, maxUp: 6, rookieUp: 5 };
/**
 * Leniency for young players: up to maxAge, a season slightly below expectations
 * (performance signal above -deadZone OVR) does not hurt, a flop (below `flop`)
 * hurts only negFactor as much, and without a flop one summer costs at most
 * maxDrop OVR (≤22, 23–24, 25).
 */
export const YOUNG = { maxAge: 25, deadZone: 2.5, flop: -3, negFactor: 0.5, maxDrop: [0, 1, 2], grow: [0.4, 0.38, 0.35, 0.28, 0.12, 0.12, 0.18, 0.18, 0.1] };

/**
 * The development curve, year by year (index = age − 19, clamped at both ends):
 *  grow:    natural growth of the young (BPM per summer, before the talent bonus that runs until 22)
 *  minDrop: minimum decline by the player's own clock (BPM per summer)
 *  neg:     share of a below-rating season that is charged
 *  pos:     share of an above-rating season that is credited
 *  lgDown / lgUp: share of the league-wide recalibration he carries when the league runs too strong / too weak
 *  young:   most a young player who did not flop can lose in one summer (OVR, sim scale)
 */
/** Share of the data's (survivor-biased) aging growth young players get, by age 19 … 25 (see develop()). */
/** Share of the data's aging decline veterans (29+ by their own clock) take – see develop(). */
export const VET_TREND = 0.5;
export const YOUNG_TREND = [0.8, 0.8, 0.65, 0.35, 0.25, 0.25, 0.3];
export const AGE = {
  //         19    20    21    22    23    24    25    26    27    28    29    30    31    32    33    34    35    36    37    38    39
  grow:   [0.12, 0.11, 0.095, 0.15, 0.11, 0.04, 0.03, 0.02, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  minDrop:[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.13, 0.17, 0.21, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.86],
  neg:    [0, 0, 0, 0, 0.20, 0.55, 0.75, 0.85, 0.90, 1.05, 1.05, 1.00, 1.05, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10],
  pos:    [1.20, 1.20, 1.20, 1.25, 1.30, 1.45, 1.45, 1.40, 1.15, 0.95, 0.90, 0.85, 0.75, 0.65, 0.60, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55],
  lgDown: [0.60, 0.60, 0.60, 0.60, 0.55, 0.50, 0.45, 0.45, 0.50, 0.75, 1.00, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80],
  lgUp:   [1.30, 1.30, 1.30, 1.30, 1.30, 1.30, 1.30, 1.30, 1.30, 1.20, 1.00, 0.80, 0.65, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
  young:  [0, 0, 0, 0, 0.5, 1, 2],
  //         19    20    21    22    23    24
  play:   [0.28, 0.28, 0.26, 0.21, 0.15, 0.10],   // extra growth (BPM) for a starter's season (2500+ minutes) – see playShare
};
/**
 * How much of the playing-time bonus a season earns: nothing for garbage time (under 500 minutes), a little for a
 * bench role, most of it only for real rotation and starter minutes – 1000 min ≈ 16%, 1500 ≈ 39%, 2000 ≈ 69%, 2500+ all.
 */
export const playShare = (min: number) => Math.pow(Math.max(0, Math.min(1, (min - 500) / 2000)), 1.3);
export const atAge = (t: number[], age: number) => t[Math.max(0, Math.min(t.length - 1, Math.round(age) - 19))];

export function ensureDev(p: Player, rng: Rng) {
  if (p.dev) return p.dev;
  // a raw athlete (athletic, skills still behind) is a wider bet: more upside and more spread; a polished
  // non-athlete a narrower one
  const a = athOf(p), raw = Math.max(-1, Math.min(2, a - 0.35 * bpmOf(p.z)));
  const vol = Math.exp(rng.normal() * 0.3 + ATH_DEV.rawVol * raw);
  p.dev = { pot: rng.normal() + ATH_DEV.rawPot * Math.max(0, a), peak: Math.round(rng.normal() * 1.3), vol, e: new Array(NK).fill(0) };
  return p.dev;
}
/** athleticism in development: yearly luck (z), how much the fade hits those who lean on it, skill pass-through, raw-athlete spread and upside */
export const ATH_DEV = { noise: 0.07, lean: 0.6, skill: 1.8, rawVol: 0.12, rawPot: 0.15 };

const TENDENCY = new Set<number>([K.usg, K.tpr]);
/** Usage (z) the real league reaches only in its most extreme seasons (99.9th percentile): above it, development pulls back. */
export const USG_CAP = 2.5;
let OVR_DIR: number[] = [];
/** unit change in BPM along the skills the overall rating rewards (tendencies excluded) */
export function initDev() {
  const w = H.keys.map((k, i) => (TENDENCY.has(i) ? 0 : H.ovr[k]));
  const n2 = w.reduce((a, x) => a + x * x, 0);
  OVR_DIR = w.map(x => x / n2);
}

// ------------------------------------------------------------------ performance
// How a player actually played moves his ratings: each skill with a box-score
// trace (shooting, rebounding, passing, ...) is compared with the league that
// season and pulled toward what he showed, more so the more he played. A role
// player who catches fire in big minutes comes back next season much better.
type Obs = { k: number; log: boolean; num: (l: StatLine) => number; den: (l: StatLine) => number; prior: number; w?: number };
const OBS: Obs[] = [
  { k: K.ins, log: false, num: l => l.fgm - l.tpm, den: l => l.fga - l.tpa, prior: 180 },
  { k: K.tp, log: false, num: l => l.tpm, den: l => l.tpa, prior: 200 },
  { k: K.ft, log: false, num: l => l.ftm, den: l => l.fta, prior: 90 },
  { k: K.drw, log: true, num: l => l.fta, den: l => l.fga, prior: 250 },
  { k: K.tpr, log: false, num: l => l.tpa, den: l => l.fga, prior: 150 },
  { k: K.tov, log: false, num: l => l.tov, den: l => l.fga + 0.44 * l.fta + l.ast + l.tov, prior: 400 }, // per action, assists counted (as in the data)
  { k: K.usg, log: true, num: l => l.fga + 0.44 * l.fta + l.tov, den: l => l.min, prior: 500 },
  { k: K.ast, log: true, num: l => l.ast, den: l => l.min, prior: 450 },
  { k: K.orb, log: true, num: l => l.orb, den: l => l.min, prior: 450 },
  { k: K.drb, log: true, num: l => l.drb, den: l => l.min, prior: 450 },
  { k: K.stl, log: true, num: l => l.stl, den: l => l.min, prior: 600 },
  { k: K.blk, log: true, num: l => l.blk, den: l => l.min, prior: 600 },
  { k: K.pf, log: true, num: l => l.pf, den: l => l.min, prior: 600 },
  // defence: shots he contested as the primary defender that missed (older seasons have no count and are skipped)
  { k: K.def, log: false, num: l => (l.dfga ?? 0) - (l.dfgm ?? 0), den: l => l.dfga ?? 0, prior: 600, w: 1 },
];
export const PERF = { alpha: 1, skill: 0.32, overall: 0.9, maxStep: 12, vetNeg: 1.1, youngPos: 1.2, spread: [0.5, 0.3, 0.2] };
const lgt = (p: number) => Math.log(Math.min(0.995, Math.max(0.005, p)) / (1 - Math.min(0.995, Math.max(0.005, p))));

/** Season line (regular season + playoffs) the player produced in season Y. */
function seasonLine(p: Player, Y: number): StatLine | null {
  const ls = p.career.filter(c => c.s === Y);
  if (!ls.length) return null;
  const out = emptyLine();
  for (const l of ls) addLine(out, l);
  return out.min > 0 ? out : null;
}

/** Weighted least squares y = a + b·x + c·x²; returns the fitted value and local slope at x. */
function wls(xs: number[], ys: number[], ws: number[]) {
  // normal equations for [1, x, x^2]
  const S = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < xs.length; i++) {
    const v = [1, xs[i], xs[i] * xs[i]];
    for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) S[r][c] += ws[i] * v[r] * v[c]; S[r][3] += ws[i] * v[r] * ys[i]; }
  }
  for (let r = 0; r < 3; r++) S[r][r] += 1e-6;
  for (let c = 0; c < 3; c++) {
    let piv = c; for (let r = c + 1; r < 3; r++) if (Math.abs(S[r][c]) > Math.abs(S[piv][c])) piv = r;
    [S[c], S[piv]] = [S[piv], S[c]];
    if (Math.abs(S[c][c]) < 1e-12) return null;
    for (let r = 0; r < 3; r++) if (r !== c) { const f = S[r][c] / S[c][c]; for (let k = c; k < 4; k++) S[r][k] -= f * S[c][k]; }
  }
  const [a, b, c] = [S[0][3] / S[0][0], S[1][3] / S[1][1], S[2][3] / S[2][2]];
  if (![a, b, c].every(Number.isFinite)) return null;
  return { fit: (x: number) => a + b * x + c * x * x, slope: (x: number) => b + 2 * c * x };
}

/**
 * Rating change suggested by last season's play (before aging), and the OVR it implies.
 * For every skill the league-wide relation "rating → observed stat" is fitted on
 * that season; only what a player did above or below that line counts. So the
 * signal is pure over/under-performance and cannot feed on itself.
 */
/** Weighted ridge regression of y on the whole rating profile (all box-score skills, not defence). */
function profileFit(zs: number[][], ys: number[], ws: number[]) {
  const ks = Array.from({ length: NK }, (_, k) => k).filter(k => k !== K.def);
  const m = ks.length + 1, n = ys.length;
  if (n < m * 4) return null;
  const A = Array.from({ length: m }, () => new Array(m).fill(0)), bv = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    const x = [1, ...ks.map(k => zs[i][k])], w = ws[i];
    for (let a = 0; a < m; a++) { bv[a] += w * x[a] * ys[i]; for (let c = 0; c < m; c++) A[a][c] += w * x[a] * x[c]; }
  }
  const W = ws.reduce((a, x) => a + x, 0);
  for (let a = 1; a < m; a++) A[a][a] += 0.02 * W;
  // Gaussian elimination
  for (let c = 0; c < m; c++) {
    let piv = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [bv[c], bv[piv]] = [bv[piv], bv[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < m; r++) if (r !== c) { const f = A[r][c] / A[c][c]; if (!f) continue; for (let q = c; q < m; q++) A[r][q] -= f * A[c][q]; bv[r] -= f * bv[c]; }
  }
  const beta = bv.map((v, i) => v / A[i][i]);
  return (z: number[]) => beta[0] + ks.reduce((a, k, j) => a + beta[j + 1] * z[k], 0);
}

export function performanceShift(lg: League, Y: number) {
  if (!OVR_DIR.length) initDev();
  const lines: { p: Player; l: StatLine }[] = [];
  for (const p of Object.values(lg.players)) { const l = seasonLine(p, Y); if (l && l.min >= 60) lines.push({ p, l }); }
  const out = new Map<string, { dz: number[]; ovrGain: number }>();
  for (const { p } of lines) out.set(p.id, { dz: new Array(NK).fill(0), ovrGain: 0 });
  // team context: how good the teammates he shared the ball with were (minutes-weighted). On a stacked team
  // a good player shoots, scores and assists less – that is his role, not a decline.
  const byTeam = new Map<string, { p: Player; min: number }[]>();
  for (const { p } of lines) for (const c of p.career) if (c.s === Y && !c.po && c.tid && c.min > 0) {
    let a = byTeam.get(c.tid); if (!a) byTeam.set(c.tid, a = []); a.push({ p, min: c.min });
  }
  const ctx = new Map<string, number>();
  for (const { p } of lines) {
    let sw = 0, sq = 0;
    for (const c of p.career) if (c.s === Y && !c.po && c.tid && c.min > 0) {
      let tw = 0, tq = 0;
      for (const m of byTeam.get(c.tid) ?? []) if (m.p !== p) { tw += m.min; tq += m.min * Math.max(-4, bpmOf(m.p.z)); }
      if (tw > 0) { sw += c.min; sq += c.min * tq / tw; }
    }
    ctx.set(p.id, sw ? sq / sw : 0);
  }
  /** take out the part of the residuals that the quality of the teammates explains */
  const deCtx = (res: number[], who: Player[], ws: number[]) => {
    let W = 0, mx = 0, my = 0;
    who.forEach((p, i) => { W += ws[i]; mx += ws[i] * ctx.get(p.id)!; my += ws[i] * res[i]; });
    if (W <= 0) return res;
    mx /= W; my /= W;
    let cov = 0, vx = 0;
    who.forEach((p, i) => { const dx = ctx.get(p.id)! - mx; cov += ws[i] * dx * (res[i] - my); vx += ws[i] * dx * dx; });
    const b = vx > 1e-9 ? cov / vx : 0;
    return res.map((r, i) => r - b * (ctx.get(who[i].id)! - mx));
  };
  const ROLE = new Set<number>([K.usg, K.ast, K.tpr, K.drw, K.orb, K.drb]);
  const USG_DETREND = new Set<number>([K.ins, K.tp, K.drw, K.tov]);
  /** residuals less their weighted linear trend on the usage rating (a piecewise one: only above-average usage) */
  const deUsg = (res: number[], who: Player[], ws: number[]) => {
    const u = who.map(p => Math.max(0, p.z[K.usg]));
    let W = 0, mx = 0, my = 0;
    u.forEach((x, i) => { W += ws[i]; mx += ws[i] * x; my += ws[i] * res[i]; });
    if (W <= 0) return res;
    mx /= W; my /= W;
    let cov = 0, vx = 0;
    u.forEach((x, i) => { cov += ws[i] * (x - mx) * (res[i] - my); vx += ws[i] * (x - mx) ** 2; });
    const b = vx > 1e-9 ? cov / vx : 0;
    return res.map((r, i) => r - 0.3 * b * (u[i] - mx));   // a third of it: the positional ranking takes out the rest
  };
  // 1) skill by skill
  for (const o of OBS) {
    // tendencies (how many shots he takes, how many of them threes) are handed out by the game engine itself:
    // reading them back as a skill would feed on itself – the engine gives a star a little more of the ball than
    // his rating says, the rating goes up, he gets more again ... (a usage that only ever climbs)
    if (TENDENCY.has(o.k)) continue;
    const xs: number[] = [], ys: number[] = [], ws: number[] = [], who: { p: Player; n: number }[] = [];
    for (const { p, l } of lines) {
      const n = o.den(l);
      if (n <= 0) continue;
      const r = o.num(l) / n;
      xs.push(p.z[o.k]); ys.push(o.log ? Math.log(Math.max(r, 1e-3)) : lgt(r)); ws.push(n / (n + o.prior)); who.push({ p, n });
    }
    const f = wls(xs, ys, ws);
    if (!f) continue;
    let res = ys.map((y, i) => y - f.fit(xs[i]));
    if (ROLE.has(o.k)) res = deCtx(res, who.map(x => x.p), ws);
    // the go-to man meets the stopper, the double team and the late-clock shot: the engine takes a little off his
    // twos and free throws and adds to his turnovers for every point of usage (test/statfit.ts by usage band). That is
    // the job, not a slump – take out what usage explains, or every high-usage star "declines" each season
    if (USG_DETREND.has(o.k)) res = deUsg(res, who.map(x => x.p), ws);
    if (o.k === K.def) {
      // bigs contest shots at the rim, guards jumpers: compare each with his own position group
      const grp = (p: Player) => { const n = posNum(p.pos); return n <= 2.5 ? 0 : n >= 4.5 ? 2 : 1; };
      const gm = [[0, 0], [0, 0], [0, 0]];
      who.forEach((x, i) => { const g = gm[grp(x.p)]; g[0] += ws[i] * res[i]; g[1] += ws[i]; });
      res = res.map((r, i) => { const g = gm[grp(who[i].p)]; return g[1] > 0 ? r - g[0] / g[1] : r; });
    }
    who.forEach((x, i) => {
      const sl = f.slope(xs[i]);
      if (sl < 0.03) return;
      const resid = res[i];
      const dz = Math.max(-0.7, Math.min(0.7, (resid / sl) * ws[i]));
      out.get(x.p.id)!.dz[o.k] += PERF.skill * dz;
    });
  }
  // 2) overall production per 36 minutes against what his overall rating predicts
  const xs = lines.map(x => bpmOf(x.p.z)), ys = lines.map(x => gameScore(x.l) / x.l.min * 36), ws = lines.map(x => x.l.min);
  const f = wls(xs, ys, ws);
  // what a player with his exact skill profile usually produces in the box score – so a defensive anchor (whose
  // value barely shows in a box score) or a low-usage role player is measured against players like him, not
  // against scorers of the same overall rating
  const prof = profileFit(lines.map(x => x.p.z), ys, ws);
  const ores0 = f ? deCtx(ys.map((y, i) => y - (prof ? prof(lines[i].p.z) : f.fit(xs[i]))), lines.map(x => x.p), ws) : [];
  // no role is better or worse at beating its own expectations: take out what is common to a whole role
  const roleMean = new Map<string, [number, number]>();
  const roleOfP = lines.map(x => roleOf(x.p.z, x.p.pos).arch.id);
  ores0.forEach((r, i) => { const m = roleMean.get(roleOfP[i]) ?? [0, 0]; m[0] += ws[i] * r; m[1] += ws[i]; roleMean.set(roleOfP[i], m); });
  const ores = ores0.map((r, i) => { const m = roleMean.get(roleOfP[i])!; return m[1] > 3000 ? r - m[0] / m[1] : r; });
  // the skill-by-skill signal (1) counts by minutes per game, as before
  for (const { p, l } of lines) {
    const d = out.get(p.id)!;
    d.dz[K.def] += 0.3 * (d.dz[K.stl] + d.dz[K.blk] + d.dz[K.drb]) / 3;
    const g0 = ovrOf(p.z.map((v, i) => v + d.dz[i])) - ovrOf(p.z);
    const tr = minutesTrust(l.min / Math.max(1, l.gp), g0 > 0);
    if (tr < 1) for (let k = 0; k < NK; k++) d.dz[k] *= tr;
  }
  // 2) overall: where his season ranks among the players of his position against where his rating ranks them.
  // What he showed is his rating plus what his box score beat (or missed) players of his exact profile by; ranking
  // it inside his position takes out whatever the engine does to a whole position or to the very top (a superstar
  // who plays like the best SF stays the best SF – no yearly bonus for being a star). The rank he played to is
  // turned back into a rating: the rating the player at that rank has. Regulars (ROT.min+ minutes) are ranked among
  // regulars; reserves (ROT.bench+) among reserves of their position – the best of them can play himself up to
  // about the level of the ROT.benchCap-th best regular there, and a reserve's season counts less.
  if (f) {
    const obs = lines.map((x, i) => xs[i] + Math.max(-4, Math.min(4, ores[i] / Math.max(0.3, f.slope(xs[i])))));
    const posOf = (p: Player) => Math.min(5, Math.max(1, Math.round(posNum(p.pos))));
    const idx = lines.map((_, i) => i);
    for (let g = 1; g <= 5; g++) {
      const rot = idx.filter(i => posOf(lines[i].p) === g && lines[i].l.min >= ROT.min);
      const bench = idx.filter(i => posOf(lines[i].p) === g && lines[i].l.min >= ROT.bench && lines[i].l.min < ROT.min);
      const rotR = rot.map(i => xs[i]).sort((a, b) => b - a);
      const cap = rotR.length ? rotR[Math.min(ROT.benchCap - 1, rotR.length - 1)] : Infinity;
      for (const [pool, isBench] of [[rot, false], [bench, true]] as [number[], boolean][]) {
        if (pool.length < 4) continue;
        const ratings = pool.map(i => xs[i]).sort((a, b) => b - a);
        const byObs = pool.slice().sort((a, b) => obs[b] - obs[a]);
        byObs.forEach((i, r) => {
          let deserved = ratings[r];
          if (isBench && deserved > xs[i]) deserved = Math.max(xs[i], Math.min(deserved, cap));
          const gap = Math.max(-4, Math.min(4, deserved - xs[i]));
          const m = lines[i].l.min;
          const w = (isBench ? ROT.benchW : 1) * m / (m + 900);
          const d = out.get(lines[i].p.id)!.dz;
          for (let k = 0; k < NK; k++) d[k] += PERF.overall * ROT.k * gap * w * OVR_DIR[k];
        });
      }
    }
  }
  for (const { p } of lines) { const d = out.get(p.id)!; d.ovrGain = ovrOf(p.z.map((v, i) => v + d.dz[i])) - ovrOf(p.z); }
  // Age is not a skill. A veteran's legs, stamina and athleticism already fall in his ratings, and the engine plays
  // them – so as a group the 30+ underperform the line every season, and charging that again on top of the aging
  // curve made every veteran decline twice (−2.2 a summer at 33+ against −1.55 in the data). Each age group's mean
  // signal is taken out; who beat or missed his group still counts in full.
  const grpA = (p: Player) => { const a = Y - (p.born ?? Y); return a >= 33 ? 2 : a >= 30 ? 1 : -1; };
  const gm = [[0, 0], [0, 0], [0, 0]];
  for (const { p, l } of lines) { const g = grpA(p); if (g < 0) continue; gm[g][0] += l.min * out.get(p.id)!.ovrGain; gm[g][1] += l.min; }
  for (const { p } of lines) {
    const g = grpA(p); if (g < 0 || gm[g][1] < 5000) continue;
    const m = gm[g][0] / gm[g][1]; if (m >= 0) continue;
    const d = out.get(p.id)!, z0 = ovrOf(p.z);
    // shift along the OVR direction until his gain is up by −m
    let lo = 0, hi = 3 * Math.abs(m) + 1;
    for (let it = 0; it < 20; it++) { const mid = (lo + hi) / 2; const g1 = ovrOf(p.z.map((v, i) => v + d.dz[i] + mid * OVR_DIR[i])) - z0; if (g1 - d.ovrGain < -m) lo = mid; else hi = mid; }
    for (let k = 0; k < NK; k++) d.dz[k] += lo * OVR_DIR[k];
    d.ovrGain = ovrOf(p.z.map((v, i) => v + d.dz[i])) - z0;
  }
  return out;
}
/** How much a season's signal counts by minutes per game: a step up only from ~15 mpg (in full from ~30),
 *  a step down a little from the start, in full from ~26 mpg. */
export const minutesTrust = (mpg: number, up: boolean) => up
  ? (mpg < MPG.upFrom ? 0 : MPG.upMin + (1 - MPG.upMin) * Math.min(1, (mpg - MPG.upFrom) / (MPG.upFull - MPG.upFrom)))
  : MPG.downMin + (1 - MPG.downMin) * Math.min(1, Math.max(0, (mpg - MPG.downFrom) / (MPG.downFull - MPG.downFrom)));
/** The positional ranking: regulars from `min` minutes, reserves from `bench`; a reserve can play himself up to the
 *  benchCap-th best regular of his position at most, and his season counts benchW as much; k scales the step. */
/** Memory of what performance has already moved a player (OVR): same-way signals count less the further he went
 *  (nothing left at `span`, at least `floor`); it fades by `fade` a year, so a later breakout counts in full again. */
/** Breakout summers: chance by age (index = age − 19), the leap in OVR (min–max), and what makes one likelier:
 *  hidden potential (per sd, exponent), a season above his rating, a jump the summer before. */
export const BREAK = { p: [0, 0, 0, 0, 0.075, 0.04, 0.07, 0.06, 0.04, 0.008, 0.008, 0], min: 2.5, max: 4.5, pot: 0.35, elite: 86, played: 1.4, momentum: 1.5,
  skills: ['tp', 'ins', 'ast', 'def', 'ft', 'drb', 'tov'] };
export const PCUM = { span: 8, floor: 0.15, fade: 0.8 };
export const ROT = { min: 1200, bench: 300, benchCap: 15, benchW: 0.6, k: 0.85 };
export const MPG = { upFrom: 15, upMin: 0.35, upFull: 30, downFrom: 10, downMin: 0.25, downFull: 26 };
const gameScore = (l: StatLine) => l.pts + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.orb + 0.3 * l.drb + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov;

export function develop(lg: League, rng: Rng) {
  if (!OVR_DIR.length) initDev();
  const Y = lg.season, d = lg.destiny;
  if (!OVR_DIR.length) initDev();
  const perf = performanceShift(lg, Y);
  for (const p of Object.values(lg.players)) {
    if (p.retired) continue;
    if (p.entered === Y + 1) { ensureDev(p, rng); continue; } // just drafted: ratings already set
    const dev = ensureDev(p, rng);
    const age = ageIn(p, Y);
    const ai = agingIndex(age - dev.peak);
    const z0 = p.z.slice();
    // the summer's change by cause, in displayed OVR points (for the progression screen)
    const sh = () => shownOvr(p.z, p.id);
    const pre = p.ovrHist?.find(h => h[0] === Y);
    const s0 = sh();
    const why: any = { s: Y + 1, inj: pre ? s0 - histShown(pre) : 0, perf: 0, trend: 0, luck: 0, cap: 0, destiny: 0, total: 0 };
    // 1) what he showed on the court
    const pf = perf.get(p.id);
    // a player named to an All-League or All-Defensive team (or MVP / DPOY) had a good season by definition:
    // no penalty for not matching an already sky-high rating
    const honored = (p.awards ?? []).some(a => a.startsWith(`${Y} `) && /All-League|All-Defensive|MVP$|DPOY$/.test(a) && !/Finals/.test(a));
    if (pf && honored && pf.ovrGain < 0) { pf.ovrGain = 0; pf.dz.fill(0); }
    const flop = !!pf && pf.ovrGain < YOUNG.flop;
    (dev as any).flop = flop;
    const cur = new Array(NK).fill(0);
    if (pf) {
      // a season below his rating: up to 22 it costs nothing (the young grow into their game), from 23 the bill
      // comes in step by step, and a veteran who no longer delivers pays in full (he will not grow back into it).
      // A good season counts most for the young – and right away (below).
      // the signal moves his overall, not the skills behind it – so a profile the engine keeps over- (or under-)
      // rating would push him the same way every year without end. What earlier seasons already moved him is
      // remembered (fading a little each year): the further he has gone one way, the less the same signal counts
      const pc = (dev as any).pcum ?? 0;
      const same = Math.sign(pc) === Math.sign(pf.ovrGain) && pc !== 0;
      const damp = same ? Math.max(PCUM.floor, 1 - Math.abs(pc) / PCUM.span) : 1;
      const a = PERF.alpha * atAge(pf.ovrGain < 0 ? AGE.neg : AGE.pos, age) * damp;
      if (age <= 22 && pf.ovrGain < 0) why.dz = true;
      const gain = pf.ovrGain * a;
      const cap = Math.abs(gain) > PERF.maxStep ? PERF.maxStep / Math.abs(gain) : 1;
      for (let i = 0; i < NK; i++) cur[i] = pf.dz[i] * a * cap;
      // a young player who delivers – or a veteran who still does – is rewarded at once, not over three summers
      if ((age <= 24 || age >= 28) && pf.ovrGain > 0) { for (let i = 0; i < NK; i++) p.z[i] += cur[i]; cur.fill(0); }
    }
    // what a season shows is spread over three summers (50 / 30 / 20): one bad year does not sink a player at once,
    // and a real decline (or a real step up) keeps adding up
    {
      const q = dev.pq ?? [];
      for (let i = 0; i < NK; i++) p.z[i] += PERF.spread[0] * cur[i] + PERF.spread[1] * (q[0]?.[i] ?? 0) + PERF.spread[2] * (q[1]?.[i] ?? 0);
      dev.pq = [cur.map(v => Math.round(v * 1000) / 1000), ...(q[0] ? [q[0]] : [])];
    }
    why.flop = flop;
    const s1 = sh();
    why.perf = s1 - s0;
    (dev as any).pcum = Math.round((((dev as any).pcum ?? 0) * PCUM.fade + (s1 - s0)) * 100) / 100;
    // 2) age, potential and year-to-year noise
    const before = ovrOf(p.z);
    const potBoost = age <= 24 ? 0.05 : age <= 27 ? 0.025 : 0;
    const nat = new Array(NK).fill(0);
    const eNew = new Array(NK).fill(0);
    // the summer's luck: mostly one common "form" factor along the overall rating (a good or an off summer), with
    // only a small part skill by skill – so his overall moves as much as before, but single skills no longer churn
    // at random (a shooter does not lose 5 points of shooting while gaining 6 of blocks out of nothing)
    const sdOf = (i: number) => H.aging[H.keys[i]].sd[ai] * DEV.noise * dev.vol;
    const wO = H.keys.map((k, i) => (TENDENCY.has(i) ? 0 : H.ovr[k]));
    const commonSd = Math.sqrt(H.keys.reduce((a, _, i) => a + (sdOf(i) * wO[i]) ** 2, 0) * (1 - DEV.idio ** 2));
    const g = rng.normal() * commonSd;
    for (let i = 0; i < NK; i++) {
      const a = H.aging[H.keys[i]];
      const pot = (TENDENCY.has(i) ? 0.4 : 1) * potBoost * dev.pot * (i === K.tov || i === K.pf ? -1 : 1);
      eNew[i] = DEV.ar * dev.e[i] + rng.normal() * sdOf(i) * DEV.idio + g * OVR_DIR[i];
      // trend moves with the aging curve; the noise component is replaced, not added on top
      // the data's aging curve is measured on players who stayed in the league (the ones who got better): for the young
      // it runs too steep, so their average growth is taken at YOUNG_TREND of it
      // ...and for veterans it runs too steep the other way (measured on those who kept their place, in a league
      // whose coaches bench a declining veteran sooner): past ~29 by his own clock, VET_TREND of it
      const m = a.mean[ai] > 0 && age <= 25 ? a.mean[ai] * atAge(YOUNG_TREND, age) : a.mean[ai] < 0 && age - dev.peak >= 29 ? a.mean[ai] * VET_TREND : a.mean[ai];
      nat[i] = m + pot + (eNew[i] - dev.e[i]);
    }
    // the young grow by themselves until about 23 – the more talented (hidden potential, and already good for his
    // age) the faster; no box score needed for that
    // (and keep filling out a little until 26, so careers peak at 25–27 as in the real league)
    if (age <= 27) {
      const expect = age <= 19 ? 70 : age <= 21 ? 72 : 74;
      const t = age <= 22 ? 0.5 * dev.pot + (s0 - expect) / 6 : 0;
      const grow = atAge(AGE.grow, age) + 0.3 * Math.max(0, Math.min(2.5, t));
      for (let i = 0; i < NK; i++) nat[i] += grow * OVR_DIR[i];
    }
    // playing time develops the young: minutes against NBA players count on top of growing up
    if (age <= 24) {
      const ln = seasonLine(p, Y);
      const play = atAge(AGE.play, age) * playShare(ln?.min ?? 0);
      if (play > 0) for (let i = 0; i < NK; i++) nat[i] += play * OVR_DIR[i];
    }
    // the age curve by the player's own clock (some peak early, some late): no natural decline before 28,
    // then it starts gently (28–29) and gets steeper from 30 – the data's curve only sees survivors, so a
    // minimum expected decline (BPM per year, along the overall-rating direction) is enforced
    {
      const effAge = age - dev.peak;
      const meanOnly = p.z.map((v, i) => v + H.aging[H.keys[i]].mean[ai]);
      const drift = bpmOf(meanOnly) - bpmOf(p.z);
      if (effAge <= 28 && drift < 0) for (let i = 0; i < NK; i++) nat[i] -= drift * OVR_DIR[i];
      const minDrop = atAge(AGE.minDrop, effAge);
      const extra = Math.max(0, drift + minDrop);
      if (minDrop > 0 && extra > 0) for (let i = 0; i < NK; i++) nat[i] -= extra * OVR_DIR[i];
    }
    // athleticism: a year older is a step quicker (to 22) or slower (from 27, faster past 30). The league's average
    // fade is already in the age curve above; what moves his skills here is his own part – the year's luck, and
    // a fade (or growth) that is bigger the more he leaned on his athleticism (a high flyer loses more than a craftsman)
    {
      const a0 = athOf(p, Y);
      const st = athStep(age + 1), luckA = rng.normal() * ATH_DEV.noise;
      p.ath = Math.round((a0 + st + luckA) * 1000) / 1000;
      const own = luckA + st * ATH_DEV.lean * a0;
      for (let i = 0; i < NK; i++) nat[i] += ATH_DEV.skill * AW[i] * own;
      why.athD = Math.round((st + luckA) * 100) / 100;
    }
    // no single off-season moves a player more than DEV.maxOvrStep overall points
    const trial = p.z.map((v, i) => v + nat[i]);
    const step = ovrOf(trial) - before;
    const scale = Math.abs(step) > DEV.maxOvrStep ? DEV.maxOvrStep / Math.abs(step) : 1;
    // split the age trend (and potential) from the summer's luck
    const luckPart = eNew.map((v, i) => (v - dev.e[i]) * scale);
    for (let i = 0; i < NK; i++) p.z[i] += nat[i] * scale - luckPart[i];
    const s2 = sh();
    for (let i = 0; i < NK; i++) p.z[i] += luckPart[i];
    const s3 = sh();
    why.trend = s2 - s1; why.luck = s3 - s2;
    dev.e = eNew;
    // 3) a breakout summer: now and then a player in his early-to-mid twenties makes a real leap – he adds a skill
    // (a reliable three, playmaking, defence ...) and the rest of his game comes along. As often as in the real league
    // (by age), likelier with hidden potential, after a season he outplayed his rating, and right after a jump
    {
      const bp = atAge(BREAK.p, age);
      if (bp > 0 && (p.injury ?? 0) < 30) {
        let mult = Math.exp(BREAK.pot * (dev.pot ?? 0));
        if (pf && pf.ovrGain > 0) mult *= BREAK.played;
        const pw = p.devWhy;
        if (pw && pw.s === Y && (pw.total ?? 0) >= 3) mult *= BREAK.momentum;
        // the very best have less room to leap (and the league no more superstars than it should)
        const elite = s0 >= BREAK.elite;
        if (elite) mult *= 0.5;
        if (rng.next() < bp * mult) {
          const sb = sh();
          const G = elite ? BREAK.min + rng.next() * 0.8 : BREAK.min + rng.next() * (BREAK.max - BREAK.min);
          // the skill he adds: one of the trainable ones, likelier where he has room to grow
          const cand = BREAK.skills.map(k => K[k as keyof typeof K] as number);
          const wts = cand.map(k => Math.max(0.15, 1.6 - (H.ovr[H.keys[k]] < 0 ? -p.z[k] : p.z[k])));
          let r = rng.next() * wts.reduce((a, b) => a + b, 0), fi = 0;
          while (fi < cand.length - 1 && (r -= wts[fi]) > 0) fi++;
          const fk = cand[fi], sgn = H.ovr[H.keys[fk]] < 0 ? -1 : 1;
          p.z[fk] += sgn * (0.25 + 0.2 * rng.next());
          const base = p.z.slice(), o0 = sb;
          if (shownOvr(p.z, p.id) - o0 < G) {
            let lo = 0, hi = 4;
            for (let it = 0; it < 14; it++) { const t = (lo + hi) / 2; if (shownOvr(base.map((v, i) => v + t * OVR_DIR[i]), p.id) - o0 < G) lo = t; else hi = t; }
            for (let i = 0; i < NK; i++) p.z[i] = base[i] + hi * OVR_DIR[i];
          }
          why.breakout = sh() - sb; why.focus = H.keys[fk];
        }
      }
    }
    // a usage beyond the real league's extremes (top 0.1 % of seasons) comes back halfway each summer – it can
    // only have come from an engine loop, and it is what turns a star into a 40-point scorer
    if (p.z[K.usg] > USG_CAP) p.z[K.usg] -= 0.5 * (p.z[K.usg] - USG_CAP);
    // young players who did not flop lose at most a little in one summer
    const maxDrop = age <= 25 ? atAge(AGE.young, age) : Infinity;
    // grown players don't swing wildly: one summer moves a single skill by at most maxSkillStep (≈7 rating points)
    if (age >= 24) for (let i = 0; i < NK; i++) { const dv = p.z[i] - z0[i]; if (Math.abs(dv) > DEV.maxSkillStep) p.z[i] = z0[i] + Math.sign(dv) * DEV.maxSkillStep; }
    // and in his prime (26–29) a player who did not flop loses at most a few points in one summer
    // (a bad season – a flop – may cost a little more; serious injuries are handled separately)
    const primeCap = age >= 25 && age <= 29 ? (flop ? DEV.primeDrop + 1.5 : DEV.primeDrop) : Infinity;
    if ((flop || maxDrop === Infinity) && primeCap < Infinity) {
      const o0 = ovrOf(z0), drop = ovrOf(p.z) - o0;
      if (drop < -primeCap) {
        let lo = 0, hi = 1;
        for (let it = 0; it < 12; it++) { const t = (lo + hi) / 2; if (ovrOf(z0.map((v, i) => v + t * (p.z[i] - v))) - o0 >= -primeCap) lo = t; else hi = t; }
        for (let i = 0; i < NK; i++) p.z[i] = z0[i] + lo * (p.z[i] - z0[i]);
      }
    }
    if ((!flop || age <= 22) && maxDrop < Infinity) {
      const o0 = ovrOf(z0), drop = ovrOf(p.z) - o0;
      if (drop < -maxDrop) {
        let lo = 0, hi = 1; // largest share of this summer's change that keeps the drop within the limit
        for (let it = 0; it < 12; it++) { const t = (lo + hi) / 2; if (ovrOf(z0.map((v, i) => v + t * (p.z[i] - v))) - o0 >= -maxDrop) lo = t; else hi = t; }
        for (let i = 0; i < NK; i++) p.z[i] = z0[i] + lo * (p.z[i] - z0[i]);
      }
    }
    // nobody jumps more than a few overall points in one summer (a rookie even less): big leaps happen over years
    {
      const rookie = p.entered >= Y;
      const capUp = rookie ? DEV.rookieUp : DEV.maxUp, o0 = shownOvr(z0);
      if (shownOvr(p.z) - o0 > capUp) {
        let lo = 0, hi = 1;
        for (let it = 0; it < 12; it++) { const t = (lo + hi) / 2; if (shownOvr(z0.map((v, i) => v + t * (p.z[i] - v))) - o0 <= capUp) lo = t; else hi = t; }
        for (let i = 0; i < NK; i++) p.z[i] = z0[i] + lo * (p.z[i] - z0[i]);
      }
    }
    const s4 = sh();
    why.cap = s4 - s3 - (why.breakout ?? 0);
    // destiny: pull toward the real career
    const tgt = realTarget(p.id, Y + 1 - (p.shift ?? 0));
    if (tgt) for (let i = 0; i < NK; i++) p.z[i] += d * (tgt.z[i] - p.z[i]);
    const s5 = sh();
    why.destiny = s5 - s4;
    // soft ceiling on single skills (not applied to real values under full destiny)
    const s = 1 - (tgt ? d : 0);
    for (let i = 0; i < NK; i++) {
      const v = p.z[i];
      if (v > DEV.soft) p.z[i] = v - s * 0.5 * (v - DEV.soft);
      else if (v < -DEV.soft - 0.5) p.z[i] = v - s * 0.5 * (v + DEV.soft + 0.5);
    }
    zClamp(p.z);
    why.cap += sh() - s5;   // the soft ceiling on single skills counts as a limit too
    why.total = sh() - s0 + why.inj;
    p.devWhy = why;
    snapRatings(p, Y + 1);
  }
}

// ------------------------------------------------------------------ league profile
export interface Profile { mean: number[]; bpmMean: number; bpmSd: number; top10: number; rotOvr: number; n80: number; n90?: number }
const W = [36, 34, 32, 30, 28, 24, 20, 16, 12, 8];

function profileOf(teams: number[][][]): Profile {
  // teams: list of rosters, each a list of z vectors
  const mean = new Array(NK).fill(0);
  let sw = 0;
  const bp: [number, number][] = [];
  const all: number[] = [], shown: number[] = [];
  for (const roster of teams) {
    const sorted = roster.map(z => ({ z, b: bpmOf(z) })).sort((a, b) => b.b - a.b);
    for (const x of sorted) { all.push(x.b); shown.push(shownOvr(x.z)); }
    sorted.slice(0, 10).forEach((x, i) => {
      const w = W[i];
      for (let k = 0; k < NK; k++) mean[k] += w * x.z[k];
      bp.push([x.b, w]);
      sw += w;
    });
  }
  for (let k = 0; k < NK; k++) mean[k] /= sw;
  const bm = bp.reduce((a, [b, w]) => a + b * w, 0) / sw;
  const bsd = Math.sqrt(bp.reduce((a, [b, w]) => a + w * (b - bm) ** 2, 0) / sw);
  all.sort((a, b) => b - a);
  const top10 = all.slice(0, 10).reduce((a, b) => a + ovrOf0(b), 0) / Math.min(10, all.length);
  return { mean, bpmMean: bm, bpmSd: bsd, top10, rotOvr: ovrOf0(bm), n80: shown.filter(o => o >= 80).length, n90: shown.filter(o => o >= 90).length }; // counts on the displayed OVR scale
}
const ovrOf0 = (b: number) => Math.max(25, Math.min(99, 48 + 5.5 * b));

const realCache: Record<number, Profile> = {};
export function realProfile(season: number): Profile {
  const S = Math.min(Math.max(season, FIRST_SEASON), LAST_SEASON);
  if (realCache[S]) return realCache[S];
  const byTeam: Record<string, number[][]> = {};
  for (const hp of Object.values(H.players)) {
    const r = hp.s.find(x => x[0] === S);
    if (!r || r[3] < 300) continue;
    (byTeam[r[1]] ??= []).push(r[7]);
  }
  return (realCache[S] = profileOf(Object.values(byTeam)));
}

export function simProfile(lg: League): Profile {
  const rosters = Object.values(lg.teams).filter(t => t.active).map(t => t.roster.map(pid => lg.players[pid].z));
  return profileOf(rosters);
}

export interface HealthRec { s: number; sim: Profile; real: Profile; shift: number; spread: number }

/** Pull league-wide drift back toward the real league of this season. */
/**
 * After the league-wide recalibration: young players who did not flop end the
 * summer at most YOUNG.maxDrop below last season's rating (the recalibration
 * moves everyone and could otherwise undo the leniency).
 */
export function youngFloor(lg: League, S = lg.season) {
  if (!OVR_DIR.length) initDev();
  for (const p of Object.values(lg.players)) {
    if (p.retired || !p.dev || (p.dev as any).flop) continue;
    const age = ageIn(p, S - 1);
    const maxDrop = age <= 25 ? atAge(AGE.young, age) : Infinity;
    if (maxDrop === Infinity) continue;
    const prev = p.ovrHist.find(h => h[0] === S - 1)?.[1];
    if (prev === undefined) continue;
    const target = prev - maxDrop;
    if (ovrOf(p.z) >= target) continue;
    let lo = 0, hi = 3;
    for (let it = 0; it < 14; it++) { const t = (lo + hi) / 2; if (ovrOf(p.z.map((v, i) => v + t * OVR_DIR[i])) >= target) hi = t; else lo = t; }
    for (let i = 0; i < NK; i++) p.z[i] += hi * OVR_DIR[i];
    zClamp(p.z);
    snapRatings(p, S);
  }
}

/** League calibration: how hard it pulls toward the real league (share per summer), and how many more 80+ players
 *  than the real league of that season it tolerates before pulling the top down. */
export const CAL = { str: 0.4, room: 25, top: 1.3 };
export function normalizeLeague(lg: League, S = lg.season, maxStep = Infinity) {
  const real = realProfile(S);
  const before = simProfile(lg);
  const str = CAL.str * (1 - lg.destiny);
  // room to grow: the league may become stronger than the real one – up to CAL.room more 80+ players – before
  // anything pulls it back down; a league that drifts too weak is still lifted at once
  // ...and the very top is watched on its own: superstars may be up to half again as many as in the real league
  const excess = Math.max(before.n80 - real.n80 - CAL.room, before.n90 != null && real.n90 != null ? (before.n90 - Math.max(6, real.n90) * CAL.top) * 5 : 0);
  const mayCut = excess > 0;
  const players = Object.values(lg.players).filter(p => !p.retired);
  const z0 = new Map(players.map(p => [p.id, p.z.slice()]));
  let shiftSize = 0;
  const wRel = new Map<string, number>();   // each player's share of the correction (by age)
  if (str > 0) {
    let shift = before.mean.map((m, k) => {
      const diff = real.mean[k] - m;
      return Math.abs(diff) > 0.03 ? str * diff : 0;
    });
    // pulling down only once the room is used up – and then gently at first
    if (bpmOf(shift) - bpmOf(new Array(NK).fill(0)) < 0) { const g = mayCut ? Math.min(1, excess / 25) : 0; shift = shift.map(x => x * g); }
    shiftSize = Math.sqrt(shift.reduce((a, x) => a + x * x, 0));
    // who carries the correction: when the league has drifted too strong, mostly the veterans past their peak
    // (careers still peak around 27); when it has drifted too weak, mostly the young and players in their prime
    const down = bpmOf(shift) - bpmOf(new Array(NK).fill(0)) < 0;
    const wOf = (p: Player) => {
      const a = ageIn(p, S - 1) - (p.dev?.peak ?? 0);
      if (!down) return atAge(AGE.lgUp, a);
      // the young carry the same small share as always; past 28 the share depends on how he played: a veteran who
      // delivered carries little, one who played to his rating some, one who no longer delivers the most
      const w = p.devWhy?.s === S ? p.devWhy.perf : 0;
      const form = a > 27 ? (w >= 1 ? 0.3 : w <= -1 ? 1.6 : 1) : 1;
      return atAge(AGE.lgDown, a) * form;
    };
    const rot = Object.values(lg.teams).filter(t => t.active).flatMap(t => t.roster.map(pid => lg.players[pid]).sort((x, y) => bpmOf(y.z) - bpmOf(x.z)).slice(0, 10));
    const meanW = rot.length ? rot.reduce((a, p) => a + wOf(p), 0) / rot.length : 1;
    for (const p of players) { const w = wOf(p) / meanW; wRel.set(p.id, w); for (let k = 0; k < NK; k++) p.z[k] += shift[k] * w; }
  }
  let spread = 1;
  const mid = simProfile(lg);
  const r = real.bpmSd / Math.max(0.1, mid.bpmSd);
  if (str > 0 && (r < 0.94 && mayCut || r > 1.1)) {
    spread = 1 + str * (r - 1);
    for (const p of players) for (let k = 0; k < NK; k++) p.z[k] = mid.mean[k] + (p.z[k] - mid.mean[k]) * spread;
  }
  for (const p of players) {
    zClamp(p.z);
    // the recalibration drifts the whole league a little; it never moves one player more than maxStep in a summer
    // (the rest of the correction comes in later years) – a star at his peak does not drop because of it
    // (a veteran past his peak, who carries more of the correction, may move proportionally more)
    const a = z0.get(p.id)!, o0 = shownOvr(a), lim = maxStep * Math.max(1, wRel.get(p.id) ?? 1);
    if (Math.abs(shownOvr(p.z) - o0) > lim) {
      const b = p.z.slice();
      let lo = 0, hi = 1;
      for (let it = 0; it < 12; it++) { const t = (lo + hi) / 2; if (Math.abs(shownOvr(a.map((v, i) => v + t * (b[i] - v))) - o0) <= lim) lo = t; else hi = t; }
      for (let i = 0; i < NK; i++) p.z[i] = a[i] + lo * (b[i] - a[i]);
    }
    if (p.ovrHist.length && p.ovrHist[p.ovrHist.length - 1][0] === S) snapRatings(p, S);
  }
  const rec: HealthRec = { s: S, sim: simProfile(lg), real, shift: Math.round(shiftSize * 1000) / 1000, spread: Math.round(spread * 1000) / 1000 };
  (lg.health ??= []).push(rec);
  if (lg.health.length > 80) lg.health.shift();
  return rec;
}

export function recordHealth(lg: League) {
  const rec: HealthRec = { s: lg.season, sim: simProfile(lg), real: realProfile(lg.season), shift: 0, spread: 1 };
  (lg.health ??= []).push(rec);
}
