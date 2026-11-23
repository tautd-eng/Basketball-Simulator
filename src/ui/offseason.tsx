// @ts-nocheck
// Off-season screens: draft day (one pick at a time), the free-agency hub
// (three stages) and the free-agent list where the user makes offers.
import { guardMove } from './guard';
import { hash01 } from '../rng';
import { POS_FILTER, natural, posLabel, posOk } from './positions';
import { fmtAttr, defCols, grouped } from './grades';
import { PickBoard, OnClock, useBoards, BoardsToggle, PickTicker } from './pickboard';
import { htStr, htCol, htDiff } from './units';
import { Linkify, PL, TL, nav } from './nav';
import { MyBoard, BoardToggle, boardOf } from './myboard';
import { run } from '../league/commands';
import { waveUnseen } from '../api';
import { RoleCell, roleSortKey, projectedZ } from './roles';
import { money, usd, showDollars, dollarsOf } from './money';
import { useMemo, useState } from 'react';
import { shownOvr as ovrOf, shownFromRaw, shownFromBpm, RATING_LABELS, ratingOf, seasonInfo, attrOf, perD, K } from '../data';
import { ageIn } from '../players';
import { peakBpm, payroll, askingSalary, MIN_SAL, maxSalary, hardCap, maxPlayer as maxPlayerOf } from '../ai/value';
import { discount, reasons, preferredYears, lengthPrice, offerUtility } from '../league/prefs';
import { isFreeAgent } from '../ai/trades';
import {
  initDraft, draftOnClock, draftAdvance, draftPick, draftSuggest, finishDraft,
  enterFreeAgency, faStage, startSeason, faOffer, faDemand, offersOn, withdrawOffer, faRenounce, faRelease, faDecide, faMatch, prevTeam, faOffersFor, faBudget, myOffers, capCheck,
} from '../league/offseason';
import { DecisionsBoard } from './offsteps';
import { isHuman, handTo, canRun, humans } from '../league/humans';
import { OthersWaiting } from './humans';
import { SortTable, f1 } from './sorttable';
import { ExpansionRoom, LotteryRoom, LotteryReveal, AutoControls, useAutoPlay } from './draftday';
import { posNum } from '../engine/game';

export const moneyOf = (frac: number, s: number) => money(frac, s);
export { potOf } from '../league/scouting';
import { potOf, scoutNow } from '../league/scouting';
const POT_STEPS: [number, string][] = [[90, 'A+'], [86, 'A'], [83, 'A-'], [80, 'B+'], [77, 'B'], [74, 'B-'], [71, 'C+'], [68, 'C'], [65, 'C-'], [62, 'D+'], [59, 'D'], [0, 'D-']];
export const potLetter = (v: number) => POT_STEPS.find(([t]) => v >= t)![1];
/** The scouts' potential as a letter grade (the number on hover). */
export const PotGrade = ({ v }: { v: number }) => { const l = potLetter(v); return <span className={`grade g-${l[0]}`} title={`Scouts: ${v}`}>{l}</span>; };
/** A potential column: the scouts' estimate as a letter grade (the number on hover). */
export const potCol = (pOf: (r: any) => any, S: number) => ({ key: 'pot', label: 'Pot.', title: "Potential as the scouts see it – they can be wrong, especially about prospects; the real potential stays hidden", get: (r: any) => potOf(pOf(r), S),
  fmt: (v: number) => { const l = potLetter(v); return <span className={`grade g-${l[0]}`} title={`Scouts: ${v}`}>{l}</span>; } });
export { scoutNow } from '../league/scouting';
export const athOf = (p: any) => {
  const z = p.z, c = (z[K.drw] + z[K.orb] + z[K.drb] + z[K.stl] + z[K.blk] + 1.5 * perD(z, p.ht)) / 6.5;
  return ratingOf(c * 2.5); // the composite varies little, so it is spread out to the usual 0–99 scale
};
/** Columns for prospects: what the scouts think he is now. */
export const scoutCols = (pOf: (r: any) => any) => [
  { key: 'now', label: 'Now', title: 'His overall today as the scouts see it – an estimate, it can be a few points off (the real one shows once he is drafted)', get: (r: any) => scoutNow(pOf(r)), fmt: (v: number) => <span className="dim" title="Scouts' estimate">~{v}</span> },
];
const R = (p: any, i: number) => attrOf(p.z, RATING_LABELS[i]);
/** Height and every rating, for lists where you choose players without opening their cards.
 *  `proj`: the ratings he projects to at his peak (the league's average development, skill by skill) instead of today's. */
export function attrCols(pOf: (r: any) => any, S: number, proj = false) {
  const cache = new Map<string, number[]>();
  const zOf = (r: any) => { const p = pOf(r); if (!proj) return p.z; let z = cache.get(p.id); if (!z) { z = projectedZ(p, S); cache.set(p.id, z); } return z; };
  return grouped([
    { key: 'role', label: 'Role', left: true, asc: true, title: 'Archetype – for a young player without a clear role yet, what he projects to become (proj.)', get: (r: any) => roleSortKey(pOf(r), S), fmt: (_: any, r: any) => <RoleCell p={pOf(r)} S={S} /> },
    htCol((r: any) => pOf(r).ht),
    ...RATING_LABELS.map((L, i) => ({ key: 'r' + i, label: L.short, title: L.name + (L.tendency ? ' (a tendency, not a skill)' : '') + (proj ? ' – projected at his peak' : ''), get: (r: any) => attrOf(zOf(r), L), fmt: (v: any, r: any) => {
      if (L.tendency) return <span className="dim">{v}</span>;
      if (!proj) return fmtAttr(v);
      const d = v - attrOf(pOf(r).z, L);
      return <span title={`Now ${v - d}`}>{fmtAttr(v)}{d >= 3 ? <span className="pos small-t"> +{d}</span> : d <= -3 ? <span className="neg small-t"> {d}</span> : null}</span>;
    } })),
    ...defCols(pOf),
  ]);
}
/** A "Sort by" picker for a draft table: every column that can sort, by its full name. */
export function SortBy({ cols, value, onChange }: any) {
  const opts = cols.filter((c: any) => c.get && c.key !== 'act' && c.key !== 'name');
  return (
    <label className="sort-by"><span className="dim">Sort by</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label="Sort by">
        {opts.map((c: any) => <option key={c.key} value={c.key}>{c.title ? c.title.split(' – ')[0].split(' (')[0] : c.label}</option>)}
      </select>
    </label>
  );
}
/** Today's ratings or the projected ones. */
export function AttrMode({ proj, setProj }: any) {
  return <div className="seg" role="group" aria-label="Ratings shown">
    <button className={!proj ? 'on' : ''} onClick={() => setProj(false)}>Ratings now</button>
    <button className={proj ? 'on' : ''} onClick={() => setProj(true)} title="What each rating projects to at his peak (around 27) if he develops like an average player – real players beat or miss it">Projected at peak</button>
  </div>;
}
const POS = POS_FILTER;
function Ovr({ v }: any) {
  const tier = v >= 90 ? 'star' : v >= 80 ? 'good' : v >= 70 ? 'mid' : 'low';
  return <span className={`ovr ${tier} sm`}>{v}</span>;
}
const lastLine = (p: any) => [...p.career].reverse().find((c: any) => !c.po);

