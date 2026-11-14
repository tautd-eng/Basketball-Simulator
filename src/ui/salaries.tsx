// Salary cap breakdown: a team's contracts season by season (as shares of each season's cap), and the league at a glance.
import { useState } from 'react';
import { shownOvr as ovrOf } from '../data';
import { payroll, hardCap, deadPay, MIN_SAL, DEAD_SHARE, MAX_SAL } from '../ai/value';
import { run } from '../league/commands';
import { isHuman } from '../league/humans';
import { ageIn } from '../players';
import { money, usd } from './money';
import { SortTable } from './sorttable';
import { useNavState } from './nav';
import { registerTable } from './export';

const seasonLabel = (s: number) => `${s - 1}–${String(s).slice(2)}`;
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;

export function SalaryView({ lg, openPlayer, openTeam, onChange = () => {} }: any) {
  const teams = Object.values(lg.teams).filter((t: any) => t.active).sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[];
  const [tid, setTid] = useNavState<string>('sal.tid', lg.userTid ?? teams[0].tid);
  const [mode, setMode] = useNavState<'team' | 'league' | 'release' | 'rules'>('sal.mode', 'team');
  return (
    <div className="col">
      <div className="panel">
        <div className="team-head">
          <h2>Salary cap</h2>
          <div className="seg" role="group" aria-label="View">
            <button className={mode === 'team' ? 'on' : ''} onClick={() => setMode('team')}>Team breakdown</button>
            <button className={mode === 'league' ? 'on' : ''} onClick={() => setMode('league')}>All teams</button>
            {lg.userTid && <button className={mode === 'release' ? 'on' : ''} onClick={() => setMode('release')}>Release players</button>}
            <button className={mode === 'rules' ? 'on' : ''} onClick={() => setMode('rules')}>How contracts work</button>
          </div>
          {mode === 'team' && <select aria-label="Team" className="mm-opp" value={tid} onChange={e => setTid(e.target.value)}>
            {teams.map(t => <option key={t.tid} value={t.tid}>{t.name}</option>)}
          </select>}
        </div>
        <p className="note">Every salary is a share of that season's salary cap – the same scale in every era. Hard cap {Math.round(hardCap(lg) * 100)}% of the cap.</p>
      </div>
      {mode === 'team' ? <TeamSalary lg={lg} tid={tid} openPlayer={openPlayer} openTeam={openTeam} />
        : mode === 'release' && lg.userTid ? <ReleaseView lg={lg} openPlayer={openPlayer} onChange={onChange} />
        : mode === 'rules' ? <ContractRules lg={lg} />
        : <LeagueSalary lg={lg} open={(t: string) => { setTid(t); setMode('team'); }} />}
    </div>
  );
}

