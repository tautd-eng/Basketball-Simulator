// Advanced stats for simulated seasons, from the box scores the engine records (Basketball-Reference / Dean Oliver
// formulas – the same family NBA 2K shows): PER, TS%, eFG%, rebound/assist/steal/block/turnover/usage rates,
// individual offensive and defensive ratings, win shares, plus on-court ratings and on/off from the plus-minus.
import { StatLine } from '../types';

export interface TeamTot { st: StatLine; opp: StatLine; gp: number }
export interface Adv {
  per: number; ts: number; efg: number; tpar: number; ftr: number;
  orbp: number; drbp: number; trbp: number; astp: number; stlp: number; blkp: number; tovp: number; usg: number;
  ortg: number; drtg: number; ows: number; dws: number; ws: number; ws48: number;
  onOrtg: number; onDrtg: number; onNet: number; onOff: number; dfg: number | null;
}

const d = (a: number, b: number) => (b ? a / b : 0);
const poss = (s: StatLine, o: StatLine) => 0.5 * ((s.fga + 0.4 * s.fta - 1.07 * d(s.orb, s.orb + o.drb) * (s.fga - s.fgm) + s.tov)
  + (o.fga + 0.4 * o.fta - 1.07 * d(o.orb, o.orb + s.drb) * (o.fga - o.fgm) + o.tov));

/** League context for one season (regular season or playoffs): totals over all teams. */
export function leagueCtx(teams: TeamTot[]) {
  const lg: any = {}; for (const k of ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'min']) lg[k] = teams.reduce((a, t) => a + (t.st as any)[k], 0);
  const gp = teams.reduce((a, t) => a + t.gp, 0);
  const P = teams.reduce((a, t) => a + poss(t.st, t.opp), 0);
  lg.trb = lg.orb + lg.drb;
  lg.poss = P; lg.ppp = d(lg.pts, P); lg.ppg = d(lg.pts, gp);
  lg.pace = d(48 * P, lg.min);                                 // possessions per 48 minutes
  lg.vop = d(lg.pts, lg.fga - lg.orb + lg.tov + 0.44 * lg.fta);
  lg.drbp = d(lg.drb, lg.trb);
  lg.factor = 2 / 3 - d(0.5 * d(lg.ast, lg.fgm), 2 * d(lg.fgm, lg.ftm));
  return lg;
}

