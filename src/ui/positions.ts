// @ts-nocheck
// Positions as PG / SG / SF / PF / C: where a player naturally plays (and the other spot his listed position covers).
import { K } from '../data';
import REAL from './realpos.json';

/** Where he really played most of his career (Basketball-Reference positions, by minutes), e.g. "SF/PF". */
const realOf = (p: any): string | undefined => (REAL as any)[String(p.id).split('~')[0]];

export const SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
/** Natural slot (1 … 5) from his listed position. */
/** The slots his listed position covers (G = PG/SG, F = SF/PF, G-F = SG/SF, F-C = PF/C …). */
export function slotsOf(pos: string): number[] {
  const m: Record<string, number[]> = { PG: [1], SG: [2], SF: [3], PF: [4], C: [5], G: [1, 2], F: [3, 4], GF: [2, 3], 'G-F': [2, 3], 'F-G': [2, 3], FC: [4, 5], 'F-C': [4, 5], 'C-F': [4, 5] };
  return m[pos] ?? m[pos.split('-')[0]] ?? [3];
}
/** Where he naturally plays: within his listed position, by size and game – a small playmaker is the point guard, a big rebounder the power forward. */
export function natural(p: any) {
  const r = realOf(p);
  if (r) return SLOTS.indexOf(r.split('/')[0]) + 1;
  const opts = slotsOf(p.pos);
  if (opts.length === 1) return opts[0];
  const [lo, hi] = opts, z = p.z, ht = p.ht;
  const ast = z[K.ast], reb = z[K.orb] + z[K.drb], tpr = z[K.tpr], blk = z[K.blk];
  // a guard or wing who runs the offence is the point guard (Magic Johnson at 6'9")
  if (lo <= 2 && ast >= 1.8 && ht <= 82) return 1;
  // above 0 leans to the bigger slot; each term against what is usual for that listed position
  const lean = lo === 1 ? (ht - 75) * 0.5 - (ast - 0.8) + 0.3 * (reb + 1.9)                              // PG or SG
    : lo === 2 ? (ht - 78) * 0.5 + 0.3 * (reb + 1) - 0.5 * (ast - 0.1)                                    // SG or SF
    : lo === 3 ? (ht - 80) * 0.35 + 0.6 * (reb - 0.8) - 0.5 * (tpr - 0.2) - 0.3 * (ast + 0.6)             // SF or PF
    : (ht - 82) * 0.5 + 0.5 * (blk - 0.8) - 0.6 * (tpr + 0.7) - 0.2 * (ast + 0.7);                        // PF or C
  return lean > 0 ? hi : lo;
}

/** His positions for display: the natural one first, then the other one his listed position covers (e.g. "PG/SG"). */
export function posLabel(p: any): string {
  if (!p?.pos) return '';
  const r = realOf(p);
  if (r) return r;
  const o = slotsOf(p.pos), n = natural(p);
  const other = o.find(x => x !== n);
  return other ? `${SLOTS[n - 1]}/${SLOTS[other - 1]}` : SLOTS[n - 1];
}

/** Position filter buttons: All, then each position (a player counts for both of his positions). */
export const POS_FILTER: [string, string][] = [['all', 'All'], ...SLOTS.map(x => [x, x] as [string, string])];
export const posOk = (p: any, f: string) => f === 'all' || posLabel(p).split('/').includes(f);