function TeamSalary({ lg, tid, openPlayer, openTeam }: any) {
  const t = lg.teams[tid];
  const S = lg.season, YRS = [S, S + 1, S + 2, S + 3, S + 4];
  const ps = t.roster.map((pid: string) => lg.players[pid]).sort((a: any, b: any) => ovrOf(b.z, b.id) - ovrOf(a.z, a.id));
  const pay = payroll(lg, tid), hc = hardCap(lg);
  const on = (p: any, s: number) => s <= p.contract.exp;
  const opt = (p: any, s: number) => p.contract.opts?.find((o: any) => o.s === s)?.k;
  const dead = (lg.dead ?? []).filter((d: any) => d.tid === tid && d.exp >= S);
  const total = (s: number) => ps.reduce((a: number, p: any) => a + (on(p, s) ? p.contract.sal : 0), 0) + deadPay(lg, tid, s);
  const after = (p: any) => (p.contract.rookie ? 'RFA' : 'UFA');
  const fmtS = (x: number, s: number) => money(x, s);
  const rows: (string | number)[][] = [['Player', 'Pos', 'Age', 'OVR', ...YRS.map(seasonLabel)],
    ...ps.map((p: any) => [p.name, p.pos, ageIn(p, S), ovrOf(p.z, p.id), ...YRS.map(s => on(p, s) ? pc(p.contract.sal) + (opt(p, s) ? ` (${opt(p, s)} option)` : '') : (s === p.contract.exp + 1 ? after(p) : ''))]),
    ...dead.map((d: any) => [`${lg.players[d.pid]?.name ?? d.pid} (released)`, '', '', '', ...YRS.map(s => (s <= d.exp ? pc(d.sal) : ''))]),
    ['Total', '', '', '', ...YRS.map(s => pc(total(s)))]];
  return (
    <div className="panel sal-panel">
      <div className="team-head"><h2><button className="link" onClick={() => openTeam(tid)}>{t.name}</button></h2></div>
      <div className="sal-top">
        <div><span>Team salary</span><b>{pc(pay)}</b><small>of the cap{usd(pay, S)}</small></div>
        {hc < Infinity
          ? <div><span>Free-agent room</span><b className={pay > 1.1 ? 'neg' : 'pos'}>{pay > 1.1 ? '−' : ''}{pc(Math.abs(Math.min(hc, 1.1) - pay))}</b><small>{pay > 1.1 ? 'over 110% – minimum deals and your own players only' : 'to sign other teams\' free agents (up to 110%)'}</small></div>
          : <div><span>Cap room</span><b className={pay > 1 ? 'neg' : 'pos'}>{pay > 1 ? '−' : ''}{pc(Math.abs(1 - pay))}</b><small>{pay > 1 ? 'over the cap – exceptions and minimum deals only' : 'free to sign players'}</small></div>}
        <div><span>Hard cap room</span><b className={hc - pay < 0.05 ? 'neg' : ''}>{pc(hc - pay)}</b><small>to the {Math.round(hc * 100)}% limit</small></div>
        <div className="sal-legend"><span><i className="sw team"></i>Team option</span><span><i className="sw player"></i>Player option</span><span><i className="sw rk"></i>Rookie deal</span></div>
      </div>
      <div className="tbl-wrap"><table className="tbl sal-tbl" ref={el => registerTable(el, () => rows)}>
        <thead><tr><th className="l">Player</th><th>Pos</th><th>Age</th><th>OVR</th>{YRS.map(s => <th key={s}>{seasonLabel(s)}</th>)}</tr></thead>
        <tbody>
          {ps.map((p: any) => <tr key={p.id} className={tid === lg.userTid ? '' : ''}>
            <td className="l"><button className="link" onClick={() => openPlayer(p.id)}>{p.name}</button>{p.contract.rookie ? <span className="chip tiny" title="Rookie contract – a restricted free agent when it ends">R</span> : null}</td>
            <td className="dim">{p.pos}</td><td>{ageIn(p, S)}</td><td>{ovrOf(p.z, p.id)}</td>
            {YRS.map(s => {
              const o = opt(p, s);
              return <td key={s} className={on(p, s) ? `sal ${o ? 'opt-' + o : p.contract.rookie ? 'rk' : ''}` : 'dim'} title={o ? `${o === 'team' ? 'Team' : 'Player'} option` : undefined}>
                {on(p, s) ? fmtS(p.contract.sal, s) : s === p.contract.exp + 1 ? <span className="fa-tag">{after(p)}</span> : '–'}
              </td>;
            })}
          </tr>)}
          {dead.map((d: any, i: number) => <tr key={'d' + i} className="dim">
            <td className="l">{lg.players[d.pid]?.name ?? d.pid} <span className="chip tiny" title="Released – this money stays on the books">dead</span></td><td></td><td></td><td></td>
            {YRS.map(s => <td key={s}>{s <= d.exp ? fmtS(d.sal, s) : '–'}</td>)}
          </tr>)}
        </tbody>
        <tfoot><tr className="sal-total"><td className="l"><b>Total</b></td><td></td><td></td><td></td>{YRS.map(s => { const v = total(s); return <td key={s}><b className={v > hc ? 'neg' : v > 1 ? 'warn-t' : ''}>{fmtS(v, s)}</b></td>; })}</tr>
          <tr><td className="l dim">Cap room</td><td></td><td></td><td></td>{YRS.map(s => { const v = 1 - total(s); return <td key={s} className={v < 0 ? 'neg' : 'pos'}>{v < 0 ? '−' : ''}{pc(Math.abs(v))}</td>; })}</tr></tfoot>
      </table></div>
      <p className="note">Contracts are flat: the same share of the cap every season. UFA / RFA – the season he becomes an unrestricted or restricted free agent.</p>
    </div>
  );
}

