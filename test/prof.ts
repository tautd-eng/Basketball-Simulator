// Profile: one regular season + playoffs + offseason, timed by phase.
import { boot } from './harness';
import { newLeague, simDay } from '../src/league/league';
import { runDraftPhase, startNewSeason } from '../src/league/offseason';
import { setEraCal } from '../src/engine/game';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const lg: any = newLeague(0, 7, undefined, { start: 2026, classMode: 'fictional', futureMode: 'fictional' });
let t = performance.now();
let n = 0; while (lg.phase === 'regular') { simDay(lg); n++; }
console.log('regular', n, 'days', ((performance.now() - t) / 1000).toFixed(1), 's'); t = performance.now();
while (lg.phase === 'playoffs') simDay(lg);
console.log('playoffs', ((performance.now() - t) / 1000).toFixed(1)); t = performance.now();
runDraftPhase(lg); console.log('draft', ((performance.now() - t) / 1000).toFixed(1)); t = performance.now();
startNewSeason(lg); console.log('offseason', ((performance.now() - t) / 1000).toFixed(1));
const { createHash } = await import('crypto');
const sig = JSON.stringify({ tr: (lg.trades ?? []).map((t: any) => t.desc), ro: Object.values(lg.teams).map((t: any) => t.roster), fa: (lg.fa?.log ?? []).map((x: any) => [x.pid, x.tid, x.sal]) });
console.log('state', createHash('sha1').update(sig).digest('hex'), (lg.trades ?? []).length, 'trades');
