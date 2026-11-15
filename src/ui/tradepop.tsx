// @ts-nocheck
// Incoming trade offers as pop-ups, and the trade committee (online): one-sided trades between people wait for its vote.
import { useState } from 'react';
import { run } from '../league/commands';
import { inbox, proposalProblem, describeSide, reviews, canVote, voters, committee, commissionerDecide } from '../league/proposals';
import { pastDeadline, describeAssets } from '../ai/trades';
import { Linkify, TL } from './nav';
import { shownOvr } from '../data';
import { ageIn } from '../players';

const SEEN = 'nba-offers-seen';
let seen: Set<string>;
try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { seen = new Set(); }
const keep = () => { try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-400))); } catch { /* no storage */ } };
const offerKey = (pr: any) => `o|${pr.s}|${pr.phase}|${pr.day}|${pr.id}|${pr.from}|${pr.to}`;
const reviewKey = (lg: any, r: any) => `r|${r.s}|${r.id}|${r.pr.from}|${r.pr.to}|${lg.userTid}`;

/** One side of a deal: players with OVR and age, picks as text. */
function Side({ lg, xs, openPlayer }: any) {
  if (!xs.length) return <i>nothing</i>;
  return <ul className="pop-assets">{xs.map((x: any, i: number) => {
    if (!x.pid) return <li key={i}>{describeAssets(lg, [x])}</li>;
    const p = lg.players[x.pid];
    return <li key={i}><button className="link" onClick={() => openPlayer(x.pid)}>{p?.name ?? x.pid}</button>{p ? <span className="dim"> · OVR {shownOvr(p.z, p.id)} · age {ageIn(p, lg.season)}</span> : null}</li>;
  })}</ul>;
}

/** The pop-up: offers to your team you have not seen yet, then trades waiting for your committee vote. */
export function TradePopups({ lg, openPlayer, goTrades, onChange, busy }: any) {
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  if (busy || !lg?.userTid || lg.phase === 'fantasy') return null;
  const closed = lg.phase === 'playoffs' || (lg.phase === 'regular' && pastDeadline(lg));
  const offers = inbox(lg, lg.userTid).filter((pr: any) => !seen.has(offerKey(pr)));
  const votes = reviews(lg).filter((r: any) => canVote(lg, r, lg.userTid) && r.votes[lg.userTid] === undefined && !seen.has(reviewKey(lg, r)));
  const items = [...offers.map((pr: any) => ({ k: 'o', pr })), ...votes.map((r: any) => ({ k: 'r', r }))];
  if (!items.length && !msg) return null;
  const later = (key: string) => { seen.add(key); keep(); setMsg(''); bump(x => x + 1); };
  if (!items.length) return (
    <div className="overlay center" onClick={() => setMsg('')}><div className="dialog trade-pop" role="dialog" aria-label="Trade" onClick={e => e.stopPropagation()}>
      <p>{msg}</p><div className="dialog-actions"><button className="primary" onClick={() => setMsg('')}>OK</button></div>
    </div></div>
  );
  const it = items[0];
  if (it.k === 'o') {
    const pr = it.pr, bad = proposalProblem(lg, pr);
    const act = (yes: boolean) => { const r = run(lg, { t: 'answer', id: pr.id, yes }); seen.add(offerKey(pr)); keep(); setMsg(r.msg); onChange(); };
    return (
      <div className="overlay center"><div className="dialog trade-pop" role="dialog" aria-label="Trade offer">
        <div className="team-head"><h2>Trade offer</h2>{items.length > 1 && <span className="dim">1 of {items.length}</span>}</div>
        <p>The <b><TL tid={pr.from} /></b> {pr.ai ? '(computer)' : `(${lg.teams[pr.from].name} – run by a person)`} offer a trade{pr.note ? <span className="dim"> – {pr.note}</span> : '.'}</p>
        <div className="pop-sides">
          <div><h4>You get</h4><Side lg={lg} xs={pr.fromGives} openPlayer={openPlayer} /></div>
          <div><h4>You give</h4><Side lg={lg} xs={pr.toGives} openPlayer={openPlayer} /></div>
        </div>
        {pr.ai && <p className="dim small-t">{pr.exp !== undefined ? `The offer stands until day ${pr.exp + 1}.` : 'The offer stands until this stage ends.'}</p>}
        {(bad || closed) && <p className="hint neg">{bad ?? 'Trading is closed right now.'}</p>}
        <div className="dialog-actions">
          <button className="ghost" onClick={() => later(offerKey(pr))} title="Keep it in Trades → Trade offers and answer later">Later</button>
          <button onClick={() => { later(offerKey(pr)); goTrades(); }}>Open in Trades</button>
          <button onClick={() => act(false)}>Decline</button>
          <button className="primary" disabled={!!bad || closed} onClick={() => act(true)}>Accept</button>
        </div>
      </div></div>
    );
  }
  const r = it.r;
  const doVote = (yes: boolean) => { const res = run(lg, { t: 'tcVote', id: r.id, yes }); seen.add(reviewKey(lg, r)); keep(); setMsg(res.msg); onChange(); };
  return (
    <div className="overlay center"><div className="dialog trade-pop" role="dialog" aria-label="Trade committee">
      <div className="team-head"><h2>Trade committee vote</h2>{items.length > 1 && <span className="dim">1 of {items.length}</span>}</div>
      <ReviewBody lg={lg} r={r} openPlayer={openPlayer} />
      <div className="dialog-actions">
        <button className="ghost" onClick={() => later(reviewKey(lg, r))}>Later</button>
        <button onClick={() => doVote(false)}>Veto</button>
        <button className="primary" onClick={() => doVote(true)}>Approve</button>
      </div>
    </div></div>
  );
}

