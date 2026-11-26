import { boot } from './harness';
import { newLeague } from '../src/league/league';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import { findTrades, ensurePicks, describeAssets } from '../src/ai/trades';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const me = process.argv[2] ?? 'BOS';
const lg: any = newLeague(0, 3, me, { start: 2026 }); ensurePicks(lg);
const ps = lg.teams[me].roster.map((id: string) => lg.players[id]).sort((a: any, b: any) => shownOvr(b.z) - shownOvr(a.z));
for (const p of [ps[1], ps[3], ps[6]]) for (const k of ['any', 'young', 'picks', 'now', 'cap'] as const) {
  const t = Date.now(); const r = findTrades(lg, me, [{ pid: p.id }], [], null, 40, k);
  console.log(`${p.name} (${shownOvr(p.z)}) ${k}: ${r.length} in ${Date.now() - t} ms${r[0] ? ' | ' + r[0].tid + ': ' + describeAssets(lg, r[0].gets) : ''}`);
}
