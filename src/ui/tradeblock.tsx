// @ts-nocheck
// Trade block: each team lists the players it would move and what it is after. People set their own (it goes to the
// host online like any move); computer teams show what their front office would part with.
import { useState } from 'react';
import { run } from '../league/commands';
import { keeps, planOf } from '../ai/plan';
import { isHuman } from '../league/humans';
import { shownOvr } from '../data';
import { ageIn } from '../players';
import { posLabel } from './positions';
import { money } from './money';
import { TL } from './nav';
import { ownerName } from './pickboard';
import { PotOf } from './potgrade';
import { tradeValue } from '../ai/tradevalue';

/** This season's line (or last season's regular-season one before the games start). */
function lineOf(lg: any, p: any) {
  const inSeason = lg.phase === 'regular' || lg.phase === 'playoffs';
  const l = inSeason ? p.cur : [...(p.career ?? [])].reverse().find((c: any) => !c.po);
  return l?.gp ? { l, last: !inSeason } : null;
}
const f1 = (x: number) => x.toFixed(1);

/** The roster as a table to tick players onto the block: who they are, what they do, what they cost, what they fetch. */
function BlockTable({ lg, tid, picked, toggle, openPlayer }: any) {
  const S = lg.season;
  const rows = lg.teams[tid].roster.map((id: string) => lg.players[id]).filter(Boolean).sort((a: any, b: any) => shownOvr(b.z, b.id) - shownOvr(a.z, a.id));
  const tv = rows.map((p: any) => { try { return tradeValue(lg, p, tid); } catch { return 0; } });
  const top = Math.max(1e-9, ...tv);
  const anyLast = rows.some((p: any) => lineOf(lg, p)?.last);
  return (
    <div className="tbl-wrap"><table className="tbl block-tbl">
      <thead><tr>
        <th></th><th className="l">Player</th><th>Pos</th><th>Age</th><th>OVR</th><th title="Potential as your scouts see it">Pot.</th>
        <th title={anyLast ? 'Last season' : 'This season'}>GP</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th title="Field goal %">FG%</th><th title="Three-point %">3P%</th>
        <th title="Salary this season (share of the cap)">Salary</th><th title="Contract runs through the season ending that year">Thru</th>
        <th title="What he would fetch in a trade, against the best on your team">Value</th>
      </tr></thead>
      <tbody>{rows.map((p: any, i: number) => {
        const x = lineOf(lg, p), l = x?.l, on = picked.includes(p.id);
        const c = p.contract ?? {};
        return <tr key={p.id} className={on ? 'on' : ''} onClick={e => { if ((e.target as any).closest('button,input')) return; toggle(p.id, !on); }}>
          <td><input type="checkbox" aria-label={`Put ${p.name} on the block`} checked={on} onChange={e => toggle(p.id, e.target.checked)} /></td>
          <td className="l"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button>{p.injury > 0 ? <span className="chip tiny neg" title={p.inj?.k ?? "Injured"}> out {p.injury}</span> : null}</td>
          <td className="dim">{posLabel(p)}</td><td>{ageIn(p, S)}</td><td><b>{shownOvr(p.z, p.id)}</b></td><td><PotOf p={p} s={S} /></td>
          <td className="dim">{l ? l.gp : '–'}</td><td>{l ? f1(l.min / l.gp) : '–'}</td><td>{l ? f1(l.pts / l.gp) : '–'}</td><td>{l ? f1((l.orb + l.drb) / l.gp) : '–'}</td><td>{l ? f1(l.ast / l.gp) : '–'}</td>
          <td className="dim">{l?.fga ? (100 * l.fgm / l.fga).toFixed(0) : '–'}</td><td className="dim">{l?.tpa ? (100 * l.tpm / l.tpa).toFixed(0) : '–'}</td>
          <td>{money(c.sal ?? 0, S)}{c.opts?.length ? <span className="dim" title="Option years still to be decided"> opt</span> : null}{c.rookie ? <span className="dim" title="Rookie contract"> R</span> : null}</td>
          <td className="dim">{c.exp ? `’${String(c.exp).slice(2)}` : '–'}</td>
          <td><span className="vbar" title={`${Math.round(100 * tv[i] / top)}% of your most valuable player`}><span style={{ width: `${Math.max(3, Math.round(100 * Math.max(0, tv[i]) / top))}%` }} /></span></td>
        </tr>;
      })}</tbody>
    </table>
    {anyLast && <p className="note small-t">Stats from last regular season until the games start.</p>}</div>
  );
}

export const WANTS = ['Young players', 'Draft picks', 'Cap space', 'Win-now help', 'A star', 'Guards', 'Wings', 'Bigs', 'Shooting', 'Defense'];

/** What a computer team would put on the block: players outside its core and young pieces, best first. */
function aiBlock(lg: any, tid: string) {
  const t = lg.teams[tid], pl = planOf(lg, tid);
  const pids = t.roster.map((id: string) => lg.players[id]).filter((p: any) => !keeps(lg, tid, p) && shownOvr(p.z, p.id) >= 72)
    .sort((a: any, b: any) => shownOvr(b.z, b.id) - shownOvr(a.z, a.id)).slice(0, 3).map((p: any) => p.id);
  const want = !pl ? [] : pl.stage === 'rebuild' || pl.stage === 'build' ? ['Young players', 'Draft picks', 'Cap space'] : ['Win-now help', ...(pl.stage === 'contend' ? ['A star'] : [])];
  return { pids, want, note: '' };
}
export const blockOf = (lg: any, tid: string) => (isHuman(lg, tid) ? lg.tradeBlock?.[tid] : aiBlock(lg, tid)) ?? null;

