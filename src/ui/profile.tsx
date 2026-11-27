// @ts-nocheck
// The scouts' read on a prospect in a few words: how athletic he is, how finished, how high the ceiling, how big
// the risk. Athleticism the scouts see well; skills and potential are their estimates (they can be wrong).
import { athRating } from '../athletic';
import { potOf, scoutNow } from '../league/scouting';
import { ageIn } from '../players';

export interface Tag { t: string; c: string; tip: string }
export function profileTags(p: any, S: number): Tag[] {
  const ath = athRating(p, S), now = scoutNow(p), pot = potOf(p, S), age = ageIn(p, S), gap = pot - now;
  const out: Tag[] = [];
  if (ath >= 72) out.push({ t: 'Elite athlete', c: 'up', tip: `Athleticism ${ath}: explosive for his size – wins mismatches at the rim, on the break and on the glass` });
  else if (ath >= 61) out.push({ t: 'Athletic', c: 'up', tip: `Athleticism ${ath}` });
  else if (ath <= 37) out.push({ t: 'Below the rim', c: 'dn', tip: `Athleticism ${ath}: he will have to win with skill and feel` });
  if (ath >= 61 && now <= 70) out.push({ t: 'Raw', c: 'warn', tip: 'The tools are there, the skills are not yet – a project who needs minutes and time' });
  else if (ath <= 45 && now >= 74) out.push({ t: 'Polished', c: 'ok', tip: 'Skilled and ready now; not much athletic upside left' });
  if (gap >= 14) out.push({ t: 'High ceiling', c: 'up', tip: 'The scouts see a lot of room above where he is today' });
  else if (gap <= 7 && now >= 73) out.push({ t: 'High floor', c: 'ok', tip: 'Close to what he will become – a safer pick, a lower ceiling' });
  // the risk: young, raw and athletic is the widest bet; an older, finished player the narrowest
  const risk = (age <= 19 ? 1 : age >= 23 ? -1 : 0) + (ath >= 61 && now <= 70 ? 1 : 0) + (gap >= 14 ? 1 : 0) - (now >= 76 ? 1 : 0);
  if (risk >= 2) out.push({ t: 'Boom or bust', c: 'warn', tip: 'A wide range of outcomes: could be a star, could wash out' });
  else if (risk <= -1) out.push({ t: 'Safe', c: 'ok', tip: 'A narrow range of outcomes' });
  return out;
}
export const ProfileTags = ({ p, S }: { p: any; S: number }) =>
  <span className="prof-tags">{profileTags(p, S).map(x => <span key={x.t} className={`chip tiny prof-${x.c}`} title={x.tip}>{x.t}</span>)}</span>;
/** a table column: the scouts' read */
export const profileCol = (pOf: (r: any) => any, S: number) => ({ key: 'prof', label: 'Profile', left: true, title: "The scouts' read: athleticism, how finished he is, the ceiling and the risk",
  get: (r: any) => athRating(pOf(r), S), fmt: (_: any, r: any) => <ProfileTags p={pOf(r)} S={S} /> });
