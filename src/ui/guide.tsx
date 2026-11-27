// @ts-nocheck
// The game guide: everything worth knowing, from ratings to team building to contracts – one page, by topic.
import { useState } from 'react';
import { RATING_LABELS } from '../data';
import { ARCHETYPES } from '../archetypes';
import { GROUPS, SYSTEMS } from '../league/tactics';

/** When each point of emphasis helps – advice to go with the engine's description. */
const WHEN: Record<string, Record<string, string>> = {
  of: {
    star: 'You have one clearly better scorer (a Shot Creator or Two-Way Star) and weak secondary options.',
    ball: 'Many good passers and shooters, no dominant scorer; costs a few more turnovers.',
    basket: 'Slashers and good free-throw shooters, poor three-point shooting – or against a team with no rim protector.',
    shooters: 'Three or more good shooters; boosts your ceiling but games swing more. Strong in the modern era, weak in early-80s rules.',
    post: 'A Post Scorer or a big with a size edge; also draws fouls on their bigs. Weak if your bigs cannot score inside.',
    pnr: 'A good ball-handling guard plus a Rim Runner or Stretch Big.',
  },
  tempo: {
    patient: 'You are the weaker team (fewer possessions = more upsets) or your roster is old and slow.',
    push: 'Young, athletic, deep teams; more possessions favour the better team.',
    will: 'Lots of shooters and depth; maximum pace and threes.',
  },
  oreb: {
    limit: 'The opponent runs well in transition, or your bigs are poor rebounders.',
    crash: 'Glass Cleaners and big lineups; against small or poor-rebounding teams.',
  },
  df: {
    paint: 'They score inside (post scorers, slashers) and shoot threes poorly.',
    perim: 'They live on threes (several Sharpshooters) and have no inside game.',
  },
  aggr: {
    cons: 'Your key players are in foul trouble often, or your bench is thin.',
    phys: 'A deep frontcourt that can afford fouls; against jump-shooting teams.',
    press: 'Quick guards with steals (Lockdown Defenders) against careless ball-handlers; risky against good passers.',
  },
  dreb: {
    run: 'You have finishers in transition and they rarely crash the glass.',
    crash: 'They have Glass Cleaners or a big front line.',
  },
  cover: {
    drop: 'You have a Rim Protector and they lack pull-up shooters.',
    switch: 'Your players are similar in size (wings, versatile bigs); bad if a slow big ends up on their guards or a small guard on their post scorer.',
    blitz: 'Their offence depends on one ball-handler and their shooters are weak.',
  },
  dbl: {
    never: 'Their supporting cast can shoot – let the star get his and guard everyone else.',
    always: 'One player carries them and the others cannot shoot.',
  },
  zone: {
    often: 'They shoot threes poorly and attack the paint; also hides a weak individual defender.',
    never: 'They have good shooters – a zone gives up open threes.',
  },
};

/** what an option does, where the tactic itself has no line for it */
const DOES: Record<string, string> = {
  'tempo.patient': 'Fewer possessions: long possessions, set plays, few fast breaks.',
  'tempo.push': 'More fast breaks and early offence.',
  'tempo.will': 'The fastest pace: early shots, many threes, more possessions.',
  'zone.often': 'Zone defence instead of man-to-man: protects the paint, dares them to shoot.',
  'zone.never': 'Man-to-man every possession.',
};

const SECTIONS: [string, string][] = [
  ['start', 'Getting around'], ['ovr', 'Overall and ratings'], ['roles', 'Roles'], ['ath', 'Athleticism'], ['sta', 'Stamina'], ['pot', 'Potential and scouting'],
  ['dev', 'How players develop'], ['engine', 'How games are played'], ['tactics', 'Tactics'], ['build', 'Team building'],
  ['money', 'Salaries and contracts'], ['draft', 'The draft'], ['fa', 'Free agency'], ['trades', 'Trades'],
  ['season', 'Season, awards and history'], ['multi', 'Playing with friends'],
];

function Sec({ id, title, open, children }: any) {
  return (
    <details className="panel guide-sec" id={'g-' + id} open={open}>
      <summary><h2>{title}</h2></summary>
      <div className="guide-body">{children}</div>
    </details>
  );
}