export function TradeBlock({ lg, openPlayer, offer, onDone }: any) {
  const me = lg.userTid;
  const mine = (me && lg.tradeBlock?.[me]) || { pids: [], want: [], note: '' };
  const [edit, setEdit] = useState(false);
  const [pids, setPids] = useState<string[]>(mine.pids);
  const [want, setWant] = useState<string[]>(mine.want);
  const [note, setNote] = useState<string>(mine.note ?? '');
  const [showAi, setShowAi] = useState(false);
  const [msg, setMsg] = useState('');
  const save = () => { const r = run(lg, { t: 'setBlock', pids, want, note: note.slice(0, 200) }); setMsg(r.msg); setEdit(false); onDone(); };
  const teams = (Object.values(lg.teams) as any[]).filter(t => t.active && t.tid !== me);
  const people = teams.filter(t => isHuman(lg, t.tid) && lg.tradeBlock?.[t.tid]?.pids?.length);
  const cpu = showAi ? teams.filter(t => !isHuman(lg, t.tid)).map(t => ({ t, b: aiBlock(lg, t.tid) })).filter(x => x.b.pids.length) : [];
  const Player = ({ pid, tid }: any) => { const p = lg.players[pid]; if (!p || p.tid !== tid) return null; return (
    <li><button className="link" onClick={() => openPlayer(pid)}>{p.name}</button> <span className="dim">{posLabel(p)} · OVR {shownOvr(p.z, p.id)} · pot. </span><PotOf p={p} s={lg.season} /><span className="dim"> · age {ageIn(p, lg.season)} · {money(p.contract.sal, lg.season)} through ’{String(p.contract.exp).slice(2)}{(() => { const x = lineOf(lg, p); return x ? ` · ${f1(x.l.pts / x.l.gp)} pts, ${f1((x.l.orb + x.l.drb) / x.l.gp)} reb, ${f1(x.l.ast / x.l.gp)} ast${x.last ? ' last season' : ''}` : ''; })()}</span>
      {tid !== me && me && <> <button className="small" onClick={() => offer(tid, pid)}>Make an offer</button></>}</li>); };
  const Card = ({ t, b, who }: any) => (
    <div className="block-card">
      <div className="team-head"><h3><TL tid={t.tid} /></h3><span className="dim">{who}</span></div>
      <ul className="pop-assets">{b.pids.map((pid: string) => <Player key={pid} pid={pid} tid={t.tid} />)}</ul>
      {b.want?.length > 0 && <p className="small-t">Looking for: {b.want.map((w: string) => <span key={w} className="chip tiny">{w}</span>)}</p>}
      {b.note && <p className="note">“{b.note}”</p>}
    </div>
  );
  return (
    <div className="panel">
      <h2>Trade block</h2>
      <p className="note">Who is available and what each team is after. Put your own players on the block so others know – it is a list, not an offer.</p>
      {me && (!edit ? <div className="block-card mine">
        <div className="team-head"><h3>Your block</h3><button className="small" onClick={() => { setPids(mine.pids.filter((x: string) => lg.players[x]?.tid === me)); setWant(mine.want); setNote(mine.note ?? ''); setEdit(true); }}>{mine.pids.length ? 'Edit' : 'Put players on the block'}</button></div>
        {mine.pids.length ? <ul className="pop-assets">{mine.pids.map((pid: string) => <Player key={pid} pid={pid} tid={me} />)}</ul> : <p className="note">Nobody on your block.</p>}
        {mine.want?.length > 0 && <p className="small-t">Looking for: {mine.want.map((w: string) => <span key={w} className="chip tiny">{w}</span>)}</p>}
        {mine.note && <p className="note">“{mine.note}”</p>}
      </div> : <div className="block-card mine">
        <h3>Your block</h3>
        <BlockTable lg={lg} tid={me} picked={pids} toggle={(id: string, on: boolean) => setPids(on ? [...pids.filter(x => x !== id), id] : pids.filter(x => x !== id))} openPlayer={openPlayer} />
        <p className="small-t">Looking for:</p>
        <div className="block-pick">{WANTS.map(w => <label key={w} className="chk"><input type="checkbox" checked={want.includes(w)} onChange={e => setWant(e.target.checked ? [...want, w] : want.filter(x => x !== w))} /> {w}</label>)}</div>
        <label className="field"><span>Note (optional)</span><input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="e.g. open to offers for our backup center" /></label>
        <div className="def-row"><button className="primary" onClick={save}>Save</button><button className="ghost" onClick={() => setEdit(false)}>Cancel</button></div>
      </div>)}
      {people.map(t => <Card key={t.tid} t={t} b={lg.tradeBlock[t.tid]} who={ownerName(lg, t.tid) ?? ''} />)}
      {!people.length && <p className="note">{(lg.humans?.length ?? 0) > 1 ? 'Nobody else has put players on the block yet.' : ''}</p>}
      <label className="chk"><input type="checkbox" checked={showAi} onChange={e => setShowAi(e.target.checked)} /> Show what computer teams would move (players outside their core)</label>
      {cpu.map(({ t, b }) => <Card key={t.tid} t={t} b={b} who="CPU" />)}
      {msg && <p className="ok-msg">{msg}</p>}
    </div>
  );
}
