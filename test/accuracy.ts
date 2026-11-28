// Engine accuracy and sanity: a full round of real-roster games per season (era calibration on, as in the game):
// league rates vs real, team wins and player lines vs real (harness report), plus per-game extremes and season
// leaders to catch anything implausible. Usage: bun test/accuracy.ts 1985,2000,2015,2024 [seed]
import { boot, report, corr } from './harness';
import { simGame, setEraCal, ATHX, ATHB } from '../src/engine/game';
import { realTeams } from './harness';
import { H } from '../src/data';
import { Rng } from '../src/rng';
import { seasonInfo } from '../src/data';
import cal from '../src/engine/eracal.json';
boot(); setEraCal(cal as any);
if (process.env.NOATH) { for (const k in ATHX) (ATHX as any)[k] = 0; for (const k in ATHB) (ATHB as any)[k] = 0; }
const seasons = (process.argv[2] ?? '1985,2000,2015,2024').split(',').map(Number);
const seed = +(process.argv[3] ?? 7);
const add = (a: any, b: any) => { for (const k in b) if (typeof b[k] === 'number') a[k] = (a[k] ?? 0) + b[k]; };
let errSum = 0;
for (const season of seasons) {
  const rng = new Rng(seed);
  const teams: any = realTeams(season);
  const ids = Object.keys(teams);
  const lines: Record<string, any> = {}, tot: any = {}, wins: any = {}, games: any = {};
  let homeW = 0, n = 0, ots = 0;
  const ex = { pts: [0, ''], reb: [0, ''], ast: [0, ''], stl: [0, ''], blk: [0, ''], tpm: [0, ''], min: [0, ''], teamHi: 0, teamLo: 999, margin: 0, td: 0, p40: 0, p50: 0, p60: 0, fo: 0, maxPf: 0, zeroMinStar: 0 } as any;
  const perPair = Math.max(1, Math.round(seasonInfo(season).games / (2 * (ids.length - 1))));
  for (let r = 0; r < 2 * perPair; r++) for (const h of ids) for (const a of ids) {
    if (h === a) continue;
    const res: any = simGame(teams[h], teams[a], { season, po: false, rng });
    for (const b of [res.home, res.away]) {
      ex.teamHi = Math.max(ex.teamHi, b.pts); ex.teamLo = Math.min(ex.teamLo, b.pts);
      for (const pl of b.players) {
        const s = pl.st; (lines[pl.pid] ??= {}); add(lines[pl.pid], s); if (s.min > 0) { ((lines[pl.pid] as any).g ??= []).push(s.pts); ((lines[pl.pid] as any).gr ??= []).push(s.orb + s.drb); ((lines[pl.pid] as any).ga ??= []).push(s.ast); if ([s.pts, s.orb + s.drb, s.ast, s.stl, s.blk].filter(x => x >= 10).length >= 3) (lines[pl.pid] as any).td = ((lines[pl.pid] as any).td ?? 0) + 1; } add(tot, s);
        const nm = H.players[pl.pid]?.n ?? pl.pid, reb = s.orb + s.drb;
        for (const [k, v] of [['pts', s.pts], ['reb', reb], ['ast', s.ast], ['stl', s.stl], ['blk', s.blk], ['tpm', s.tpm], ['min', s.min]] as [string, number][]) if (v > ex[k][0]) ex[k] = [v, `${nm} ${season}`];
        const dd = [s.pts, reb, s.ast, s.stl, s.blk].filter(x => x >= 10).length;
        if (dd >= 3) ex.td++;
        if (s.pts >= 40) ex.p40++; if (s.pts >= 50) ex.p50++; if (s.pts >= 60) ex.p60++;
        if (s.pf >= 6) ex.fo++; ex.maxPf = Math.max(ex.maxPf, s.pf);
      }
    }
    ex.margin = Math.max(ex.margin, Math.abs(res.home.pts - res.away.pts));
    const hw = res.home.pts > res.away.pts;
    wins[h] = (wins[h] ?? 0) + (hw ? 1 : 0); wins[a] = (wins[a] ?? 0) + (hw ? 0 : 1);
    games[h] = (games[h] ?? 0) + 1; games[a] = (games[a] ?? 0) + 1;
    if (hw) homeW++; n++; ots += res.ot ? 1 : 0;
  }
  const r: any = { teams, lines: Object.fromEntries(Object.entries(lines).map(([k, l]: any) => [k, l])), tot, wins, games, homeW: homeW / n, n, ots: ots / n };
  const rep = report(season, r, true);
  errSum += rep.err;
  console.log(rep.text);
  console.log(`mean abs error of league rates ${(100 * rep.err).toFixed(1)}%`);
  const per = (k: string) => (1000 * ex[k] / (n * 2)).toFixed(1);
  console.log(`per team-season (82 g): 40+ pt games ${(82 * ex.p40 / (n * 2) * ids.length / ids.length).toFixed(2)} per team, 50+ per season ${(ex.p50 / (2 * perPair * (ids.length - 1) / 82 * 0 + 2)).toFixed(1)}, 60+ ${(ex.p60 / 2).toFixed(1)}, triple-doubles ${(82 * ids.length * ex.td / (n * 2) / 2 * 2 / 2).toFixed(0)} per season, foul-outs ${(ex.fo / (n * 2)).toFixed(3)}/team-game`);
  console.log(`game highs: pts ${ex.pts.join(' – ')}, reb ${ex.reb.join(' – ')}, ast ${ex.ast.join(' – ')}, stl ${ex.stl.join(' – ')}, blk ${ex.blk.join(' – ')}, 3PM ${ex.tpm.join(' – ')}, min ${ex.min[0].toFixed(1)}; team score ${ex.teamLo}–${ex.teamHi}, biggest margin ${ex.margin}, max PF ${ex.maxPf}`);
  // season leaders (≥ 58 % of games) vs real leaders
  const P = Object.entries(lines).filter(([, l]: any) => l.gp >= 0.58 * 82 * 2 * perPair * (ids.length - 1) / 82).map(([pid, l]: any) => ({ pid, l }));
  const lead = (f: (l: any) => number, lab: string, ri: number | null) => {
    const top = [...P].sort((a, b) => f(b.l) - f(a.l)).slice(0, 3).map(x => `${H.players[x.pid].n} ${f(x.l).toFixed(1)}`);
    let real = '';
    if (ri != null) { const rs = Object.keys(teams).flatMap(t => teams[t].players.map((p: any) => p.id)).map((pid: string) => [pid, H.players[pid.split('~')[0]]?.s.find((x: any) => x[0] === season)] as any).filter(([, s]: any) => s && s[2] >= 50).sort((a: any, b: any) => b[1][ri] - a[1][ri]).slice(0, 3); real = ' | real: ' + rs.map(([pid, s]: any) => `${H.players[pid].n} ${s[ri]}`).join(', '); }
    console.log(`  ${lab}: ${top.join(', ')}${real}`);
  };
  for (const x of [...P].sort((a, b) => b.l.pts / b.l.gp - a.l.pts / a.l.gp).slice(0, 6)) { const g = x.l.g as number[]; const m = g.reduce((a, b) => a + b, 0) / g.length; const sd = Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length); console.log(`  scoring spread ${H.players[x.pid].n}: ${m.toFixed(1)} ± ${sd.toFixed(1)} (cv ${(sd / m).toFixed(2)}), 40+ ${g.filter(v => v >= 40).length}, 50+ ${g.filter(v => v >= 50).length} in ${g.length}`); }
  const sd = (g: number[]) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return [m, Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length)]; };
  for (const x of [...P].sort((a, b) => (b.l.td ?? 0) - (a.l.td ?? 0)).slice(0, 5)) { const [mr, sr] = sd(x.l.gr), [ma, sa] = sd(x.l.ga); console.log(`  triple-doubles ${H.players[x.pid].n}: ${((x.l.td ?? 0) * 82 / x.l.g.length).toFixed(1)} per 82 g – reb ${mr.toFixed(1)} ± ${sr.toFixed(1)}, ast ${ma.toFixed(1)} ± ${sa.toFixed(1)}`); }
  lead(l => l.pts / l.gp, 'PPG', 4); lead(l => (l.orb + l.drb) / l.gp, 'RPG', 5); lead(l => l.ast / l.gp, 'APG', 6);
  lead(l => l.stl / l.gp, 'SPG', null); lead(l => l.blk / l.gp, 'BPG', null); lead(l => l.min / l.gp, 'MPG', null);
  lead(l => l.tpa > 150 ? l.tpm / l.tpa * 100 : 0, '3P% (150+ att)', null); lead(l => l.fga > 400 ? (l.fgm / l.fga) * 100 : 0, 'FG% (400+ att)', null);
  lead(l => l.fta > 150 ? (l.ftm / l.fta) * 100 : 0, 'FT% (150+ att)', null);
  console.log('');
}
console.log(`ALL: mean abs error of league rates ${(100 * errSum / seasons.length).toFixed(1)}%`);
