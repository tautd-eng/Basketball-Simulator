// Hot seat: which teams people run, and whose turn it is.
import { useState } from 'react';
import { humans, setHuman, playAs } from '../league/humans';
import { inbox } from '../league/proposals';

/** Header switch between the human-run teams (shown with two or more). */
export function PlayingAs({ lg, onChange }: any) {
  const hs = humans(lg);
  if (hs.length < 2 || lg.online) return null; // online: everyone plays his own team on his own screen
  let narrow = false; try { narrow = window.matchMedia('(max-width: 640px)').matches; } catch { /* */ }   // phone: abbreviations, so the header still fits
  // the next of your teams, on the same screen (wraps round)
  const nx = hs[(hs.indexOf(lg.userTid) + 1) % hs.length];
  return (
    <span className="playing-as-wrap">
      <label className="playing-as" htmlFor="playing-as" title="Switch between the teams you run"><span className="pa-l">Playing as</span>
        <select id="playing-as" aria-label="Playing as" value={lg.userTid ?? ''} onChange={e => { playAs(lg, e.target.value); onChange(); }}>
          {hs.map(t => { const n = inbox(lg, t).length; return <option key={t} value={t}>{narrow ? lg.teams[t].abbr : lg.teams[t].name}{n ? ` (${n}${narrow ? '' : ` offer${n > 1 ? 's' : ''}`})` : ''}</option>; })}
        </select>
      </label>
      <button className="next-team" title={`Switch to the ${lg.teams[nx].name} – same screen`} aria-label={`Switch to the ${lg.teams[nx].name}`} onClick={() => { playAs(lg, nx); onChange(); }}>{lg.teams[nx].abbr} ›</button>
    </span>
  );
}

/** Pick the teams run by people (one computer, taking turns). */
export function HumansPanel({ lg, close, onChange }: any) {
  const [, bump] = useState(0);
  const hs = new Set(humans(lg));
  const teams = Object.values(lg.teams).filter((t: any) => t.active).sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[];
  const set = (tid: string, on: boolean) => { setHuman(lg, tid, on); bump(x => x + 1); onChange(); };
  return (
    <div className="overlay center" onClick={close}>
      <div className="dialog saves" role="dialog" aria-label="My teams" onClick={e => e.stopPropagation()}>
        <h2>My teams</h2>
        <p className="note">Tick every team you run yourself – one person can run several teams, or friends can share the league on this device and take turns. The game stops for each ticked team: draft picks, contract decisions, free agents and trade offers; the rest are run by their GMs. Switch with “Playing as” at the top. A trade between two of these teams goes as an offer: switch to the other team to accept it. A name is optional – handy when friends share the league.</p>
        <ul className="save-list hum-list">{teams.map(t => (
          <li key={t.tid} className={t.tid === lg.userTid ? 'mine' : ''}>
            <label><input type="checkbox" checked={hs.has(t.tid)} onChange={e => set(t.tid, e.target.checked)} /> <b>{t.name}</b>{t.tid === lg.userTid ? <span className="chip tiny">playing now</span> : null}</label>
            {hs.has(t.tid) && <input className="hum-name" placeholder="Name (optional)" aria-label={`Who runs ${t.name}`} defaultValue={lg.humanNames?.[t.tid] ?? ''} onChange={e => { (lg.humanNames ??= {})[t.tid] = e.target.value.slice(0, 24); onChange(); }} />}
            {hs.has(t.tid) && t.tid !== lg.userTid && <button className="small" onClick={() => { playAs(lg, t.tid); bump(x => x + 1); onChange(); }}>Play as</button>}
          </li>
        ))}</ul>
        <div className="def-row"><button className="primary" onClick={close}>Done</button></div>
      </div>
    </div>
  );
}

/** In free agency: what the other people still have to decide before the next step. */
export function OthersWaiting({ lg, onChange }: any) {
  const fa = lg.fa;
  const hs = humans(lg).filter(t => t !== lg.userTid);
  if (!fa || !hs.length) return null;
  const rows = hs.map(t => {
    const dec = fa.stage === 0 ? (fa.decisions ?? []).filter((d: any) => d.tid === t && d.choice === undefined).length : 0;
    const pend = fa.stage === 1 ? fa.pending.filter((pid: string) => lg.players[pid]?.bird === t).length : 0;
    const sh = (fa.sheets ?? []).filter((x: any) => lg.players[x.pid]?.rfa === t).length;
    const off = inbox(lg, t).length;
    const bits = [dec && `${dec} contract decision${dec > 1 ? 's' : ''}`, pend && `${pend} own free agent${pend > 1 ? 's' : ''} to re-sign`, sh && `${sh} offer sheet${sh > 1 ? 's' : ''}`, off && `${off} trade offer${off > 1 ? 's' : ''}`].filter(Boolean);
    return { t, bits };
  });
  return (
    <div className="panel">
      <h2>Other players</h2>
      <p className="note">Before you go on, let everyone have their turn – whatever they leave open, their GM decides.</p>
      <ul className="news">{rows.map(r => <li key={r.t}><span className="yr">{lg.teams[r.t].abbr}</span><span>{lg.teams[r.t].name}: {r.bits.length ? r.bits.join(', ') : <span className="dim">nothing open</span>}{' '}
        <button className="small" onClick={() => { playAs(lg, r.t); onChange(); }}>Play as {lg.teams[r.t].abbr}</button></span></li>)}</ul>
    </div>
  );
}
