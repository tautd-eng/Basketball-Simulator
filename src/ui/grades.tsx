// @ts-nocheck
// Ratings in the big tables as letter grades (A+ … F) or as numbers – a preference kept in this browser.
// Player profiles always show the numbers.
import { perD, postD, rimD, ratingOf } from '../data';
import { athRating, staRating, NOW } from '../athletic';

let mode: 'letters' | 'numbers' = (() => { try { return localStorage.getItem('gradeMode') === 'numbers' ? 'numbers' : 'letters'; } catch { return 'letters'; } })();
export const gradeMode = () => mode;
export function setGradeMode(m: 'letters' | 'numbers') { mode = m; try { localStorage.setItem('gradeMode', m); } catch { /* ignore */ } }

const STEPS: [number, string][] = [[90, 'A+'], [85, 'A'], [80, 'A-'], [75, 'B+'], [70, 'B'], [65, 'B-'], [60, 'C+'], [55, 'C'], [50, 'C-'], [45, 'D+'], [40, 'D'], [35, 'D-'], [0, 'F']];
export const letterOf = (v: number) => STEPS.find(([t]) => v >= t)![1];
/** a table cell for a 0–99 rating: a coloured letter (the number in the tooltip) or the number */
export function fmtAttr(v: number) {
  if (mode === 'numbers') return v;
  const l = letterOf(v);
  return <span className={`grade g-${l[0]}`} title={String(v)}>{l}</span>;
}
/** the three faces of defence as table columns (they depend on height too) */
export const defCols = (pOf: (r: any) => any) => [
  { key: 'perd', label: 'PerD', title: 'Perimeter defense', get: (r: any) => { const p = pOf(r); return ratingOf(perD(p.z, p.ht)); }, fmt: fmtAttr },
  { key: 'postd', label: 'PostD', title: 'Post defense', get: (r: any) => { const p = pOf(r); return ratingOf(postD(p.z, p.ht)); }, fmt: fmtAttr },
  { key: 'rimp', label: 'Rim', title: 'Rim protection', get: (r: any) => { const p = pOf(r); return ratingOf(rimD(p.z, p.ht)); }, fmt: fmtAttr },
  { key: 'ath', label: 'Ath', title: 'Athleticism: burst, speed, leaping and strength for his size', get: (r: any) => athRating(pOf(r)), fmt: fmtAttr },
  { key: 'sta', label: 'Sta', title: 'Stamina: how many minutes he can carry before heavy legs set in', get: (r: any) => { const p = pOf(r); return staRating(p, NOW.season); }, fmt: fmtAttr },
];

/**
 * Ratings in groups, the same order everywhere: offence (usage first, then scoring – inside, drawing fouls,
 * free throws, threes with the three-point volume beside them – then passing and ball handling),
 * rebounding, and defence (overall defence, the three faces, steals, blocks, fouls).
 * Indexes are RATING_LABELS positions ('r' + i); the defence faces are perd / postd / rimp.
 */
export const ATTR_ORDER = ['r12', 'r0', 'r3', 'r2', 'r1', 'r13', 'r4', 'r5', 'r6', 'r7', 'r10', 'perd', 'postd', 'rimp', 'r8', 'r9', 'r11', 'ath', 'sta'];
const GRP_START = new Set(['r6', 'r10', 'ath']);
/** Puts the rating columns of a table in ATTR_ORDER (where the first of them stood) and marks where each group starts. */
export function grouped(cols: any[]) {
  const isA = (c: any) => ATTR_ORDER.includes(c.key);
  const at = cols.findIndex(isA);
  if (at < 0) return cols;
  const attrs = cols.filter(isA).sort((a, b) => ATTR_ORDER.indexOf(a.key) - ATTR_ORDER.indexOf(b.key))
    .map((c, i) => (i === 0 || GRP_START.has(c.key) ? { ...c, grp: true } : c));
  const rest = cols.filter(c => !isA(c));
  return [...rest.slice(0, at), ...attrs, ...rest.slice(at)];
}
