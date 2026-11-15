// @ts-nocheck
// Online draft pick clock (a commissioner setting): a person on the clock who does not pick in time gets his GM's pick.
// The host's browser keeps the clock – it has to be open for the clock to run.
import { useEffect, useState } from 'react';
import { draftOnClock, draftPick } from '../league/offseason';
import { fantasyOnClock, fantasyAutoPick } from '../league/fantasy';
import { isHuman } from '../league/humans';
import { hostChanged, lastPull } from '../online/sync';

export const CLOCK_OPTS: [number, string][] = [[0, 'Off'], [1, '1 min'], [2, '2 min'], [5, '5 min'], [10, '10 min'], [30, '30 min'], [60, '1 hour'], [240, '4 hours'], [720, '12 hours'], [1440, '24 hours']];

/** Who is on the clock now (draft or fantasy draft), with a key that changes with every pick. */
export function onClock(lg: any): { key: string; tid: string } | null {
  if (lg.phase === 'fantasy') { const on = fantasyOnClock(lg); return on ? { key: `f|${lg.fantasy.picks.length}`, tid: on.tid } : null; }
  if (lg.phase !== 'draft') return null;
  const on = draftOnClock(lg);
  return on ? { key: `d|${lg.draftDay.year}|${lg.draftDay.idx}`, tid: on.tid } : null;
}
export const timeLeft = (lg: any) => {
  const on = onClock(lg), m = lg.pickTimer;
  if (!on || !m || !isHuman(lg, on.tid) || lg.pickClock?.k !== on.key) return null;
  return lg.pickClock.at + m * 60000 - Date.now();
};
export const fmtLeft = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`; };

/** Host: start the clock for each new pick; when it runs out, make the GM's pick. */
export function useHostPickClock(lg: any, host: boolean) {
  useEffect(() => {
    if (!host || !lg) return;
    const t = setInterval(() => {
      const on = onClock(lg);
      if (!on) return;
      if (lg.pickClock?.k !== on.key) { lg.pickClock = { k: on.key, at: Date.now() }; if (lg.pickTimer && isHuman(lg, on.tid)) hostChanged(); return; }
      const left = timeLeft(lg);
      if (left == null || left > 0) return;
      // a pick someone sent in time may still sit in the queue (the host was away): read it first
      if (lastPull() < Date.now() + left + 1000) return;
      const name = lg.teams[on.tid].name;
      if (lg.phase === 'fantasy') fantasyAutoPick(lg); else draftPick(lg);
      lg.news.push({ s: lg.season, t: `The ${name} ran out of time on the clock – their GM made the pick.` });
      hostChanged();
    }, 3000);
    return () => clearInterval(t);
  }, [lg, host]);
}

/** "auto pick in 4:12" – for everyone in the league. */
export function PickClockNote({ lg }: any) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const left = timeLeft(lg), on = onClock(lg);
  if (left == null || !on) return null;
  return <span className={`chip ${left < 60000 ? 'on-clock' : ''}`} title="The commissioner's pick clock: when it runs out, the GM picks for that team">⏱ {lg.teams[on.tid].abbr} auto pick in {fmtLeft(left)}</span>;
}
