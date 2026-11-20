// After each off-season: own free agents a team let go while it kept clearly worse players.
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
const ovrOf = (z: any, id?: string) => shownOvr(z, id as any);
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const years = +(process.argv[2] ?? 4), seed = +(process.argv[3] ?? 42);
const lg = newLeague(0.5, seed, undefined, { start: +(process.argv[4] ?? 1980) });
let tot = 0, bad = 0, badStar = 0;
for (let y = 0; y < years && !lg.ended; y++) {
  while (lg.phase === 'regular' || lg.phase === 'playoffs') simDay(lg);
  runDraftPhase(lg);
  const Y = lg.season;
  const exp: { pid: string; tid: string; ovr: number }[] = [];
  for (const t of Object.values(lg.teams)) if ((t as any).active !== false) for (const pid of t.roster) { const p = lg.players[pid]; if (p.contract.exp <= Y) exp.push({ pid, tid: t.tid, ovr: ovrOf(p.z, p.id) }); }
  startNewSeason(lg);
  const lines: string[] = [];
  for (const x of exp) {
    const p = lg.players[x.pid], t = lg.teams[x.tid]; tot++;
    if (p.tid === x.tid) continue;
    const ros = t.roster.map(id => lg.players[id]).map(q => ({ q, o: ovrOf(q.z, q.id) })).sort((a, b) => a.o - b.o);
    const worse = ros.filter(r => r.o <= x.ovr - 6);
    const ovrNow = ovrOf(p.z, p.id);
    if (worse.length >= 2 && ovrNow >= 60) {
      bad++; if (ovrNow >= 68) badStar++;
      const reason = lg.fa?.log.filter(l => l.pid === x.pid).map(l => `${l.st}:${l.kind}${l.desc ? '(' + l.desc + ')' : ''}${l.tid ? '@' + l.tid : ''}`).join(' ');
      lines.push(`  ${t.abbr} lost ${p.name} ${x.ovr}→${ovrNow} age ${Y + 1 - (p as any).born} now ${p.tid ? lg.teams[p.tid].abbr : 'FA'} sal ${(p.contract.sal * 100).toFixed(1)} | kept worse: ${worse.slice(0, 4).map(r => `${r.q.name.split(' ').pop()} ${r.o} $${(r.q.contract.sal * 100).toFixed(1)}/${r.q.contract.exp}`).join(', ')} | ${reason} || ${(globalThis as any).__birdLog?.[x.pid] ?? ("NOLOG c=" + JSON.stringify(p.contract) + " opt=" + JSON.stringify((p as any).opts ?? null))}`);
    }
  }
  console.log(`${Y}: expiring ${exp.length}, lost-while-keeping-worse ${lines.length}`); for (const l of lines.slice(0, 12)) console.log(l);
}
console.log('full-roster blocks', ((globalThis as any).__fullBlock ?? []).length, ((globalThis as any).__fullBlock ?? []).slice(0, 30).join(' | '));
console.log(`total ${bad}/${tot} (68+: ${badStar})`);
