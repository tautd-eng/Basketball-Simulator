// General managers: who ran each team in each season (a person's nick, or CPU), titles, and GM of the Year –
// the GM whose team beat its outlook the most: projected right after the draft lottery vs. where it stands
// going into the playoffs (record and title chances).
import { League } from '../types';
import { isHuman } from './humans';
import { teamStrength } from '../ai/value';
import { rosterFit } from '../archetypes';
import { bpmOf } from '../data';

export const CPU = 'CPU';
/** Name of the GM running a team right now. Online: the member's nick (kept by the host); offline: the name set
 *  under Players & teams, else "User". */
export function gmOf(lg: League, tid: string): string {
  if (!isHuman(lg, tid)) return CPU;
  const x: any = lg;
  return (x.gmNames?.[tid] || x.humanNames?.[tid] || '').trim() || 'User';
}

/** Notes this season's GMs (everyone who ran a team at some point of it). Cheap – call it often. */
export function noteGms(lg: League, S = lg.season) {
  const x: any = lg;
  const h = ((x.gmHist ??= {})[S] ??= {}) as Record<string, string[]>;
  for (const t of Object.values(lg.teams)) {
    if (!t.active) continue;
    const g = gmOf(lg, t.tid), l = (h[t.tid] ??= []);
    if (l[l.length - 1] === g) continue;
    const i = l.indexOf(g); if (i >= 0) l.splice(i, 1);
    l.push(g);                                   // in order of who ran it, the last one at the end
  }
}

/** Outlook of every team from its roster: expected win share and title chances (as in the season preview). */
export function outlook(lg: League): Record<string, { wp: number; odds: number }> {
  const ts = Object.values(lg.teams).filter(t => t.active);
  const str = ts.map(t => teamStrength(lg, t.tid)), mean = str.reduce((a, b) => a + b, 0) / str.length;
  const wp = ts.map((t, i) => {
    const ps = t.roster.map(id => lg.players[id]).sort((a, b) => bpmOf(b.z) - bpmOf(a.z));
    return Math.max(0.12, Math.min(0.88, 0.5 + 0.0245 * (str[i] - mean) + 0.1 * rosterFit(ps)));
  });
  return oddsOf(ts.map(t => t.tid), wp);
}
function oddsOf(tids: string[], wp: number[], alive?: (tid: string) => boolean) {
  const ex = wp.map((w, i) => (alive && !alive(tids[i]) ? 0 : Math.exp(0.42 * (w - 0.5) / 0.0245)));
  const tot = ex.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(tids.map((t, i) => [t, { wp: wp[i], odds: ex[i] / tot }]));
}

/** Right after the draft lottery: the outlook for the coming season is the baseline. */
export function gmBaseline(lg: League, S = lg.season + 1) {
  (lg as any).gmBase = { s: S, o: outlook(lg) };
}
/** Going into the playoffs: the record so far blended with the roster now; only playoff teams keep title chances. */
export function gmPlayoffs(lg: League, playoffTeams: string[]) {
  const o = outlook(lg), tids = Object.keys(o);
  const wp = tids.map(t => { const tm = lg.teams[t], g = tm.w + tm.l; return g ? 0.6 * (tm.w / g) + 0.4 * o[t].wp : o[t].wp; });
  (lg as any).gmPo = { s: lg.season, o: oddsOf(tids, wp, t => playoffTeams.includes(t)) };
}

export interface GmAward { tid: string; gm: string; score: number; w: number; l: number; baseW: number; baseOdds: number; poOdds: number }
/** GM of the Year for season S: the largest jump from the post-lottery outlook to the playoff-eve outlook. */
export function gmOfYear(lg: League, G: number): GmAward | null {
  const x: any = lg, S = lg.season;
  if (x.gmBase?.s !== S || x.gmPo?.s !== S) return null;
  let best: GmAward | null = null;
  for (const t of Object.values(lg.teams)) {
    if (!t.active) continue;
    const b = x.gmBase.o[t.tid], p = x.gmPo.o[t.tid];
    if (!b || !p) continue;
    const g = t.w + t.l || 1;
    // wins above the outlook, plus the gain in title chances (a 10-point jump in title odds ≈ 3 wins)
    const score = (t.w / g - b.wp) * G + 30 * (p.odds - b.odds);
    if (!best || score > best.score) best = { tid: t.tid, gm: gmOf(lg, t.tid), score: Math.round(score * 10) / 10, w: t.w, l: t.l, baseW: Math.round(b.wp * G), baseOdds: b.odds, poOdds: p.odds };
  }
  return best;
}

/** Every GM's record: seasons, teams, titles, GM of the Year awards (people only; CPU summed as one). */
export function gmRecords(lg: League) {
  const x: any = lg, out = new Map<string, { gm: string; seasons: number; teams: Set<string>; titles: { s: number; tid: string }[]; gmoy: { s: number; tid: string }[] }>();
  const row = (gm: string) => { let r = out.get(gm); if (!r) out.set(gm, r = { gm, seasons: 0, teams: new Set(), titles: [], gmoy: [] }); return r; };
  for (const [s, teams] of Object.entries(x.gmHist ?? {}) as [string, Record<string, string[]>][]) for (const [tid, gms] of Object.entries(teams)) {
    for (const g of gms) { const r = row(g); r.teams.add(tid); }
    const last = gms[gms.length - 1];
    if (last) row(last).seasons++;
    void s;
  }
  for (const h of lg.history as any[]) {
    const gms = x.gmHist?.[h.season];
    if (h.champion && gms?.[h.champion]) row(gms[h.champion].at(-1)).titles.push({ s: h.season, tid: h.champion });
    if (h.gmoy) row(h.gmoy.gm).gmoy.push({ s: h.season, tid: h.gmoy.tid });
  }
  return [...out.values()];
}
