// @ts-nocheck
// Around the live game: a broadcast commentary line, the key plays (click one to watch it again) and a full
// shot chart with filters and zone splits. All read from the recorded play-by-play – nothing here changes the game.
import { useMemo, useState } from 'react';
import { mmss, periodName } from './court';

const who = (e: any, k: string) => e.d?.find((x: any) => x[1] === k)?.[0] ?? null;
const sur = (n?: string) => { if (!n) return ''; const p = n.split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const pick = (seed: number, xs: string[]) => xs[Math.abs(seed) % xs.length];

/** Running count of a player's game so far (points, threes, dunks…), up to and including event i. */
function tally(pbp: any[], upto: number) {
  const t: Record<string, any> = {};
  for (let i = 0; i <= upto && i < pbp.length; i++) {
    const e = pbp[i];
    if (e.d) for (const [pid, k, v] of e.d) { const r = (t[pid] ??= { pts: 0, tpm: 0, reb: 0, ast: 0, blk: 0, stl: 0, fgm: 0, fga: 0 }); if (k === 'orb' || k === 'drb') r.reb += v; else if (k in r) r[k] += v; }
  }
  return t;
}

/** The team's run going into event i: points in a row since the other side last scored. */
function runAt(pbp: any[], i: number) {
  const e = pbp[i]; if (!e) return { side: '', a: 0, b: 0 };
  let side = '', a = 0, b = 0;
  for (let j = i; j >= 0; j--) {
    const x = pbp[j], prev = pbp[j - 1] ?? { hs: 0, as: 0 };
    const dh = x.hs - prev.hs, da = x.as - prev.as;
    if (!dh && !da) continue;
    const s = dh ? 'h' : 'a';
    if (!side) side = s;
    if (s !== side) { b = s === 'h' ? dh : da; break; }
    a += dh || da;
  }
  return { side, a, b };
}

/** One line of broadcast commentary for the latest event the viewer has seen. */
export function commentary(pbp: any[], n: number, names: Record<string, string>, abbr: { h: string; a: string }): string {
  for (let i = n - 1; i >= Math.max(0, n - 4); i--) {
    const e = pbp[i]; if (!e) continue;
    const t = tally(pbp, i), nm = (pid: string | null) => sur(names[pid ?? '']);
    const shooter = who(e, 'fga') ?? who(e, 'fta'), st = shooter ? t[shooter] : null;
    const margin = e.hs - e.as, lead = e.s === 'h' ? margin : -margin, late = e.p >= 4 && e.c < 120;
    const team = abbr[e.s] ?? '';
    const run = runAt(pbp, i);
    const runTxt = run.a >= 8 && run.side === e.s ? ` That's a ${run.a}–0 run for ${team}.` : '';
    const ast = who(e, 'ast');
    const seed = Math.round(e.t * 7);
    if (e.k === 'make3' && st) {
      const base = pick(seed, [`Bang! ${nm(shooter)} from deep`, `${nm(shooter)} buries the three`, `Splash – ${nm(shooter)} from downtown`, `${nm(shooter)} lets it fly – and it's good`]);
      const extra = st.tpm >= 3 ? ` – his ${ord(st.tpm)} three tonight` : ast ? `, ${nm(ast)} with the feed` : '';
      return `${base}${extra}.${late && Math.abs(margin) <= 3 ? ' Huge shot!' : ''}${runTxt}`;
    }
    if (e.k === 'make2' && st) {
      if (e.sk === 'dunk') return `${pick(seed, ['Throws it down', 'Slams it home', 'Big-time dunk'])} – ${nm(shooter)}${ast ? `, on the dish from ${nm(ast)}` : ''}!${runTxt}`;
      if (late && lead > 0 && lead <= 2) return `${nm(shooter)} puts ${team} in front with ${mmss(e.c)} to go!`;
      if (st.pts >= 30 && st.pts - 2 < 30) return `${nm(shooter)} reaches 30 – he has been unstoppable.`;
      if (st.pts >= 20 && st.pts - 2 < 20) return `${nm(shooter)} gets to 20 for the night.`;
      return `${nm(shooter)} ${pick(seed, ['scores', 'finishes', 'gets it to go', 'knocks it down'])}${e.sk ? ` on the ${e.sk}` : ''}${ast ? `, ${nm(ast)} the assist` : ''}. ${team} ${lead > 0 ? `up ${lead}` : lead < 0 ? `within ${-lead}` : 'tie it'}.${runTxt}`;
    }
    if (e.bk) { const b = who(e, 'blk'); return b ? `${pick(seed, ['Rejected', 'Get that out of here', 'Swatted away'])}! ${nm(b)} with the block${t[b]?.blk >= 3 ? ` – his ${ord(t[b].blk)}` : ''}.` : ''; }
    if (e.k === 'tov') { const s2 = who(e, 'stl'); return s2 ? `${nm(s2)} picks his pocket – ${abbr[e.s === 'h' ? 'a' : 'h']} the other way.` : `Turnover ${team}${who(e, 'tov') ? `, ${nm(who(e, 'tov'))} gives it away` : ''}.`; }
    if (e.k === 'miss3' && late && Math.abs(margin) <= 3 && st) return `${nm(shooter)} for the lead… no good!`;
    if (e.k === 'drb') { const r = who(e, 'drb'); if (r) return pick(seed, [`${nm(r)} cleans the glass.`, `Rebound ${nm(r)}.`, `${nm(r)} comes down with it.`]); }
    if ((e.k === 'ft' || e.k === 'ftm') && shooter) return `${nm(shooter)} at the line${st ? ` – ${st.pts} points tonight` : ''}.`;
    if (e.k === 'foul') { const f = who(e, 'pf'); if (f) return `Whistle – foul on ${nm(f)}.`; }
    if ((e.k === 'miss2' || e.k === 'miss3') && st && !e.bk) return pick(seed, [`${nm(shooter)} can't connect.`, `${nm(shooter)} misses${e.k === 'miss3' ? ' from three' : ''}.`, `No good from ${nm(shooter)}.`]);
    if (e.k === 'orb') { const r = who(e, 'orb'); return r ? `${nm(r)} on the offensive glass – another chance.` : ''; }
    if (e.k === 'timeout') return `Timeout ${team || 'on the floor'}${run.a >= 8 ? ` – ${abbr[run.side]} on a ${run.a}–0 run` : ''}.`;
    if (e.k === 'period') return `End of the ${periodName(e.p - 1 || e.p).toLowerCase()} – ${abbr.a} ${e.as}, ${abbr.h} ${e.hs}.`;
    if (e.k === 'end') return `That's the game! ${margin > 0 ? abbr.h : abbr.a} win it ${Math.max(e.hs, e.as)}–${Math.min(e.hs, e.as)}.`;
  }
  return '';
}

export interface KeyPlay { i: number; t: number; tag: string; text: string; s: string; score: string; when: string }
/** The plays a broadcast would show again: dunks, blocks, late threes, the go-ahead buckets, buzzer-beaters, big runs. */
export function keyPlays(pbp: any[], names: Record<string, string>, abbr: { h: string; a: string }, upto = pbp.length): KeyPlay[] {
  const out: (KeyPlay & { w: number })[] = [];
  const nm = (pid: string | null) => sur(names[pid ?? '']);
  const runSeen = new Set<string>();
  for (let i = 0; i < upto; i++) {
    const e = pbp[i], prev = pbp[i - 1] ?? { hs: 0, as: 0 };
    const shooter = who(e, 'fga') ?? who(e, 'fta');
    const before = prev.hs - prev.as, after = e.hs - e.as;
    const late = e.p >= 4 && e.c <= 120, clutch = late && Math.abs(after) <= 5;
    const base = { i, t: e.t, s: e.s, score: `${abbr.a} ${e.as}–${e.hs} ${abbr.h}`, when: `${periodName(e.p)} ${mmss(e.c)}` };
    const ast = who(e, 'ast');
    if ((e.k === 'make2' || e.k === 'make3') && e.c <= 1.5 && e.p >= 1) out.push({ ...base, tag: 'Buzzer', text: `${nm(shooter)} beats the buzzer${e.k === 'make3' ? ' from three' : ''}`, w: 9 });
    else if ((e.k === 'make2' || e.k === 'make3') && late && Math.sign(before) !== Math.sign(after) && after !== 0 && Math.abs(after) <= 3) out.push({ ...base, tag: 'Go-ahead', text: `${nm(shooter)} puts ${abbr[e.s]} ahead${e.k === 'make3' ? ' with a three' : ''}`, w: 10 });
    else if ((e.k === 'make2' || e.k === 'make3') && late && after === 0) out.push({ ...base, tag: 'Tying', text: `${nm(shooter)} ties it${e.k === 'make3' ? ' from deep' : ''}`, w: 9 });
    else if (e.k === 'make3' && clutch && Math.min(Math.abs(before), Math.abs(after)) <= 3) out.push({ ...base, tag: 'Clutch three', text: `${nm(shooter)} knocks down a big three`, w: 7 });
    else if (e.k === 'make2' && e.sk === 'dunk') out.push({ ...base, tag: 'Dunk', text: `${nm(shooter)} throws it down${ast ? ` (${nm(ast)} assist)` : ''}`, w: 4 + (clutch ? 3 : 0) });
    else if (e.bk) { const b = who(e, 'blk'); if (b) out.push({ ...base, tag: 'Block', text: `${nm(b)} rejects ${nm(shooter)}`, w: 4 + (clutch ? 3 : 0) }); }
    else if (e.k === 'tov' && who(e, 'stl') && clutch) out.push({ ...base, tag: 'Steal', text: `${nm(who(e, 'stl'))} with a late steal`, w: 6 });
    // a run of 10 or more unanswered
    if (e.hs !== prev.hs || e.as !== prev.as) {
      const r = runAt(pbp, i);
      if (r.a >= 10 && !runSeen.has(r.side + '|' + r.a)) {
        const nxt = pbp.slice(i + 1).find(x => x.hs !== e.hs || x.as !== e.as);
        const ends = !nxt || (r.side === 'h' ? nxt.as !== e.as : nxt.hs !== e.hs);
        if (ends) { out.push({ ...base, tag: 'Run', text: `${abbr[r.side]} on a ${r.a}–0 run`, w: 5 + Math.min(4, r.a - 10) }); runSeen.add(r.side + '|' + r.a); }
      }
    }
  }
  // the best dozen, in game order – no more than four of a kind (a dunk-fest reel shows the late game too)
  const per: Record<string, number> = {}, cap: Record<string, number> = { Dunk: 4, Block: 3, Run: 3, 'Clutch three': 4, Steal: 2 };
  return out.sort((a, b) => b.w - a.w || b.t - a.t).filter(x => (per[x.tag] = (per[x.tag] ?? 0) + 1) <= (cap[x.tag] ?? 9)).slice(0, 12).sort((a, b) => a.i - b.i);
}

export function KeyPlays({ plays, watch }: { plays: KeyPlay[]; watch: (p: KeyPlay) => void }) {
  if (!plays.length) return <p className="note">No key plays yet.</p>;
  return <ol className="key-plays">{plays.map(p => <li key={p.i}>
    <button className="link" onClick={() => watch(p)} title="Watch this play again in the arena">▶</button>
    <span className={`kp-tag ${p.s}`}>{p.tag}</span>
    <span className="kp-txt">{p.text}</span>
    <span className="dim kp-when">{p.when} · {p.score}</span>
  </li>)}</ol>;
}

/** Shot chart with filters: last 24 or all shots, a team, a player; field-goal splits by zone underneath. */
export function ShotChart({ shown, names, sides, abbr, done }: any) {
  const [scope, setScope] = useState<'recent' | 'all'>(done ? 'all' : 'recent');
  const [team, setTeam] = useState<'both' | 'h' | 'a'>('both');
  const [pid, setPid] = useState('');
  const all = useMemo(() => shown.filter((e: any) => e.x !== undefined && (e.k.startsWith('make') || e.k.startsWith('miss'))), [shown.length]);
  const shooterOf = (e: any) => who(e, 'fga');
  let shots = all.filter((e: any) => team === 'both' || e.s === team);
  if (pid) shots = shots.filter((e: any) => shooterOf(e) === pid);
  const scoped = scope === 'recent' && !pid ? shots.slice(-24) : shots;
  const zone = (e: any) => { const r = Math.hypot(e.x - 25, e.y - 5.25); return e.k.endsWith('3') ? 'three' : r < 6 ? 'rim' : r < 14 ? 'short' : 'mid'; };
  const Z = [['rim', 'At the rim'], ['short', 'Floaters / short'], ['mid', 'Mid-range'], ['three', 'Three']];
  const split = Z.map(([z, l]) => { const xs = shots.filter((e: any) => zone(e) === z), m = xs.filter((e: any) => e.k.startsWith('make')).length; return { l, m, a: xs.length }; });
  const shooters = useMemo(() => [...new Set(all.map(shooterOf).filter(Boolean))].filter((p: string) => team === 'both' || sides[p] === team).sort((a: string, b: string) => (names[a] ?? '').localeCompare(names[b] ?? '')), [all.length, team]);
  return (
    <div className="court-wrap">
      <div className="def-row chart-filters">
        <div className="seg" role="group" aria-label="Shots">
          <button className={scope === 'recent' ? 'on' : ''} onClick={() => setScope('recent')}>Last 24</button>
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All</button>
        </div>
        <div className="seg" role="group" aria-label="Team">
          <button className={team === 'both' ? 'on' : ''} onClick={() => { setTeam('both'); }}>Both</button>
          <button className={team === 'a' ? 'on' : ''} onClick={() => { setTeam('a'); if (pid && sides[pid] !== 'a') setPid(''); }}>{abbr.a}</button>
          <button className={team === 'h' ? 'on' : ''} onClick={() => { setTeam('h'); if (pid && sides[pid] !== 'h') setPid(''); }}>{abbr.h}</button>
        </div>
        <select value={pid} onChange={e => setPid(e.target.value)} aria-label="Player"><option value="">Every player</option>{shooters.map((p: string) => <option key={p} value={p}>{names[p]}</option>)}</select>
      </div>
      <svg viewBox="-1 -1 52 36" className="court" role="img" aria-label="Shot chart">
        <rect x="0" y="0" width="50" height="34" className="floor" />
        <path d="M3 0 V14 A23.75 23.75 0 0 0 47 14 V0" className="cline" />
        <rect x="17" y="0" width="16" height="19" className="paint" />
        <circle cx="25" cy="19" r="6" className="cline" />
        <path d="M21 4 A4 4 0 0 0 29 4" className="cline" />
        <line x1="22" y1="4" x2="28" y2="4" className="cline" />
        <circle cx="25" cy="5.25" r="0.75" className="rim" />
        {scoped.map((e: any, i: number) => {
          const made = e.k.startsWith('make'), side = e.s;
          const cls = `shot ${side} ${made ? 'made' : 'miss'} ${i === scoped.length - 1 && !done ? 'latest' : ''}`;
          const y = Math.min(33, e.y);
          return made ? <circle key={i} cx={e.x} cy={y} r="0.9" className={cls} /> : <g key={i} className={cls}><line x1={e.x - 0.7} y1={y - 0.7} x2={e.x + 0.7} y2={y + 0.7} /><line x1={e.x - 0.7} y1={y + 0.7} x2={e.x + 0.7} y2={y - 0.7} /></g>;
        })}
      </svg>
      <div className="legend"><span className="k h"></span>{abbr.h} <span className="k a"></span>{abbr.a} · dot – made, cross – missed{scope === 'recent' && !pid ? ' (last 24 shots)' : ` (${scoped.length} shots)`}</div>
      <table className="tbl zone-split"><thead><tr><th>Zone</th><th>FG</th><th>%</th></tr></thead><tbody>
        {split.map(z => <tr key={z.l}><td>{z.l}</td><td>{z.m}/{z.a}</td><td>{z.a ? Math.round(100 * z.m / z.a) + '%' : '–'}</td></tr>)}
      </tbody></table>
    </div>
  );
}
