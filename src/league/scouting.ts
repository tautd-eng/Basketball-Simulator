// What the scouts believe: potential and current level with their (player-specific, repeatable) errors, and the
// consensus board they make from it for prospects who have no real draft position (generated classes).
import { Player } from '../types';
import { hash01 } from '../rng';
import { shownOvr, shownFromBpm } from '../data';
import { peakBpm } from '../ai/value';

const hh = (p: Player, k: string) => hash01(p.id.split('~')[0] + k);
/** The real potential – hidden; nothing on screen shows it. */
const truePot = (p: Player, s: number) => shownFromBpm(peakBpm(p, s));
/**
 * Potential as the scouts see it: the real one plus their error. The error is the player's own (the same every time
 * you look), large for a prospect – now and then wildly off, a Giannis nobody saw or a Darko everybody did – and it
 * shrinks as he plays in the league and they learn who he is.
 */
export const potOf = (p: any, s: number) => {
  let n = (hh(p, 'a') + hh(p, 'b') + hh(p, 'c') + hh(p, 'd') - 2) * 1.73;
  if (hh(p, 'e') < 0.08) n += (hh(p, 'f') < 0.5 ? -1 : 1) * 1.8;   // the big misses
  const yrs = p.prospect ? 0 : Math.max(0, s - (p.entered ?? s));
  const sd = 5.5 * Math.max(0.25, 1 - 0.22 * yrs);
  return Math.max(40, Math.min(99, Math.round(truePot(p, s) + n * sd)));
};
/** His overall today as the scouts see it: smaller error than for potential – they can watch him play. */
export const scoutNow = (p: any) => {
  const n = (hh(p, 'na') + hh(p, 'nb') + hh(p, 'nc') - 1.5) * 2;
  return Math.max(30, Math.min(99, Math.round(shownOvr(p.z, p.id) + n * 3.5)));
};
/**
 * The scouts' consensus board for a class without real draft positions: mostly the potential they see, partly how
 * good he is already, younger a little ahead – the rank becomes his consensus rank (and how teams value the picks).
 */
export function scoutBoard(players: Player[], season: number) {
  const age = (p: Player) => season - p.born;
  const score = (p: Player) => 0.65 * potOf(p, season) + 0.35 * scoutNow(p) - 0.6 * Math.max(0, age(p) - 19);
  return [...players].sort((a, b) => score(b) - score(a));
}
