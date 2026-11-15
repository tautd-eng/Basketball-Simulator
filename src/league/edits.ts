// Editing players by hand (the commissioner's tool): only what the player card shows – name, age, height, position,
// the visible ratings, contract and injury. Hidden traits (potential, development, scouting bias, destiny) stay as they are.
// Every change is written to the league's edit log, which everyone in the league can read.
import { League, Player } from '../types';
import { RATING_LABELS, attrZ, attrOf, K } from '../data';
import { ageIn } from '../players';

export interface EditRec { at: number; s: number; phase: string; day: number; by: string; pid: string; name: string; ch: [string, string, string][] }

/** Who may edit: anyone in an offline league; online only the commissioner (the host). */
export const canEdit = (lg: League) => { const o = (lg as any).online; return o ? o.role === 'host' : true; };

/** The z behind a displayed 0–99 rating (the inverse of ratingOf: 50 ± 14 per sd up to 1, 18 per sd to 2.5, then 10). */
export function zOfRating(r: number, inv = false) {
  const d = Math.abs(r - 50), a = d <= 14 ? d / 14 : d <= 41 ? 1 + (d - 14) / 18 : 2.5 + (d - 41) / 10;
  const v = Math.sign(r - 50) * a;
  return inv ? -v : v;
}
/** Sets one visible rating to `target` on z (in place). Ratings that blend several skills move only their own skill. */
export function setRating(z: number[], li: number, target: number) {
  const L = RATING_LABELS[li];
  if (attrOf(z, L) === target) return;
  const want = zOfRating(Math.max(1, Math.min(99, target)), L.inv);
  if (L.k !== K.tp && L.k !== K.tpr && L.k !== K.tov) { z[L.k] = want; return; }
  // attrZ rises with the skill's own z: bisection
  let lo = -8, hi = 8;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; z[L.k] = m; if (attrZ(z, L.k) < want) lo = m; else hi = m; }
  z[L.k] = (lo + hi) / 2;
}

export interface PlayerDraft { name: string; age: number; ht: number; pos: string; r: number[]; sal: number; exp: number; injury: number }
export function draftOf(lg: League, p: Player): PlayerDraft {
  return { name: p.name, age: ageIn(p, lg.season), ht: p.ht, pos: (p as any).posX ?? '', r: RATING_LABELS.map(L => attrOf(p.z, L)), sal: p.contract?.sal ?? 0, exp: p.contract?.exp ?? lg.season, injury: p.injury ?? 0 };
}

/** Applies the edits (only the fields that changed) and logs them. Returns the log entry, or null if nothing changed. */
export function applyEdit(lg: League, p: Player, d: PlayerDraft, z: number[], by: string, phase: string, fmt: { ht: (x: number) => string; sal: (x: number) => string; pos: (p: Player) => string }): EditRec | null {
  if (!canEdit(lg)) throw new Error('Only the commissioner can edit players in an online league.');
  const old = draftOf(lg, p), ch: [string, string, string][] = [];
  const name = d.name.trim();
  if (name && name !== p.name) { ch.push(['Name', p.name, name]); p.name = name; }
  if (d.age !== old.age) { ch.push(['Age', String(old.age), String(d.age)]); p.born -= d.age - old.age; }
  if (d.ht !== p.ht) { ch.push(['Height', fmt.ht(p.ht), fmt.ht(d.ht)]); p.ht = d.ht; }
  const posBefore = fmt.pos(p);
  if ((d.pos || '') !== old.pos) { if (d.pos) (p as any).posX = d.pos; else delete (p as any).posX; }
  const posAfter = fmt.pos(p);
  if (posAfter !== posBefore) ch.push(['Position', posBefore, posAfter]);
  const before = RATING_LABELS.map(L => attrOf(p.z, L)), after = RATING_LABELS.map(L => attrOf(z, L));
  if (after.some((v, i) => v !== before[i])) {
    RATING_LABELS.forEach((L, i) => { if (after[i] !== before[i]) ch.push([L.name, String(before[i]), String(after[i])]); });
    p.z = z.slice();                     // a new array: anything cached by the old one is dropped
  }
  if (p.contract && p.tid) {
    if (Math.abs(d.sal - p.contract.sal) > 1e-6) { ch.push(['Salary', fmt.sal(p.contract.sal), fmt.sal(d.sal)]); p.contract.sal = d.sal; }
    if (d.exp !== p.contract.exp) {
      ch.push(['Contract through', `${p.contract.exp - 1}–${String(p.contract.exp).slice(2)}`, `${d.exp - 1}–${String(d.exp).slice(2)}`]);
      p.contract.exp = d.exp;
      if (p.contract.opts) p.contract.opts = p.contract.opts.filter(o => o.s <= d.exp);
    }
  }
  // an injury can be shortened, lengthened or healed (not made up): its end day moves 2 calendar days per game
  if (p.inj && d.injury !== (p.injury ?? 0)) {
    const g = Math.max(0, Math.round(d.injury));
    ch.push(['Injury (games out)', String(p.injury ?? 0), g ? String(g) : 'healed']);
    if (g <= 0) { delete p.inj; p.injury = 0; delete (p as any).injAt; }
    else { p.inj.until += (g - (p.injury ?? 0)) * 2; p.injury = g; }
  }
  if (!ch.length) return null;
  const rec: EditRec = { at: Date.now(), s: lg.season, phase, day: lg.day ?? 0, by, pid: p.id, name: p.name, ch };
  const log = ((lg as any).editLog ??= []) as EditRec[];
  log.push(rec);
  if (log.length > 2000) log.splice(0, log.length - 2000);
  (p as any).edited = (p as any).edited ?? lg.season;
  return rec;
}