function LeagueSalary({ lg, open }: any) {
  const S = lg.season, hc = hardCap(lg);
  const rows = Object.values(lg.teams).filter((t: any) => t.active).map((t: any) => {
    const ps = t.roster.map((pid: string) => lg.players[pid]);
    const next = ps.reduce((a: number, p: any) => a + (p.contract.exp >= S + 1 ? p.contract.sal : 0), 0) + deadPay(lg, t.tid, S + 1);
    const top = [...ps].sort((a: any, b: any) => b.contract.sal - a.contract.sal)[0];
    return { key: t.tid, t, pay: payroll(lg, t.tid), next, n: ps.length, dead: deadPay(lg, t.tid), top };
  });
  const cols = [
    { key: 'team', label: 'Team', left: true, asc: true, get: (r: any) => r.t.name, fmt: (v: any, r: any) => <button className="link" onClick={() => open(r.t.tid)}>{v}</button> },
    { key: 'pay', label: 'Salary', title: 'Payroll this season, % of the cap', get: (r: any) => r.pay, fmt: (v: any) => <b className={v > hc ? 'neg' : v > 1 ? 'warn-t' : ''}>{pc(v)}</b> },
    { key: 'room', label: 'Cap room', get: (r: any) => 1 - r.pay, fmt: (v: any) => <span className={v < 0 ? 'neg' : 'pos'}>{v < 0 ? '−' : ''}{pc(Math.abs(v))}</span> },
    { key: 'hard', label: 'Hard cap room', get: (r: any) => hc - r.pay, fmt: (v: any) => pc(v) },
    { key: 'dead', label: 'Dead money', get: (r: any) => r.dead, fmt: (v: any) => (v ? pc(v) : '–') },
    { key: 'next', label: `Committed ${seasonLabel(S + 1)}`, get: (r: any) => r.next, fmt: (v: any) => pc(v) },
    { key: 'n', label: 'Players', get: (r: any) => r.n },
    { key: 'top', label: 'Highest paid', left: true, get: (r: any) => r.top?.contract.sal ?? 0, fmt: (_: any, r: any) => r.top ? `${r.top.name} – ${pc(r.top.contract.sal)}` : '–' },
  ];
  return <div className="panel"><h2>All teams · {seasonLabel(S)}</h2><SortTable cols={cols} rows={rows} initial="pay" /></div>;
}

// ---------------------------------------------------------------- releasing players
const ROSTER_MAX = 15, ROSTER_MIN = 13;
/** What releasing him would do: dead money season by season, payroll and room before and after, roster limits. */
export function releaseImpact(lg: any, tid: string, p: any) {
  const S = lg.season, hc = hardCap(lg), t = lg.teams[tid];
  const free = p.contract.sal <= MIN_SAL * 1.0001;
  const seasons: number[] = []; for (let s = S; s <= p.contract.exp; s++) seasons.push(s);
  const dead = free ? 0 : p.contract.sal * DEAD_SHARE;
  const before = payroll(lg, tid), after = before - p.contract.sal + dead;
  const n = t.roster.length;
  const blocked = lg.phase === 'playoffs' || lg.phase === 'draft' ? 'Players can\'t be released during the playoffs or on draft day.'
    : lg.phase === 'regular' && n <= ROSTER_MIN - 1 ? `During the season you must keep at least ${ROSTER_MIN - 1} players.` : null;
  const warn: string[] = [];
  if (n - 1 < ROSTER_MIN) warn.push(`Roster drops to ${n - 1}: you need ${ROSTER_MIN}–${ROSTER_MAX} players to start a season – sign a replacement (a minimum deal always fits, even over the hard cap).`);
  if (dead > 0 && seasons.length > 1) warn.push(`The dead money stays for ${seasons.length} seasons (through ${seasonLabel(p.contract.exp)}).`);
  if (p.contract.opts?.length) warn.push(`His contract has ${p.contract.opts.map((o: any) => `a ${o.k} option for ${seasonLabel(o.s)}`).join(' and ')} – releasing him gives that up too.`);
  return { free, seasons, dead, saved: p.contract.sal - dead, before, after, hc, blocked, warn, totalDead: dead * seasons.length };
}

