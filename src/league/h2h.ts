// Head-to-head between two teams over the league's simulated seasons: regular season games (kept from the season
// they are played in), playoff games and series, play-in games.
import { League } from '../types';

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** Regular-season results of the season so far: "A|B" (A < B) -> [A wins, B wins]. */
export function regMatrix(lg: League): Record<string, [number, number]> {
  const m: Record<string, [number, number]> = {};
  for (const g of lg.schedule ?? []) {
    if (!g.done || g.hs == null || g.as == null) continue;
    const k = key(g.home, g.away), r = (m[k] ??= [0, 0]);
    const winner = g.hs > g.as ? g.home : g.away;
    r[winner === k.split('|')[0] ? 0 : 1]++;
  }
  return m;
}

export interface H2HSeason { s: number; reg: [number, number] | null; series: { round: number; w: number; l: number; won: boolean; done: boolean }[]; playIn: { won: boolean }[] }
export interface H2H { reg: [number, number]; po: [number, number]; series: [number, number]; playIn: [number, number]; seasons: H2HSeason[]; since: number | null }

/** Team a against team b (wins for a first). */
export function h2h(lg: League, a: string, b: string): H2H {
  const out: H2H = { reg: [0, 0], po: [0, 0], series: [0, 0], playIn: [0, 0], seasons: [], since: null };
  const k = key(a, b), aFirst = k.split('|')[0] === a;
  const fromSeason = (s: number, reg: Record<string, [number, number]> | undefined, series: any[] | undefined, playIn: any[] | undefined) => {
    const row: H2HSeason = { s, reg: null, series: [], playIn: [] };
    const r = reg?.[k];
    if (r) { row.reg = aFirst ? [r[0], r[1]] : [r[1], r[0]]; out.reg[0] += row.reg[0]; out.reg[1] += row.reg[1]; }
    for (const x of series ?? []) {
      if (!x.hi || !x.lo || !((x.hi === a && x.lo === b) || (x.hi === b && x.lo === a))) continue;
      const w = x.hi === a ? x.hw : x.lw, l = x.hi === a ? x.lw : x.hw;
      out.po[0] += w; out.po[1] += l;
      if (x.winner) { const won = x.winner === a; out.series[won ? 0 : 1]++; row.series.push({ round: x.round, w, l, won, done: true }); }
      else row.series.push({ round: x.round, w, l, won: false, done: false });
    }
    for (const g of playIn ?? []) {
      if (!g.winner || !((g.a === a && g.b === b) || (g.a === b && g.b === a))) continue;
      const won = g.winner === a; out.playIn[won ? 0 : 1]++; row.playIn.push({ won });
    }
    if (row.reg || row.series.length || row.playIn.length) out.seasons.push(row);
  };
  for (const h of lg.history as any[]) {
    if (h.h2h && out.since == null) out.since = h.season;
    fromSeason(h.season, h.h2h, h.bracket?.series, h.bracket?.playIn);
  }
  if (lg.phase === 'regular' || lg.phase === 'playoffs') {
    if (out.since == null) out.since = lg.season;
    fromSeason(lg.season, regMatrix(lg), lg.series, lg.playIn);
  }
  out.seasons.reverse();
  return out;
}
