// @ts-nocheck
// One position filter for every player list: All, PG … C, then Guards / Wings / Bigs.
import { POS_FILTER, POS_GROUPS } from './positions';

export function PosFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="seg pos-seg" role="group" aria-label="Position">
    {POS_FILTER.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    <span className="seg-sep" aria-hidden="true" />
    {POS_GROUPS.map(([k, l, xs]) => <button key={k} className={`grp ${value === k ? 'on' : ''}`} title={`${l}: ${xs.join(' or ')}`} onClick={() => onChange(value === k ? 'all' : k)}>{l}</button>)}
  </div>;
}
