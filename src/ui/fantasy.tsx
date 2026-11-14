// @ts-nocheck
// Fantasy draft room.
import { useMemo, useState } from 'react';
import { posLabel, natural } from './positions';
import { canRun } from '../league/humans';
import { run } from '../league/commands';
import { shownOvr as ovrOf, shownFromRaw, shownFromBpm, RATING_LABELS, ratingOf } from '../data';
import { ageIn } from '../players';
import { money, usd } from './money';
import { hardCap } from '../ai/value';
import { fantasyContract, fantasyTidAt, fantasyOnClock, fantasyPool, fantasyUserPick, fantasyAdvance, fantasyStep } from '../league/fantasy';
import { AutoControls, useAutoPlay } from './draftday';
import { posNum } from '../engine/game';
import { PickBoard, OnClock, useBoards, BoardsToggle } from './pickboard';
import { SortTable } from './sorttable';
import { attrCols, SortBy } from './offseason';

const POS = [['all', 'All'], ['g', 'Guards'], ['f', 'Forwards'], ['c', 'Centers']] as const;

export function FantasyRoom({ lg, onChange, onTick = () => {}, openPlayer }: any) {
  const [pos, setPos] = useState('all');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  useAutoPlay(playing, speed, () => {
    if (!fantasyStep(lg)) return false;
    onTick();
    const nx = fantasyOnClock(lg);
    return !!nx && nx.tid !== lg.userTid;
  }, () => { setPlaying(false); onChange(); });
  const [q, setQ] = useState('');
  const on = fantasyOnClock(lg);
  const f = lg.fantasy;
  const myTurn = on && on.tid === lg.userTid;
  const pool = useMemo(() => fantasyPool(lg)
    .filter((p: any) => pos === 'all' || (pos === 'g' ? posNum(p.pos) <= 2.5 : pos === 'c' ? posNum(p.pos) >= 4.5 : posNum(p.pos) > 2.5 && posNum(p.pos) < 4.5))
    .filter((p: any) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)), [f.picks.length, pos, q]);
  const [sortKey, setSortKey] = useState('ovr');
  const [boards, toggleBoards] = useBoards();
  const cols = [
    { key: 'name', label: 'Player', left: true, get: (p: any) => p.name, fmt: (v: any, p: any) => <button className="link" onClick={() => openPlayer(p.id)}>{v}</button> },
    { key: 'pos', label: 'Pos', title: 'Position', get: (p: any) => natural(p), fmt: (_: any, p: any) => <span className="dim">{posLabel(p)}</span> },
    { key: 'age', label: 'Age', title: 'Age', asc: true, get: (p: any) => ageIn(p, lg.season) },
    { key: 'ovr', label: 'OVR', title: 'Overall', get: (p: any) => ovrOf(p.z, p.id), fmt: (v: any) => <b>{v}</b> },
    { key: 'sal', label: 'Contract', title: 'The contract he signs with the team that drafts him: share of the cap per season, and the years', get: (p: any) => fantasyContract(p, lg.season).sal,
      fmt: (v: any, p: any) => { const c = fantasyContract(p, lg.season), y = c.exp - lg.season + 1; return <span title={`${money(v, lg.season)} a season through ${c.exp - 1}–${String(c.exp).slice(2)}`}>{money(v, lg.season)} <span className="dim">· {y} yr{y > 1 ? 's' : ''}</span></span>; } },
    ...attrCols((p: any) => p, lg.season),
    { key: 'act', label: '', get: () => 0, fmt: (_: any, p: any) => myTurn ? <button className="small primary" onClick={() => act(() => { run(lg, { t: 'fantasyPick', pid: p.id }); })}>Pick</button> : null },
  ];
  const act = (fn: () => void) => { fn(); onChange(); };
  const mine = lg.userTid ? lg.teams[lg.userTid].roster.map((pid: string) => lg.players[pid]) : [];
  const recent = f.picks.slice().reverse().slice(0, 30);

  return (
    <div className={`draft-layout ${boards ? 'open' : ''}`}>
      <section className="panel">
        <div className="team-head">
          <h2>Fantasy draft</h2>
          {!on && <span className="dim">Draft complete</span>}
          <BoardsToggle open={boards} toggle={toggleBoards} />
        </div>
        {on && <OnClock lg={lg} tid={on.tid} pick={on.pick} round={on.round} mine={myTurn} />}
        {lg.userTid && <MyFantasyTeam lg={lg} openPlayer={openPlayer} />}
        <p className="note">All players from the {(lg.start ?? 1980) - 1}–{String(lg.start ?? 1980).slice(2)} season go into one pool. {f.rounds} rounds in snake order (the last pick of a round picks first in the next){f.rr ? `, and from round ${f.rr} the order turns again (${f.rr}RR)` : ''}. Undrafted players become free agents.</p>
        <div className="def-row">
          {myTurn ? <span className="chip on-clock">You're on the clock – pick from the list!</span> : on && canRun(lg) ? <button className="primary" disabled={playing} onClick={() => act(() => fantasyStep(lg))}>Next pick</button> : on ? <span className="hint">Waiting for the host to move the draft on.</span> : null}
          {on && canRun(lg) && <AutoControls playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} disabled={myTurn} />}
          {!myTurn && lg.userTid && on && canRun(lg) && <button disabled={playing} onClick={() => act(() => fantasyAdvance(lg))}>{(lg.humans?.length ?? 0) > 1 ? 'To the next user pick' : 'To my pick'}</button>}
          {on && canRun(lg) && <button onClick={() => { setPlaying(false); act(() => fantasyAdvance(lg, true)); }}>{lg.userTid ? 'Auto-finish (AI picks for me too)' : 'Run the whole draft'}</button>}
        </div>
        <div className="def-row">
          <div className="seg" role="group" aria-label="Position">{POS.map(([k, l]) => <button key={k} className={pos === k ? 'on' : ''} onClick={() => setPos(k)}>{l}</button>)}</div>
          <SortBy cols={cols} value={sortKey} onChange={setSortKey} />
          <input id="fan-q" className="search" placeholder="Search player" value={q} onChange={e => setQ(e.target.value)} aria-label="Search player" />
        </div>
        <SortTable key={sortKey} cols={cols} rows={pool.map((p: any) => ({ ...p, key: p.id }))} initial={sortKey} initialAsc={!!cols.find((c: any) => c.key === sortKey)?.asc} limit={150} />
      </section>
      <section className="col draft-side">
        {lg.userTid && (
          <div className="panel">
            <h2>{lg.teams[lg.userTid].name}</h2>
            {mine.length ? (
              <ul className="news">{mine.map((p: any, i: number) => <li key={p.id}><span className="yr">{f.picks.find((x: any) => x.pid === p.id)?.pick}</span><span>{p.name} <span className="dim">{posLabel(p)} · OVR {ovrOf(p.z, p.id)}</span></span></li>)}</ul>
            ) : <p className="note">You haven't picked anyone yet.</p>}
          </div>
        )}
        <PickBoard lg={lg} at={on ? on.pick - 1 : -1} openPlayer={openPlayer}
          slots={Array.from({ length: f.order.length * f.rounds }, (_, i) => {
            const round = Math.floor(i / f.order.length) + 1, tid = fantasyTidAt(f, i);
            const made = f.picks[i];
            return { n: i + 1, round, tid: made?.tid ?? tid, pid: made?.pid };
          })} />
      </section>
    </div>
  );
}