// ---------------------------------------------------------------- draft day
export function DraftRoom({ lg, onChange, onTick = () => {}, openPlayer, openTeam }: any) {
  const d = lg.draftDay && lg.draftDay.year === lg.season ? lg.draftDay : null;
  const [pos, setPos] = useState('all');
  const [sortKey, setSortKey] = useState('cons');
  const [boards, toggleBoards] = useBoards();
  const proj = false;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [reveal, setReveal] = useState(false);
  // draft-day trades pop up as they happen (and stay in the pick list)
  const nTrades = lg.draftDay?.trades?.length ?? 0;
  const [seen, setSeen] = useState(nTrades);
  const act = (fn: () => void) => { fn(); onChange(); };
  useAutoPlay(playing, speed, () => {
    const c = draftOnClock(lg);
    if (!c) return false;
    if (isHuman(lg, c.tid)) { handTo(lg, c.tid); return false; } // hot seat: that team picks
    const before = lg.draftDay?.trades?.length ?? 0;
    draftAdvance(lg, 'one'); onTick();
    if ((lg.draftDay?.trades?.length ?? 0) > before) return false; // a trade: stop so it can be seen
    const nx = draftOnClock(lg);
    return !!nx && !isHuman(lg, nx.tid);
  }, () => { setPlaying(false); onChange(); });
  if (!d) {
    const last = lg.history[lg.history.length - 1];
    return (
      <div className="panel accent">
        <h2>Draft day awaits</h2>
        <p className="note">The {lg.season} season is over. On draft day {seasonInfo(lg.season + 1).teams && Object.keys(seasonInfo(lg.season + 1).teams).some(t => !lg.teams[t]) ? 'there will first be an expansion draft for the new teams, then ' : ''}you'll see the lottery odds and the draw, and then teams pick one by one. You can make your own picks or skip ahead.</p>
        <div className="def-row"><button className="primary host-only" onClick={() => act(() => initDraft(lg))}>Start draft day</button></div>
        {last?.champion && <p className="note">Champions: <TL tid={last.champion} />.</p>}
      </div>
    );
  }
  if (d.done) return <DraftSummary lg={lg} d={d} openPlayer={openPlayer} openTeam={openTeam} onNext={() => act(() => enterFreeAgency(lg))} />;
  const stage = d.stage ?? 'draft';
  if (stage === 'expansion') return <ExpansionRoom lg={lg} onChange={onChange} onTick={onTick} openPlayer={openPlayer} openTeam={openTeam} />;
  if (stage === 'lottery') return <LotteryRoom lg={lg} onChange={onChange} onDrawn={() => setReveal(true)} />;
  if (reveal && d.lotto?.result) return <LotteryReveal lg={lg} close={() => setReveal(false)} />;
  const on = draftOnClock(lg);
  const myTurn = on && on.tid === lg.userTid;
  const myLeft = lg.userTid && d.order.slice(d.idx).some((o: any, i: number) => {
    const owner = lg.picks?.find((p: any) => p.season === d.year && p.round === o.round && p.orig === o.orig)?.owner ?? o.orig;
    return isHuman(lg, owner);
  });
  const board = d.pool.map((pid: string) => lg.players[pid]).filter((p: any) => posOk(p, pos));
  const suggestion = myTurn ? draftSuggest(lg, lg.userTid) : null;
  const cols = [
    { key: 'name', label: 'Player', left: true, get: (p: any) => p.name, fmt: (v: any, p: any) => <button className="link" onClick={() => openPlayer(p.id)}>{v}</button> },
    { key: 'pos', label: 'Pos', get: (p: any) => natural(p), fmt: (_: any, p: any) => <span className="dim">{posLabel(p)}</span> },
    { key: 'age', label: 'Age', asc: true, get: (p: any) => ageIn(p, d.year + 1) },
    { key: 'cons', label: 'Rank', title: 'Consensus rank of the scouts (his overall stays hidden until he is picked)', asc: true, get: (p: any) => p.draft?.realPick ?? 99 },
    potCol((p: any) => p, d.year + 1),
    ...scoutCols((p: any) => p),
    ...(lg.userTid ? [{ key: 'my', label: 'My board', title: 'Your own board – + adds him, the number is his place on it', asc: true, get: (p: any) => { const i = boardOf(lg, d.year).indexOf(p.id); return i < 0 ? 999 : i; }, fmt: (_: any, p: any) => <BoardToggle lg={lg} year={d.year} pid={p.id} onChange={() => act(() => {})} /> }] : []),
    ...attrCols((p: any) => p, d.year + 1, proj),
    { key: 'act', label: '', get: () => 0, fmt: (_: any, p: any) => myTurn ? <button className={`small ${p.id === suggestion ? 'primary' : ''}`} onClick={() => act(() => run(lg, { t: 'draftPick', pid: p.id }))}>Pick</button> : null },
  ];
  const slots = d.order.map((o: any, i: number) => {
    const made = d.picks[i];
    if (made) return { n: made.pick, round: o.round, tid: made.tid, via: made.via, pid: made.pid };
    const owner = lg.picks?.find((p: any) => p.season === d.year && p.round === o.round && p.orig === o.orig)?.owner ?? o.orig;
    return { n: i + 1, round: o.round, tid: owner, via: owner !== o.orig ? o.orig : undefined };
  });
  const recent = [...d.picks].reverse();
  const trades = d.trades ?? [];
  const fresh = trades.slice(seen);
  // picks and trades in one list, newest first (a trade at index i happened just before pick i + 1)
  const feed = [...recent.map((x: any) => ({ k: 'p', at: x.pick - 1 + 0.5, x })), ...trades.map((t: any, i: number) => ({ k: 't', at: t.at, x: t, i }))].sort((a, b) => b.at - a.at);
  return (
    <>
    {fresh.length > 0 && (
      <div className="overlay center" onClick={() => setSeen(trades.length)}>
        <div className="dialog trade-pop" role="dialog" aria-label="Draft-day trade" onClick={e => e.stopPropagation()}>
          <div className="eyebrow">Draft-day trade{fresh.length > 1 ? `s (${fresh.length})` : ''}</div>
          {fresh.map((t: any, i: number) => (
            <div key={i} className="trade-pop-row">
              <h2>{lg.teams[t.up]?.name} trade up to No. {t.to}</h2>
              <p><Linkify text={t.text} /></p>
            </div>
          ))}
          <div className="dialog-actions"><button className="primary" onClick={() => setSeen(trades.length)}>OK</button></div>
        </div>
      </div>
    )}
    <div className={`draft-layout ${boards ? 'open' : ''}`}>
      <section className="panel accent">
        <div className="team-head">
          <h2>{d.year} draft day</h2>
          <BoardsToggle open={boards} toggle={toggleBoards} />
        </div>
        {on && <OnClock lg={lg} tid={on.tid} pick={on.pick} round={on.round} via={on.tid !== on.orig ? on.orig : null} mine={myTurn} />}
        {!boards && <PickTicker lg={lg} slots={slots} at={d.idx} openPlayer={openPlayer} open={toggleBoards} />}
        {d.lottery && <p className="note"><Linkify text={d.lottery} /></p>}
        <div className="def-row">
          {myTurn ? <>
            <span className="hint">You're on the clock – pick from the list{suggestion ? (boardOf(lg, d.year).includes(suggestion) ? ` (top of your board: ${lg.players[suggestion].name})` : ` (GM suggests: ${lg.players[suggestion].name})`) : ''}.</span>
            <button onClick={() => act(() => run(lg, { t: 'draftPick' }))}>Let the GM pick</button>
          </> : canRun(lg) ? <button className="primary host-only" disabled={playing} onClick={() => act(() => draftAdvance(lg, 'one'))}>Next pick</button> : <span className="hint">Waiting for the host to move the draft on.</span>}
          {canRun(lg) && <AutoControls playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} disabled={!on || myTurn} />}
          {canRun(lg) && !myTurn && myLeft && <button className="host-only" disabled={playing} onClick={() => act(() => draftAdvance(lg, 'user'))}>{(lg.humans?.length ?? 0) > 1 ? 'To my next pick' : 'To my pick'}</button>}
          {canRun(lg) && <button className="host-only" onClick={() => { setPlaying(false); guardMove(lg, () => act(() => { draftAdvance(lg, 'all'); finishDraft(lg); }), 'draft'); }}>{lg.userTid ? 'To the end (GM picks for me)' : 'To the end'}</button>}
          {!myTurn && on && lg.online && isHuman(lg, on.tid) && <button className="host-only" title="He is not here – his GM makes the pick" onClick={() => act(() => draftPick(lg))}>GM picks for {lg.teams[on.tid].abbr}</button>}
          {d.lotto?.result && <button className="ghost" onClick={() => setReveal(true)}>Lottery</button>}
        </div>
        {!myTurn && on && lg.online && isHuman(lg, on.tid) && <p className="note">Waiting for {lg.teams[on.tid].name} to pick.</p>}
        {lg.userTid && <TradeUp lg={lg} d={d} slots={slots} onChange={onChange} />}
        <div className="def-row">
          <div className="seg" role="group" aria-label="Position">{POS.map(([k, l]) => <button key={k} className={pos === k ? 'on' : ''} onClick={() => setPos(k)}>{l}</button>)}</div>
          <SortBy cols={cols} value={sortKey} onChange={setSortKey} />
          <span className="hint">{d.pool.length} players left on the board</span>
        </div>
        <SortTable key={sortKey} cols={cols} rows={board.map((p: any) => ({ ...p, key: p.id }))} initial={sortKey} initialAsc={!!cols.find((c: any) => c.key === sortKey)?.asc} limit={80} />
        <p className="note">His overall stays hidden until he is drafted, and his real potential never shows: “Pot.” is what the scouts believe – usually close, sometimes far off.</p>
      </section>
      <section className="col draft-side">
        <PickBoard lg={lg} at={d.idx} openPlayer={openPlayer}
          slots={slots}
          note={trades.length ? <ul className="news pb-trades">{trades.map((t: any, i: number) => <li key={i} className="trade-li"><span className="yr">⇄</span><span><Linkify text={t.text} /></span></li>)}</ul> : null} />
        {lg.userTid && <MyBoard lg={lg} year={d.year} pool={d.pool} openPlayer={openPlayer} onChange={() => act(() => {})} />}
      </section>
    </div>
    </>
  );
}

/** Draft day: ask a computer team what it wants for one of the picks ahead of your next one (its answer is a trade offer). */
function TradeUp({ lg, d, slots, onChange }: any) {
  const me = lg.userTid;
  const mine = slots.findIndex((x: any, i: number) => i >= d.idx && !d.picks[i] && x.tid === me);
  const ahead = slots.map((x: any, i: number) => ({ ...x, i })).filter((x: any) => x.i >= d.idx && (mine < 0 || x.i < mine) && !d.picks[x.i] && x.tid !== me && !isHuman(lg, x.tid));
  const [at, setAt] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  if (mine < 0 || !ahead.length) return null;
  const sel = ahead.some((x: any) => x.i === at) ? at! : ahead[0].i;
  return <div className="def-row trade-up">
    <span>Trade up:</span>
    <select aria-label="Pick to trade up to" value={sel} onChange={e => { setAt(+e.target.value); setMsg(''); }}>
      {ahead.slice(0, 30).map((x: any) => <option key={x.i} value={x.i}>No. {x.i + 1} – {lg.teams[x.tid]?.name}</option>)}
    </select>
    <button onClick={() => { const r = run(lg, { t: 'askDraftPrice', i: sel }); setMsg(r.msg); onChange(); }}>Ask their price</button>
    {msg ? <span className="hint">{msg}</span> : <span className="hint">Your next pick is No. {mine + 1}. Their answer comes as a trade offer – it stands until that pick is made.</span>}
  </div>;
}

