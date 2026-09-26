import { useEffect, useMemo, useState } from 'react'
import {
  chemistry,
  createInitialState,
  modeInfo,
  overall,
  playMatch,
  renewContract,
  restPlayer,
  scout,
  signProspect,
  teamRating,
  trainPlayer,
  type GameState,
  type MatchMode,
  type Player,
} from './game'

const SAVE_KEY = 'esport-ai-manager-v1'
type Tab = 'HQ' | 'Play' | 'Roster' | 'Scout' | 'Inbox' | 'AI Director'

const format = new Intl.NumberFormat('en-US')

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as GameState
    if (parsed.version !== 1) return createInitialState()
    return parsed
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

function PlayerCard({
  player,
  state,
  onTrain,
  onRest,
  onRenew,
}: {
  player: Player
  state: GameState
  onTrain: () => void
  onRest: () => void
  onRenew: () => void
}) {
  const expired = player.contractWeeks <= 2
  return (
    <article className="player-card">
      <div className="player-head">
        <div>
          <div className="eyebrow">{player.role} · {player.age} y.o.</div>
          <h3>{player.alias}</h3>
          <p>{player.firstName} · OVR {overall(player)} · POT {player.potential}</p>
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
        <span className={expired ? 'warning' : ''}>Contract {player.contractWeeks}w · {player.salary} cr/w</span>
        <button className="text-button" onClick={onRenew} disabled={state.credits < player.salary * 2}>
          Renew {player.salary * 2}
        </button>
      </div>

      <div className="card-actions">
        <button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 100}>Train · 100</button>
        <button className="secondary" onClick={onRest} disabled={state.staffEnergy < 1}>Rest</button>
      </div>
    </article>
  )
}

