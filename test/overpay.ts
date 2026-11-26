// Trade finder probe: for the best players elsewhere, does the finder find any price – fair or overpay?
import { boot } from './harness';
import { newLeague } from '../src/league/league';
import { setEraCal } from '../src/engine/game';
import { shownOvr } from '../src/data';
import { findTrades, ensurePicks, describeAssets } from '../src/ai/trades';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
const start = +(process.argv[2] ?? 2026), me = process.argv[3] ?? 'BOS';
const lg: any = newLeague(0, 3, me, { start });
ensurePicks(lg);
const ps = Object.values(lg.players).filter((p: any) => p.tid && p.tid !== me).sort((a: any, b: any) => shownOvr(b.z) - shownOvr(a.z)).slice(+(process.argv[5] ?? 0), +(process.argv[4] ?? 20)) as any[];
console.log("my picks", lg.picks.filter((k: any) => k.owner === me).length);
let any = 0, ov = 0; const t0 = Date.now();
for (const p of ps) {
  const t1 = Date.now();
  const r = findTrades(lg, me, [], [{ pid: p.id }], null, 40);
  if (r.length) any++;
  const o = r.filter(x => x.overpay); if (o.length) ov++;
  const f = r.filter(x => !x.overpay);
  console.log(`${p.name.padEnd(22)} ${p.tid} OVR ${shownOvr(p.z)} fair ${f.length} overpay ${o.length} (${Date.now() - t1} ms)${o[0] ? ` | ${describeAssets(lg, o[0].gives)} [${o[0].getV.toFixed(1)}/${o[0].giveV.toFixed(1)}]` : f[0] ? ` | fair: ${describeAssets(lg, f[0].gives)}` : ''}`);
}
console.log(`any deal ${any}/${ps.length}, overpay ${ov}, ${Date.now() - t0} ms`);
