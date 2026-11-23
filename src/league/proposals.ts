// Hot seat: trade offers between two human-run teams wait in the other team's inbox until that team is played.
import { League, Proposal, TradeAsset } from '../types';
import { tradeRules, executeTrade, fillRoster, pickUsed, describeAssets, pastDeadline, lopsided } from '../ai/trades';
import { isHuman } from './humans';

const owned = (lg: League, tid: string, xs: TradeAsset[]) => xs.every(x =>
  x.pid ? lg.players[x.pid]?.tid === tid
    : x.pick ? (lg.picks ?? []).some(p => p.season === x.pick!.season && p.round === x.pick!.round && p.orig === x.pick!.orig && p.owner === tid && !pickUsed(lg, p))
      : true);

/** Why the offer can no longer go through (null = it still can). */
export function proposalProblem(lg: League, pr: Proposal): string | null {
  if (pr.ai ? isHuman(lg, pr.from) || !isHuman(lg, pr.to) : !isHuman(lg, pr.from) || !isHuman(lg, pr.to)) return 'One of the teams is no longer run by a person.';
  if (!owned(lg, pr.from, pr.fromGives) || !owned(lg, pr.to, pr.toGives)) return 'Some of the players or picks have moved since.';
  return tradeRules(lg, pr.from, pr.to, pr.toGives, pr.fromGives);
}

export function propose(lg: League, from: string, to: string, fromGives: TradeAsset[], toGives: TradeAsset[], note?: string) {
  const pr: Proposal = { id: (lg.proposals ?? []).reduce((a, x) => Math.max(a, x.id), 0) + 1, from, to, fromGives, toGives, s: lg.season, day: lg.day, phase: lg.phase, note };
  const bad = proposalProblem(lg, pr);
  if (bad) return { ok: false, msg: bad };
  (lg.proposals ??= []).push(pr);
  return { ok: true, msg: `Offer sent to the ${lg.teams[to].name}. They answer when their team is played.` };
}

export const COOL_DAYS = 21;
/** A running day count for trade talk: the regular season by days, the playoffs and the offseason after it (each free-agency wave about a week). */
export function tradeClock(lg: League): number {
  const ph = lg.phase as string;
  const d = ph === 'regular' ? lg.day : ph === 'playoffs' ? 250 : 300 + (ph === 'freeagency' ? 10 + (lg.fa?.stage ?? 0) * 7 : ph === 'draft' ? 5 : 0);
  return lg.season * 1000 + d;
}
/** Has this team been told no about this player lately? (old entries are dropped on the way) */
export function coolingOff(lg: League, from: string, to: string, pid: string): boolean {
  const now = tradeClock(lg);
  const c = ((lg as any).tradeCool ?? []).filter((x: any) => x.until > now);
  (lg as any).tradeCool = c;
  return c.some((x: any) => x.from === from && x.to === to && x.pids.includes(pid));
}

export function answer(lg: League, id: number, accept: boolean) {
  const pr = (lg.proposals ?? []).find(x => x.id === id);
  if (!pr) return { ok: false, msg: 'The offer is gone.' };
  lg.proposals = lg.proposals!.filter(x => x !== pr);
  if (!accept) {
    // a computer team that was told no does not call about the same players again for about three weeks
    if (pr.ai && pr.draftAt === undefined) {
      const pids = pr.toGives.map(x => x.pid).filter(Boolean) as string[];
      if (pids.length) ((lg as any).tradeCool ??= []).push({ from: pr.from, to: pr.to, pids, until: tradeClock(lg) + COOL_DAYS });
    }
    lg.news.push({ s: lg.season, t: `The ${lg.teams[pr.to].name} turned down a trade offer from the ${lg.teams[pr.from].name}.` });
    return { ok: true, msg: 'Offer declined.' };
  }
  const bad = proposalProblem(lg, pr);
  if (bad) return { ok: false, msg: `The trade can't go through: ${bad}` };
  // online, a trade between two people that looks illogical waits for the trade committee
  const mv = (lg as any).online && !pr.ai ? lopsided(lg, pr.toGives, pr.fromGives) : null;
  if (mv) {
    const rv: Review = { id: ((lg as any).reviews ?? []).reduce((a: number, x: Review) => Math.max(a, x.id), 0) + 1, pr, mv: [mv[1], mv[0]], votes: {}, s: lg.season, day: lg.day, phase: lg.phase, st: stageOf(lg) };
    ((lg as any).reviews ??= []).push(rv);
    lg.news.push({ s: lg.season, t: `The ${lg.teams[pr.from].name} and the ${lg.teams[pr.to].name} agreed to a trade – it goes to the trade committee first.` });
    return { ok: true, msg: 'Accepted – the trade looks one-sided, so it goes to the trade committee. It goes through once they approve it.' };
  }
  return { ok: true, msg: `Trade done: ${finish(lg, pr).desc}` };
}
function finish(lg: League, pr: Proposal) {
  const rec = executeTrade(lg, pr.from, pr.to, pr.toGives, pr.fromGives, true);
  fillRoster(lg, pr.from); fillRoster(lg, pr.to);
  return rec;
}

