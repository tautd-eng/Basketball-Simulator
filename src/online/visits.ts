// Visitor counter (online/visits.sql in Supabase): this browser says "I'm here" on opening and every 2 minutes.
import { SB_URL, SB_KEY, maybeToken } from './client';

export interface VisitStats { visitors: number; visits: number; online: number; today: number; week: number }
let stats: VisitStats | null = null;
const subs = new Set<() => void>();
export const visitStats = () => stats;
export const onVisitStats = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

function visitorId() {
  try {
    let id = localStorage.getItem('nba-visitor');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('nba-visitor', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
async function ping() {
  if (typeof document !== 'undefined' && document.hidden && started > 1) return;
  started = 2;   // a hidden tab still counts at the next look
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/site_visit`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${(await maybeToken()) ?? SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_id: visitorId() }) });
    if (!r.ok) return;                                                    // not set up in Supabase yet: nothing shown
    stats = await r.json();                                              // null unless this account may see the numbers
    for (const f of subs) f();
  } catch { /* offline */ }
}
let started = 0;
export function startVisits() {
  if (started || typeof window === 'undefined' || !/^https?:/.test(location.protocol)) return;
  started = 1;
  ping();
  setInterval(ping, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
}
