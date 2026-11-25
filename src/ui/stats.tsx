// @ts-nocheck
// Statistics: league leaders, sortable player stats and team stats, for any season played.
import { PosFilter } from './posfilter';
import { posOk } from './positions';
import { useMemo, useState } from 'react';
import { useNavState } from './nav';
import { shownOvr as ovrOf, shownFromRaw, shownFromBpm } from '../data';
import { ageIn } from '../players';
import { seasonGames } from '../league/league';
import { SortTable, f1, f0, pctf, div } from './sorttable';
import { advanced, leagueCtx, perScale } from '../league/advanced';

const seasonLabel = (s: number) => `${s - 1}–${String(s).slice(2)}`;

/** Player lines for a season (current or archived), regular season or playoffs. */
function playerLines(lg: any, season: number, po: boolean) {
  const out: any[] = [];
  for (const p of Object.values(lg.players) as any[]) {
    let l: any = null, tid = '';
    if (season === lg.season && (lg.phase === 'regular' || lg.phase === 'playoffs' || lg.phase === 'fantasy')) { l = po ? p.curPo : p.cur; tid = p.tid ?? ''; }
    else { const c = p.career.find((x: any) => x.s === season && x.po === po); if (c) { l = c; tid = c.tid; } }
    if (!l || !l.gp) continue;
    out.push({ key: p.id, p, l, tid, age: ageIn(p, season) });
  }
  return out;
}

function teamLines(lg: any, season: number, po: boolean) {
  if (season === lg.season && (lg.phase === 'regular' || lg.phase === 'playoffs')) {
    return Object.values(lg.teams).filter((t: any) => t.active && (po ? t.gpPo : t.gp)).map((t: any) => ({ key: t.tid, tid: t.tid, w: t.w, l: t.l, st: po ? t.stPo : t.st, opp: po ? t.oppPo : t.opp, gp: po ? t.gpPo : t.gp }));
  }
  const h = lg.history.find((x: any) => x.season === season);
  if (!h?.teamStats) return [];
  return Object.entries(h.teamStats).filter(([, v]: any) => (po ? v.gpPo : v.gp)).map(([tid, v]: any) => ({ key: tid, tid, w: v.w, l: v.l, st: po ? v.stPo : v.st, opp: po ? v.oppPo : v.opp, gp: po ? v.gpPo : v.gp }));
}

const poss = (s: any) => s.fga + 0.44 * s.fta - s.orb + s.tov;
const gmsc = (l: any) => l.pts + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.orb + 0.3 * l.drb + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov;
const ts = (l: any) => div(l.pts, 2 * (l.fga + 0.44 * l.fta));

