// @ts-nocheck
// A trade package in detail: each player with position, age, OVR, the scouts' potential grade, salary and contract
// length; picks with where they project; and the package's total salary. Used by offers, the finder and the builder.
import { shownOvr } from '../data';
import { ageIn } from '../players';
import { money } from './money';
import { posLabel } from './positions';
import { PotOf } from './potgrade';
import { describeAssets, expectedSlot, pickUsed } from '../ai/trades';
import { optLabel } from '../league/contracts';

/** Seasons left on a deal, counting the one being played (before free agency the ending season no longer counts). */
export const yrsLeft = (lg: any, exp: number) => Math.max(0, exp - lg.season + (lg.phase === 'draft' || lg.phase === 'offseason' ? 0 : 1));
export const yrsTxt = (lg: any, c: any) => {
  const n = yrsLeft(lg, c.exp);
  return n === 0 ? 'expiring' : `${n} yr${n > 1 ? 's' : ''}`;
};

/** One side of a deal as a small table. */
export function Pkg({ lg, xs, openPlayer, total = true, compact = false }: any) {
  if (!xs?.length) return <i className="dim">nothing</i>;
  const S = lg.season;
  const ps = xs.filter((x: any) => x.pid && lg.players[x.pid]).map((x: any) => lg.players[x.pid]);
  const sal = ps.reduce((a: number, p: any) => a + (p.contract?.sal ?? 0), 0);
  return <div className={`pkg ${compact ? 'compact' : ''}`}>
    <table className="tbl pkg-tbl">
      {ps.length > 0 && !compact && <thead><tr><th className="l">Player</th><th>Pos</th><th>Age</th><th>OVR</th><th title="Potential as the scouts project it">Pot.</th><th title="Salary this season">Salary</th><th className="l" title="Seasons left on the contract, and the season it runs through">Contract</th></tr></thead>}
      <tbody>{xs.map((x: any, i: number) => {
        if (x.pid) {
          const p = lg.players[x.pid];
          if (!p) return <tr key={i}><td className="l" colSpan={7}>{x.pid}</td></tr>;
          const c = p.contract ?? {};
          return <tr key={i}>
            <td className="l"><button className="link" onClick={() => openPlayer?.(x.pid)}>{p.name}</button>{p.injury > 0 && <span className="inj" title="Injured – games he will still miss">+{p.injury}</span>}</td>
            <td className="dim">{posLabel(p)}</td><td>{ageIn(p, S)}</td><td><b>{shownOvr(p.z, p.id)}</b></td><td><PotOf p={p} s={S} /></td>
            <td>{money(c.sal ?? 0, S)}</td>
            <td className="l dim">{c.exp ? <>{yrsTxt(lg, c)}{compact ? ` ’${String(c.exp).slice(2)}` : <span className="small-t"> (’{String(c.exp).slice(2)})</span>}</> : '–'}{optLabel(c) ? <span className="chip tiny" title="TO – team option, PO – player option">{optLabel(c)}</span> : null}{c.rookie ? <span className="chip tiny" title="Rookie deal – restricted free agent when it ends">RFA</span> : null}{p.ext ? <span className="chip tiny ext" title={`Extension: ${money(p.ext.sal, S + 1)} per season through ${p.ext.exp}`}>ext. ’{String(p.ext.exp).slice(2)}</span> : null}</td>
          </tr>;
        }
        const pk = x.pick;
        let proj = '';
        if (pk && !pickUsed(lg, pk) && pk.season - lg.season <= 1) { try { const s = Math.round(expectedSlot(lg, pk)); if (s > 0) proj = `projects ~No. ${s}${pk.round === 2 ? ' overall' : ''}`; } catch { /* no projection */ } }
        return <tr key={i} className="pkg-pick"><td className="l" colSpan={ps.length ? 7 : 1}>{describeAssets(lg, [x])}{proj && <span className="dim small-t"> · {proj}</span>}</td></tr>;
      })}</tbody>
    </table>
    {total && ps.length > (compact ? 1 : 0) && <p className="pkg-foot dim small-t">Salary {money(sal, S)}{ps.length > 1 ? ` · avg age ${(ps.reduce((a: number, p: any) => a + ageIn(p, S), 0) / ps.length).toFixed(1)}` : ''}</p>}
  </div>;
}