function ReviewBody({ lg, r, openPlayer }: any) {
  const vs = voters(lg, r), yesN = vs.filter((t: string) => r.votes[t] === true).length, noN = vs.filter((t: string) => r.votes[t] === false).length;
  return <>
    <p>The <b><TL tid={r.pr.from} /></b> and the <b><TL tid={r.pr.to} /></b> agreed to a trade that looks one-sided, so it needs the committee's approval.</p>
    <div className="pop-sides">
      <div><h4><TL tid={r.pr.from} abbr /> get <span className="dim">· market value {r.mv[0]}</span></h4><Side lg={lg} xs={r.pr.toGives} openPlayer={openPlayer} /></div>
      <div><h4><TL tid={r.pr.to} abbr /> get <span className="dim">· market value {r.mv[1]}</span></h4><Side lg={lg} xs={r.pr.fromGives} openPlayer={openPlayer} /></div>
    </div>
    <p className="dim small-t">Votes: {yesN} for, {noN} against · {vs.length ? `${Math.floor(vs.length / 2) + 1} of ${vs.length} decide` : 'no committee members can vote – the commissioner decides'}. If time runs out ({lg.phase === 'regular' ? '3 days' : 'the end of this stage'}), the votes cast decide and a tie lets it through.</p>
  </>;
}

/** Trades screen: trades waiting for the committee; votes for members, a decision for the commissioner. */
export function CommitteePanel({ lg, openPlayer, onDone }: any) {
  const [msg, setMsg] = useState('');
  const list = reviews(lg);
  const past = ((lg as any).reviews ?? []).filter((r: any) => r.done).slice(-8).reverse();
  if (!(lg as any).online && !list.length && !past.length) return null;
  const host = (lg as any).online?.role === 'host';
  const mine = committee(lg).includes(lg.userTid);
  return (
    <div className="panel">
      <h2>Trade committee</h2>
      <p className="note">In an online league a trade between two people that looks one-sided (one side gets half again as much market value, or more) waits for the trade committee. {committee(lg).length ? <>Members: {committee(lg).map((t: string, i: number) => <span key={t}>{i ? ', ' : ''}<TL tid={t} abbr /></span>)}.</> : 'No members yet – the commissioner gives the right under People.'}{mine ? ' You are on it.' : ''} The commissioner can decide any of them at once.</p>
      {list.length ? list.map((r: any) => <div key={r.id} className="review-card">
        <ReviewBody lg={lg} r={r} openPlayer={openPlayer} />
        <div className="def-row">
          {canVote(lg, r, lg.userTid) && <>
            <span className="dim">{r.votes[lg.userTid] === undefined ? 'Your vote:' : `You voted ${r.votes[lg.userTid] ? 'to approve' : 'to veto'} – change it:`}</span>
            <button className="small primary" onClick={() => { setMsg(run(lg, { t: 'tcVote', id: r.id, yes: true }).msg); onDone(); }}>Approve</button>
            <button className="small" onClick={() => { setMsg(run(lg, { t: 'tcVote', id: r.id, yes: false }).msg); onDone(); }}>Veto</button>
          </>}
          {host && <>
            <button className="small primary host-only" onClick={() => { setMsg(commissionerDecide(lg, r.id, true).msg); onDone(); }}>Approve now (commissioner)</button>
            <button className="small danger host-only" onClick={() => { setMsg(commissionerDecide(lg, r.id, false).msg); onDone(); }}>Veto now (commissioner)</button>
          </>}
        </div>
      </div>) : <p className="note">Nothing waiting.</p>}
      {past.length > 0 && <><h3>Decided</h3><ul className="news">{past.map((r: any, i: number) => <li key={i}><span className="yr">{r.done}</span><span><TL tid={r.pr.from} abbr /> get <Linkify text={describeSide(lg, r.pr.toGives)} />; <TL tid={r.pr.to} abbr /> get <Linkify text={describeSide(lg, r.pr.fromGives)} /> <span className="dim">· {r.by}</span></span></li>)}</ul></>}
      {msg && <p className="ok-msg">{msg}</p>}
    </div>
  );
}