export function DraftSummary({ lg, d, openPlayer, openTeam, onNext }: any) {
  const S = d.year + 1;
  const rows = d.picks.map((x: any) => ({ ...x, key: x.pick, p: lg.players[x.pid] })).filter((r: any) => r.p);
  const byPot = [...rows].sort((a, b) => potOf(b.p, S) - potOf(a.p, S));
  const byOvr = [...rows].sort((a, b) => ovrOf(b.p.z, b.p.id) - ovrOf(a.p.z, a.p.id));
  const steal = rows.filter((r: any) => r.pick > 10).sort((a: any, b: any) => potOf(b.p, S) - potOf(a.p, S))[0];
  const mine = rows.filter((r: any) => r.tid === lg.userTid);
  const cols = [
    { key: 'pick', label: 'No.', asc: true, get: (r: any) => r.pick },
    { key: 'team', label: 'Team', left: true, get: (r: any) => lg.teams[r.tid].abbr, fmt: (v: any, r: any) => <><button className="link" onClick={() => openTeam(r.tid)}>{v}</button>{r.via ? <span className="dim"> (via {lg.teams[r.via].abbr})</span> : null}</> },
    { key: 'name', label: 'Player', left: true, get: (r: any) => r.p.name, fmt: (v: any, r: any) => <button className="link" onClick={() => openPlayer(r.pid)}>{v}</button> },
    { key: 'pos', label: 'Pos', get: (r: any) => natural(r.p), fmt: (_: any, r: any) => <span className="dim">{posLabel(r.p)}</span> },
    { key: 'age', label: 'Age', asc: true, get: (r: any) => ageIn(r.p, S) },
    { key: 'ovr', label: 'OVR', get: (r: any) => ovrOf(r.p.z, r.p.id), fmt: (v: any) => <Ovr v={v} /> },
    potCol((r: any) => r.p, S),
    { key: 'where', label: '', left: true, get: (r: any) => ((r.p as any).stash ? 1 : 0), fmt: (v: any, r: any) => v ? <span className="dim">stays overseas (until {(r.p as any).stash})</span> : '' },
  ];
  const line = (r: any) => r ? <><button className="link" onClick={() => openPlayer(r.pid)}>{r.p.name}</button> <span className="dim">({lg.teams[r.tid].abbr}, No. {r.pick})</span></> : '–';
  return (
    <div className="col">
      <div className="panel accent">
        <div className="team-head">
          <h2>{d.year} draft recap</h2>
          <button className="primary host-only" onClick={onNext}>To free agency →</button>
        </div>
        {d.lottery && <p className="note"><Linkify text={d.lottery} /></p>}
        {lg.classSrc?.[d.year] && <p className="note"><b>Revealed:</b> this year brought the real {lg.classSrc[d.year]} draft class.</p>}
        <div className="kv">
          <div><span className="dim">No. 1</span> {line(rows[0])}</div>
          <div><span className="dim">Most ready now</span> {line(byOvr[0])}</div>
          <div><span className="dim">Highest potential</span> {line(byPot[0])}</div>
          {steal && <div><span className="dim">Possible steal (after pick 10)</span> {line(steal)}</div>}
          {lg.userTid && <div><span className="dim">Your rookies</span> {mine.length ? mine.map((r: any, i: number) => <span key={r.pid}>{i ? ', ' : ''}<button className="link" onClick={() => openPlayer(r.pid)}>{r.p.name}</button> <span className="dim">(No. {r.pick})</span></span>) : 'you had no picks this year'}</div>}
        </div>
      </div>
      <div className="panel">
        <SortTable cols={cols} rows={rows} initial="pick" initialAsc rowClass={(r: any) => (r.tid === lg.userTid ? 'mine' : '')} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- free agency hub
const STAGE_TXT = [
  'Contract decisions before the market opens: players decide on their player options, teams on team options and qualifying offers for younger players (restricted free agents, RFA). Other teams can make offers to an RFA, but his team can match and keep him. Trading is open before you confirm: clear salary first if you need room to keep an option – a player traded with an open option takes it with him, and his new team decides.',
  'First wave: the top free agents ask for full price and some wait for better offers. Only you can make offers to your own players whose contracts ended.',
  'Second wave: asking prices drop (~15%) and most players with offers sign. Teams are actively looking for trades.',
  'Final wave: the remaining players accept ~70% of their original ask. After it, teams fill their rosters to the minimum and the season begins.',
];

export function FAHub({ lg, onChange, openPlayer, openTeam, goFA }: any) {
  const fa = lg.fa;
  const [msg, setMsg] = useState<string | null>(null);
  const [offersOf, setOffersOf] = useState<string | null>(null);
  const [neg, setNeg] = useState<string | null>(null);
  // the market right now: which teams would make each of the best free agents an offer
  const market = useMemo(() => {
    const m = new Map<string, any[]>();
    if (!fa || fa.stage < 1 || fa.stage > 3) return m;
    const top = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)).slice(0, 80);
    for (const p of top as any[]) m.set(p.id, faOffersFor(lg, p));
    return m;
  }, [fa?.stage, fa?.log.length, lg.trades?.length]);
  if (!fa) return null;
  if (fa.stage === 1 && !fa.sumSeen) return <OptionsSummary lg={lg} openPlayer={openPlayer} onOpen={() => { fa.sumSeen = true; onChange(); try { window.scrollTo({ top: 0 }); } catch { /* */ } }} />;
  // after each wave: its results on a screen of their own, then on to the next wave
  { const me = lg.userTid ?? '-', w = fa.stage - 1;
    if (waveUnseen(lg))
      return <WaveSummary lg={lg} w={w} openPlayer={openPlayer} onNext={() => { (fa.waveSeen ??= {})[me] = w; onChange(); try { window.scrollTo({ top: 0 }); } catch { /* */ } }} />; }
  const act = (fn: () => any) => { const r = fn(); if (r?.msg) setMsg(r.msg); onChange(); };
  const N = lg.season;
  const u = lg.userTid ? lg.teams[lg.userTid] : null;
  // before the decisions are confirmed: payroll and roster as your current choices would leave them
  // (declined options and unsigned rookies off the books, tendered qualifying offers on them as cap holds)
  const choice = (d: any) => d.choice ?? d.rec;
  const myDec = fa.stage === 0 && u ? (fa.decisions ?? []).filter((d: any) => (d.tid ?? lg.userTid) === u.tid) : [];
  const dropped = myDec.filter((d: any) => (d.kind === 'team' || d.kind === 'rookie') && lg.players[d.pid].tid === u!.tid && choice(d) === false);
  const holds = myDec.filter((d: any) => d.kind === 'qo' && choice(d) === true);
  const pay = u ? payroll(lg, u.tid) - dropped.reduce((a: number, d: any) => a + d.sal, 0) + holds.reduce((a: number, d: any) => a + d.sal, 0) : 0;
  const nPlayers = u ? u.roster.length - dropped.length : 0;
  const capLim = N < 1985 ? 1.3 : 1.0;
  const pending = fa.stage === 1 ? fa.pending.map((pid: string) => lg.players[pid]).filter((p: any) => (p.bird ?? lg.userTid) === lg.userTid) : [];
  const top = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)).slice(0, 8);
  const stages = [0, 1, 2, 3].map(s => ({ s, log: fa.log.filter((x: any) => x.st === s) }));
  const decisions = fa.stage === 0 ? (fa.decisions ?? []).filter((d: any) => (d.tid ?? lg.userTid) === lg.userTid || (d.kind === 'team' && lg.players[d.pid]?.tid === lg.userTid)) : [];
  const sheets = (fa.sheets ?? []).filter((sh: any) => (lg.players[sh.pid]?.rfa ?? lg.userTid) === lg.userTid);
  const entry = (x: any, i: number) => {
    const p = x.pid ? lg.players[x.pid] : null;
    if (x.kind === 'trade') return <li key={i}><span className="yr">⇄</span><span><Linkify text={x.desc} /></span></li>;
    if (!p) return null;
    const who = <button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button>;
    const team = x.tid ? lg.teams[x.tid].abbr : '';
    const k = { sign: 'signed', resign: 're-signed', release: 'released', leave: 'hit the market', option: 'option', qo: 'qualifying offer (RFA)', match: 'matched', sheet: 'offer sheet to an RFA' }[x.kind];
    return <li key={i} className={x.tid === lg.userTid ? 'mine' : ''}><span className="yr">{x.tid ? <TL tid={x.tid} abbr /> : team}</span><span>{who} <span className="dim">OVR {ovrOf(p.z, p.id)}, age {ageIn(p, N)} · {k}{x.sal ? ` · ${moneyOf(x.sal, N)}${x.exp ? ` through ${x.exp}` : ''}` : ''}{x.desc ? <> · <Linkify text={x.desc} /></> : ''}</span></span></li>;
  };
  const tradesAll = fa.log.filter((x: any) => x.kind === 'trade').reverse();
  const signed = fa.log.filter((x: any) => x.pid && lg.players[x.pid] && x.st >= 1 && ['sign', 'resign', 'match', 'sheet', 'qo'].includes(x.kind) && !(x.kind === 'sheet' && (x.desc ?? '').includes('awaiting')))
    .map((x: any, i: number) => ({ ...x, key: i, p: lg.players[x.pid] }));
  const avail = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p) && ovrOf(p.z, p.id) >= 55).map((p: any) => ({ key: p.id, p, from: prevTeam(p) }));
  const nm = (p: any) => <button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button>;
  const tm = (tid: string) => tid && lg.teams[tid] ? <TL tid={tid} abbr /> : <span className="dim">–</span>;
  const availCols = [
    { key: 'name', label: 'Player', left: true, get: (r: any) => r.p.name, fmt: (_: any, r: any) => <>{nm(r.p)}{r.p.rfa ? <span className="chip tiny rfa" title={`Restricted: the ${lg.teams[r.p.rfa]?.name} can match`}>RFA</span> : null}</> },
    { key: 'ask', label: 'Asks', get: (r: any) => (u ? faDemand(lg, r.p, u.tid, preferredYears(r.p, N)) : askingSalary(r.p, N)), fmt: (v: any) => moneyOf(v, N) },
    { key: 'pos', label: 'Pos', get: (r: any) => natural(r.p), fmt: (_: any, r: any) => <span className="dim">{posLabel(r.p)}</span> },
    { key: 'age', label: 'Age', asc: true, get: (r: any) => ageIn(r.p, N) },
    { key: 'ovr', label: 'OVR', get: (r: any) => ovrOf(r.p.z, r.p.id), fmt: (v: any) => <Ovr v={v} /> },
    potCol((r: any) => r.p, N),
    { key: 'from', label: 'Last team', left: true, get: (r: any) => lg.teams[r.from]?.abbr ?? '', fmt: (_: any, r: any) => tm(r.from) },
    { key: 'int', label: 'Interest', title: 'Teams interested in him (offers stay secret until he signs)', left: true, get: (r: any) => market.get(r.p.id)?.length ?? -1,
      fmt: (_: any, r: any) => { const o = market.get(r.p.id); if (!o) return <span className="dim">–</span>; if (!o.length) return <span className="dim">no offers</span>;
        return <button className="link-btn" onClick={() => setOffersOf(r.p.id)} title={`${o.length} teams interested – what they offer stays secret until he signs`}><b>{o.length}</b> <span className="chip tiny">interested</span></button>; } },
    ...attrCols((r: any) => r.p, N),
  ];
  const signedCols = [
    { key: 'name', label: 'Player', left: true, get: (r: any) => r.p.name, fmt: (_: any, r: any) => nm(r.p) },
    { key: 'ovr', label: 'OVR', get: (r: any) => ovrOf(r.p.z, r.p.id), fmt: (v: any) => <Ovr v={v} /> },
    { key: 'age', label: 'Age', asc: true, get: (r: any) => ageIn(r.p, N) },
    { key: 'from', label: 'From', left: true, get: (r: any) => lg.teams[r.from]?.abbr ?? '', fmt: (_: any, r: any) => tm(r.from) },
    { key: 'to', label: 'To', left: true, get: (r: any) => lg.teams[r.tid]?.abbr ?? '', fmt: (_: any, r: any) => <b>{tm(r.tid)}</b> },
    { key: 'sal', label: 'Salary', get: (r: any) => r.sal ?? 0, fmt: (v: any) => moneyOf(v, N) },
    { key: 'yrs', label: 'Yrs', get: (r: any) => (r.exp ? r.exp - N + 1 : 1) },
    { key: 'st', label: 'Wave', get: (r: any) => r.st, fmt: (v: any, r: any) => <span className="dim" title={r.desc ?? ''}>{v >= 4 ? 'late' : `W${v}`}{r.kind === 'match' ? ' ✓' : r.kind === 'qo' ? ' QO' : r.kind === 'resign' ? ' ↺' : ''}</span> },
    { key: 'bids', label: 'Offers', left: true, title: 'Every offer he had – revealed now that he signed', get: (r: any) => lg.bidLog?.[r.p.id]?.bids?.length ?? 0, fmt: (_: any, r: any) => <BidsReveal lg={lg} pid={r.p.id} /> },
  ];
  return (
    <div className="col">
    {offersOf && <OffersDialog lg={lg} p={lg.players[offersOf]} offers={market.get(offersOf) ?? faOffersFor(lg, lg.players[offersOf])} close={() => setOffersOf(null)} openPlayer={openPlayer} />}
    <div className="grid-2">
      <section className="col">
        <div className="panel accent">
          <div className="team-head">
            <h2>{fa.stage === 0 ? `Options & contract decisions · ${N - 1}–${String(N).slice(2)}` : `Free agency · ${N - 1}–${String(N).slice(2)}`}</h2>
            {fa.stage > 0 && <div className="seg stage-seg" aria-label="Free agency stages">{[1, 2, 3].map(s => <span key={s} className={`chip ${fa.stage === s ? 'on-clock' : fa.stage > s ? 'past' : ''}`}>Wave {s}</span>)}</div>}
          </div>
          <p className="note">{fa.stage <= 3 ? STAGE_TXT[fa.stage] : 'Free agency is over. When the season starts, teams with fewer than 13 players will sign minimum deals, and teams with more than 15 will release their weakest.'}</p>
          {u && <div className="kv">
            <div><span className="dim">{u.name}</span> {nPlayers} players{fa.stage === 0 && (dropped.length || holds.length) ? <span className="dim"> (with your choices{holds.length ? `, incl. ${holds.length} qualifying offer${holds.length > 1 ? 's' : ''} as cap hold` : ''})</span> : ''} · payroll {Math.round(pay * 100)}% of the cap{usd(pay, N)} {hardCap(lg) < Infinity ? <> · room under the cap ({Math.round(hardCap(lg) * 100)}%): <b className={pay > hardCap(lg) ? 'neg' : ''}>{Math.round((hardCap(lg) - pay) * 100)}%</b></> : <> · cap space {Math.max(0, Math.round((capLim - pay) * 100))}%{N >= 1995 ? ` · mid-level exception ${fa.mle.includes(u.tid) ? 'used' : 'available'}` : ''}</>}</div>
          </div>}
          <div className="def-row">
            {fa.stage <= 3
              ? <button className="primary host-only" onClick={() => guardMove(lg, () => act(() => faStage(lg)))}>{fa.stage === 0 ? 'Confirm decisions →' : `Finish wave ${fa.stage} →`}</button>
              : <button className="primary host-only" onClick={() => guardMove(lg, () => act(() => startSeason(lg)))}>To the season preview →</button>}
            <button onClick={goFA}>All free agents</button>
          </div>
          {u && fa.stage <= 3 && !lg.online && humans(lg).length > 1 && (() => {
            const done = fa.doneTeams ?? [];
            const on = done.includes(u.tid);
            return <div className="done-fa">
              <label className="chk" title="This team will not get a turn in the remaining steps of free agency – its GM decides whatever is left open (an offer sheet on your restricted free agent still asks you)">
                <input type="checkbox" checked={on} onChange={e => { fa.doneTeams = e.target.checked ? [...done.filter((t: string) => t !== u.tid), u.tid] : done.filter((t: string) => t !== u.tid); onChange(); }} /> {u.name}: done with free agency
              </label>
              {humans(lg).filter((t: string) => t !== u.tid).length > 0 && <span className="dim small-t"> · {humans(lg).filter((t: string) => t !== u.tid).map((t: string) => <span key={t} className={`chip tiny ${done.includes(t) ? 'past' : ''}`} title={done.includes(t) ? 'Done with free agency' : 'Still gets its turn each step'}>{lg.teams[t].abbr}{done.includes(t) ? ' ✓' : ''}</span>)}</span>}
            </div>;
          })()}
          {msg && <p className="hint" role="status">{msg}</p>}
        </div>
        <OthersWaiting lg={lg} onChange={onChange} />
        {fa.stage === 0 && <PlayerOptionResults lg={lg} openPlayer={openPlayer} />}
        {fa.stage >= 1 && fa.stage <= 3 && <BirdRights lg={lg} openPlayer={openPlayer} goFA={goFA} />}
        {decisions.length > 0 && (
          <div className="panel">
            <h2>Your contract decisions</h2>
            {(() => {
              const u = lg.userTid, hc = hardCap(lg);
              if (!u || hc === Infinity) return null;
              return <p className={pay > hc ? 'hint warn-t' : 'note'}>Payroll with these choices: <b>{Math.round(pay * 100)}%</b> of the cap (hard cap {Math.round(hc * 100)}%).{pay > hc ? ' Over the hard cap – trade salary away or decline an option before you confirm.' : ''}</p>;
            })()}
            <p className="note">Team option – whether to keep the player next season at the salary in his contract. Rookie contract – sign your draft pick to his rookie deal, or let him go (no money on your books, he becomes a free agent). Qualifying offer – if you tender it, the player becomes a restricted free agent: you can match other teams' offers, and if nobody offers, he plays for you for one year at this amount. If you don't choose, the GM decides (his recommendation is marked).</p>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th className="l">Player</th><th>Age</th><th>OVR</th><th className="l">Decision</th><th>Salary</th><th className="l">GM suggests</th><th></th></tr></thead>
              <tbody>{decisions.map((d: any) => {
                const p = lg.players[d.pid];
                const yes = d.choice ?? null;
                if (d.kind === 'team' && p.tid !== lg.userTid && (d.tid ?? lg.userTid) === lg.userTid) return <tr key={d.pid}><td className="l">{p.name}</td><td colSpan={6} className="l dim">Traded – the option went with him; {p.tid ? lg.teams[p.tid].name : 'his new team'} decide{p.tid ? '' : 's'}.</td></tr>;
                return <tr key={d.pid}>
                  <td className="l"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{posLabel(p)}</span></td>
                  <td>{ageIn(p, N)}</td><td><Ovr v={ovrOf(p.z, p.id)} /></td>
                  <td className="l">{d.kind === 'team' ? 'Team option' : d.kind === 'rookie' ? `Rookie contract${p.draft ? ` (No. ${p.draft.pick})` : ''}` : 'Qualifying offer'}</td>
                  <td>{moneyOf(d.sal, N)}</td>
                  <td className="l dim">{d.rec ? (d.kind === 'team' ? 'keep' : d.kind === 'rookie' ? 'sign' : 'tender') : (d.kind === 'team' ? 'decline' : d.kind === 'rookie' ? 'let go' : 'don\'t tender')}</td>
                  <td className="l">
                    <button className={`small ${yes === true ? 'primary' : ''}`} onClick={() => act(() => run(lg, { t: 'decide', pid: d.pid, yes: true }))}>{d.kind === 'team' ? 'Keep' : d.kind === 'rookie' ? 'Sign' : 'Tender'}</button>{' '}
                    <button className={`small ${yes === false ? 'primary' : ''}`} onClick={() => act(() => run(lg, { t: 'decide', pid: d.pid, yes: false }))}>{d.kind === 'team' ? 'Decline' : d.kind === 'rookie' ? 'Let go' : 'Don\'t tender'}</button>
                  </td>
                </tr>;
              })}</tbody>
            </table></div>
          </div>
        )}
        {sheets.length > 0 && (
          <div className="panel accent">
            <h2>Offer sheets for your RFAs</h2>
            <p className="note">Another team signed your restricted free agent to an offer sheet. Match it and he stays with you on the same terms (you can go over the cap, up to the hard cap), or let him go. If you do nothing, the GM decides at the end of the wave.</p>
            <ul className="news">{sheets.map((sh: any) => {
              const p = lg.players[sh.pid];
              return <li key={sh.pid}><span className="yr">{lg.teams[sh.tid].abbr}</span><span><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">OVR {ovrOf(p.z, p.id)}, age {ageIn(p, N)} · {moneyOf(sh.sal, N)} through {sh.exp}</span>{' '}
                <button className="small primary" onClick={() => act(() => run(lg, { t: 'match', pid: sh.pid, yes: true }))}>Match</button>{' '}
                <button className="small" onClick={() => act(() => run(lg, { t: 'match', pid: sh.pid, yes: false }))}>Let go</button></span></li>;
            })}</ul>
          </div>
        )}
        {pending.length > 0 && (
          <div className="panel">
            <h2>Your players with expired contracts</h2>
            <p className="note">In this wave only you can negotiate with them, and you can go over the cap (up to the hard cap). If you do nothing, the GM decides at the end of the wave.</p>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th className="l">Player</th><th>Age</th><th>OVR</th><th>Pot</th><th title="For the length he would pick himself">Asks</th><th></th></tr></thead>
              <tbody>{pending.map((p: any) => {
                const need = faDemand(lg, p, u.tid, preferredYears(p, N));
                return <tr key={p.id}>
                  <td className="l"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{posLabel(p)}</span></td>
                  <td>{ageIn(p, N)}</td><td><Ovr v={ovrOf(p.z, p.id)} /></td><td><PotGrade v={potOf(p, N)} /></td>
                  <td>{moneyOf(need, N)}</td>
                  <td className="l"><button className={`small ${neg === p.id ? '' : 'primary'}`} onClick={() => setNeg(neg === p.id ? null : p.id)}>{neg === p.id ? 'Close' : 'Negotiate'}</button> <button className="small" onClick={() => act(() => run(lg, { t: 'faRenounce', pid: p.id }))}>Let go</button></td>
                </tr>;
              })}</tbody>
            </table></div>
            {neg && pending.some((p: any) => p.id === neg) && <FAOfferBox key={neg} lg={lg} p={lg.players[neg]} onDone={(r: any) => { setMsg(r.msg); if (r.ok) setNeg(null); onChange(); }} onCancel={() => setNeg(null)} />}
          </div>
        )}
      </section>
      <section className="col">
        {fa.stage === 0 ? <DecisionsBoard lg={lg} openPlayer={openPlayer} /> : (
          <div className="panel fa-trades">
            <h2>Trades this summer</h2>
            {tradesAll.length ? <ul className="news">{tradesAll.slice(0, 30).map((x: any, i: number) => <li key={i}><span className="yr">{x.st ? `W${x.st}` : '⇄'}</span><span><Linkify text={x.desc} /></span></li>)}</ul> : <p className="note">No trades yet – AI teams talk at the end of each wave.</p>}
          </div>
        )}
      </section>
    </div>
    {fa.stage >= 1 && (
      <div className="grid-2 fa-grid">
        <section className="panel">
          <div className="team-head"><h2>Still available</h2><span className="dim">{avail.length} players (OVR 55+)</span><button className="small" onClick={goFA}>Make offers</button></div>
          <SortTable cols={availCols} rows={avail} initial="ovr" limit={60} />
        </section>
        <section className="panel">
          <div className="team-head"><h2>Signed</h2><span className="dim">{signed.length} deals · ✓ matched offer sheet · ↺ re-signed · QO played on the qualifying offer</span></div>
          {signed.length ? <SortTable cols={signedCols} rows={signed} initial="ovr" limit={120} rowClass={(r: any) => (r.tid === lg.userTid ? 'mine' : '')} /> : <p className="note">Nobody has signed yet – deals are done at the end of each wave.</p>}
        </section>
      </div>
    )}
    {fa.stage >= 1 && (
      <div className="panel">
        <h2>All moves, wave by wave</h2>
        {stages.filter(x => x.s <= fa.stage).reverse().map(({ s, log }) => {
          const routine = log.filter((x: any) => x.kind === 'option' && !x.user && x.tid !== lg.userTid && (x.desc ?? '').includes('team exercised'));
          const shown = log.filter((x: any) => !routine.includes(x));
          return <div key={s}>
            <h3>{s ? `Wave ${s}` : 'Contract decisions'} {s === fa.stage && s <= 3 ? '(in progress)' : ''}</h3>
            {routine.length > 0 && <p className="note">Teams exercised {routine.length} options (players stay).</p>}
            {shown.length ? <ul className="news">{shown.slice(0, 80).map(entry)}</ul> : !routine.length && <p className="note">{s === fa.stage ? 'Quiet so far – AI teams act at the end of the wave.' : 'Nothing happened.'}</p>}
          </div>;
        })}
      </div>
    )}
    </div>
  );
}

