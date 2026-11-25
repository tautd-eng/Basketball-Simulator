// @ts-nocheck
// Potential is shown only as the scouts' letter grade – never as a number (it is their projection, not a fact).
import { potOf } from '../league/scouting';

const POT_STEPS: [number, string][] = [[90, 'A+'], [86, 'A'], [83, 'A-'], [80, 'B+'], [77, 'B'], [74, 'B-'], [71, 'C+'], [68, 'C'], [65, 'C-'], [62, 'D+'], [59, 'D'], [0, 'D-']];
export const potLetter = (v: number) => POT_STEPS.find(([t]) => v >= t)![1];
/** the grade's rank for sorting: the same for everyone with that letter, so a sort shows no more than the letter */
const potStep = (v: number) => POT_STEPS.find(([t]) => v >= t)![0];
const TIP = "Potential as the scouts project it – they can be wrong, especially about prospects";
/** The scouts' potential as a letter grade. */
export const PotGrade = ({ v }: { v: number }) => { const l = potLetter(v); return <span className={`grade g-${l[0]}`} title={TIP}>{l}</span>; };
/** The scouts' grade for a player. */
export const PotOf = ({ p, s }: { p: any; s: number }) => <PotGrade v={potOf(p, s)} />;
/** A potential column: the scouts' projection as a letter grade. */
export const potCol = (pOf: (r: any) => any, S: number) => ({ key: 'pot', label: 'Pot.', title: TIP + '; the real potential stays hidden', get: (r: any) => potStep(potOf(pOf(r), S)),
  fmt: (v: number) => { const l = potLetter(v); return <span className={`grade g-${l[0]}`} title={TIP}>{l}</span>; } });
