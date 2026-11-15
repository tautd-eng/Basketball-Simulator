// @ts-nocheck
// Online host: a second click before the league moves on while other people are not done yet
// (or before the draft runs past picks other people still have to make).
import { useEffect, useState } from 'react';
import { onlineCtx } from '../online/sync';
import { pickOwner } from '../ai/trades';

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
  const msg = moveOnWarning(lg, kind);
  if (!msg) return go();
  pending = { msg, go }; emit();
}

export function GuardDialog() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
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