/** After the contract decisions: what happened, and who is on the market. */
/** One wave of free agency done: how your offers came out, what is still open, every move around the league. */
function WaveSummary({ lg, w, openPlayer, onNext }: any) {
  const fa = lg.fa, N = lg.season, u = lg.userTid;
  const [all, setAll] = useState(false);
  const nm = (p: any) => <button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button>;
  const info = (p: any) => <span className="dim">{posLabel(p)} · OVR {ovrOf(p.z, p.id)} · age {ageIn(p, N)}</span>;
  const deal = (sal: number, exp?: number) => `${moneyOf(sal, N)}${exp ? ` through ${exp}` : ''}`;
  // your offers: the answers from this wave, and those still open
  const ans = ((lg as any).offerResults ?? []).filter((x: any) => x.tid === u && x.s === N && x.st === w && lg.players[x.pid]);
  const open = u ? myOffers(lg, u).filter((o: any) => lg.players[o.pid] && isFreeAgent(lg, lg.players[o.pid])) : [];
  const ICON: any = { signed: '✔', sheet: '…', matched: '✖', elsewhere: '✖', declined: '✖', waiting: '…' };
  const ansLine = (x: any, i: number) => {
    const p = lg.players[x.pid], d = `${moneyOf(x.sal, N)} × ${x.yrs} yr${x.yrs > 1 ? 's' : ''}`;
    const t = x.res === 'signed' ? <>{nm(p)} signed – {d}</>
      : x.res === 'sheet' ? <>{nm(p)} signed your offer sheet ({d}) – the <TL tid={p.rfa} /> can still match</>
      : x.res === 'matched' ? <>{nm(p)}: the <TL tid={x.to} /> matched your offer sheet</>
      : x.res === 'elsewhere' ? <>{nm(p)} chose the <TL tid={x.to} /> over your {d}</>
      : x.res === 'waiting' ? <>{nm(p)} has not decided – your {d} stays open{(() => { try { return isFreeAgent(lg, p) && x.sal + 1e-9 < faDemand(lg, p, x.tid, x.yrs) ? ' (under what he asks now)' : ''; } catch { return ''; } })()}</>
      : <>{nm(p)} turned down your {d}{x.under ? ' – under his asking price' : ''}</>;
    return <li key={i} className={`ans-${x.res}`}><span className="ans-ic" aria-hidden>{ICON[x.res]}</span> <span>{t}</span></li>;
  };
  // the wave's moves
  const moves = fa.log.filter((x: any) => x.st === w);
  const signs = moves.filter((x: any) => x.pid && lg.players[x.pid] && ['sign', 'resign', 'match', 'sheet'].includes(x.kind) && !(x.kind === 'sheet' && /awaiting/.test(x.desc ?? '')))
    .sort((a: any, b: any) => ovrOf(lg.players[b.pid].z, b.pid) - ovrOf(lg.players[a.pid].z, a.pid));
  const trades = moves.filter((x: any) => x.kind === 'trade');
  const cuts = moves.filter((x: any) => x.kind === 'release' && x.pid && lg.players[x.pid]);
  const mine = moves.filter((x: any) => x.tid === u && x.pid && lg.players[x.pid]);
  const K: any = { sign: 'signed', resign: 're-signed', match: 'matched the offer sheet', sheet: 'offer sheet', release: 'released', leave: 'left', option: 'option', qo: 'qualifying offer' };
  const moveLine = (x: any, i: number) => { const p = lg.players[x.pid];
    return <li key={i} className={x.tid === u ? 'mine' : ''}><span className="yr">{x.tid && lg.teams[x.tid] ? <TL tid={x.tid} abbr /> : ''}</span><span>{nm(p)} {info(p)} · {K[x.kind] ?? x.kind}{x.sal ? ` · ${deal(x.sal, x.exp)}` : ''}{x.from && x.from !== x.tid && lg.teams[x.from] ? <span className="dim"> · from {lg.teams[x.from].abbr}</span> : null}</span></li>; };
  const left = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)).slice(0, 12);
  const next = w < 3 ? `Continue to wave ${w + 1} →` : 'Continue →';
  return (
    <div className="col">
      <div className="panel accent step-head">
        <div className="team-head">
          <h2>Wave {w} is done · free agency {N - 1}–{String(N).slice(2)}</h2>
          <button className="primary" onClick={onNext}>{next}</button>
        </div>
        <p className="note">{signs.length} signing{signs.length === 1 ? '' : 's'}{trades.length ? `, ${trades.length} trade${trades.length > 1 ? 's' : ''}` : ''}{cuts.length ? `, ${cuts.length} release${cuts.length > 1 ? 's' : ''}` : ''} around the league this wave.{w < 3 ? ` Wave ${w + 1} is next: new offers, and the open ones are answered at its end.` : ' The market is closed now – the rest sign late, at the minimum.'}</p>
      </div>
      <div className="grid-2">
        <section className="col">
          {u && <div className="panel">
            <h2>Answers to your offers</h2>
            {ans.length ? <ul className="news ans-list">{ans.map(ansLine)}</ul> : <p className="note">You had no offers out in this wave.</p>}
          </div>}
          {u && <div className="panel">
            <h2>Your open offers <span className="dim">({open.length})</span></h2>
            {open.length ? <ul className="news">{open.map((o: any) => { const p = lg.players[o.pid]; let ask = 0; try { ask = faDemand(lg, p, u, o.yrs); } catch { /* */ }
              return <li key={o.pid}><span className="yr">{ovrOf(p.z, p.id)}</span><span>{nm(p)} {info(p)} · your offer {moneyOf(o.sal, N)} × {o.yrs} yr{o.yrs > 1 ? 's' : ''}{ask ? <span className={o.sal + 1e-9 < ask ? 'neg' : 'dim'}> · he asks {moneyOf(ask, N)}</span> : null}</span></li>; })}</ul>
              : <p className="note">{w < 3 ? 'None – make offers in the next wave.' : 'None.'}</p>}
          </div>}
          {u && mine.length > 0 && <div className="panel">
            <h2>Your moves</h2>
            <ul className="news">{mine.map(moveLine)}</ul>
          </div>}
          <div className="panel">
            <h2>Best still on the market</h2>
            {left.length ? <ul className="news">{left.map((p: any) => <li key={p.id}><span className="yr">{ovrOf(p.z, p.id)}</span><span>{nm(p)} <span className="dim">{posLabel(p)} · age {ageIn(p, N)} · asks {moneyOf(u ? faDemand(lg, p, u, preferredYears(p, N)) : askingSalary(p, N), N)}</span>{p.rfa ? <span className="chip tiny rfa">RFA</span> : null}</span></li>)}</ul> : <p className="note">Nobody left.</p>}
          </div>
        </section>
        <section className="col">
          <div className="panel">
            <h2>Signings this wave <span className="dim">({signs.length})</span></h2>
            {signs.length ? <ul className="news">{(all ? signs : signs.slice(0, 25)).map(moveLine)}</ul> : <p className="note">None.</p>}
            {signs.length > 25 && <button className="ghost small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${signs.length}`}</button>}
          </div>
          {trades.length > 0 && <div className="panel">
            <h2>Trades this wave</h2>
            <ul className="news">{trades.map((x: any, i: number) => <li key={i}><span className="yr">⇄</span><span><Linkify text={x.desc} /></span></li>)}</ul>
          </div>}
          {cuts.length > 0 && <div className="panel">
            <h2>Released</h2>
            <ul className="news">{cuts.slice(0, 15).map(moveLine)}</ul>
          </div>}
        </section>
      </div>
      <div className="def-row"><button className="primary" onClick={onNext}>{next}</button></div>
    </div>
  );
}

