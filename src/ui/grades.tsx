// @ts-nocheck
// Ratings in the big tables as letter grades (A+ … F) or as numbers – a preference kept in this browser.
// Player profiles always show the numbers.
import { perD, postD, rimD, ratingOf } from '../data';

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
];