/** Advanced line for one player (l) who played for a team (t) in a league (L). aPER is normalized later (perScale). */
export function advanced(l: StatLine, t: TeamTot, L: any): Adv & { aper: number } {
  const T = t.st, O = t.opp, MP = Math.max(l.min, 1e-6), TmMP = 5 * T.min;
  const trb = l.orb + l.drb, tTrb = T.orb + T.drb, oTrb = O.orb + O.drb;
  const tPoss = poss(T, O), tPace = d(48 * tPoss, T.min);
  const share = MP / (TmMP / 5);                                // his share of the team's minutes on court
  // shooting and rates
  const ts = d(l.pts, 2 * (l.fga + 0.44 * l.fta)), efg = d(l.fgm + 0.5 * l.tpm, l.fga);
  const orbp = 100 * d(l.orb * (TmMP / 5), MP * (T.orb + O.drb));
  const drbp = 100 * d(l.drb * (TmMP / 5), MP * (T.drb + O.orb));
  const trbp = 100 * d(trb * (TmMP / 5), MP * (tTrb + oTrb));
  const astp = 100 * d(l.ast, share * T.fgm - l.fgm);
  const stlp = 100 * d(l.stl * (TmMP / 5), MP * tPoss);
  const blkp = 100 * d(l.blk * (TmMP / 5), MP * (O.fga - O.tpa));
  const tovp = 100 * d(l.tov, l.fga + 0.44 * l.fta + l.tov);
  const usg = 100 * d((l.fga + 0.44 * l.fta + l.tov) * (TmMP / 5), MP * (T.fga + 0.44 * T.fta + T.tov));
  // PER (Hollinger): unadjusted, then pace-adjusted; scaled to a league average of 15 by the caller
  const tA = d(T.ast, T.fgm);
  const uper = (1 / MP) * (l.tpm + (2 / 3) * l.ast + (2 - L.factor * tA) * l.fgm + l.ftm * 0.5 * (1 + (1 - tA) + (2 / 3) * tA)
    - L.vop * l.tov - L.vop * L.drbp * (l.fga - l.fgm) - L.vop * 0.44 * (0.44 + 0.56 * L.drbp) * (l.fta - l.ftm)
    + L.vop * (1 - L.drbp) * l.drb + L.vop * L.drbp * l.orb + L.vop * l.stl + L.vop * L.drbp * l.blk
    - l.pf * (d(L.ftm, L.pf) - 0.44 * d(L.fta, L.pf) * L.vop));
  const aper = d(L.pace, tPace) * uper;
  // Oliver offensive rating: points produced per 100 individual possessions
  const tFT = 1 - (1 - d(T.ftm, T.fta)) ** 2;
  const qAST = share * (1.14 * d(T.ast - l.ast, T.fgm)) + d(d(T.ast, TmMP) * MP * 5 - l.ast, d(T.fgm, TmMP) * MP * 5 - l.fgm) * (1 - share);
  const shot = 0.5 * d(l.pts - l.ftm, 2 * l.fga) * qAST;
  const fgPart = l.fgm * (1 - shot);
  const astPart = 0.5 * d((T.pts - T.ftm) - (l.pts - l.ftm), 2 * (T.fga - l.fga)) * l.ast;
  const ftPart = l.fta ? (1 - (1 - l.ftm / l.fta) ** 2) * 0.4 * l.fta : 0;
  const tScPoss = T.fgm + tFT * T.fta * 0.4;
  const tOrbP = d(T.orb, T.orb + (oTrb - O.orb));
  const tPlay = d(tScPoss, T.fga + T.fta * 0.4 + T.tov);
  const tOrbW = d((1 - tOrbP) * tPlay, (1 - tOrbP) * tPlay + tOrbP * (1 - tPlay));
  const orbPart = l.orb * tOrbW * tPlay;
  const red = 1 - d(T.orb, tScPoss) * tOrbW * tPlay;
  const scPoss = (fgPart + astPart + ftPart) * red + orbPart;
  const totPoss = scPoss + (l.fga - l.fgm) * (1 - 1.07 * tOrbP) + (l.fta ? (1 - l.ftm / l.fta) ** 2 * 0.4 * l.fta : 0) + l.tov;
  const pprod = (2 * (l.fgm + 0.5 * l.tpm) * (1 - shot)
    + 2 * d(T.fgm - l.fgm + 0.5 * (T.tpm - l.tpm), T.fgm - l.fgm) * astPart + l.ftm) * red
    + orbPart * d(T.pts, tScPoss);
  const ortg = 100 * d(pprod, totPoss);
  // Oliver defensive rating: team defence, adjusted by his stops
  const dorp = d(O.orb, O.orb + T.drb), dfgp = d(O.fgm, O.fga);
  const fmwt = d(dfgp * (1 - dorp), dfgp * (1 - dorp) + (1 - dfgp) * dorp);
  const stops1 = l.stl + l.blk * fmwt * (1 - 1.07 * dorp) + l.drb * (1 - fmwt);
  const stops2 = (d(O.fga - O.fgm - T.blk, TmMP) * fmwt * (1 - 1.07 * dorp) + d(O.tov - T.stl, TmMP)) * MP
    + d(l.pf, T.pf) * 0.4 * O.fta * (1 - d(O.ftm, O.fta)) ** 2;
  const stopP = d((stops1 + stops2) * O.min * 5, tPoss * MP);
  const tDrtg = 100 * d(O.pts, tPoss);
  const dPtsSc = d(O.pts, O.fgm + (1 - (1 - d(O.ftm, O.fta)) ** 2) * O.fta * 0.4);
  const drtg = tDrtg + 0.2 * (100 * dPtsSc * (1 - stopP) - tDrtg);
  // win shares: marginal points over the points a win costs in this league and at this team's pace
  const ptsPerWin = 0.32 * L.ppg * d(tPace, L.pace);
  const ows = d(pprod - 0.92 * L.ppp * totPoss, ptsPerWin);
  const dws = d((MP / TmMP) * tPoss * (1.08 * L.ppp - drtg / 100), ptsPerWin);
  const ws = ows + dws;
  // on court (from the plus-minus): his team's points for and against while he played, per 100 possessions
  const onPoss = tPoss * share;
  const onFor = l.opp + l.pm, onOrtg = 100 * d(onFor, onPoss), onDrtg = 100 * d(l.opp, onPoss);
  const offPoss = tPoss - onPoss, offNet = offPoss > 1 ? 100 * d((T.pts - O.pts) - l.pm, offPoss) : 0;
  return {
    per: 0, aper, ts: 100 * ts, efg: 100 * efg, tpar: 100 * d(l.tpa, l.fga), ftr: 100 * d(l.fta, l.fga),
    orbp, drbp, trbp, astp, stlp, blkp, tovp, usg, ortg, drtg, ows, dws, ws, ws48: d(ws * 48, MP),
    onOrtg, onDrtg, onNet: onOrtg - onDrtg, onOff: onPoss > 0 && offPoss > 1 ? (onOrtg - onDrtg) - offNet : 0,
    dfg: l.dfga ? 100 * l.dfgm / l.dfga : null,
  };
}

/** PER: scale aPER so the minute-weighted league average is 15. */
export function perScale(rows: { min: number; aper: number }[]) {
  const m = rows.reduce((a, r) => a + r.min, 0), w = rows.reduce((a, r) => a + r.min * r.aper, 0);
  return d(15, d(w, m));
}
