// @ts-nocheck
// The player editor (commissioner's tool) and the league's edit log. Shows only what the player card shows.
import { useMemo, useState } from 'react';
import { RATING_LABELS, attrOf, ratingOf, perD, postD, rimD, shownOvr, seasonInfo } from '../data';
import { applyEdit, draftOf, setRating, canEdit } from '../league/edits';
import { ATTR_ORDER } from './grades';
import { SLOTS, posLabel } from './positions';
import { htStr } from './units';
import { money } from './money';
import { onlineCtx } from '../online/sync';
import { ownerName } from './pickboard';
import { maxSalary } from '../ai/value';

const GROUPS: [string, string[]][] = [
  ['Offense', ATTR_ORDER.slice(0, ATTR_ORDER.indexOf('r6'))],
  ['Rebounding', ['r6', 'r7']],
  ['Defense', ATTR_ORDER.slice(ATTR_ORDER.indexOf('r10'))],
];
const sl = (s: number) => `${s - 1}–${String(s).slice(2)}`;

export const editorName = (lg: any) => {
  const c = onlineCtx();
  if (c) return c.me.name ? `${c.me.name} (commissioner)` : 'Commissioner';
  return (lg.userTid && ownerName(lg, lg.userTid)) || 'You';
};

export function EditButton({ lg, p, onSaved }: any) {
  const [open, setOpen] = useState(false);
  if (!canEdit(lg)) return null;
  return <>
    <button className="small ghost" onClick={() => setOpen(true)} title="Change his name, age, size, position, ratings or contract – the change is written to the edit log everyone can see">✎ Edit player</button>
    {open && <PlayerEditor lg={lg} p={p} close={() => setOpen(false)} onSaved={onSaved} />}
  </>;
}

