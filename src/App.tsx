import { useEffect, useMemo, useState } from 'react'
import {
  canPlayMatch,
  chemistry,
  createInitialState,
  getStartingFive,
  lineupWarnings,
  migrateState,
  modeInfo,
  overall,
  playMatch,
  releasePlayer,
  renewContract,
  restPlayer,
  scout,
  signProspect,
  tacticInfo,
  teamRating,
  toggleStarter,
  trainPlayer,
  weeklyPayroll,
  type GameState,
  type MatchMode,
  type Player,
  type TacticalPlan,
} from './game'
import { VRS_STATS, VRS_SNAPSHOT_DATE } from './vrs'
import { CARD_TIER_LABEL, PLAYER_PORTRAIT_STATS, cardTier, countryFlag, playerPhoto } from './playerVisuals'

const SAVE_KEY = 'esport-ai-manager-v2'
const LEGACY_SAVE_KEY = 'esport-ai-manager-v1'
type Tab = 'HQ' | 'Play' | 'Roster' | 'Scout' | 'Inbox' | 'AI Director'

const format = new Intl.NumberFormat('en-US')

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY)
    if (!raw) return createInitialState()
    return migrateState(JSON.parse(raw))
  } catch {
    return createInitialState()
  }
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={'metric ' + (accent ? 'metric-accent' : '')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PlayerVisualCard({ player, starter = false, compact = false }: { player: Player; starter?: boolean; compact?: boolean }) {
  const ovr = overall(player)
  const tier = cardTier(ovr)
  const photo = playerPhoto(player.alias)
  const initials = player.alias.slice(0, 3).toUpperCase()
  const role = player.role === 'Rifler' ? 'RIF' : player.role === 'Support' ? 'SUP' : player.role === 'Entry' ? 'ENT' : player.role

  return (
    <div className={'visual-player-card tier-' + tier + (starter ? ' is-starter' : '') + (compact ? ' compact' : '')}>
      <div className="visual-card-shine" />
      <div className="visual-card-top">
        <div>
          <strong>{ovr}</strong>
          <span>{role}</span>
        </div>
        {starter && <b className="starter-star">★</b>}
      </div>
      <div className="visual-country">{countryFlag(player.country)} <span>{player.country}</span></div>
      <div className="visual-photo">
        <div className="visual-monogram">{initials}</div>
        {photo && (
          <img
            src={photo}
            alt={player.realName + ' (' + player.alias + ')'}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
      </div>
      <div className="visual-identity">
        <strong>{player.alias}</strong>
        <span>{player.team}</span>
      </div>
      <div className="visual-stats">
        <span><b>{player.aim}</b>AIM</span>
        <span><b>{player.gameSense}</b>SEN</span>
        <span><b>{player.utility}</b>UTL</span>
        <span><b>{player.clutch}</b>CLU</span>
      </div>
      <div className="visual-rarity">{CARD_TIER_LABEL[tier]}</div>
    </div>
  )
}

function PlayerCard({
  player,
  state,
  isStarter,
  onTrain,
  onRest,
  onRenew,
  onToggleStarter,
  onRelease,
}: {
  player: Player
  state: GameState
  isStarter: boolean
  onTrain: () => void
  onRest: () => void
  onRenew: () => void
  onToggleStarter: () => void
  onRelease: () => void
}) {
  const expiring = player.contractWeeks <= 2
  const expired = player.contractWeeks <= 0
  const canStart = isStarter || (state.startingFive.length < 5 && !expired)

  return (
    <article className={'player-card ' + (isStarter ? 'player-card-starter' : '')}>
      <div className="player-head">
        <div>
          <div className="eyebrow">{player.country} · {player.team} · {player.role} · {isStarter ? 'STARTER' : 'BENCH'}</div>
          <h3>{player.alias}</h3>
          <p>{player.realName} · {player.age} y.o. · OVR {overall(player)} · POT {player.potential}</p>
        </div>
        <div className="ovr">{overall(player)}</div>
      </div>

      <div className="skill-grid">
        <span>AIM <b>{player.aim}</b></span>
        <span>SENSE <b>{player.gameSense}</b></span>
        <span>UTIL <b>{player.utility}</b></span>
        <span>CLUTCH <b>{player.clutch}</b></span>
      </div>

      <div className="bars">
        <label>Form <i><em style={{ width: player.form + '%' }} /></i><b>{player.form}</b></label>
        <label>Morale <i><em style={{ width: player.morale + '%' }} /></i><b>{player.morale}</b></label>
        <label>Fatigue <i className="danger"><em style={{ width: player.fatigue + '%' }} /></i><b>{player.fatigue}</b></label>
      </div>

      <p className="bio">{player.bio}</p>
      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>

      <div className="contract-row">
        <span className={expiring ? 'warning' : ''}>
          {expired ? 'CONTRACT EXPIRED' : 'Contract ' + player.contractWeeks + 'w'} · {player.salary} cr/week
        </span>
        <button className="text-button" onClick={onRenew} disabled={state.credits < player.salary * 4}>
          Extend {player.salary * 4}
        </button>
      </div>

      <div className="lineup-actions">
        <button className={isStarter ? 'secondary' : 'primary'} onClick={onToggleStarter} disabled={!canStart}>
          {isStarter ? 'Move to bench' : state.startingFive.length >= 5 ? 'Bench someone first' : 'Add to starting five'}
        </button>
        <button className="text-button release" onClick={onRelease} disabled={state.roster.length <= 5 || state.credits < player.salary}>
          Release · {player.salary}
        </button>
      </div>

      <div className="card-actions">
        <button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 120}>Train · 120</button>
        <button className="secondary" onClick={onRest} disabled={state.staffEnergy < 1}>Rest</button>
      </div>
    </article>
  )
}

function App() {
  const [state, setState] = useState<GameState>(loadState)
  const [tab, setTab] = useState<Tab>('HQ')
  const [tactic, setTactic] = useState<TacticalPlan>('balanced')
  const [seenNewsId, setSeenNewsId] = useState<string | null>(null)

  const starters = useMemo(() => getStartingFive(state.roster, state.startingFive), [state.roster, state.startingFive])
  const rating = useMemo(
    () => teamRating(state.roster, state.startingFive, state.lineupContinuity),
    [state.roster, state.startingFive, state.lineupContinuity],
  )
  const chem = useMemo(
    () => chemistry(state.roster, state.startingFive, state.lineupContinuity),
    [state.roster, state.startingFive, state.lineupContinuity],
  )
  const warnings = useMemo(() => lineupWarnings(state.roster, state.startingFive), [state.roster, state.startingFive])
  const payroll = useMemo(() => weeklyPayroll(state), [state])
  const last = state.history[0]
  const unread = seenNewsId === state.news[0]?.id ? 0 : Math.min(state.news.length, 9)

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  }, [state])

  const openTab = (next: Tab) => {
    setTab(next)
    if (next === 'Inbox') setSeenNewsId(state.news[0]?.id ?? null)
  }

  const play = (mode: MatchMode) => {
    const gate = canPlayMatch(state, mode)
    if (!gate.ok) return
    setState((current) => playMatch(current, mode, tactic))
    setTab('HQ')
  }

  const reset = () => {
    if (window.confirm('Reset the current save and start a new project?')) {
      const fresh = createInitialState()
      localStorage.setItem(SAVE_KEY, JSON.stringify(fresh))
      setState(fresh)
      setTab('HQ')
    }
  }

  const directorNotes = useMemo(() => {
    const notes: { level: 'urgent' | 'watch' | 'good'; title: string; body: string }[] = []
    const tired = starters.filter((p) => p.fatigue >= 65)
    const expiring = state.roster.filter((p) => p.contractWeeks <= 2)
    const runway = payroll > 0 ? state.credits / payroll : 99

    if (state.startingFive.length !== 5) {
      notes.push({ level: 'urgent', title: 'Lineup incomplete', body: 'You cannot play until exactly five contracted starters are selected.' })
    }
    if (expiring.length) {
      notes.push({ level: 'urgent', title: 'Contract risk', body: expiring.map((p) => p.alias).join(', ') + ' are within two weeks of expiry.' })
    }
    if (tired.length) {
      notes.push({ level: 'watch', title: 'Fatigue pressure', body: tired.map((p) => p.alias).join(', ') + ' are above 65 fatigue. Rest or bench them before a high-risk series.' })
    }
    if (runway < 3) {
      notes.push({ level: 'watch', title: 'Short cash runway', body: 'Current cash covers only ' + runway.toFixed(1) + ' payroll cycles before match income.' })
    }
    if (warnings.some((item) => item.startsWith('No IGL'))) {
      notes.push({ level: 'watch', title: 'No IGL in the five', body: 'The simulation applies a real rating penalty when the active lineup has no IGL.' })
    }
    if (warnings.some((item) => item.startsWith('No dedicated AWP'))) {
      notes.push({ level: 'watch', title: 'No AWP in the five', body: 'The active lineup is taking a map-control penalty without a dedicated AWP.' })
    }
    if (!notes.length) {
      notes.push({ level: 'good', title: 'Club is operational', body: 'The lineup is legal, contracts are stable and no immediate fatigue or cash warning is active.' })
    }
    return notes.slice(0, 4)
  }, [state, starters, payroll, warnings])

  const tabs: Tab[] = ['HQ', 'Play', 'Roster', 'Scout', 'Inbox', 'AI Director']

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <span>ESPORT</span>
            <strong>AI MANAGER</strong>
          </div>
        </div>
        <div className="top-stats">
          <Metric label="OVR" value={rating} accent />
          <Metric label="Record" value={state.wins + 'W ' + state.losses + 'L'} />
          <Metric label="Week" value={state.week + '/' + state.seasonLength} />
          <Metric label="Credits" value={format.format(state.credits)} />
          <Metric label="Payroll" value={format.format(payroll)} />
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => openTab(item)}>
            {item}
            {item === 'Inbox' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'HQ' && (
          <section className="screen">
            <div className="hero">
              <div>
                <div className="eyebrow">SEASON ZERO · WEEK {state.week}</div>
                <h1>Manage the club, not just the result.</h1>
                <p>
                  The starting five, fatigue, roles, contracts and weekly payroll now change what you can afford
                  and how strong the team is. Match income is not free money: every series advances the week.
                </p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => openTab('Play')}>Prepare next match</button>
                  <button className="secondary" onClick={() => openTab('Roster')}>Manage starting five</button>
                </div>
              </div>
              <div className="rating-orb">
                <span>TEAM</span>
                <strong>{rating}</strong>
                <small>{chem} chemistry</small>
              </div>
            </div>

            <div className="kpi-grid">
              <Metric label="Reputation" value={state.reputation + '/100'} />
              <Metric label="Season points" value={state.seasonPoints} />
              <Metric label="Staff actions" value={state.staffEnergy + '/3'} />
              <Metric label="Last week net" value={(state.lastWeekNet >= 0 ? '+' : '') + state.lastWeekNet + ' cr'} />
            </div>

            <div className="status-strip">
              <div><span>STARTING FIVE</span><b>{starters.map((p) => p.alias).join(' · ') || 'Incomplete'}</b></div>
              <div><span>CONTINUITY</span><b>{state.lineupContinuity}/100</b></div>
              <div><span>WEEKLY PAYROLL</span><b>{payroll} cr</b></div>
              <div><span>CUP</span><b>{state.wins >= 2 || state.reputation >= 45 ? 'UNLOCKED' : 'LOCKED'}</b></div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-stack">
                {warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}

            <div className="two-col">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">LATEST SERIES</div>
                    <h2>{last ? last.opponent : 'No matches yet'}</h2>
                  </div>
                  {last && <span className={last.won ? 'result win' : 'result loss'}>{last.won ? 'WIN' : 'LOSS'}</span>}
                </div>
                {last ? (
                  <>
                    <div className="map-row">
                      {last.maps.map((map) => (
                        <div key={map.map}>
                          <span>{map.map} · {map.winChance}%</span>
                          <strong>{map.us}:{map.them}</strong>
                        </div>
                      ))}
                    </div>
                    <h3 className="story-title">{last.headline}</h3>
                    <p className="muted">{last.detail}</p>
                    <div className="performance-row">
                      {last.performances.slice(0, 3).map((perf) => (
                        <span key={perf.playerId}>{perf.alias} <b>{perf.rating}</b></span>
                      ))}
                    </div>
                    <div className="reward-line">
                      <span>MVP {last.mvp}</span>
                      <span>Income +{last.reward}</span>
                      <span>Payroll -{last.payroll}</span>
                      <span>Net {last.net >= 0 ? '+' : ''}{last.net}</span>
                    </div>
                  </>
                ) : (
                  <p className="empty">Set your starting five and tactical plan, then play a BO3. The first result will show map probabilities, player performances and the actual weekly cashflow.</p>
                )}
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">MANAGER INBOX</div>
                    <h2>What changed</h2>
                  </div>
                  <button className="text-button" onClick={() => openTab('Inbox')}>Open all</button>
                </div>
                <div className="feed">
                  {state.news.slice(0, 5).map((item) => (
                    <div className="feed-item" key={item.id}>
                      <span>W{item.week}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}

        {tab === 'Play' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">MATCH CENTER · OVR {rating} · CHEM {chem}</div>
                <h1>Make a pre-match decision.</h1>
              </div>
              <p>Every match advances one week, pays the whole roster and burns starter contracts. Your current payroll is <b>{payroll} cr</b>.</p>
            </div>

            <div className="lineup-summary">
              <div>
                <span>ACTIVE FIVE</span>
                <strong>{starters.length === 5 ? starters.map((p) => p.alias).join(' · ') : starters.length + '/5 selected'}</strong>
              </div>
              <button className="secondary" onClick={() => openTab('Roster')}>Edit lineup</button>
            </div>

            {warnings.length > 0 && (
              <div className="warning-stack compact">
                {warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}

            <div className="tactic-grid">
              {(Object.keys(tacticInfo) as TacticalPlan[]).map((plan) => (
                <button key={plan} className={'tactic-card ' + (tactic === plan ? 'selected' : '')} onClick={() => setTactic(plan)}>
                  <span>{tacticInfo[plan].name}</span>
                  <small>{tacticInfo[plan].description}</small>
                </button>
              ))}
            </div>

            <div className="mode-grid">
              {(['scrim', 'showmatch', 'cup'] as MatchMode[]).map((mode) => {
                const gate = canPlayMatch(state, mode)
                return (
                  <article className="mode-card" key={mode}>
                    <span className={'risk risk-' + modeInfo[mode].risk.toLowerCase()}>{modeInfo[mode].risk} risk</span>
                    <h2>{modeInfo[mode].name}</h2>
                    <p>{modeInfo[mode].description}</p>
                    <div className="mode-meta">
                      <span>Best of 3 · map-to-map momentum</span>
                      <span>Roles + condition + continuity matter</span>
                      <span>Income is settled against payroll</span>
                    </div>
                    {!gate.ok && <div className="gate-reason">{gate.reason}</div>}
                    <button className="primary" disabled={!gate.ok} onClick={() => play(mode)}>
                      Play with {tacticInfo[tactic].name} plan
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {tab === 'Roster' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">ROSTER · {state.roster.length}/8 · STARTERS {state.startingFive.length}/5</div>
                <h1>The bench now has a purpose.</h1>
              </div>
              <p>Bench tired players, protect contracts, maintain role coverage and control payroll. Lineup changes reduce continuity temporarily.</p>
            </div>

            <div className="lineup-card-grid">
              {[...state.roster]
                .sort((a, b) => Number(state.startingFive.includes(b.id)) - Number(state.startingFive.includes(a.id)) || overall(b) - overall(a))
                .map((player) => (
                  <PlayerVisualCard
                    key={'visual-' + player.id}
                    player={player}
                    starter={state.startingFive.includes(player.id)}
                  />
                ))}
            </div>

            <div className="roster-toolbar">
              <Metric label="Team OVR" value={rating} accent />
              <Metric label="Chemistry" value={chem} />
              <Metric label="Continuity" value={state.lineupContinuity} />
              <Metric label="Payroll" value={payroll + ' cr/w'} />
              <Metric label="Staff actions" value={state.staffEnergy + '/3'} />
            </div>

            <div className="roster-grid">
              {[...state.roster]
                .sort((a, b) => Number(state.startingFive.includes(b.id)) - Number(state.startingFive.includes(a.id)) || overall(b) - overall(a))
                .map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    state={state}
                    isStarter={state.startingFive.includes(player.id)}
                    onTrain={() => setState((current) => trainPlayer(current, player.id))}
                    onRest={() => setState((current) => restPlayer(current, player.id))}
                    onRenew={() => setState((current) => renewContract(current, player.id))}
                    onToggleStarter={() => setState((current) => toggleStarter(current, player.id))}
                    onRelease={() => setState((current) => releasePlayer(current, player.id))}
                  />
                ))}
            </div>
          </section>
        )}

        {tab === 'Scout' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">SCOUTING · ROSTER {state.roster.length}/8</div>
                <h1>Recruit for a reason.</h1>
              </div>
              <button className="primary" disabled={state.credits < 300} onClick={() => setState((current) => scout(current))}>
                Scout 3 prospects · 300 cr
              </button>
            </div>
            <div className="callout">
              <strong>Economy rule</strong>
              <span>A signing has two costs: an up-front fee and a weekly salary. Extra depth can solve fatigue and role problems, but bloated rosters reduce cash runway.</span>
            </div>
            {state.prospects.length === 0 ? (
              <div className="empty-state">
                <span>SCOUTING DESK</span>
                <h2>No active report</h2>
                <p>Spend 300 credits to draw three deterministic candidates from {format.format(VRS_STATS.players)} real CS2 aliases across {format.format(VRS_STATS.teams)} teams in the Valve VRS snapshot ({VRS_SNAPSHOT_DATE}). The portrait layer currently resolves {format.format(PLAYER_PORTRAIT_STATS.coveredPlayers)} real HLTV CDN bodyshots; unmatched aliases keep the card fallback. Reputation raises the gameplay-rating floor.</p>
              </div>
            ) : (
              <div className="prospect-grid">
                {state.prospects.map((player) => {
                  const fee = player.salary * 3
                  return (
                    <article className="prospect-card" key={player.id}>
                      <PlayerVisualCard player={player} compact />
                      <div className="prospect-identity-line">
                        <span>{player.realName !== player.alias ? player.realName : 'Identity metadata pending'}</span>
                        <span>{player.age > 0 ? player.age + ' y.o.' : 'age unknown'}</span>
                      </div>
                      <p>{player.bio}</p>
                      <div className="scout-numbers">
                        <span>Potential <b>{player.potential}</b></span>
                        <span>Salary <b>{player.salary}/w</b></span>
                        <span>Sign fee <b>{fee}</b></span>
                      </div>
                      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                      <button
                        className="primary"
                        disabled={state.credits < fee || state.roster.length >= 8}
                        onClick={() => setState((current) => signProspect(current, player.id))}
                      >
                        Sign to bench · {fee} cr
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {tab === 'Inbox' && (
          <section className="screen narrow">
            <div className="section-title">
              <div>
                <div className="eyebrow">CLUB FEED · {state.news.length} EVENTS</div>
                <h1>The season records consequences.</h1>
              </div>
            </div>
            <div className="timeline">
              {state.news.map((item) => (
                <article key={item.id}>
                  <div className="timeline-marker">{item.kind.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <span>Week {item.week} · {item.kind}</span>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'AI Director' && (
          <section className="screen narrow">
            <div className="section-title">
              <div>
                <div className="eyebrow">LOCAL DIRECTOR · LIVE STATE ANALYSIS</div>
                <h1>Useful now, LLM-ready later.</h1>
              </div>
            </div>

            <div className="director-grid">
              {directorNotes.map((note) => (
                <article className={'director-note ' + note.level} key={note.title}>
                  <span>{note.level}</span>
                  <h2>{note.title}</h2>
                  <p>{note.body}</p>
                </article>
              ))}
            </div>

            <div className="architecture">
              <article>
                <span>01 · CANONICAL STATE</span>
                <h2>Simulation owns the truth</h2>
                <p>Starting five, contracts, payroll, fatigue, map probability, performances and rewards are deterministic state transitions.</p>
                <code>state + lineup + tactic + mode + seed → nextState</code>
              </article>
              <article>
                <span>02 · DIRECTOR TODAY</span>
                <h2>Rule-based decision support</h2>
                <p>This screen now reads the actual save and flags contract, fatigue, role and cash risks. It is functional without pretending an LLM is connected.</p>
                <code>canonical facts → actionable warnings</code>
              </article>
              <article>
                <span>03 · LLM BOUNDARY</span>
                <h2>Generation stays presentation-only</h2>
                <p>A future gateway can rewrite these facts into negotiations, media and rivalries, but it should never decide match outcomes or transactions.</p>
                <code>facts → validated schema → narrative</code>
              </article>
            </div>

            <div className="debug-panel">
              <div><span>Seed</span><b>{state.seed}</b></div>
              <div><span>Team rating</span><b>{rating}</b></div>
              <div><span>Chemistry</span><b>{chem}</b></div>
              <div><span>Payroll</span><b>{payroll}</b></div>
            </div>
            <button className="danger-button" onClick={reset}>Reset save</button>
          </section>
        )}
      </main>

      <footer>
        <span>ESPORT AI Manager v0.2 playable core</span>
        <span>Fictional universe · versioned local save · deterministic simulation</span>
      </footer>
    </div>
  )
}

export default App