function ReleaseView({ lg, openPlayer, onChange }: any) {
  const tid = lg.userTid, t = lg.teams[tid], S = lg.season;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const ps = t.roster.map((pid: string) => lg.players[pid]).sort((a: any, b: any) => b.contract.sal - a.contract.sal);
  const p = sel ? lg.players[sel] : null;
  const im = p && p.tid === tid ? releaseImpact(lg, tid, p) : null;
  const cols = [
    { key: 'name', label: 'Player', left: true, get: (x: any) => x.name, fmt: (v: any, x: any) => <button className="link" onClick={() => openPlayer(x.id)}>{v}</button> },
    { key: 'age', label: 'Age', asc: true, get: (x: any) => ageIn(x, S) },
    { key: 'ovr', label: 'OVR', get: (x: any) => ovrOf(x.z, x.id) },
    { key: 'sal', label: 'Salary', get: (x: any) => x.contract.sal, fmt: (v: any) => money(v, S) },
    { key: 'yrs', label: 'Seasons left', get: (x: any) => x.contract.exp - S + 1 },
    { key: 'dead', label: 'Dead money / season', title: 'What stays on your books each season if you release him', get: (x: any) => releaseImpact(lg, tid, x).dead, fmt: (v: any) => v ? money(v, S) : <span className="pos">none</span> },
    { key: 'saved', label: 'Saved / season', get: (x: any) => releaseImpact(lg, tid, x).saved, fmt: (v: any) => money(v, S) },
    { key: 'act', label: '', get: () => 0, fmt: (_: any, x: any) => <button className={`small ${sel === x.id ? 'primary' : ''}`} onClick={() => { setSel(x.id); setMsg(''); }}>{sel === x.id ? 'Selected' : 'What if…'}</button> },
  ];
  return (
    <div className="grid-2">
      <div className="panel">
        <h2>Release players</h2>
        <p className="note">Pick a player to see what releasing him would do before you decide. Half of a released player's salary stays on your books every season until his contract would have ended; a minimum deal costs nothing.</p>
        <SortTable cols={cols} rows={ps.map((x: any) => ({ ...x, key: x.id }))} initial="sal" />
      </div>
      <div className="panel">
        {!im ? <p className="note">Choose a player on the left (“What if…”).</p> : <>
          <h2>Release {p.name}?</h2>
          <div className="kv">
            <div><span className="dim">His salary</span> {money(p.contract.sal, S)} per season, through {seasonLabel(p.contract.exp)}</div>
            <div><span className="dim">Dead money</span> {im.dead ? <>{money(im.dead, S)} per season × {im.seasons.length} = <b>{money(im.totalDead, S)}</b></> : <span className="pos">none – a minimum contract</span>}</div>
            <div><span className="dim">Payroll this season</span> {pc(im.before)} → <b>{pc(im.after)}</b> <span className="pos">(−{pc(im.saved)})</span></div>
            {im.hc < Infinity && <div><span className="dim">Room under the hard cap</span> {pc(im.hc - im.before)} → <b>{pc(im.hc - im.after)}</b></div>}
            <div><span className="dim">Roster</span> {t.roster.length} → <b>{t.roster.length - 1}</b> players</div>
          </div>
          {im.seasons.length > 0 && <table className="tbl sal-tbl"><thead><tr><th className="l">Season</th><th>Keep him</th><th>Release</th><th>Saved</th></tr></thead>
            <tbody>{im.seasons.map(s => { const keep = payroll(lg, tid) - deadPay(lg, tid) + deadPay(lg, tid, s); return <tr key={s}><td className="l">{seasonLabel(s)}</td><td>{money(p.contract.sal, s)}</td><td>{im.dead ? money(im.dead, s) : '–'}</td><td className="pos">{money(im.saved, s)}</td></tr>; })}</tbody></table>}
          {im.warn.map((w, i) => <p key={i} className="hint">{w}</p>)}
          {im.blocked ? <p className="neg">{im.blocked}</p> : <div className="def-row">
            <button className="danger" onClick={() => { const r = run(lg, { t: 'release', pid: p.id }); setMsg(r?.msg ?? ''); setSel(null); onChange(); }}>Release {p.name}</button>
            <button className="ghost" onClick={() => setSel(null)}>Cancel</button>
          </div>}
        </>}
        {msg && <p className="ok-msg" role="status">{msg}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the rules, explained
function ContractRules({ lg }: any) {
  const S = lg.season, hc = hardCap(lg);
  const R = (t: string, body: any) => <div className="rule"><h3>{t}</h3>{body}</div>;
  return (
    <div className="panel rules">
      <h2>How contracts work</h2>
      <p className="note">This league is in {seasonLabel(S)}. Some rules depend on the era – those use the real NBA agreements of the time.</p>
      {R('Salaries are shares of the cap', <p>Every salary is a share of that season's salary cap, so a contract means the same in 1985 and in 2025 (turn on dollars in Preferences to see that season's money too). Contracts are flat: the same share every season.</p>)}
      {R('The limit: the hard cap', hc < Infinity
        ? <p>Two limits (dead money included). <b>Up to {Math.min(110, Math.round(hc * 100))}% of the cap</b> you can sign any free agent who accepts. <b>From there up to the {Math.round(hc * 100)}% hard cap</b> only minimum deals and your own players: re-signing them (Bird rights), matching an offer sheet for your restricted free agent, and extensions. Trades can take you up to the hard cap. Above the hard cap nothing – except minimum deals to fill the roster to {ROSTER_MIN}. The hard cap can be changed in “Season format”.</p>
        : <p>This league has no hard cap. Under the cap (100%{S < 1985 ? ', 130% before 1984–85' : ''}) a team signs anyone; over it only: your own players with their Bird rights (up to {S < 1985 ? 160 : 145}% of the cap), {S >= 1995 ? 'the mid-level exception (up to 10% of the cap, one player per summer), ' : ''}and minimum deals.</p>)}
      {R('Minimum and maximum', <p>The minimum is {pc(MIN_SAL)} of the cap for a rookie and grows by 0.1% a season with experience (up to {pc(MIN_SAL + 0.01)} after 10 years). {S >= 2000 ? <>The maximum depends on years in the league: 25% of the cap (0–6 years), 30% (7–9), 35% (10+), or 105% of his previous salary if more.</> : <>Before the 1999 agreement there was no individual maximum; 40% of the cap is the practical ceiling.</>}</p>)}
      {R('What a player asks', <p>His price follows his expected level over the next two seasons (more for proven stars, a premium for a big name). The length matters: a young player wants a short deal or a premium for a long one; a veteran prefers security – a longer deal is never more expensive for him. A player who likes your team (winner, his role, his hometown) gives up to a 10% discount; one who doesn't want to stay asks your team up to twice as much to re-sign.</p>)}
      {R('Rookie contracts', <p>First-round picks get a rookie-scale deal: the higher the pick, the more (No. 1 ≈ 7.5% of the cap, falling with every pick). {S >= 2000 ? 'Two guaranteed years plus team options for years 3 and 4.' : 'Three years.'} Second-rounders get a minimum two-year deal. When a rookie deal ends the player is a <b>restricted</b> free agent (RFA).</p>)}
      {R('Options', <p>{S >= 1990 ? <>Veteran deals can have an option on the last year: a <b>player option</b> (he decides to stay or test free agency – usually on big deals) or a <b>team option</b> (the team decides – more often for older players).</> : <>Option years on veteran deals arrive with the 1988 agreement (from 1989–90).</>} Options are decided before free agency opens. A player traded with an open option takes it with him; his new team decides.</p>)}
      {R('Restricted and unrestricted free agents', <p>{S < 1989 ? <>Until the 1988 agreement <b>every</b> free agent is restricted: his team has the right of first refusal.</> : <>Most free agents are unrestricted (UFA) – anyone may sign them. Players finishing a rookie deal are restricted (RFA) if their team makes a qualifying offer.</>} Other teams can give an RFA an offer sheet; his team may match it and keep him.</p>)}
      {R('Free agency', <p>Free agency runs in waves. Your offers are not signed at once: the player decides at the end of the wave (in the season: the next day), comparing everyone's offers – money, years, role and team. Unsigned players stay free agents and can be signed during the season. Online, you only see who is interested until he signs.</p>)}
      {R('Extensions', <p>A player in the last year of his deal can be extended during the season (his profile → contract): the same asking rules, but he decides at once.</p>)}
      {R('Releasing a player', <p>A released player becomes a free agent. <b>Half of his salary stays on your books</b> every season until his contract would have ended (dead money; a minimum deal costs nothing). Not possible during the playoffs or on draft day; in the season you must keep at least {ROSTER_MIN - 1} players. See “Release players” for the exact effect before you decide.</p>)}
      {R('Roster', <p>{ROSTER_MIN}–{ROSTER_MAX} players. Drafted players who stay overseas don't count until they come over.</p>)}
    </div>
  );
}
