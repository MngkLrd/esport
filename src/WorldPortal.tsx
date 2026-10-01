import { useMemo, useState } from 'react'
import type { GameState, NewsItem } from './game'
import type { WorldHistoryEvent, WorldHistoryKind } from './worldEcology'
import { snapshotWorldEcology } from './worldEcologyAnalytics'

export type WorldPortalTarget = 'World' | 'Roster' | 'Scout' | 'Profile'

interface WorldPortalProps {
  state: GameState
  onResolveDecision: (choice: 'a' | 'b') => void
  onNavigate: (target: WorldPortalTarget) => void
  onReset: () => void
}

type FeedFilter = 'all' | 'competition' | 'market' | 'ecosystem'

const FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'competition', label: 'COMPETITION' },
  { id: 'market', label: 'MARKET' },
  { id: 'ecosystem', label: 'ECOSYSTEM' },
]

const COMPETITION_KINDS = new Set<WorldHistoryKind>(['tournament-created', 'tournament-completed'])
const MARKET_KINDS = new Set<WorldHistoryKind>(['transfer-offer', 'transfer-completed', 'contract-expired'])
const ECOSYSTEM_KINDS = new Set<WorldHistoryKind>([
  'player-generated',
  'player-retired',
  'team-founded',
  'team-dissolved',
  'operator-founded',
  'operator-dissolved',
  'economic-shock',
])

const filterEvent = (event: WorldHistoryEvent, filter: FeedFilter) =>
  filter === 'all' ||
  (filter === 'competition' && COMPETITION_KINDS.has(event.kind)) ||
  (filter === 'market' && MARKET_KINDS.has(event.kind)) ||
  (filter === 'ecosystem' && ECOSYSTEM_KINDS.has(event.kind))

const eventLabel = (kind: WorldHistoryKind) => {
  if (COMPETITION_KINDS.has(kind)) return 'COMPETITION'
  if (MARKET_KINDS.has(kind)) return 'MARKET'
  return 'WORLD'
}

const eventTone = (kind: WorldHistoryKind) => {
  if (kind === 'tournament-completed') return 'major'
  if (kind === 'transfer-completed') return 'market'
  if (kind === 'team-dissolved' || kind === 'operator-dissolved' || kind === 'economic-shock') return 'danger'
  if (kind === 'team-founded' || kind === 'operator-founded' || kind === 'player-generated') return 'growth'
  return 'neutral'
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value.endsWith('Z') ? value : value + 'Z'))
    .toUpperCase()

const newsTarget = (item: NewsItem): WorldPortalTarget | null =>
  item.kind === 'contract' || item.kind === 'lineup'
    ? 'Roster'
    : item.kind === 'scout'
      ? 'Scout'
      : item.kind === 'finance'
        ? 'Profile'
        : item.kind === 'match' || item.kind === 'media'
          ? 'World'
          : null

