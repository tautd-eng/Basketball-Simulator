// @ts-nocheck
// Online host: a second click before the league moves on while other people are not done yet
// (or before the draft runs past picks other people still have to make).
import { useEffect, useState } from 'react';
import { onlineCtx } from '../online/sync';
import { pickOwner } from '../ai/trades';
import { humans, handTo } from '../league/humans';
import { inbox } from '../league/proposals';

// ---- several teams on this device: every one of them gets its turn before a step that decides for it ----
let rerender: () => void = () => {};
/** The app's re-render, so a hand-over shows the next team's screen at once. */
export const setGuardRerender = (f: () => void) => { rerender = f; };
let notice: string | null = null;

/** This step, and the teams that must have their say in it (null = nobody waits for anybody). */
function turnStep(lg: any): { key: string; who: (t: string) => string | null } | null {
  const fa = lg.fa;
  const sheets = (t: string) => (fa?.sheets ?? []).filter((x: any) => lg.players[x.pid]?.rfa === t).length;
  if (lg.phase === 'freeagency' && fa && fa.stage <= 3) return {
    key: `fa|${lg.season}|${fa.stage}`,
    who: (t: string) => {
      const dec = fa.stage === 0 ? (fa.decisions ?? []).filter((d: any) => (d.tid ?? lg.userTid) === t && d.choice === undefined).length : 0;
      const pend = fa.stage === 1 ? fa.pending.filter((pid: string) => lg.players[pid]?.bird === t).length : 0;
      const bits = [dec && `${dec} contract decision${dec > 1 ? 's' : ''}`, pend && `${pend} own free agent${pend > 1 ? 's' : ''} to re-sign`, sheets(t) && `an offer sheet to match`].filter(Boolean);
      if (bits.length) return bits.join(', ');
      return fa.stage >= 1 ? `wave ${fa.stage} of free agency` : null;   // a wave: everyone may sign someone
    },
  };
  const e = lg.draftDay?.exp;
  if (e && !e.confirmed && !e.done) return { key: `exp|${lg.season}`, who: (t: string) => (e.protect?.[t] ? 'the protected list for the expansion draft' : null) };
  return null;
}

/** Offline with several teams of your own: hand over to the next one that has its say here. True = handed over. */
function nextTurn(lg: any): boolean {
  if (!lg || lg.online || onlineCtx()) return false;
  const hs = humans(lg);
  if (hs.length < 2) return false;
  const st = turnStep(lg);
  if (!st) { if (lg.turns) delete lg.turns; return false; }
  const done: string[] = ((lg.turns ??= {})[st.key] ??= []);
  if (lg.userTid && !done.includes(lg.userTid)) done.push(lg.userTid);
  for (const t of hs) {
    if (done.includes(t)) continue;
    const why = st.who(t);
    if (!why) { done.push(t); continue; }
    handTo(lg, t);
    notice = `Now the ${lg.teams[t].name}: ${why}. When you are done, press the same button again${hs.filter(x => !done.includes(x) && x !== t).length ? ' – the next of your teams follows' : ''}.`;
    emit(); rerender();
    try { window.scrollTo({ top: 0 }); } catch { /* */ }
    return true;
  }
  delete lg.turns[st.key];
  return false;
}

let pending: { msg: string; go: () => any } | null = null;
const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };

const tag = (lg: any, m: any) => `${m.name || 'player'} (${lg.teams[m.tid]?.abbr ?? m.tid})`;

/** Why moving on now would skip someone, or null. */
export function moveOnWarning(lg: any, kind: 'step' | 'draft' = 'step'): string | null {
  const c = onlineCtx();
  if (!c || c.role !== 'host' || !lg) return null;
  const others = c.members.filter((m: any) => m.tid && m.role !== 'host');
  if (!others.length) return null;
  const d = lg.draftDay;
  const draftOn = lg.phase === 'draft' && d && !d.done && d.year === lg.season && (d.stage ?? 'draft') === 'draft' && d.idx < d.order.length;
  if (draftOn) {
    // the draft waits only for whoever is on the clock: warn when the GM would pick for someone
    const left = new Map<string, number>();
    for (const o of d.order.slice(d.idx)) { const t = pickOwner(lg, d.year, o.round, o.orig); left.set(t, (left.get(t) ?? 0) + 1); }
    const who = others.filter((m: any) => left.get(m.tid));
    return who.length ? `These people still have picks to make: ${who.map((m: any) => `${tag(lg, m)} – ${left.get(m.tid)}`).join(', ')}. Moving on lets their GM pick for them.` : null;
  }
  if (kind === 'draft') return null;
  const notDone = others.filter((m: any) => !m.done);
  return notDone.length ? `Not done yet: ${notDone.map((m: any) => tag(lg, m)).join(', ')}. If you move the league on now, their GM decides for them.` : null;
}

/** Runs `go` at once, or after the host confirms when it would skip someone. */
export function guardMove(lg: any, go: () => any, kind: 'step' | 'draft' = 'step') {
  if (kind === 'step' && nextTurn(lg)) return;
  const msg = moveOnWarning(lg, kind);
  if (!msg) return go();
  pending = { msg, go }; emit();
}

export function GuardDialog() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  if (notice && !pending) return (
    <div className="overlay center guard-bg" onClick={() => { notice = null; emit(); }}>
      <div className="dialog" role="dialog" aria-label="Your next team" onClick={e => e.stopPropagation()}>
        <h2>Your next team</h2>
        <p>{notice}</p>
        <div className="dialog-actions"><button className="primary" onClick={() => { notice = null; emit(); }}>OK</button></div>
      </div>
    </div>
  );
  if (!pending) return null;
  const p = pending;
  const close = () => { pending = null; emit(); };
  return (
    <div className="overlay center guard-bg" onClick={close}>
      <div className="dialog" role="alertdialog" aria-label="Move the league on?" onClick={e => e.stopPropagation()}>
        <h2>Move the league on?</h2>
        <p>{p.msg}</p>
        <div className="dialog-actions">
          <button className="primary" onClick={close}>Wait for them</button>
          <button className="danger" onClick={() => { close(); p.go(); }}>Move on anyway</button>
        </div>
      </div>
    </div>
  );
}