/** Your team so far in a fantasy draft: who you have and what they will cost (share of the cap per season). */
function MyFantasyTeam({ lg, openPlayer }: any) {
  const S = lg.season, mine = lg.fantasy.picks.filter((x: any) => x.tid === lg.userTid).map((x: any) => lg.players[x.pid]).filter(Boolean);
  const total = mine.reduce((a: number, p: any) => a + fantasyContract(p, S).sal, 0);
  const hc = hardCap(lg), lim = hc < Infinity ? hc : 1;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="fz-mine">
      <div className="fz-sum">
        <b>{lg.teams[lg.userTid].name}</b>
        <span>{mine.length} player{mine.length === 1 ? '' : 's'} · salaries <b className={total > lim ? 'neg' : ''}>{pct(total)}</b> of the cap{usd(total, S)}</span>
        <span className="dim">{hc < Infinity ? <>hard cap {pct(hc)} · room left <b className={total > hc ? 'neg' : ''}>{pct(hc - total)}</b></> : <>cap 100% · {total <= 1 ? <>space {pct(1 - total)}</> : <>over by {pct(total - 1)}</>}</>}</span>
      </div>
      <div className="fz-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (total / Math.max(lim, total)) * 100)}%` }} className={total > lim ? 'over' : ''} /></div>
      {mine.length > 0 && <div className="fz-list">{mine.map((p: any) => { const c = fantasyContract(p, S); return <span key={p.id} className="chip"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{ovrOf(p.z, p.id)} · {money(c.sal, S)} · {c.exp - S + 1}y</span></span>; })}</div>}
    </div>
  );
}