function App() {
  const [state, setState] = useState<GameState>(loadState)
  const [tab, setTab] = useState<Tab>('HQ')
  const rating = useMemo(() => teamRating(state.roster), [state.roster])
  const chem = useMemo(() => chemistry(state.roster), [state.roster])
  const last = state.history[0]

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  }, [state])

  const play = (mode: MatchMode) => {
    setState((current) => playMatch(current, mode))
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
          <Metric label="Week" value={state.week} />
          <Metric label="Credits" value={format.format(state.credits)} />
          <Metric label="Fans" value={format.format(state.fans)} />
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
            {item === 'Inbox' && <span className="badge">{Math.min(state.news.length, 9)}</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'HQ' && (
          <section className="screen">
            <div className="hero">
              <div>
                <div className="eyebrow">SEASON ZERO · WEEK {state.week}</div>
                <h1>Build a team that develops a story.</h1>
                <p>
                  Ratings, economy and match outcomes are deterministic. The narrative layer turns those
                  facts into personalities, pressure and consequences without deciding the result.
                </p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => setTab('Play')}>Play next match</button>
                  <button className="secondary" onClick={() => setTab('Roster')}>Manage roster</button>
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
              <Metric label="Staff actions" value={state.staffEnergy + '/2'} />
              <Metric label="Streak" value={state.streak === 0 ? '—' : (state.streak > 0 ? '+' : '') + state.streak} />
            </div>

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
                          <span>{map.map}</span>
                          <strong>{map.us}:{map.them}</strong>
                        </div>
                      ))}
                    </div>
                    <h3 className="story-title">{last.headline}</h3>
                    <p className="muted">{last.detail}</p>
                    <div className="reward-line">
                      <span>MVP {last.mvp}</span>
                      <span>+{last.reward} cr</span>
                      <span>+{last.fansDelta} fans</span>
                    </div>
                  </>
                ) : (
                  <p className="empty">Choose a match format. The same save and seed always produce reproducible simulation outcomes.</p>
                )}
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">MANAGER INBOX</div>
                    <h2>What needs attention</h2>
                  </div>
                  <button className="text-button" onClick={() => setTab('Inbox')}>Open all</button>
                </div>
                <div className="feed">
                  {state.news.slice(0, 4).map((item) => (
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
                <div className="eyebrow">MATCH CENTER</div>
                <h1>Choose the risk profile.</h1>
              </div>
              <p>Your current team rating is <b>{rating}</b>. Higher-risk formats accelerate reputation and economy.</p>
            </div>
            <div className="mode-grid">
              {(['scrim', 'showmatch', 'cup'] as MatchMode[]).map((mode) => (
                <article className="mode-card" key={mode}>
                  <span className={'risk risk-' + modeInfo[mode].risk.toLowerCase()}>{modeInfo[mode].risk} risk</span>
                  <h2>{modeInfo[mode].name}</h2>
                  <p>{modeInfo[mode].description}</p>
                  <div className="mode-meta">
                    <span>Deterministic seed</span>
                    <span>Best of 3</span>
                    <span>Procedural recap</span>
                  </div>
                  <button className="primary" onClick={() => play(mode)}>Simulate series</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'Roster' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">ROSTER · {state.roster.length}/7</div>
                <h1>Players are systems and characters.</h1>
              </div>
              <p>Two staff actions refresh after every match. Training targets the weakest skill; rest reduces fatigue.</p>
            </div>
            <div className="roster-grid">
              {[...state.roster].sort((a, b) => overall(b) - overall(a)).map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  state={state}
                  onTrain={() => setState((current) => trainPlayer(current, player.id))}
                  onRest={() => setState((current) => restPlayer(current, player.id))}
                  onRenew={() => setState((current) => renewContract(current, player.id))}
                />
              ))}
            </div>
          </section>
        )}

        {tab === 'Scout' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">SCOUTING INTELLIGENCE</div>
                <h1>Generate a market, not a loot box.</h1>
              </div>
              <button className="primary" disabled={state.credits < 300} onClick={() => setState((current) => scout(current))}>
                Scout 3 prospects · 300 cr
              </button>
            </div>
            <div className="callout">
              <strong>Design rule</strong>
              <span>Prospects are generated from your reputation and a seeded model. No paid random packs, no real-player likenesses, no skin economy.</span>
            </div>
            {state.prospects.length === 0 ? (
              <div className="empty-state">
                <span>SCOUTING DESK</span>
                <h2>No active report</h2>
                <p>Spend 300 credits to generate three fictional candidates. Better reputation raises the market floor.</p>
              </div>
            ) : (
              <div className="prospect-grid">
                {state.prospects.map((player) => {
                  const fee = player.salary * 3
                  return (
                    <article className="prospect-card" key={player.id}>
                      <div className="player-head">
                        <div>
                          <div className="eyebrow">{player.role} · {player.age} y.o.</div>
                          <h2>{player.alias}</h2>
                          <p>{player.firstName}</p>
                        </div>
                        <div className="ovr">{overall(player)}</div>
                      </div>
                      <p>{player.bio}</p>
                      <div className="scout-numbers">
                        <span>Potential <b>{player.potential}</b></span>
                        <span>Salary <b>{player.salary}</b></span>
                        <span>Sign fee <b>{fee}</b></span>
                      </div>
                      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                      <button
                        className="primary"
                        disabled={state.credits < fee || state.roster.length >= 7}
                        onClick={() => setState((current) => signProspect(current, player.id))}
                      >
                        Sign player · {fee} cr
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
                <div className="eyebrow">CLUB FEED</div>
                <h1>The season remembers what happened.</h1>
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
                <div className="eyebrow">AI-FIRST ARCHITECTURE</div>
                <h1>Generative on top. Deterministic underneath.</h1>
              </div>
            </div>
            <div className="architecture">
              <article>
                <span>01 · SOURCE OF TRUTH</span>
                <h2>Simulation engine</h2>
                <p>Seeded RNG owns ratings, match probability, map scores, rewards, fatigue, morale, contracts and progression. Replaying the same state is reproducible.</p>
                <code>state + action + seed → nextState</code>
              </article>
              <article>
                <span>02 · INTERPRETATION</span>
                <h2>Narrative director</h2>
                <p>The current MVP uses local procedural writing. A future LLM gateway can turn structured facts into press, rivalries, negotiations and scouting reports without changing game outcomes.</p>
                <code>facts → schema → narrative</code>
              </article>
              <article>
                <span>03 · MEMORY</span>
                <h2>Season history</h2>
                <p>Match results and events become compact memory. Future agents can reference real history instead of inventing canon.</p>
                <code>events → summaries → context</code>
              </article>
            </div>
            <div className="debug-panel">
              <div>
                <span>Seed</span><b>{state.seed}</b>
              </div>
              <div>
                <span>Team rating</span><b>{rating}</b>
              </div>
              <div>
                <span>Chemistry</span><b>{chem}</b>
              </div>
              <div>
                <span>Saved locally</span><b>Yes</b>
              </div>
            </div>
            <button className="danger-button" onClick={reset}>Reset save</button>
          </section>
        )}
      </main>

      <footer>
        <span>ESPORT AI Manager v0.1</span>
        <span>Original fictional universe · local save · no external AI key required</span>
      </footer>
    </div>
  )
}

export default App