export function WorldPortal({ state, onResolveDecision, onNavigate, onReset }: WorldPortalProps) {
  const [filter, setFilter] = useState<FeedFilter>('all')
  const ecology = state.world.ecology
  const snapshot = useMemo(() => snapshotWorldEcology(state.world, state.now), [state.world, state.now])
  const worldEvents = useMemo(
    () => [...(ecology?.history ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.importance - a.importance),
    [ecology?.history],
  )
  const filtered = useMemo(() => worldEvents.filter((event) => filterEvent(event, filter)).slice(0, 60), [worldEvents, filter])
  const hero = useMemo(
    () => worldEvents
      .filter((event) => event.importance >= 45)
      .sort((a, b) => b.importance - a.importance || b.at.localeCompare(a.at))[0] ?? worldEvents[0] ?? null,
    [worldEvents],
  )
  const upcoming = useMemo(
    () => Object.values(ecology?.competitions ?? {})
      .filter((competition) => competition.status === 'announced' || competition.status === 'running')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5),
    [ecology?.competitions],
  )
  const standings = useMemo(
    () => state.world.teams
      .filter((team) => team.active !== false)
      .sort((a, b) => a.vrsRank - b.vrsRank)
      .slice(0, 8),
    [state.world.teams],
  )

  return (
    <section className="world-portal">
      <header className="world-portal-head">
        <div>
          <span>WORLD INTELLIGENCE · {formatDate(state.now)}</span>
          <h1>PORTAL</h1>
        </div>
        <div className="world-portal-health">
          <span><b>{snapshot.activeTeams}</b> ACTIVE TEAMS</span>
          <span><b>{snapshot.activePlayers}</b> PLAYERS</span>
          <span><b>{snapshot.activeOperators}</b> OPERATORS</span>
          <span><b>{snapshot.activeEvents}</b> LIVE / UPCOMING</span>
        </div>
      </header>

      {state.pendingDecision && (
        <article className={'sim-decision-card decision-' + state.pendingDecision.kind + ' world-portal-decision'}>
          <span>DECISION REQUIRED · YOUR CLUB</span>
          <h2>{state.pendingDecision.title}</h2>
          <p>{state.pendingDecision.body}</p>
          <div>
            <button onClick={() => onResolveDecision('a')}>{state.pendingDecision.optionA}</button>
            <button onClick={() => onResolveDecision('b')}>{state.pendingDecision.optionB}</button>
          </div>
        </article>
      )}

      <div className="world-portal-grid">
        <aside className="world-portal-club">
          <div className="world-portal-section-title"><span>YOUR CLUB</span><b>{state.news.length} ITEMS</b></div>
          <div className="world-portal-club-feed">
            {state.news.slice(0, 14).map((item) => {
              const target = newsTarget(item)
              return (
                <article key={item.id}>
                  <span>W{item.week} · {item.kind.toUpperCase()}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  {target && <button onClick={() => onNavigate(target)}>OPEN <b>→</b></button>}
                </article>
              )
            })}
            {state.news.length === 0 && <div className="world-portal-empty">No club messages.</div>}
          </div>
        </aside>

        <main className="world-portal-main">
          {hero && (
            <article className={'world-portal-hero tone-' + eventTone(hero.kind)}>
              <div className="world-portal-hero-meta">
                <span>{eventLabel(hero.kind)} · {formatDate(hero.at)}</span>
                <b>IMPORTANCE {hero.importance}</b>
              </div>
              <h2>{hero.title}</h2>
              <p>{hero.detail}</p>
              <div className="world-portal-cause">
                <span>CAUSAL RECORD</span>
                <strong>{hero.causes.slice(0, 3).join(' · ')}</strong>
              </div>
            </article>
          )}

          <div className="world-portal-feed-head">
            <div>
              <span>WORLD FEED</span>
              <b>{filtered.length} VISIBLE</b>
            </div>
            <nav aria-label="World feed filters">
              {FILTERS.map((entry) => (
                <button key={entry.id} className={filter === entry.id ? 'active' : ''} onClick={() => setFilter(entry.id)}>
                  {entry.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="world-portal-feed">
            {filtered.map((event) => (
              <article key={event.id} className={'tone-' + eventTone(event.kind)}>
                <div className="world-portal-feed-marker" />
                <div>
                  <span>{formatDate(event.at)} · {eventLabel(event.kind)} · IMP {event.importance}</span>
                  <h3>{event.title}</h3>
                  <p>{event.detail}</p>
                  <small>CAUSE · {event.causes.slice(0, 2).join(' · ')}</small>
                </div>
              </article>
            ))}
            {filtered.length === 0 && <div className="world-portal-empty">The world ledger has no events for this filter yet.</div>}
          </div>
        </main>

        <aside className="world-portal-context">
          <section>
            <div className="world-portal-section-title"><span>CIRCUIT</span><b>{upcoming.length}</b></div>
            <div className="world-portal-events">
              {upcoming.map((competition) => (
                <article key={competition.id}>
                  <span>T{competition.tier} · {competition.region} · {competition.format}</span>
                  <strong>{competition.name}</strong>
                  <small>{competition.status.toUpperCase()} · {formatDate(competition.startsAt)}</small>
                  <b>{competition.prizePool.toLocaleString('en-US')} PRIZE</b>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="world-portal-section-title"><span>VRS</span><b>TOP 8</b></div>
            <div className="world-portal-standings">
              {standings.map((team) => (
                <div key={team.id}>
                  <b>{team.vrsRank}</b>
                  <span>{team.name}</span>
                  <strong>{Math.round(team.vrsPoints)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="world-portal-economy">
            <div className="world-portal-section-title"><span>WORLD HEALTH</span><b>LIVE</b></div>
            <div><span>SPONSOR LIQUIDITY</span><b>{Math.round(snapshot.sponsorLiquidity)}</b></div>
            <div><span>AUDIENCE DEMAND</span><b>{Math.round(snapshot.audienceDemand)}</b></div>
            <div><span>FREE PLAYERS</span><b>{snapshot.freePlayers}</b></div>
            <div><span>365D TRANSFERS</span><b>{snapshot.transfersLast365Days}</b></div>
            <div><span>NEW / RETIRED</span><b>{snapshot.generatedLast365Days} / {snapshot.retiredLast365Days}</b></div>
          </section>

          <button className="world-portal-reset" onClick={onReset}>RESET SAVE</button>
        </aside>
      </div>
    </section>
  )
}