export function Guide({ onBack }: any) {
  const [all, setAll] = useState(false);
  const go = (id: string) => { const el = document.getElementById('g-' + id) as HTMLDetailsElement | null; if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  return (
    <div className="col guide">
      <div className="panel">
        {onBack && <button className="ghost small menu-back" onClick={onBack}>← Main menu</button>}
        <div className="team-head"><h2>Game guide</h2><button className="ghost small" onClick={() => setAll(a => !a)}>{all ? 'Close all' : 'Open all'}</button></div>
        <p className="note">What you need to know to run a team – ratings, development, the game engine, building a roster, money, the draft and free agency. Open a topic below.</p>
        <nav className="guide-toc">{SECTIONS.map(([k, t]) => <button key={k} className="small" onClick={() => go(k)}>{t}</button>)}</nav>
      </div>

      <Sec id="start" title="Getting around" open={all}>
        <ul>
          <li><b>Moving on:</b> the buttons at the top advance the league – a day, a week, to the trade deadline, to the end of the regular season, the season, a full year or five years. Anything that needs you (your draft pick, a contract decision, an offer sheet) stops the clock.</li>
          <li><b>Back:</b> the ← at the top left (or the browser's Back) returns to exactly where you were.</li>
          <li><b>Overview</b> shows what is happening now: today's games, standings, news, and in the offseason the step you are on (recap, retirements, development, draft, options, free agency, preview).</li>
          <li><b>Team management</b> (your team): rotation and minutes, starters, positions, matchups, tactics, extensions – or import them from Excel.</li>
          <li><b>Saves:</b> every league is saved automatically in this browser. “Main menu” → Load game switches between them; Saves at the bottom of a league copies or renames.</li>
          <li><b>Tables:</b> click a column to sort; hover a table for CSV / Excel export.</li>
          <li><b>Preferences</b> (main menu): dark or light theme, heights in metres or feet, ratings as letters or numbers, salaries in dollars.</li>
        </ul>
      </Sec>

      <Sec id="ovr" title="Overall and ratings" open={all}>
        <p><b>OVR</b> is a player's impact per minute plus how much of the offence he carries, on a basketball-game scale: a rotation player ~74, a good starter ~80, an All-Star ~86–91, the era's superstars 95+. Real players start from their real seasons (blended 50/30/20 with the two before, so a one-off career year is softened); players whose standing in their time (MVP and All-NBA votes) beat their numbers get a reputation boost.</p>
        <p><b>Attributes</b> (0–99, ~50 is a typical player, 64 a clear strength, 80+ a standout, 90+ the best in the league at it; in tables shown as letters A+ … F):</p>
        <table className="tbl guide-tbl"><tbody>
          {RATING_LABELS.map(L => <tr key={L.short}><td><b>{L.short}</b></td><td className="l">{L.name}{L.tendency ? <span className="dim"> – a tendency (how he plays), not a quality</span> : ''}</td></tr>)}
          <tr><td><b>PerD</b></td><td className="l">Perimeter defence: staying in front, contesting jumpers (defence, steals, size)</td></tr>
          <tr><td><b>PostD</b></td><td className="l">Post defence: mostly size, some defence and blocks</td></tr>
          <tr><td><b>Rim</b></td><td className="l">Rim protection: blocks, size and defence</td></tr>
        </tbody></table>
        <p>Three-point shooting is shown as shooter quality (accuracy, touch from the line, and volume for a good shooter); ball handling weighs how much he creates. A player's profile has the exact numbers, his rating history and why he changed each summer.</p>
      </Sec>

      <Sec id="roles" title="Roles" open={all}>
        <p>Every player gets a role from his skill profile (a young one without a clear role shows what he projects to become). Roles matter for fit: the engine rewards lineups that have what a team needs.</p>
        <table className="tbl guide-tbl"><tbody>{ARCHETYPES.map(a => <tr key={a.id}><td className="l"><b>{a.name}</b></td><td className="l">{a.blurb} <span className="pos">{a.plus}</span> <span className="neg">{a.minus}</span></td></tr>)}</tbody></table>
      </Sec>

      <Sec id="ath" title="Athleticism" open={all}>
        <p><b>Athleticism</b> (Physical on the player card, “Ath” in the tables) is burst, speed, leaping and strength <i>for his size</i> – 50 is a typical NBA player his size. It comes from the real data (dunks, shots at the rim, free throws, size and role), the NBA combine where measured, and a scout's review of the best players.</p>
        <ul>
          <li><b>In the games</b> it decides mismatches: an explosive slasher against a slow defender finishes and draws fouls more often, a quick defender bothers a slow ball-handler, a leaper blocks more shots, and the more athletic lineup gets out on the break and to the offensive glass more. Against the league on average it evens out – a player's season still matches his ratings.</li>
          <li><b>Over a career</b> it grows a little to about 22, stays to 26, then fades – faster past 30. The skills built on it (finishing, drawing fouls, rebounding, blocks, steals, defence) fade with it, more for those who leaned on it: a high flyer loses more than a craftsman. A torn ACL or Achilles takes some of it for good.</li>
          <li><b>In the draft</b> the scouts see it well. The Profile column sums them up: Elite athlete / Athletic / Below the rim, Raw (the tools without the skills yet), Polished, High ceiling / High floor, Boom or bust / Safe. A raw athlete is a wider bet – more upside, more risk.</li>
        </ul>
      </Sec>
      <Sec id="sta" title="Stamina and heavy minutes" open={all}>
        <p><b>Stamina</b> (Physical on the player card, “Sta” in the tables, “Legs” in your rotation) is how many minutes a player can carry. It comes from the real data: how many minutes he played compared with players of his quality – Iverson and DeRozan carried huge loads, load-managed stars did not.</p>
        <ul>
          <li>Each player has a limit – about 37 minutes in a game for a typical player, ~34 to ~40 from poor to great stamina, less when he comes in tired. Past it, every extra minute wears him down: worse shooting and ball security, a step slow on defence, fewer rebounds, more fouls, less burst.</li>
          <li>Heavy nights also weigh extra afterwards: a 42-minute game leaves far more fatigue than 36, it carries into the next games (weaker legs, shorter minutes) and raises the injury risk.</li>
          <li>Your rotation shows each player's limit (“Legs”) and marks a plan past it as <b>heavy</b>.</li>
        </ul>
      </Sec>
      <Sec id="pot" title="Potential and scouting" open={all}>
        <p>A player's real potential is hidden. “Pot.” is what the scouts believe: the real potential plus their error. For a prospect the error is ~±5 OVR, and about one in twelve is badly misjudged – the Darko everybody loved, the Giannis nobody saw. As a player spends seasons in the league the scouts learn and the error shrinks. Overall stays hidden in the draft until a player is picked.</p>
        <p>In the draft, <b>Now</b> is the scouts' estimate of a prospect's overall today – it can be a few points off; the real one shows once he is drafted.</p>
        <p><b>How closely to follow reality</b> (set when the league starts, eight levels from “Alternate history” to “Replay”) is how strongly real careers pull. With <b>Generated classes</b> there is no real career to follow, so the question does not come up.</p>
      </Sec>

      <Sec id="dev" title="How players develop" open={all}>
        <ul>
          <li><b>Young players grow by themselves</b> until about 23 – the most talented fastest – and keep filling out a little until 26. Careers peak around 25–28; the decline starts at 29 and gets steep after 33 (each player has his own clock: some peak early, some late).</li>
          <li><b>How they play counts:</b> after each season every player is compared with what his ratings promised – shooting, rebounding, passing, defence (shots contested as the primary defender), his production per 36 against players with the same profile, adjusted for his teammates.</li>
          <li>A season's verdict is spread over three summers (50 / 30 / 20): one bad year doesn't sink a player, a real decline keeps adding up.</li>
          <li><b>The young are protected:</b> up to 22 a bad season costs nothing; from 23 the bill comes in step by step. A good season is rewarded at once and more for the young (up to 1.5×).</li>
          <li><b>Veterans who no longer deliver pay in full;</b> a veteran who still plays well holds his level until about 30.</li>
          <li>Players named to All-League or All-Defensive teams (or MVP / DPOY) are never marked down for that season. Serious injuries can cost ratings.</li>
          <li><b>Minutes matter:</b> a season counts in full only in a real rotation role. A good stretch in small minutes earns nothing below ~15 minutes a game (in full from ~30); a poor one in small minutes costs little – being a reserve on a deep team is not punished.</li>
          <li>The summer's luck is mostly one “form” factor (a good or an off summer), so single skills don't jump around at random.</li>
          <li><b>No one moves more than 6 overall points in one summer</b>, up or down, whatever the causes add up to.</li>
          <li>The league is kept roughly in the shape of its era, gently: it may grow stronger than the real one (up to about 50 more 80+ players) before anything pulls it back; a league that gets too weak is lifted at once.</li>
        </ul>
      </Sec>

      <Sec id="engine" title="How games are played" open={all}>
        <ul>
          <li>Every game is simulated possession by possession: who shoots (usage, matchups, tactics), from where, against which defender, rebounds, fouls, turnovers, fatigue and substitutions.</li>
          <li><b>League rule:</b> every team's three best players play at least 24 minutes, and at most one of them comes off the bench – no rotation setting or typed-in minutes can go below that.</li>
          <li><b>Minutes</b> follow your rotation (or the coach's, by quality, fatigue, foul trouble and your “play the kids” setting). Starters and positions decide the matchups.</li>
          <li><b>Matchups:</b> each defender guards his man by position – except that every team puts its best perimeter defender (the stopper) on the other side's top scoring guard or wing. You can assign them yourself in Team management. A small or soft defender draws shots; size matters in the post.</li>
          <li><b>Lineup fit:</b> spacing (shooters), ball-handling, rim protection and creation on the floor together change how everyone plays – five non-shooters clog the lane, no handler means turnovers.</li>
          <li>Home court, travel, back-to-backs and era (pace, three-point rates, rules) are all in the numbers.</li>
          <li>You can watch any game live, jump to the last five minutes, or (single player) coach the last five minutes yourself.</li>
        </ul>
      </Sec>

      <Sec id="tactics" title="Tactics" open={all}>
        <p>Set in Team management. Systems are presets; every point of emphasis can also be set on its own (a few only from their era).</p>
        {GROUPS.map(g => (
          <div key={g.k} className="guide-tac">
            <h3>{g.t}{g.from ? <span className="dim small-t"> (from {g.from - 1}–{String(g.from).slice(2)})</span> : null}</h3>
            <p className="dim">{g.d}</p>
            <table className="tbl guide-tbl"><thead><tr><th className="l">Option</th><th className="l">What it does</th><th className="l">When it helps</th></tr></thead>
              <tbody>{g.opts.map(o => <tr key={o.k}><td className="l"><b>{o.t}</b></td><td className="l">{o.d ?? DOES[g.k + '.' + o.k] ?? (o.k === 'neutral' || o.k === 'auto' || o.k === 'avg' || o.k === 'some' ? 'The default – nothing forced.' : '')}</td><td className="l">{WHEN[g.k]?.[o.k] ?? (o.k === 'neutral' || o.k === 'auto' || o.k === 'avg' || o.k === 'some' ? 'When nothing above clearly fits.' : '')}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
        <p className="note">Tactics move results by a point or two per game – fitting them to your roster and the opponent matters more than any single choice. Matchups (who guards whom) are set per opponent in Team management.</p>
        <p><b>Systems:</b> {SYSTEMS.map((x, i) => <span key={x.k}>{i ? ' · ' : ''}<b>{x.t}</b> – {x.d}</span>)}</p>
      </Sec>

      <Sec id="build" title="Team building" open={all}>
        <ul>
          <li><b>Stars win.</b> A team's strength is its best eight, weighted by minutes – one 95 helps more than two 85s in the same minutes.</li>
          <li><b>Balance beats talent piles:</b> have at least one creator (Floor General, Shot Creator or Point Forward), two or three shooters, and a rim protector or rebounder. Check the lineup fit and the matchups.</li>
          <li><b>Defence travels:</b> perimeter and rim defence keep a team steady in the playoffs.</li>
          <li><b>Age curve:</b> buy players before 25, sell them after 30 – veterans who stop delivering fall fast.</li>
          <li><b>Money:</b> other teams' free agents only fit while you are under 110% of the cap; keep room for your own stars' next deals. Minimum veterans are cheap depth. Avoid long deals for players past 30.</li>
          <li><b>Draft:</b> the lottery pays off – a top-5 pick averages a peak near 84 and about half become 85+, but scouting can be wrong. Build your own board.</li>
          <li><b>Trades:</b> teams value players by their own plans – contenders pay for veterans who help now, rebuilding teams for youth and picks. The trade finder lists deals the other side accepts.</li>
          <li><b>Draft picks:</b> every team has its picks for the next five drafts. A team must keep at least two of its future first-round picks, and may never be without a first in two drafts in a row (the Stepien rule). Teams → Draft picks shows who owns what.</li>
          <li><b>Chemistry of roles:</b> two ball-dominant scorers share the ball; a Rim Protector lets guards gamble; a Stretch Big pulls the other big out of the paint.</li>
        </ul>
      </Sec>

      <Sec id="money" title="Salaries and contracts" open={all}>
        <ul>
          <li>Salaries are shares of the cap (the same scale in every era); contracts are flat.</li>
          <li><b>Up to 110% of the cap</b> you can sign any free agent; <b>from 110% to the hard cap (150%)</b> only minimum deals and your own players (re-signing, matching offer sheets, extensions). Trades can take you to the hard cap.</li>
          <li>Rookie deals by pick (with team options from 1999–2000), player and team options, restricted free agents (qualifying offers, offer sheets you can match), maximum and minimum salaries by era.</li>
          <li>Releasing a player keeps half of his salary on your books until his contract ends (minimum deals cost nothing).</li>
          <li><b>Extensions</b> are possible until the trade deadline. If he turns your offer down, you get one more try on deadline day; after a second no (or the deadline) he goes to free agency. Computer teams play by the same rules.</li>
          <li>All the details – and “Release players”, which shows the effect before you decide – are under <b>Salaries → How contracts work</b>.</li>
        </ul>
      </Sec>

      <Sec id="draft" title="The draft" open={all}>
        <ul>
          <li>Each season's class is announced at the start of the season (Draft classes): consensus rank, the scouts' potential, ratings and projected roles. Add players to your own board; your GM picks from it when you let him.</li>
          <li>The lottery uses the era's real rules (a coin flip before 1985, weighted lotteries after) – the odds are shown before the draw.</li>
          <li>On draft day you pick when on the clock; teams trade up; the board (◂ Draft board) shows every pick in team colours.</li>
          <li>Some drafted players stay overseas until their real NBA career began – you can bring yours over early.</li>
          <li>New leagues bring <b>Generated classes</b> by default – made-up prospects with made-up names, each built on a real player's profile and career path – or real classes in their own years, shuffled classes or a mix; after today's NBA, historical classes come round again.</li>
          <li><b>After the draft: Team & rookie options</b> – keep or decline team options, tender qualifying offers, sign your draft picks (or let them go: no money on your books) and see what your players decided on their player options. Payroll updates with every choice.</li>
          <li>Positions are PG / SG / SF / PF / C: where a player really played most of his career (a second position if he played a fair share there). Filters use them; a player counts for both of his positions.</li>
        </ul>
      </Sec>

      <Sec id="fa" title="Free agency" open={all}>
        <ul>
          <li>Before the market: player and team options, qualifying offers, rookie contracts. Then three waves; at the end teams fill their rosters.</li>
          <li><b>Your own free agents are on the market from the first wave</b>, like everyone's – you hold their Bird rights (you can pay them over the free-agent limit, up to the hard cap, and they like staying a little more). They are listed at the top of Free agents.</li>
          <li><b>Max players always ask for the max.</b> Everyone else reads the market: what the teams with room can pay him decides what he expects – a thin market brings the price down (only so far each wave), several teams able to pay brings it up. His old team can keep him at his value and meets the best offer if it wants him.</li>
          <li><b>Your offers are not signed at once:</b> the player decides at the end of the wave, comparing all offers – money, years, his role, the team's chances and whether he likes the place (up to 10% discount; a player who doesn't want to stay asks his team up to twice as much). Type the exact % of the cap you offer, or press Max.</li>
          <li>The room bar shows your payroll, your open offers and what is left; put your offers in order of priority – if more say yes than the room allows, the higher ones sign first.</li>
          <li>Once a player signs, “N offers” shows every offer he had on a scale and why he chose his team.</li>
          <li>Contract length is priced: young players want short deals or a premium, veterans prefer security.</li>
          <li>Offer sheets for your restricted free agents wait one wave for your answer (match or let him go); unanswered, your GM decides.</li>
          <li>Unsigned players can be signed during the season (they decide the next day).</li>
        </ul>
      </Sec>

      <Sec id="trades" title="Trades" open={all}>
        <ul>
          <li>Build a trade or use the trade finder (also from a player's profile): it lists deals the other team accepts for what you offer, by market value.</li>
          <li>Salaries must fit under the hard cap and rosters within 13–15. Trades close at the deadline and reopen after the playoffs (draft-day trades happen too); open offers expire at the deadline.</li>
          <li>Computer teams make you offers too (Trades → offers for you); they stand about a week.</li>
          <li><b>Trade requests:</b> now and then a star on a team that missed the playoffs two years running asks to be traded. He will not extend or re-sign there – unless the team turns things around.</li>
          <li><b>Commissioner mode</b> lets you execute any trade between any teams (rules still apply) and bring retired players back.</li>
        </ul>
      </Sec>

      <Sec id="season" title="Season, awards and history" open={all}>
        <ul>
          <li>Season length and playoff format follow history by default (or your settings: games, playoff teams, play-in, series lengths, hard cap, injuries).</li>
          <li>Awards (MVP, DPOY, ROY, All-League teams…), the Hall of Fame and retired jerseys are decided in the league; History keeps champions, records, standings and every season's archive.</li>
          <li>Players retire in the offseason (age, decline, unsigned, or their real career ending); only the commissioner can talk one out of it.</li>
        </ul>
      </Sec>

      <Sec id="multi" title="Playing with friends" open={all}>
        <ul>
          <li><b>Several teams of your own:</b> pick them when you start a league (“More teams you run”) or later in “My teams” at the bottom – the game stops for each of them; switch with “Playing as” at the top.</li>
          <li><b>One device (hot seat):</b> the same “My teams” – tick the teams your friends run and give them names; you take turns.</li>
          <li><b>Online:</b> Host online game puts a league online; friends join with its code and pick teams. The host moves the league on; everyone marks “done”; the draft waits only for whoever is on the clock. Free-agent bids are blind until the player signs. You can play your own games when the other side is the computer or done, and watch replays of the others.</li>
          <li><b>Commissioner:</b> in an online league the host is the commissioner. Players pick their first team themselves; any later switch is a request the commissioner approves or declines (People in the online bar).</li>
          <li><b>Trade committee:</b> online, a trade between two people that looks one-sided (one side gets half again as much market value, or more) is not done at once – the trade committee votes on it (the commissioner ticks who is on it under People; a majority of the members not in the deal decides). The commissioner can approve or veto it at once. If time runs out (3 days in the season, or the end of the offseason step), the votes cast decide and a tie lets it through.</li>
          <li><b>Moving on:</b> when the host moves the league on while someone is not done yet – or the draft would run past another person's picks – the game asks once more before doing it.</li>
          <li><b>Trade offers</b> to your team pop up as soon as they arrive: accept, decline, or keep them for later under Trades.</li>
          <li><b>Editing players:</b> “✎ Edit player” on a player card changes his name, age, height, position, visible ratings, contract or injury – never his hidden potential. Anyone can edit in an offline league, only the commissioner online. Every edit goes to History → Edit log, which everyone in the league can see.</li>
        </ul>
      </Sec>
    </div>
  );
}
