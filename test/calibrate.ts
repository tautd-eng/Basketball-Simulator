import { boot, runSeason, report } from './harness';
boot();
import { ATHX, ATHB } from '../src/engine/game';
if (process.env.NOATH) { for (const k in ATHX) (ATHX as any)[k] = 0; for (const k in ATHB) (ATHB as any)[k] = 0; }
if (process.env.ATHB0) { for (const k in ATHB) (ATHB as any)[k] = 0; for (const k of ['drwN', 'blkN', 'tovN', 'p2N']) (ATHX as any)[k] = 0; }
const seasons = (process.argv[2] ?? '1980,1995,2010,2024').split(',').map(Number);
const t0 = Date.now();
for (const s of seasons) {
  const r = runSeason(s, 7, 2);
  console.log(report(s, r, process.argv[3] === 'v').text);
}
console.log('time', (Date.now() - t0) / 1000, 's');
