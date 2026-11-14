// Trade requests: a star who has watched his team miss the playoffs two years running may, early in the third
// season, ask out. He will not extend, and when his contract runs out he will not re-sign there – unless the team
// turns it around (wins a playoff series), which can change his mind. Rare by design, and shaped by what he cares
// about (winning matters, loyalty holds him back).
import { League, Player } from '../types';
import { Rng } from '../rng';
import { shownOvr } from '../data';
import { ageIn } from '../players';
import { traits } from './prefs';

export const REQ = { day: 25, minOvr: 84, minAge: 25, base: 0.45 };

/** Did the team make the playoffs in that (finished) season? null when the season was not played in this league. */
function madePlayoffs(lg: League, tid: string, season: number): boolean | null {
  const h = lg.history.find((x: any) => x.season === season) as any;
  if (!h?.bracket?.series?.length) return null;
  return h.bracket.series.some((s: any) => s.hi === tid || s.lo === tid);
}
const playedFor = (p: Player, tid: string, season: number) => p.career.some(c => c.s === season && !c.po && c.tid === tid && c.gp >= 20);

/** He has asked this team for a trade: no extension, no re-signing. */
export const refuses = (p: Player, tid: string | null | undefined) => !!tid && (p as any).treq?.tid === tid;

/** Early in the season: stars on teams that missed the playoffs two years running may ask out. */
export function checkTradeRequests(lg: League, rng: Rng) {
  const S = lg.season;
  for (const t of Object.values(lg.teams)) {
    if (!t.active) continue;
    if (madePlayoffs(lg, t.tid, S - 1) !== false || madePlayoffs(lg, t.tid, S - 2) !== false) continue;
    for (const pid of t.roster) {
      const p = lg.players[pid] as any;
      if (!p || p.treq || ageIn(p, S) < REQ.minAge || shownOvr(p.z, p.id) < REQ.minOvr) continue;
      if (!playedFor(p, t.tid, S - 1) || !playedFor(p, t.tid, S - 2)) continue;
      const tr = traits(p, S);
      const chance = Math.min(0.8, REQ.base * (0.6 + 0.8 * tr.win) * (1 - 0.6 * tr.loyal));
      if (!rng.chance(chance)) continue;
      p.treq = { tid: t.tid, s: S };
      lg.news.push({ s: S, t: `${p.name} has asked the ${t.name} for a trade – after two years out of the playoffs he wants to play for a winner.` });
    }
  }
}

/** At the end of the season: a request lapses once he has moved on – or when the team won a playoff series. */
export function reviewTradeRequests(lg: League) {
  const S = lg.season;
  const wonSeries = new Set(lg.series.filter(s => s.winner).map(s => s.winner!));
  for (const p of Object.values(lg.players) as any[]) {
    const r = p.treq;
    if (!r) continue;
    if (p.retired || (p.tid && p.tid !== r.tid)) { delete p.treq; continue; }
    if (p.tid === r.tid && wonSeries.has(r.tid)) {
      delete p.treq;
      lg.news.push({ s: S, t: `${p.name} likes where the ${lg.teams[r.tid].name} are heading after their playoff run – he no longer wants out.` });
    }
  }
}
