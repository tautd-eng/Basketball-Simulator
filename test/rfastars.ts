// bun test/rfastars.ts START SEASONS SEED – young RFA stars (88+ or max) whose team did not match
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import { maxPlayer, payroll } from '../src/ai/value';
import { ageIn } from '../src/players';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const [start, seasons, seed] = [+process.argv[2], +process.argv[3], +process.argv[4]];
const lg: any = newLeague(0, seed, undefined, { start, classMode: 'fictional', futureMode: 'fictional' });
let lost = 0, kept = 0;
for (let y = 0; y < seasons; y++) {
  while (lg.phase === 'regular' || lg.phase === 'playoffs') simDay(lg);
  runDraftPhase(lg); startNewSeason(lg);
  const N = lg.season;
  for (const x of lg.fa?.log ?? []) {
    const p = lg.players[x.pid]; if (!p) continue;
    const star = shownOvr(p.z, p.id) >= 86 || maxPlayer(p, N);
    if (!star || ageIn(p, N) > 26) continue;
    if (x.kind === 'match') { kept++; console.log(N, 'MATCH', p.name, shownOvr(p.z, p.id), x.desc); }
    if (x.kind === 'sign' && x.desc?.includes('did not match')) { lost++; const R = x.from; console.log(N, 'LOST', p.name, shownOvr(p.z, p.id), x.desc, 'sal', x.sal.toFixed(3), 'rights pay', R && payroll(lg, R).toFixed(2), 'roster', R && lg.teams[R].roster.length); }
  }
}
console.log('lost', lost, 'kept', kept);