function PlayerEditor({ lg, p, close, onSaved }: any) {
  const [d, setD] = useState(() => draftOf(lg, p));
  const [z, setZ] = useState<number[]>(() => p.z.slice());
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setD(x => ({ ...x, [k]: v }));
  const setR = (i: number, v: number) => { if (!Number.isFinite(v)) return; const nz = z.slice(); setRating(nz, i, Math.round(v)); setZ(nz); };
  const shown = useMemo(() => RATING_LABELS.map(L => attrOf(z, L)), [z]);
  const [pa, pb] = (d.pos || '').split('/');
  const autoPos = posLabel({ ...p, posX: undefined });
  const S = lg.season;
  const capMax = p.tid ? maxSalary(p, S) : 0.35;
  const save = () => {
    try {
      const rec = applyEdit(lg, p, d, z, editorName(lg), lg.phase, { ht: htStr, sal: (x: number) => money(x, S), pos: posLabel });
      if (rec) onSaved?.();
      close();
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="overlay center" onClick={close}>
      <div className="dialog edit-dlg" role="dialog" aria-label={`Edit ${p.name}`} onClick={e => e.stopPropagation()}>
        <div className="team-head"><h2>Edit player</h2><span className="ovr-mini" title="Overall with these ratings">{p.prospect ? 'OVR ?' : `OVR ${shownOvr(z, p.id)}`}</span></div>
        <p className="note">Everything you change here is written to the league's edit log (History → Edit log), which everyone in the league can see. Hidden traits – potential and how he will develop – are not shown and stay as they are.</p>
        <div className="edit-grid">
          <label className="field"><span>Name</span><input value={d.name} onChange={e => set('name', e.target.value)} maxLength={40} /></label>
          <label className="field"><span>Age</span><input type="number" min={16} max={50} value={d.age} onChange={e => set('age', Math.max(16, Math.min(50, +e.target.value || d.age)))} /></label>
          <label className="field"><span>Height ({htStr(d.ht)})</span><input type="number" min={60} max={96} step={0.5} value={d.ht} onChange={e => set('ht', Math.max(60, Math.min(96, +e.target.value || d.ht)))} aria-label="Height in inches" /><small className="dim">inches</small></label>
          <label className="field"><span>Position</span>
            <span className="def-row">
              <select value={pa ?? ''} onChange={e => set('pos', e.target.value ? (pb && pb !== e.target.value ? `${e.target.value}/${pb}` : e.target.value) : '')} aria-label="Main position">
                <option value="">Auto ({autoPos})</option>{SLOTS.map(x => <option key={x}>{x}</option>)}
              </select>
              {pa && <select value={pb ?? ''} onChange={e => set('pos', e.target.value ? `${pa}/${e.target.value}` : pa)} aria-label="Second position">
                <option value="">no second</option>{SLOTS.filter(x => x !== pa).map(x => <option key={x}>{x}</option>)}
              </select>}
            </span>
          </label>
        </div>

        <h3>Ratings</h3>
        <div className="ratings grouped edit-ratings">
          {GROUPS.map(([g, keys]) => <div key={g} className="rating-group"><h4>{g}</h4>
            {keys.map(k => {
              if (!/^r\d+$/.test(k)) {
                const face: any = { perd: ['Perimeter defense', perD], postd: ['Post defense', postD], rimp: ['Rim protection', rimD] }[k];
                return <div key={k} className="rating derived" title="Follows from defense, steals, blocks and height"><span className="rl">{face[0]}</span><span className="bar"><span style={{ width: `${ratingOf(face[1](z, d.ht))}%` }}></span></span><span className="rv">{ratingOf(face[1](z, d.ht))}</span></div>;
              }
              const i = +k.slice(1), L = RATING_LABELS[i], v = shown[i];
              return <div key={k} className={`rating edit ${L.tendency ? 'tend' : ''}`}>
                <span className="rl">{L.name}{L.tendency ? ' *' : ''}</span>
                <input type="range" min={1} max={99} value={v} onChange={e => setR(i, +e.target.value)} aria-label={L.name} />
                <input type="number" min={1} max={99} value={v} onChange={e => setR(i, +e.target.value)} className="rv-in" aria-label={`${L.name} value`} />
              </div>;
            })}
          </div>)}
        </div>
        <p className="note">Three-point shooting, ball handling and three-point volume blend several skills, so changing usage or passing can move them too. The three defense faces follow from defense, steals, blocks and height.</p>

        {p.tid && p.contract && !p.retired && <>
          <h3>Contract</h3>
          <div className="edit-grid">
            <label className="field"><span>Salary, % of the cap ({money(d.sal, S)})</span><input type="number" min={0.5} max={Math.round(capMax * 1000) / 10} step={0.1} value={Math.round(d.sal * 1000) / 10} onChange={e => { const v = +e.target.value / 100; if (Number.isFinite(v) && v > 0) set('sal', Math.min(capMax, v)); }} /></label>
            <label className="field"><span>Through</span><select value={d.exp} onChange={e => set('exp', +e.target.value)}>
              {Array.from({ length: 6 }, (_, k) => S + k).map(y => <option key={y} value={y}>{sl(y)}</option>)}
            </select></label>
          </div>
        </>}
        {p.inj && p.injury > 0 && <>
          <h3>Injury</h3>
          <div className="def-row"><label className="field"><span>Games out</span><input type="number" min={0} max={200} value={d.injury} onChange={e => set('injury', Math.max(0, Math.round(+e.target.value || 0)))} /></label>
            <button className="small" onClick={() => set('injury', 0)}>Heal now</button></div>
        </>}
        {err && <p className="hint neg">{err}</p>}
        <div className="dialog-actions">
          <button className="ghost" onClick={close}>Cancel</button>
          <button className="primary" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

/** History → Edit log: every hand edit, newest first. */
export function EditLog({ lg, openPlayer }: any) {
  const log = [...((lg as any).editLog ?? [])].reverse();
  const [q, setQ] = useState('');
  const rows = q.trim() ? log.filter((r: any) => (r.name + ' ' + r.by).toLowerCase().includes(q.trim().toLowerCase())) : log;
  return (
    <div className="panel">
      <div className="team-head"><h2>Edit log</h2>{log.length > 0 && <input placeholder="Filter by player or editor" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter" />}</div>
      <p className="note">{(lg as any).online ? 'Every change the commissioner made to a player by hand. Only the commissioner can edit players in an online league; everyone sees this log.' : 'Every change made to a player by hand (the ✎ Edit player button on a player card).'}</p>
      {rows.length ? <ul className="news edit-log">{rows.map((r: any, i: number) => <li key={i}>
        <span className="yr" title={new Date(r.at).toLocaleString()}>{sl(r.s)}</span>
        <span><button className="link" onClick={() => openPlayer(r.pid)}>{lg.players[r.pid]?.name ?? r.name}</button> <span className="dim">· by {r.by} · {phaseText(r)} · {new Date(r.at).toLocaleDateString()}</span><br />
          {r.ch.map(([k, a, b]: any, j: number) => <span key={j} className="chip tiny">{k}: {a} → <b>{b}</b></span>)}</span>
      </li>)}</ul> : <p className="note">{log.length ? 'Nothing matches.' : 'No edits yet.'}</p>}
    </div>
  );
}
const phaseText = (r: any) => r.phase === 'regular' ? `regular season, day ${r.day + 1}` : r.phase === 'playoffs' ? 'playoffs' : r.phase === 'draft' ? 'draft' : r.phase === 'freeagency' ? 'free agency' : r.phase ?? '';

/** On the player card: he has been edited by hand. */
export function EditedChip({ lg, p }: any) {
  const n = ((lg as any).editLog ?? []).filter((r: any) => r.pid === p.id).length;
  if (!n) return null;
  return <span className="chip tiny" title="Changed by hand – see History → Edit log">edited ×{n}</span>;
}