export function StatsView({ lg, openPlayer, openTeam }: any) {
  const seasons = useMemo(() => {
    const s = new Set<number>(lg.history.map((h: any) => h.season));
    if (lg.phase === 'regular' || lg.phase === 'playoffs') s.add(lg.season);
    return [...s].sort((a, b) => b - a);
  }, [lg.history.length, lg.season, lg.phase]);
  const [view, setView] = useNavState<'leaders' | 'players' | 'adv' | 'teams'>('stats.view', 'leaders');
  const [season, setSeason] = useState<number>(seasons[0] ?? lg.season);
  const [po, setPo] = useState(false);
  const [mode, setMode] = useState<'pg' | 'tot'>('pg');
  const [team, setTeam] = useState('');
  const [minGp, setMinGp] = useState(0);
  const [minMpg, setMinMpg] = useState(10);
  const [showSplits, setShowSplits] = useState(false);
  const [pos, setPos] = useState('all');
  const S = seasons.includes(season) ? season : seasons[0] ?? lg.season;

  const P0 = useMemo(() => playerLines(lg, S, po), [lg, S, po, lg.day, lg.phase]);
  const P = pos === 'all' ? P0 : P0.filter((r: any) => posOk(r.p, pos));
  const T = useMemo(() => teamLines(lg, S, po), [lg, S, po, lg.day, lg.phase]);
  const maxGp = Math.max(1, ...P0.map(r => r.l.gp));
  const qualGp = po ? 1 : Math.max(1, Math.round(maxGp * 0.6));
  const tAbbr = (tid: string) => lg.teams[tid]?.abbr ?? tid;
  const name = (r: any) => <button className="link" onClick={() => openPlayer(r.p.id)}>{r.p.name}</button>;

  const header = (
    <div className="stats-head">
      <div className="seg" role="group" aria-label="Section">
        {[['leaders', 'Leaders'], ['players', 'Players'], ['adv', 'Advanced'], ['teams', 'Teams']].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k as any)}>{l}</button>)}
      </div>
      <select aria-label="Season" value={S} onChange={e => setSeason(+e.target.value)}>
        {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}{s === lg.season && (lg.phase === 'regular' || lg.phase === 'playoffs') ? ' (current)' : ''}</option>)}
      </select>
      <div className="seg" role="group" aria-label="Part of season">
        <button className={!po ? 'on' : ''} onClick={() => setPo(false)}>Regular season</button>
        <button className={po ? 'on' : ''} onClick={() => setPo(true)}>Playoffs</button>
      </div>
      {view !== 'teams' && <PosFilter value={pos} onChange={setPos} />}
      {view !== 'leaders' && view !== 'adv' && (
        <div className="seg" role="group" aria-label="Show">
          <button className={mode === 'pg' ? 'on' : ''} onClick={() => setMode('pg')}>Per game</button>
          <button className={mode === 'tot' ? 'on' : ''} onClick={() => setMode('tot')}>Totals</button>
        </div>
      )}
    </div>
  );

  if (view === 'leaders') {
    const q = P.filter(r => r.l.gp >= qualGp);
    const cats: [string, (l: any) => number, (v: number) => string, ((l: any) => boolean)?][] = [
      ['Points', l => l.pts / l.gp, f1], ['Rebounds', l => (l.orb + l.drb) / l.gp, f1], ['Assists', l => l.ast / l.gp, f1],
      ['Steals', l => l.stl / l.gp, f1], ['Blocks', l => l.blk / l.gp, f1], ['Threes made', l => l.tpm / l.gp, f1],
      ['Field goal %', l => l.fgm / l.fga, pctf, l => l.fga >= l.gp * 6], ['Three-point %', l => l.tpm / l.tpa, pctf, l => l.tpa >= l.gp * 1.5],
      ['Free throw %', l => l.ftm / l.fta, pctf, l => l.fta >= l.gp * 2], ['True shooting %', l => ts(l), pctf, l => l.fga >= l.gp * 8],
      ['Minutes', l => l.min / l.gp, f1], ['Game Score', l => gmsc(l) / l.gp, f1],
      ['+/−', l => l.pm / l.gp, v => (v > 0 ? '+' : '') + v.toFixed(1)], ['Turnovers', l => l.tov / l.gp, f1],
    ];
    return (
      <div className="panel">
        {header}
        <p className="note">{po ? 'Playoffs, at least 1 game.' : `At least ${qualGp} games${S === lg.season ? ` (${seasonGames(lg)} in the season)` : ''}. Shooting categories require a minimum number of attempts per game.`}</p>
        {!q.length ? <p className="note">No stats for this period yet.</p> : (
          <div className="leaders">
            {cats.map(([n, f, fmt, ok]) => {
              const top = q.filter(r => !ok || ok(r.l)).map(r => ({ r, v: f(r.l) })).filter(x => !Number.isNaN(x.v)).sort((a, b) => b.v - a.v).slice(0, 10);
              return (
                <div key={n} className="leader-col">
                  <h3>{n}</h3>
                  <ol>{top.map(x => <li key={x.r.key}>{name(x.r)} <span className="dim">{tAbbr(x.r.tid)}</span><span className="v">{fmt(x.v)}</span></li>)}</ol>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (view === 'adv') {
    const byTid = new Map(T.map((t: any) => [t.tid, { st: t.st, opp: t.opp, gp: t.gp }]));
    const L = byTid.size ? leagueCtx([...byTid.values()] as any) : null;
    // a player who played for more than one team: one row per team (against that team's totals) and a TOT row
    const all: any[] = [];
    if (L) for (const r of P) {
      const cur = S === lg.season && (lg.phase === 'regular' || lg.phase === 'playoffs');
      const by = cur ? (po ? r.p.curPoBy : r.p.curBy) : r.p.career.find((x: any) => x.s === S && x.po === po)?.by;
      const parts = by && Object.keys(by).length > 1 ? Object.entries(by).filter(([t, l]: any) => byTid.has(t) && l.min > 0) : [];
      if (parts.length > 1) {
        const sub = parts.map(([t, l]: any) => ({ ...r, key: `${r.p.id}|${t}`, tid: t, l, split: true, a: advanced(l, byTid.get(t) as any, L) }));
        all.push(...sub);
        const m = sub.reduce((x, y) => x + y.l.min, 0), a: any = {};
        for (const key of Object.keys(sub[0].a)) {
          if (['ows', 'dws', 'ws'].includes(key)) a[key] = sub.reduce((x, y) => x + y.a[key], 0);
          else if (key === 'dfg') { const ga = sub.reduce((x, y) => x + (y.l.dfga ?? 0), 0); a.dfg = ga ? 100 * sub.reduce((x, y) => x + (y.l.dfgm ?? 0), 0) / ga : null; }
          else a[key] = sub.reduce((x, y) => x + y.a[key] * y.l.min, 0) / m;
        }
        a.ws48 = a.ws * 48 / m;
        all.push({ ...r, key: `${r.p.id}|TOT`, tid: 'TOT', tot: parts.map(([t]) => t), a });
      } else if (byTid.has(r.tid) && r.l.min > 0) all.push({ ...r, a: advanced(r.l, byTid.get(r.tid) as any, L) });
    }
    const k = perScale(all.filter(r => r.tid !== 'TOT').map(r => ({ min: r.l.min, aper: r.a.aper })));
    for (const r of all) r.a.per = r.a.aper * k;
    // all teams: TOT rows for traded players (their team rows on request); one team: that team's part only
    const rows = all.filter(r => (team ? r.tid === team : (showSplits || !r.split)) && r.l.gp >= minGp && r.l.min / r.l.gp >= minMpg);
    const a = (key: string, label: string, title: string, fmt: any = f1, asc = false) => ({ key, label, title, asc, get: (r: any) => r.a[key], fmt });
    const sg = (x: any) => (x > 0 ? '+' : '') + f1(x);
    const cols = [
      { key: 'name', label: 'Player', left: true, asc: true, get: (r: any) => r.p.name, fmt: (_: any, r: any) => name(r) },
      { key: 'tid', label: 'Team', left: true, asc: true, get: (r: any) => (r.tid === 'TOT' ? 'TOT' : tAbbr(r.tid)), fmt: (v: any, r: any) => (r.tid === 'TOT' ? <span title={`Played for ${r.tot.map(tAbbr).join(', ')} this season`}>TOT</span> : r.split ? <span className="dim">{v}</span> : v) },
      { key: 'gp', label: 'GP', get: (r: any) => r.l.gp },
      { key: 'mpg', label: 'MPG', title: 'Minutes per game', get: (r: any) => r.l.min / r.l.gp, fmt: f1 },
      a('per', 'PER', 'Player efficiency rating – per-minute production, league average 15'),
      a('ts', 'TS%', 'True shooting % – points per shot, free throws included'),
      a('efg', 'eFG%', 'Effective field goal % – a three counts 1.5 makes'),
      a('tpar', '3PAr', 'Share of his shots that are threes'),
      a('ftr', 'FTr', 'Free throw attempts per 100 field goal attempts'),
      a('orbp', 'ORB%', 'Share of available offensive rebounds he grabbed while on court'),
      a('drbp', 'DRB%', 'Share of available defensive rebounds he grabbed while on court'),
      a('trbp', 'TRB%', 'Share of all available rebounds he grabbed while on court'),
      a('astp', 'AST%', "Share of teammates' baskets he assisted while on court"),
      a('stlp', 'STL%', "Steals per 100 of the opponent's possessions while on court"),
      a('blkp', 'BLK%', "Share of the opponent's two-point shots he blocked while on court"),
      a('tovp', 'TOV%', 'Turnovers per 100 of his plays (shots, free-throw trips, turnovers)', f1, true),
      a('usg', 'USG%', "Share of the team's plays he used while on court"),
      a('ortg', 'ORtg', 'Offensive rating – points he produced per 100 of his possessions (Dean Oliver)', f0),
      a('drtg', 'DRtg', 'Defensive rating – points allowed per 100 possessions with his stops counted (Dean Oliver)', f0, true),
      a('ows', 'OWS', 'Offensive win shares'),
      a('dws', 'DWS', 'Defensive win shares'),
      a('ws', 'WS', 'Win shares – wins his offence and defence were worth'),
      a('ws48', 'WS/48', 'Win shares per 48 minutes (league average about .100)', (x: any) => x.toFixed(3).replace(/^(-?)0\./, '$1.')),
      a('onOrtg', 'On ORtg', "His team's points per 100 possessions while he was on court", f1),
      a('onDrtg', 'On DRtg', "Opponents' points per 100 possessions while he was on court", f1, true),
      a('onNet', 'On Net', 'Net rating while he was on court', sg),
      a('onOff', 'On−Off', 'Net rating with him on court minus with him off it', sg),
      { key: 'dfg', label: 'DFG%', title: 'Field goal % of the shots he defended as the primary defender (lower is better)', asc: true, get: (r: any) => r.a.dfg, fmt: (x: any) => (x == null ? '–' : f1(x)) },
    ];
    const teams = [...new Set(all.map(r => r.tid))].filter(t => t && t !== 'TOT').sort((x, y) => tAbbr(x).localeCompare(tAbbr(y)));
    return (
      <div className="panel">
        {header}
        {!L ? <p className="note">Advanced stats are worked out from the games simulated in this league – for seasons before the league started there are no box scores to work from.</p> : <>
          <div className="stats-head">
            <select aria-label="Team" value={team} onChange={e => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map(t => <option key={t} value={t}>{lg.teams[t]?.name ?? t}</option>)}
            </select>
            <label className="chk" htmlFor="mingp2">Min <input id="mingp2" type="number" min="0" max="100" value={minGp} onChange={e => setMinGp(+e.target.value || 0)} /> GP</label>
            <label className="chk" htmlFor="minmpg">Min <input id="minmpg" type="number" min="0" max="48" value={minMpg} onChange={e => setMinMpg(+e.target.value || 0)} /> MPG</label>
            {!team && all.some(r => r.split) && <label className="chk"><input type="checkbox" checked={showSplits} onChange={e => setShowSplits(e.target.checked)} /> Team-by-team rows for traded players</label>}
            <span className="dim">{rows.length} rows · hover a column for what it means</span>
          </div>
          <SortTable cols={cols} rows={rows} initial="per" limit={300} rowClass={(r: any) => (r.tid === lg.userTid ? 'mine' : '')} />
          <details className="more"><summary>What these mean</summary>
            <ul className="adv-legend">{cols.filter((c: any) => c.title).map((c: any) => <li key={c.key}><b>{c.label}</b> – {c.title}</li>)}</ul>
            <p className="note">Worked out with the Basketball-Reference formulas (PER by Hollinger, ratings and win shares by Dean Oliver) from this league's own box scores. On-court numbers and on−off come from the plus-minus the engine keeps. A player who changed teams is measured against each team's numbers for his time there; his TOT row adds up the win shares and averages the rest by minutes. Team-by-team lines are kept from this version on – a trade made earlier shows as one line against his current team.</p>
          </details>
        </>}
      </div>
    );
  }

  if (view === 'players') {
    const pg = mode === 'pg';
    const v = (k: string) => (r: any) => (pg ? r.l[k] / r.l.gp : r.l[k]);
    const rows = P.filter(r => (!team || r.tid === team) && r.l.gp >= minGp);
    const cols = [
      { key: 'name', label: 'Player', left: true, asc: true, get: (r: any) => r.p.name, fmt: (_: any, r: any) => name(r) },
      { key: 'tid', label: 'Team', left: true, asc: true, get: (r: any) => tAbbr(r.tid) },
      { key: 'age', label: 'Age', get: (r: any) => r.age },
      { key: 'ovr', label: 'OVR', get: (r: any) => (S === lg.season ? ovrOf(r.p.z, r.p.id) : (r.l.ovr != null ? shownFromRaw(r.l.ovr) : null)) },
      { key: 'gp', label: 'GP', get: (r: any) => r.l.gp },
      { key: 'min', label: 'Min', get: v('min'), fmt: pg ? f1 : f0 },
      { key: 'pts', label: 'Pts', get: v('pts'), fmt: pg ? f1 : f0 },
      { key: 'reb', label: 'Reb', get: (r: any) => (pg ? (r.l.orb + r.l.drb) / r.l.gp : r.l.orb + r.l.drb), fmt: pg ? f1 : f0 },
      { key: 'ast', label: 'Ast', get: v('ast'), fmt: pg ? f1 : f0 },
      { key: 'stl', label: 'Stl', get: v('stl'), fmt: pg ? f1 : f0 },
      { key: 'blk', label: 'Blk', get: v('blk'), fmt: pg ? f1 : f0 },
      { key: 'tov', label: 'TOV', get: v('tov'), fmt: pg ? f1 : f0 },
      { key: 'fgp', label: 'FG%', get: (r: any) => div(r.l.fgm, r.l.fga), fmt: pctf },
      { key: 'tpp', label: '3P%', get: (r: any) => div(r.l.tpm, r.l.tpa), fmt: pctf },
      { key: 'tpm', label: '3PM', title: 'Threes made', get: v('tpm'), fmt: pg ? f1 : f0 },
      { key: 'ftp', label: 'FT%', get: (r: any) => div(r.l.ftm, r.l.fta), fmt: pctf },
      { key: 'ts', label: 'TS%', title: 'True shooting', get: (r: any) => ts(r.l), fmt: pctf },
      { key: 'pm', label: '+/−', get: v('pm'), fmt: (x: any) => (x > 0 ? '+' : '') + (pg ? f1(x) : f0(x)) },
      { key: 'gs', label: 'GmSc', title: 'Game Score per game', get: (r: any) => gmsc(r.l) / (pg ? r.l.gp : 1), fmt: pg ? f1 : f0 },
    ];
    const teams = [...new Set(P.map(r => r.tid))].filter(Boolean).sort((a, b) => tAbbr(a).localeCompare(tAbbr(b)));
    return (
      <div className="panel">
        {header}
        <div className="stats-head">
          <select aria-label="Team" value={team} onChange={e => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t} value={t}>{lg.teams[t]?.name ?? t}</option>)}
          </select>
          <label className="chk" htmlFor="mingp">Min <input id="mingp" type="number" min="0" max="100" value={minGp} onChange={e => setMinGp(+e.target.value || 0)} /> GP</label>
          <span className="dim">{rows.length} players · click a column header to sort</span>
        </div>
        <SortTable cols={cols} rows={rows} initial="pts" limit={300} rowClass={(r: any) => (r.tid === lg.userTid ? 'mine' : '')} />
      </div>
    );
  }

  // teams
  const pg = mode === 'pg';
  const tv = (k: string, opp = false) => (r: any) => (pg ? (opp ? r.opp : r.st)[k] / r.gp : (opp ? r.opp : r.st)[k]);
  const cols = [
    { key: 'name', label: 'Team', left: true, asc: true, get: (r: any) => lg.teams[r.tid]?.name ?? r.tid, fmt: (v: any, r: any) => <button className="link" onClick={() => openTeam(r.tid)}>{v}</button> },
    { key: 'w', label: 'W', get: (r: any) => (po ? null : r.w) },
    { key: 'l', label: 'L', asc: true, get: (r: any) => (po ? null : r.l) },
    { key: 'pts', label: 'Pts', get: tv('pts'), fmt: pg ? f1 : f0 },
    { key: 'opts', label: 'Opp', title: 'Points allowed', asc: true, get: tv('pts', true), fmt: pg ? f1 : f0 },
    { key: 'diff', label: '+/−', get: (r: any) => (r.st.pts - r.opp.pts) / (pg ? r.gp : 1), fmt: (x: any) => (x > 0 ? '+' : '') + (pg ? f1(x) : f0(x)) },
    { key: 'fgp', label: 'FG%', get: (r: any) => div(r.st.fgm, r.st.fga), fmt: pctf },
    { key: 'tpp', label: '3P%', get: (r: any) => div(r.st.tpm, r.st.tpa), fmt: pctf },
    { key: 'tpa', label: '3PA', title: 'Three-point attempts', get: tv('tpa'), fmt: pg ? f1 : f0 },
    { key: 'ftp', label: 'FT%', get: (r: any) => div(r.st.ftm, r.st.fta), fmt: pctf },
    { key: 'reb', label: 'Reb', get: (r: any) => (r.st.orb + r.st.drb) / (pg ? r.gp : 1), fmt: pg ? f1 : f0 },
    { key: 'orb', label: 'ORB', title: 'Offensive rebounds', get: tv('orb'), fmt: pg ? f1 : f0 },
    { key: 'ast', label: 'Ast', get: tv('ast'), fmt: pg ? f1 : f0 },
    { key: 'tov', label: 'TOV', asc: true, get: tv('tov'), fmt: pg ? f1 : f0 },
    { key: 'stl', label: 'Stl', get: tv('stl'), fmt: pg ? f1 : f0 },
    { key: 'blk', label: 'Blk', get: tv('blk'), fmt: pg ? f1 : f0 },
    { key: 'ofg', label: 'Opp FG%', asc: true, title: 'Opponent field goal %', get: (r: any) => div(r.opp.fgm, r.opp.fga), fmt: pctf },
    { key: 'pace', label: 'Pace', title: 'Possessions per 48 min', get: (r: any) => ((poss(r.st) + poss(r.opp)) / 2 / r.gp) * (48 / Math.max(1, r.st.min / r.gp)), fmt: f1 },
    { key: 'ortg', label: 'ORtg', title: 'Points per 100 possessions', get: (r: any) => 100 * r.st.pts / poss(r.st), fmt: f1 },
    { key: 'drtg', label: 'DRtg', title: 'Points allowed per 100 possessions', asc: true, get: (r: any) => 100 * r.opp.pts / poss(r.opp), fmt: f1 },
  ];
  return (
    <div className="panel">
      {header}
      {!T.length ? <p className="note">No team stats for this period yet.</p>
        : <SortTable cols={cols} rows={T} initial={po ? 'pts' : 'w'} rowClass={(r: any) => (r.tid === lg.userTid ? 'mine' : '')} />}
      <p className="note">Offensive and defensive ratings – points per 100 possessions; pace – possessions per 48 minutes.</p>
    </div>
  );
}