function OptionsSummary({ lg, openPlayer, onOpen }: any) {
  const fa = lg.fa, N = lg.season;
  const log = fa.log.filter((x: any) => x.st === 0 && x.pid && lg.players[x.pid]);
  const d = (x: any) => x.desc ?? '';
  const groups = [
    ['Team options picked up', log.filter((x: any) => x.kind === 'option' && /exercised the option|you exercised/.test(d(x)))],
    ['Team options declined', log.filter((x: any) => x.kind === 'option' && /team declined|you declined/.test(d(x)))],
    ['Players opting out', log.filter((x: any) => x.kind === 'option' && /declined his player option/.test(d(x)))],
    ['Players opting in', log.filter((x: any) => x.kind === 'option' && /exercised his player option/.test(d(x)))],
    ['Re-signed before the market', log.filter((x: any) => x.kind === 'resign')],
    ['Qualifying offers (restricted)', log.filter((x: any) => x.kind === 'qo')],
  ] as const;
  const market = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p) || fa.pending.includes(p.id)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)).slice(0, 15);
  const row = (x: any, i: number) => { const p = lg.players[x.pid]; return <li key={i} className={x.tid === lg.userTid ? 'mine' : ''}><span className="yr">{x.tid ? <TL tid={x.tid} abbr /> : ''}</span><span><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">OVR {ovrOf(p.z, p.id)}, age {ageIn(p, N)}{x.sal && x.kind !== 'option' ? ` · ${moneyOf(x.sal, N)}${x.exp ? ` through ${x.exp}` : ''}` : ''}</span></span></li>; };
  return (
    <div className="col">
      <div className="panel accent step-head">
        <div className="team-head">
          <h2>Contract decisions are in</h2>
          <button className="primary" onClick={onOpen}>Open the market →</button>
        </div>
        <p className="note">What every team decided before free agency – and who is now on the market.</p>
      </div>
      <div className="grid-2">
        <section className="col">
          {groups.map(([t, xs]: any) => (
            <div className="panel" key={t}>
              <h2>{t} <span className="dim">({xs.length})</span></h2>
              {xs.length ? <ul className="news">{[...xs].sort((a: any, b: any) => ovrOf(lg.players[b.pid].z, lg.players[b.pid].id) - ovrOf(lg.players[a.pid].z, lg.players[a.pid].id)).slice(0, 15).map(row)}</ul> : <p className="note">None.</p>}
              {xs.length > 15 && <p className="note">…and {xs.length - 15} more.</p>}
            </div>
          ))}
        </section>
        <section className="col">
          <div className="panel">
            <h2>Best players on the market</h2>
            <ul className="news">{market.map((p: any) => <li key={p.id}><span className="yr">{ovrOf(p.z, p.id)}</span><span><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{posLabel(p)} · age {ageIn(p, N)} · last with {lg.teams[prevTeam(p)]?.abbr ?? '–'}{p.rfa ? ` · restricted (${lg.teams[p.rfa]?.abbr} can match)` : ''}{fa.pending.includes(p.id) ? (p.bird && p.bird !== lg.userTid ? ` · ${lg.teams[p.bird]?.abbr} negotiate first` : ' · your player – you negotiate first') : ''}</span></span></li>)}</ul>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Every offer a free agent has on the table right now, and how much he likes each one. */
function OffersDialog({ lg, p, offers: ai, close, openPlayer }: any) {
  const N = lg.season, u = lg.userTid;
  // blind bidding: until he signs you see who is interested – not what they offer
  const teams = [...new Set([...ai.map((o: any) => o.tid), ...offersOn(lg, p.id).map((o: any) => o.tid)])].filter(t => t !== u).sort((a: any, b: any) => lg.teams[a].name.localeCompare(lg.teams[b].name));
  const mine = offersOn(lg, p.id).find((o: any) => o.tid === u);
  return (
    <div className="overlay center" onClick={close}>
      <div className="dialog offers-dlg" role="dialog" aria-label={`Interest in ${p.name}`} onClick={e => e.stopPropagation()}>
        <div className="team-head"><h2>Interest in {p.name}</h2><button className="ghost small" onClick={close}>Close</button></div>
        <p className="note">OVR {ovrOf(p.z, p.id)} · age {ageIn(p, N)}{p.rfa ? <> · restricted: the <TL tid={p.rfa} /> can match any offer</> : ''}. Teams that are interested. What they offer stays secret until he signs – then every offer is shown.</p>
        {teams.length ? <ul className="offers">
          {teams.map((tid: any) => {
            const why = reasons(lg, p, tid).slice(0, 2).map((x: any) => x.t).join('; ');
            return <li key={tid}>
              <span className="o-team"><TL tid={tid} />{p.bird === tid ? <span className="chip tiny" title="His own team">Bird rights</span> : null}{isHuman(lg, tid) ? <span className="chip tiny">person</span> : null}</span>
              {why && <span className="o-why dim">{why}</span>}
            </li>;
          })}
        </ul> : <p className="note">No other team is interested right now.</p>}
        {u && <p className="note">{mine ? <>Your offer: <b>{moneyOf(mine.sal, N)}</b> × {mine.yrs} yrs{mine.sal + 1e-9 < faDemand(lg, p, u, mine.yrs) ? ' – under his number' : ''}. </> : null}From your team he asks {moneyOf(faDemand(lg, p, u, preferredYears(p, N)), N)}{reasons(lg, p, u).length ? ` (${reasons(lg, p, u).slice(0, 2).map((x: any) => x.t).join('; ')})` : ''}. Make or change your offer under “Free agents” – he answers at the end of the wave.</p>}
      </div>
    </div>
  );
}

/** After he signed: every offer he had. */
export function BidsReveal({ lg, pid }: any) {
  const b = lg.bidLog?.[pid];
  const [open, setOpen] = useState(false);
  if (!b?.bids?.length) return null;
  return <span className="bids-rev"><button className="small ghost" onClick={() => setOpen(true)}>{`${b.bids.length} offer${b.bids.length > 1 ? 's' : ''}`}</button>
    {open && <BidsDialog lg={lg} pid={pid} close={() => setOpen(false)} />}</span>;
}

/** Every offer he had, on a scale (salary per season and the whole contract), and why he took the one he took. */
function BidsDialog({ lg, pid, close }: any) {
  const b = lg.bidLog[pid], p = lg.players[pid], S = b.s;
  const signed = lg.fa?.log?.slice().reverse().find((x: any) => x.pid === pid && ['sign', 'resign', 'match', 'sheet'].includes(x.kind));
  const won = signed?.tid ?? p.tid;
  const bids = [...b.bids].sort((x: any, y: any) => y.sal - x.sal);
  const hi = Math.max(...bids.map((x: any) => x.sal)), lo = Math.min(...bids.map((x: any) => x.sal));
  const topTotal = Math.max(...bids.map((x: any) => x.sal * x.yrs));
  const span = Math.max(0.02, hi - lo), pos = (v: number) => `${4 + ((v - lo) / span) * 92}%`;
  const w = bids.find((x: any) => x.tid === won);
  const top = bids[0];
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  const same = hi - lo < 0.0015;               // everyone offered (about) the same – usually the minimum
  const tied = bids.filter((x: any) => x.sal >= hi - 1e-4).length;
  const fit = (x: any) => (x?.why?.length ? x.why.join('; ') : 'the fit – his role there and the team around him');
  let why: string;
  if (!w) why = 'He signed elsewhere after these offers.';
  else if (same) why = `Every team offered about the same${hi <= MIN_SAL * 1.01 ? ' (the minimum)' : ''}, so money did not decide it – he picked the ${lg.teams[w.tid].name} for ${fit(w)}.`;
  else if (w.sal >= top.sal - 1e-4 && tied > 1) why = `${tied} teams offered the most; he picked the ${lg.teams[w.tid].name} for ${fit(w)}.`;
  else if (w.tid === top.tid || w.sal >= top.sal - 1e-4) why = `The ${lg.teams[w.tid].name} paid the most per season${w.why?.length ? ` – and ${w.why.join(', ')}` : ''}.`;
  else {
    const less = ((1 - w.sal / top.sal) * 100).toFixed(0);
    why = `He took ${less}% less per season than the top offer (${lg.teams[top.tid].abbr}, ${pc(top.sal)})${w.sal * w.yrs >= topTotal - 1e-4 ? ' – but the most money overall (more years)' : ''}. ${w.why?.length ? `What tipped it: ${w.why.join('; ')}.` : 'He liked the overall package better (role, team, length).'}${top.why?.length ? ` About the ${lg.teams[top.tid].abbr}: ${top.why.join('; ')}.` : ''}`;
  }
  return (
    <div className="overlay center" onClick={close}>
      <div className="dialog bids-dlg" role="dialog" aria-label={`Offers for ${p.name}`} onClick={e => e.stopPropagation()}>
        <div className="team-head"><h2>{p.name} – the offers</h2><button className="ghost small" onClick={close}>Close</button></div>
        <p className="lead">{why}</p>
        <p className="note">{bids.length} team{bids.length > 1 ? 's' : ''} made an offer in {S}. Salary per season as a share of the cap, and the whole contract (Total).</p>
        {!same && <div className="bid-scale" aria-hidden="true">
          {bids.map((x: any, i: number) => { const near = bids.slice(0, i).filter((y: any) => Math.abs(y.sal - x.sal) / span < 0.08).length;
            return <span key={i} className={`bid-dot ${x.tid === won ? 'won' : ''}`} style={{ left: pos(x.sal), top: `${4 + (near % 4) * 17}px` }} title={`${lg.teams[x.tid]?.abbr} ${pc(x.sal)} × ${x.yrs}`}>{lg.teams[x.tid]?.abbr}</span>; })}
          <span className="bid-axis lo">{pc(lo)}</span><span className="bid-axis hi">{pc(hi)}</span>
        </div>}
        <table className="tbl compact">
          <thead><tr><th className="l">Team</th><th>Per season</th><th>Years</th><th>Total</th><th className="l">What else he saw</th></tr></thead>
          <tbody>{bids.map((x: any, i: number) => <tr key={i} className={x.tid === won ? 'mine' : ''}>
            <td className="l"><TL tid={x.tid} abbr />{x.tid === won ? <span className="chip tiny on-clock">signed</span> : null}{x.human ? <span className="chip tiny">person</span> : null}</td>
            <td>{moneyOf(x.sal, S)}</td><td>{x.yrs}</td><td className="dim">{moneyOf(x.sal * x.yrs, S)}</td>
            <td className="l dim small-t">{x.under ? 'under his asking price' : x.why?.length ? x.why.join('; ') : '–'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- free agents list
export function FreeAgentsView({ lg, onChange, openPlayer }: any) {
  const [pos, setPos] = useState('all');
  const [afford, setAfford] = useState(false);   // only players you could sign at their asking price
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rel, setRel] = useState<string | null>(null);
  const N = lg.season;
  const cap = seasonInfo(N).cap;
  const u = lg.userTid ? lg.teams[lg.userTid] : null;
  const canSign = u && (lg.phase === 'freeagency' || lg.phase === 'regular');
  const list = Object.values(lg.players).filter((p: any) => (isFreeAgent(lg, p) || (lg.fa?.stage === 1 && lg.fa.pending.includes(p.id))) && posOk(p, pos));
  // affordable: his asking price fits your cap room, an exception or the minimum – with the room your open offers already claim set aside
  const fits = (p: any, need: number) => {
    if (!u) return true;
    const reserve = myOffers(lg, u.tid).filter((o: any) => o.pid !== p.id).reduce((a: number, o: any) => a + o.sal, 0);
    try { return !capCheck(lg, u.tid, p, need, reserve).err; } catch { return true; }
  };
  const rows0 = list.map((p: any) => ({ key: p.id, p, l: lastLine(p), need: u ? faDemand(lg, p, u.tid, preferredYears(p, N)) : askingSalary(p, N) }));
  const rows = afford && u ? rows0.filter((r: any) => fits(r.p, r.need)) : rows0;
  const pick = (r: any) => { setSel(r.p.id); setMsg(null); };
  // who is interested in whom right now (AI teams that would make an offer, and people's offers) – the amounts stay secret
  const [offersOf, setOffersOf] = useState<string | null>(null);
  const fa = lg.fa;
  const market = useMemo(() => {
    const m = new Map<string, any[]>();
    if (lg.phase !== 'freeagency' || !fa || fa.stage < 1 || fa.stage > 3) return m;
    const top = Object.values(lg.players).filter((p: any) => isFreeAgent(lg, p)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)).slice(0, 100);
    for (const p of top as any[]) m.set(p.id, faOffersFor(lg, p));
    return m;
  }, [lg.phase, fa?.stage, fa?.log?.length, lg.trades?.length, (lg.offers ?? []).length]);
  const interest = (p: any) => {
    const ai = market.get(p.id);
    const people = offersOn(lg, p.id).filter((o: any) => o.tid !== lg.userTid).map((o: any) => o.tid);
    if (!ai && !people.length) return null;
    return [...new Set([...(ai ?? []).map((o: any) => o.tid), ...people])].filter(t => t !== lg.userTid);
  };
  const cols = [
    { key: 'name', label: 'Player', left: true, get: (r: any) => r.p.name, fmt: (v: any, r: any) => <><button className="link" onClick={() => openPlayer(r.p.id)}>{v}</button>{r.p.bird && r.p.bird === lg.userTid ? <span className="chip tiny">yours</span> : null}{offersOn(lg, r.p.id).some((o: any) => o.tid === lg.userTid) ? <span className="chip tiny on-clock" title="You made him an offer">offer made</span> : null}{r.p.rfa ? <span className="chip tiny rfa" title={`Restricted free agent: the ${lg.teams[r.p.rfa]?.name} can match an offer`}>RFA {lg.teams[r.p.rfa]?.abbr}</span> : null}</> },
    { key: 'need', label: 'Asks', title: 'What he asks from your team (for the length he would pick himself) – set by the market: what the teams with room could pay him', get: (r: any) => r.need,
      fmt: (v: any, r: any) => { const n = lg.fa?.mktN?.[r.p.id]; const m = lg.fa?.mkt?.[r.p.id]; return <span title={m !== undefined ? `Market read: ${n} team${n === 1 ? '' : 's'} could pay his full value; he expects about ${moneyOf(m, N)}` : maxPlayerOf(r.p, N) ? 'A max player: he asks for the max' : ''}>{moneyOf(v, N)}{m !== undefined && m < askingSalary(r.p, N) * 0.97 ? <span className="dim small-t"> ↓mkt</span> : null}</span>; } },
    ...(u ? [{ key: 'disc', label: 'For you', title: 'Discount he gives your team (+) or premium he wants (−) compared to his market price', get: (r: any) => discount(lg, r.p, u.tid), fmt: (v: any, r: any) => <span className={v > 0.02 ? 'pos' : v < -0.02 ? 'neg' : 'dim'} title={reasons(lg, r.p, u.tid).map(x => x.t).join('; ') || 'he doesn\'t mind either way'}>{v > 0 ? '+' : ''}{Math.round(v * 100)}%</span> }] : []),
    ...(market.size ? [{ key: 'int', label: 'Interest', title: 'Teams interested in him – click to see who (what they offer stays secret until he signs)', left: true, get: (r: any) => interest(r.p)?.length ?? -1,
      fmt: (_: any, r: any) => { const t = interest(r.p); if (!t) return <span className="dim">–</span>; if (!t.length) return <span className="dim">none</span>;
        return <button className="link-btn" onClick={() => setOffersOf(r.p.id)}><b>{t.length}</b> <span className="chip tiny">interested</span></button>; } }] : []),
    { key: 'pos', label: 'Pos', get: (r: any) => natural(r.p), fmt: (_: any, r: any) => <span className="dim">{posLabel(r.p)}</span> },
    { key: 'age', label: 'Age', asc: true, get: (r: any) => ageIn(r.p, N) },
    { key: 'ovr', label: 'OVR', get: (r: any) => ovrOf(r.p.z, r.p.id), fmt: (v: any) => <Ovr v={v} /> },
    potCol((r: any) => r.p, N),
    ...attrCols((r: any) => r.p, N),
    { key: 'ls', label: 'Last season', title: 'Last season played', get: (r: any) => r.l?.s ?? null, fmt: (v: any) => v ?? '–' },
    { key: 'pts', label: 'Pts', get: (r: any) => (r.l?.gp ? r.l.pts / r.l.gp : null), fmt: f1 },
    { key: 'reb', label: 'Reb', get: (r: any) => (r.l?.gp ? (r.l.orb + r.l.drb) / r.l.gp : null), fmt: f1 },
    { key: 'ast', label: 'Ast', get: (r: any) => (r.l?.gp ? r.l.ast / r.l.gp : null), fmt: f1 },
    ...(canSign ? [{ key: 'act', label: '', get: () => 0, fmt: (_: any, r: any) => <button className={`small ${sel === r.p.id ? 'primary' : ''}`} onClick={() => pick(r)}>Negotiate</button> }] : []),
  ];
  const sp = sel ? lg.players[sel] : null;
  const pay = u ? payroll(lg, u.tid) : 0;
  const mine = u ? u.roster.map((pid: string) => lg.players[pid]).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)) : [];
  return (
    <div className="grid-2 fa-grid">
      <section className="panel">
        <div className="team-head">
          <h2>Free agents</h2>
          <span className="dim">{rows.length} unsigned players</span>
        </div>
        <p className="note">
          {lg.phase === 'freeagency' ? `Free agency is underway (wave ${Math.min(3, lg.fa?.stage ?? 3)}). Asking prices drop with every wave.`
            : lg.phase === 'regular' ? 'During the season you can sign a player if you have fewer than 15 and fit under the cap (a minimum contract always works).'
            : 'You can sign players in free agency and during the regular season.'}
          {u ? ` Asking prices are for your team: players come cheaper to a strong team and where they'll get a big role.` : ''}
        </p>
        <div className="def-row">
          <div className="seg" role="group" aria-label="Position">{POS.map(([k, l]) => <button key={k} className={pos === k ? 'on' : ''} onClick={() => setPos(k)}>{l}</button>)}</div>
          {u && <label className="chk" title="Only players whose asking price you could pay now: under the cap, with an exception, or at the minimum – counting the room your open offers already take"><input type="checkbox" checked={afford} onChange={e => setAfford(e.target.checked)} /> Affordable{afford ? <span className="dim"> ({rows.length} of {rows0.length})</span> : null}</label>}
        </div>
        {afford && u && !rows.length && <p className="hint">Nobody fits right now{(() => { try { const e = rows0[0] && capCheck(lg, u.tid, rows0[0].p, MIN_SAL).err; return e ? ` – ${e}` : ' – not even at the minimum.'; } catch { return '.'; } })()}</p>}
        {offersOf && <OffersDialog lg={lg} p={lg.players[offersOf]} offers={market.get(offersOf) ?? faOffersFor(lg, lg.players[offersOf])} close={() => setOffersOf(null)} openPlayer={openPlayer} />}
        {lg.phase === 'freeagency' && <BirdRights lg={lg} openPlayer={openPlayer} onPick={(pid: string) => { setSel(pid); setMsg(null); }} />}
        {sp && canSign && interest(sp) && <p className="hint">{interest(sp)!.length ? <>Competition for {sp.name}: <b>{interest(sp)!.length}</b> other team{interest(sp)!.length > 1 ? 's' : ''} interested – <button className="link-btn" onClick={() => setOffersOf(sp.id)}>see who</button>.</> : <>No other team is after {sp.name} right now.</>}</p>}
        {sp && canSign && <FAOfferBox key={sp.id} lg={lg} p={sp} onDone={(r: any) => { setMsg(r.msg); if (r.ok) setSel(null); onChange(); }} onCancel={() => setSel(null)} />}
        {msg && <p className="hint" role="status">{msg}</p>}
        <SortTable cols={cols} rows={rows} initial="ovr" limit={150} />
      </section>
      {u && (
        <section className="panel">
          <h2>{u.name}</h2>
          <p className="note">{u.roster.length} players (13–15 allowed) · payroll {Math.round(pay * 100)}% of the cap{usd(pay, N)}. A released player's salary stays on the books at half until his contract ends.</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th className="l">Player</th><th>OVR</th><th className="l">Contract</th><th></th></tr></thead>
            <tbody>{mine.map((p: any) => <tr key={p.id}>
              <td className="l"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{posLabel(p)}</span></td>
              <td><Ovr v={ovrOf(p.z, p.id)} /></td>
              <td className="l dim">{moneyOf(p.contract.sal, N)} through {p.contract.exp}</td>
              <td>{canSign && (rel === p.id
                ? <><button className="small danger" onClick={() => { const r = run(lg, { t: 'release', pid: p.id }); setMsg(r.msg); setRel(null); onChange(); }}>Really release</button> <button className="small ghost" onClick={() => setRel(null)}>No</button></>
                : <button className="small" onClick={() => setRel(p.id)}>Release</button>)}</td>
            </tr>)}</tbody>
          </table></div>
          <OfferAnswers lg={lg} openPlayer={openPlayer} />
          <MyOffers lg={lg} onChange={onChange} setSel={setSel} setMsg={setMsg} />
        </section>
      )}
    </div>
  );
}

/**
 * Contract talks with a free agent (or one of your own): length and salary. Each length has its own price –
 * a young player wants paying for the free agency he gives up, a veteran takes less for security.
 */
export function FAOfferBox({ lg, p, onDone, onCancel }: any) {
  const N = lg.season;
  const cap = seasonInfo(N).cap;
  const tid = lg.userTid;
  const [years, setYears] = useState(() => preferredYears(p, N));
  const [sal, setSal] = useState<number | null>(null);
  const need = (y: number) => faDemand(lg, p, tid, y);
  const n = need(years);
  const offer = sal ?? n;
  const max = maxSalary(p, N);
  const dol = showDollars(), $ = (x: number) => dollarsOf(x, N, true);
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  const bump = (dx: number) => setSal(Math.max(MIN_SAL, Math.min(max, Math.round((offer + dx) * 10000) / 10000)));
  const why = reasons(lg, p, tid);
  const L = lengthPrice(p, N, years, Math.min(max, askingSalary(p, N)));
  const pay = payroll(lg, tid);
  const pref = preferredYears(p, N);
  // blind bidding: who is interested, not what they offer (revealed once he signs)
  const mineNow = offersOn(lg, p.id).find((o: any) => o.tid === tid);
  const others = [...new Set([...faOffersFor(lg, p).map((o: any) => o.tid), ...offersOn(lg, p.id).map((o: any) => o.tid)])].filter(t => t !== tid);
  return (
    <div className="offer ext" role="group" aria-label={`Offer to ${p.name}`}>
      <div><b>{p.name}</b> <span className="dim">{posLabel(p)} · age {ageIn(p, N)} · OVR {ovrOf(p.z, p.id)} · max contract {pc(max)}{usd(max, N)} · your payroll {Math.round(pay * 100)}% of the cap</span></div>
      <BudgetBar lg={lg} tid={tid} extra={mineNow ? offer - mineNow.sal : offer} />
      <p className="note">{why.length ? `About your team: ${why.map((x: any) => x.t).join('; ')}.` : 'He cares about the terms, not the team.'}{p.rfa && p.rfa !== tid ? ` Restricted free agent – the ${lg.teams[p.rfa].name} can match your offer.` : ''} He would pick {pref} year{pref > 1 ? 's' : ''} himself.{L.why ? ` For ${years} years: ${L.why}.` : ''}</p>
      <table className="tbl compact ext-years">
        <thead><tr><th className="l">Years</th>{[1, 2, 3, 4, 5].map(y => <th key={y}><button className={`small ${y === years ? 'primary' : ''}`} onClick={() => { setYears(y); setSal(null); }}>{y}</button></th>)}</tr></thead>
        <tbody><tr><td className="l dim">He signs for</td>{[1, 2, 3, 4, 5].map(y => { const v = need(y); return <td key={y} className={y === years ? 'on' : ''}>{pc(v)}{dol && <><br /><span className="dim small-t">{$(v)}</span></>}</td>; })}</tr></tbody>
      </table>
      <div className="ext-adjust">
        <span>Your offer for <b>{years}</b> yr{years > 1 ? 's' : ''}:</span>
        <button className="small" onClick={() => bump(-0.01)} aria-label="1% of the cap less">−1%</button>
        <button className="small" onClick={() => bump(-0.0025)} aria-label="a quarter percent less">−¼</button>
        <b className="ext-amt">{(offer * 100).toFixed(2)}% {dol && <span className="dim">· {$(offer)}</span>}</b>
        <button className="small" onClick={() => bump(0.0025)} aria-label="a quarter percent more">+¼</button>
        <button className="small" onClick={() => bump(0.01)} aria-label="1% of the cap more">+1%</button>
        <ExactPct value={offer} min={MIN_SAL} max={max} onSet={(v: number) => setSal(v)} />
        <button className="small" onClick={() => setSal(max)}>Max</button>
        <button className="small ghost" onClick={() => setSal(null)}>His number</button>
      </div>
      <div className={`ext-chance ${offer + 1e-9 >= n ? 'pos' : offer >= n * 0.93 ? 'mid' : 'neg'}`}>
        {offer + 1e-9 >= n ? <>This meets his number{offer > n + 1e-4 ? ` (you are paying ${((offer - n) * 100).toFixed(2)}% more than you need to)` : ''}. He takes it unless another team's (secret) offer appeals to him more.</>
          : offer >= n * 0.93 ? <>Close: about a <b>1 in 3</b> chance he takes {((1 - offer / n) * 100).toFixed(1)}% less than his number.</>
          : <>Too far under his number ({pc(n)}) – he will say no.</>}
        {' '}He answers {lg.phase === 'freeagency' ? 'at the end of this wave' : 'tomorrow'}.
      </div>
      <p className="note">{others.length ? <>Also interested: <b>{others.map((t: any) => lg.teams[t].abbr).join(', ')}</b> – their offers stay secret until he signs.</> : 'No other team is interested right now.'}
        {mineNow ? <> Your offer on the table: <b>{pc(mineNow.sal)}</b> × {mineNow.yrs} yrs{mineNow.sal + 1e-9 < faDemand(lg, p, tid, mineNow.yrs) ? ' (under his number)' : ''} <button className="small ghost" onClick={() => { run(lg, { t: 'faWithdraw', pid: p.id }); onDone({ ok: false, msg: 'Offer withdrawn.' }); }}>Withdraw</button></> : null}</p>
      <div className="def-row">
        <button className="primary" onClick={() => onDone(run(lg, { t: 'faOffer', pid: p.id, sal: offer, yrs: years }))}>{mineNow ? 'Change offer' : 'Make offer'}: {years} yr{years > 1 ? 's' : ''} at {dol ? $(offer) : pc(offer)}</button>
        <button className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Room for free agents at a glance: payroll, your open offers, and what is left under the limit. */
export function BudgetBar({ lg, tid, extra = 0 }: any) {
  if (!tid) return null;
  const b = faBudget(lg, tid), N = lg.season;
  const scale = Math.max(b.hard < Infinity ? b.hard : b.limit * 1.2, b.pay + b.open + Math.max(0, extra)) * 1.02;
  const w = (x: number) => `${Math.max(0, (x / scale) * 100)}%`;
  const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const left = b.after - Math.max(0, extra);
  return (
    <div className="budget">
      <div className="budget-bar" aria-hidden="true">
        <span className="bb-pay" style={{ width: w(b.pay) }} />
        <span className="bb-open" style={{ width: w(b.open) }} />
        {extra > 0 && <span className="bb-new" style={{ width: w(extra) }} />}
        <i className="bb-mark" style={{ left: w(b.limit) }} title={`Limit for other teams' free agents: ${pc(b.limit)} of the cap`} />
        {b.hard < Infinity && <i className="bb-mark hard" style={{ left: w(b.hard) }} title={`Hard cap: ${pc(b.hard)}`} />}
      </div>
      <div className="budget-legend small-t">
        <span><i className="sw bb-pay" />payroll {pc(b.pay)}{usd(b.pay, N)}</span>
        <span><i className="sw bb-open" />your open offers {pc(b.open)}</span>
        {extra > 0 && <span><i className="sw bb-new" />this offer {pc(extra)}</span>}
        <span>room left for free agents: <b className={left < 0 ? 'neg' : ''}>{pc(left)}</b> <span className="dim">(limit {pc(b.limit)}{b.hard < Infinity ? `, hard cap ${pc(b.hard)}` : ''})</span></span>
      </div>
      {left < 0 && <p className="hint">Your offers add up to more than the room: if several are accepted, the ones higher in your order go through first – minimum deals and your own players (Bird rights) do not need room.</p>}
    </div>
  );
}

/** Your open offers in the order you want them to go through when the room runs short. */
/** How your offers came out: the last step's answers (a wave of free agency, or yesterday in the season), earlier ones folded away. */
function OfferAnswers({ lg, openPlayer }: any) {
  const u = lg.userTid, N = lg.season;
  const all = ((lg as any).offerResults ?? []).filter((x: any) => x.tid === u && lg.players[x.pid]);
  if (!all.length) return null;
  const k = (x: any) => `${x.s}|${x.st ?? ''}|${x.day}`;
  const batches: any[][] = [];
  for (const x of all) { const b = batches[batches.length - 1]; if (b && k(b[0]) === k(x)) b.push(x); else batches.push([x]); }
  const when = (x: any) => x.st != null ? `free agency ${x.s - 1}–${String(x.s).slice(2)}, wave ${x.st}` : `${x.s - 1}–${String(x.s).slice(2)} season, day ${x.day}`;
  const ICON: any = { signed: '✔', sheet: '…', matched: '✖', elsewhere: '✖', declined: '✖', waiting: '…' };
  const line = (x: any) => {
    const p = lg.players[x.pid], deal = `${moneyOf(x.sal, N)} × ${x.yrs} yr${x.yrs > 1 ? 's' : ''}`;
    const name = <button className="link" onClick={() => openPlayer(x.pid)}>{p.name}</button>;
    const text = x.res === 'signed' ? <>{name} signed – {deal}</>
      : x.res === 'sheet' ? <>{name} signed your offer sheet ({deal}) – the <TL tid={p.rfa} /> can still match</>
      : x.res === 'matched' ? <>{name}: the <TL tid={x.to} /> matched your offer sheet ({deal})</>
      : x.res === 'elsewhere' ? <>{name} chose the <TL tid={x.to} /> over your {deal}</>
      : x.res === 'waiting' ? <>{name} has not decided – your {deal} stays open{(() => { try { return isFreeAgent(lg, p) && x.sal + 1e-9 < faDemand(lg, p, x.tid, x.yrs) ? ' (under what he asks now)' : ''; } catch { return ''; } })()}</>
      : <>{name} turned down your {deal}{x.under ? ' – under his asking price' : ''}</>;
    return <li key={x.pid + x.res} className={`ans-${x.res}`}><span className="ans-ic" aria-hidden>{ICON[x.res]}</span> <span>{text}</span></li>;
  };
  return <div className="offer-answers">
    <h3>Answers to your offers <span className="dim">· {when(batches[0][0])}</span></h3>
    <ul className="news ans-list">{batches[0].map(line)}</ul>
    {batches.length > 1 && <details><summary className="dim">Earlier answers</summary>
      {batches.slice(1, 12).map(b => <div key={k(b[0])}><p className="small-t dim">{when(b[0])}</p><ul className="news ans-list">{b.map(line)}</ul></div>)}
    </details>}
  </div>;
}

function MyOffers({ lg, onChange, setSel, setMsg }: any) {
  const u = lg.userTid, N = lg.season;
  const list = myOffers(lg, u);
  if (!list.length) return null;
  const move = (i: number, d: number) => {
    const ids = list.map((o: any) => o.pid); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; run(lg, { t: 'faOrder', pids: ids }); onChange();
  };
  return <>
    <h3>Your open offers – in order of priority</h3>
    <BudgetBar lg={lg} tid={u} />
    <ol className="news my-offers">{list.map((o: any, i: number) => { const q = lg.players[o.pid]; return <li key={o.pid}>
      <span className="yr">{i + 1}.</span>
      <span><button className="link" onClick={() => setSel(o.pid)}>{q.name}</button> <span className="dim">{moneyOf(o.sal, N)} × {o.yrs} yr{o.yrs > 1 ? 's' : ''} · answers {lg.phase === 'freeagency' ? 'at the end of the wave' : 'tomorrow'}</span>{' '}
        <button className="small ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Higher priority">▲</button>
        <button className="small ghost" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Lower priority">▼</button>{' '}
        <button className="small ghost" onClick={() => { run(lg, { t: 'faWithdraw', pid: o.pid }); setMsg('Offer withdrawn.'); onChange(); }}>Withdraw</button></span>
    </li>; })}</ol>
    <p className="note">If more of them say yes than your room allows, the higher ones are signed first; a lower one waits for the next wave.</p>
  </>;
}

/** Type an exact share of the cap (applied on Enter or when the field loses focus; kept within min…max). */
export function ExactPct({ value, min, max, onSet }: any) {
  const [txt, setTxt] = useState<string | null>(null);
  const apply = () => { if (txt == null) return; const v = parseFloat(txt.replace(',', '.')) / 100; if (Number.isFinite(v) && v > 0) onSet(Math.max(min, Math.min(max, Math.round(v * 10000) / 10000))); setTxt(null); };
  return <label className="ext-exact">exact <input inputMode="decimal" value={txt ?? (value * 100).toFixed(2)} onChange={e => setTxt(e.target.value)} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') apply(); }} aria-label="Offer, % of the cap" />%</label>;
}

/** What your players decided on their player options this summer. */
function PlayerOptionResults({ lg, openPlayer }: any) {
  const u = lg.userTid, rows = (lg.fa?.log ?? []).filter((x: any) => x.kind === 'option' && x.tid === u && !x.user && /player option/.test(x.desc ?? ''));
  if (!u || !rows.length) return null;
  return <div className="panel"><h2>Player options</h2>
    <ul className="news">{rows.map((x: any, i: number) => { const p = lg.players[x.pid]; return <li key={i}><span className="yr">{/declined/.test(x.desc) ? 'out' : 'in'}</span><span><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{x.desc}</span></span></li>; })}</ul>
  </div>;
}

/** Your own free agents: on the market like everyone, but you hold their Bird rights. */
export function BirdRights({ lg, openPlayer, goFA, onPick }: any) {
  const u = lg.userTid, N = lg.season;
  const ps = Object.values(lg.players).filter((p: any) => p.bird === u && isFreeAgent(lg, p)).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id)) as any[];
  if (!u || !ps.length) return null;
  return <div className="panel accent bird">
    <h2>Your free agents · Bird rights</h2>
    <p className="note">Their contracts ended and they are on the market from the first wave – every team can bid. You hold their <b>Bird rights</b>: you may re-sign them even over the free-agent limit (up to the hard cap), and they like staying a little more. Make an offer before the wave ends, or they may sign elsewhere. Only a <b>restricted</b> free agent (RFA – his rookie deal ended and you tendered a qualifying offer) can be matched: another team's offer sheet comes to you first. An unrestricted one (UFA) simply signs where he likes best.</p>
    <ul className="news">{ps.map(p => { const o = offersOn(lg, p.id).find((x: any) => x.tid === u); return <li key={p.id}><span className="yr">{ovrOf(p.z, p.id)}</span><span>
      <button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button> <span className="dim">{posLabel(p)} · age {ageIn(p, N)} · asks {moneyOf(faDemand(lg, p, u, preferredYears(p, N)), N)}</span>
      {p.rfa === u ? <span className="chip tiny rfa" title="Restricted free agent: other teams can give him an offer sheet, and you can match it">RFA – you can match</span> : <span className="chip tiny" title="Unrestricted: no matching – you bid like everyone else (over the limit, with an edge)">UFA</span>}
      {o ? <span className="chip tiny on-clock">your offer: {moneyOf(o.sal, N)} × {o.yrs}</span> : null}{' '}
      {onPick ? <button className="small" onClick={() => onPick(p.id)}>Negotiate</button> : goFA ? <button className="small" onClick={goFA}>Make an offer</button> : null}
    </span></li>; })}</ul>
  </div>;
}
