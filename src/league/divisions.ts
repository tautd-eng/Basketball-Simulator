// Divisions as they really were, season by season (keyed by franchise id, so relocations carry over):
// four divisions until 2003–04, six from 2004–05. A team the table does not know (or one whose conference
// in this league differs from the table) joins the smallest division of its own conference.
import type { League } from '../types';

type Div = { name: string; conf: 'E' | 'W'; tids: string[] };
const d = (name: string, conf: 'E' | 'W', tids: string): Div => ({ name, conf, tids: tids.split(' ') });

/** [first season (year it ends), divisions] – each entry holds until the next one. */
const ERAS: [number, Div[]][] = [
  [1980, [d('Atlantic', 'E', 'BOS NYK BRK PHI WAS'), d('Central', 'E', 'ATL HOU SAS CLE IND DET'), d('Midwest', 'W', 'MIL SAC DEN CHI UTA'), d('Pacific', 'W', 'LAL OKC PHO POR LAC GSW')]],
  [1981, [d('Atlantic', 'E', 'BOS NYK BRK PHI WAS'), d('Central', 'E', 'ATL CHI CLE DET IND MIL'), d('Midwest', 'W', 'DAL DEN HOU SAC SAS UTA'), d('Pacific', 'W', 'GSW LAL PHO POR LAC OKC')]],
  [1986, [d('Atlantic', 'E', 'BOS NYK BRK PHI WAS'), d('Central', 'E', 'ATL CHI CLE DET IND MIL'), d('Midwest', 'W', 'DAL DEN HOU SAS UTA'), d('Pacific', 'W', 'GSW LAL PHO POR LAC OKC SAC')]],
  [1989, [d('Atlantic', 'E', 'BOS NOP BRK NYK PHI WAS'), d('Central', 'E', 'ATL CHI CLE DET IND MIL'), d('Midwest', 'W', 'DAL DEN HOU MIA SAS UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO POR SAC OKC')]],
  [1990, [d('Atlantic', 'E', 'BOS MIA BRK NYK PHI WAS'), d('Central', 'E', 'ATL CHI CLE DET IND MIL ORL'), d('Midwest', 'W', 'NOP DAL DEN HOU MIN SAS UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO POR SAC OKC')]],
  [1991, [d('Atlantic', 'E', 'BOS MIA BRK NYK PHI WAS'), d('Central', 'E', 'ATL NOP CHI CLE DET IND MIL'), d('Midwest', 'W', 'DAL DEN HOU MIN ORL SAS UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO POR SAC OKC')]],
  [1992, [d('Atlantic', 'E', 'BOS MIA BRK NYK ORL PHI WAS'), d('Central', 'E', 'ATL NOP CHI CLE DET IND MIL'), d('Midwest', 'W', 'DAL DEN HOU MIN SAS UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO POR SAC OKC')]],
  [1996, [d('Atlantic', 'E', 'BOS MIA BRK NYK ORL PHI WAS'), d('Central', 'E', 'ATL NOP CHI CLE DET IND MIL TOR'), d('Midwest', 'W', 'DAL DEN HOU MEM MIN SAS UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO POR SAC OKC')]],
  [2005, [d('Atlantic', 'E', 'BOS BRK NYK PHI TOR'), d('Central', 'E', 'CHI CLE DET IND MIL'), d('Southeast', 'E', 'ATL CHA MIA ORL WAS'),
    d('Northwest', 'W', 'DEN MIN OKC POR UTA'), d('Pacific', 'W', 'GSW LAC LAL PHO SAC'), d('Southwest', 'W', 'DAL HOU MEM NOP SAS')]],
];

function eraOf(season: number): Div[] {
  let e = ERAS[0][1];
  for (const [y, ds] of ERAS) if (season >= y) e = ds;
  return e;
}

/** The divisions of the league's active teams this season, East first. */
export function divisions(lg: League, season = lg.season): { name: string; conf: 'E' | 'W'; tids: string[] }[] {
  const act = Object.values(lg.teams).filter(t => t.active);
  const era = eraOf(season);
  const out = era.map(v => ({ name: v.name, conf: v.conf, tids: [] as string[] }));
  const homeless: typeof act = [];
  for (const t of act) {
    const i = era.findIndex(x => x.tids.includes(t.tid));
    if (i >= 0 && out[i].conf === t.conf) out[i].tids.push(t.tid); else homeless.push(t);
  }
  for (const t of homeless.sort((a, b) => a.name.localeCompare(b.name))) {
    const mine = out.filter(x => x.conf === t.conf);
    const v = (mine.length ? mine : out).reduce((a, b) => (b.tids.length < a.tids.length ? b : a));
    v.tids.push(t.tid);
  }
  return out.filter(v => v.tids.length).sort((a, b) => (a.conf === b.conf ? 0 : a.conf === 'E' ? -1 : 1));
}

/** The division a team plays in this season. */
export function divisionOf(lg: League, tid: string, season = lg.season): string | null {
  return divisions(lg, season).find(v => v.tids.includes(tid))?.name ?? null;
}

/**
 * Team filter for the rankings: 'all', 'conf:E', 'conf:W', 'div:Atlantic' or a team id.
 * Returns the set of team ids it covers (null = everyone).
 */
export function groupTids(lg: League, key: string): Set<string> | null {
  if (!key || key === 'all') return null;
  if (key.startsWith('conf:')) return new Set(Object.values(lg.teams).filter(t => t.active && t.conf === key.slice(5)).map(t => t.tid));
  if (key.startsWith('div:')) return new Set(divisions(lg).find(v => v.name === key.slice(4))?.tids ?? []);
  return new Set([key]);
}