// ---- trade committee (online): members vote on one-sided trades between people; the commissioner can decide at once
/** mv: neutral market value [from gets, to gets]; votes by team id */
export interface Review { id: number; pr: Proposal; mv: [number, number]; votes: Record<string, boolean>; s: number; day: number; phase: string; st?: string; done?: 'approved' | 'vetoed' | 'cancelled'; by?: string }
export const reviews = (lg: League): Review[] => ((lg as any).reviews ?? []).filter((r: Review) => !r.done);
export const committee = (lg: League): string[] => ((lg as any).committee ?? []).filter((t: string) => isHuman(lg, t));
/** Committee members who may vote on it (not the two teams in the deal). */
export const voters = (lg: League, r: Review) => committee(lg).filter(t => t !== r.pr.from && t !== r.pr.to);
export const canVote = (lg: League, r: Review, tid: string | null) => !!tid && voters(lg, r).includes(tid);
const REVIEW_DAYS = 3;
const stageOf = (lg: League) => `${(lg as any).off?.step ?? ''}|${(lg as any).fa?.stage ?? ''}|${(lg as any).fa?.day ?? ''}`;

function close(lg: League, r: Review, yes: boolean, by: string) {
  const A = lg.teams[r.pr.from].name, B = lg.teams[r.pr.to].name;
  if (yes) {
    const bad = proposalProblem(lg, r.pr);
    if (bad) { r.done = 'cancelled'; r.by = by; lg.news.push({ s: lg.season, t: `The trade between the ${A} and the ${B} fell through: ${bad}` }); return `It can't go through any more: ${bad}`; }
    const rec = finish(lg, r.pr);
    r.done = 'approved'; r.by = by;
    lg.news.push({ s: lg.season, t: `The trade committee approved the trade between the ${A} and the ${B} (${by}).` });
    return `Approved – trade done: ${rec.desc}`;
  }
  r.done = 'vetoed'; r.by = by;
  lg.news.push({ s: lg.season, t: `The trade committee vetoed the trade between the ${A} and the ${B} (${by}).` });
  return 'Vetoed – the trade does not happen.';
}
/** A committee member's vote; the trade is decided once a majority of the voters agree. */
export function vote(lg: League, id: number, tid: string, yes: boolean) {
  const r = reviews(lg).find(x => x.id === id);
  if (!r) return { ok: false, msg: 'That trade has already been decided.' };
  if (!canVote(lg, r, tid)) return { ok: false, msg: 'You are not on the trade committee for this one.' };
  r.votes[tid] = yes;
  const vs = voters(lg, r), need = Math.floor(vs.length / 2) + 1;
  const yesN = vs.filter(t => r.votes[t] === true).length, noN = vs.filter(t => r.votes[t] === false).length;
  if (yesN >= need) return { ok: true, msg: close(lg, r, true, `${yesN}–${noN} vote`) };
  if (noN >= need) return { ok: true, msg: close(lg, r, false, `${yesN}–${noN} vote`) };
  return { ok: true, msg: `Vote counted (${yesN} for, ${noN} against, ${need} needed).` };
}
/** The commissioner decides it at once. */
export function commissionerDecide(lg: League, id: number, yes: boolean) {
  const r = reviews(lg).find(x => x.id === id);
  if (!r) return { ok: false, msg: 'That trade has already been decided.' };
  return { ok: true, msg: close(lg, r, yes, 'commissioner') };
}
/** Time runs out (a few days in the season, or the stage ends): the votes cast decide, a tie lets it through. */
function expireReviews(lg: League, closing: boolean) {
  for (const r of reviews(lg)) {
    const late = r.s !== lg.season || r.phase !== lg.phase || (lg.phase !== 'regular' && r.st !== undefined && r.st !== stageOf(lg)) || (lg.phase === 'regular' && lg.day - r.day >= REVIEW_DAYS);
    if (closing) { r.done = 'cancelled'; r.by = 'deadline'; lg.news.push({ s: lg.season, t: `The trade between the ${lg.teams[r.pr.from].name} and the ${lg.teams[r.pr.to].name} was still with the trade committee when trading closed – it does not happen.` }); continue; }
    if (!late) continue;
    const vs = voters(lg, r), yesN = vs.filter(t => r.votes[t] === true).length, noN = vs.filter(t => r.votes[t] === false).length;
    close(lg, r, noN <= yesN, `time ran out, ${yesN}–${noN}`);
  }
  if ((lg as any).reviews?.length > 60) (lg as any).reviews = (lg as any).reviews.slice(-60);
}


export const withdraw = (lg: League, id: number) => { lg.proposals = (lg.proposals ?? []).filter(x => x.id !== id); };
export const inbox = (lg: League, tid: string | null) => (lg.proposals ?? []).filter(x => x.to === tid);
export const outbox = (lg: League, tid: string | null) => (lg.proposals ?? []).filter(x => x.from === tid);
export const describeSide = (lg: League, xs: TradeAsset[]) => (xs.length ? describeAssets(lg, xs) : 'nothing');

/** Computer teams' offers that have run out: a few days in the season, or the end of the stage it was made in. */
export function expireAiOffers(lg: League) {
  const closing = (lg.phase === 'regular' && pastDeadline(lg)) || lg.phase === 'playoffs';
  if ((lg as any).reviews?.length) expireReviews(lg, closing);
  if (!lg.proposals?.length) return;
  // past the trade deadline (and through the playoffs) every open offer is off the table – people's too
  if (closing) { lg.proposals = []; return; }
  lg.proposals = lg.proposals.filter(pr => !pr.ai || (pr.s === lg.season && pr.phase === lg.phase && (pr.exp === undefined || lg.day <= pr.exp) && !proposalProblem(lg, pr)));
}
