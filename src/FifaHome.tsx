import { useEffect, useRef, useState } from 'react'
import { managerLevelProgress, type GameState, type Player } from './game'
import { tournamentForId } from './events'
import { PlayerPortrait } from './PlayerPortrait'
import { compareGameTime, formatGameDate, formatGameTime } from './calendar'
import { nextPlayerMatch, opponentForPlayerMatch } from './tournamentEngine'
import { currentCareerObjectives } from './progression'

type ModeKey = 'Play' | 'World' | 'Calendar' | 'Roster' | 'Scout' | 'Packs' | 'Finance' | 'Inbox' | 'Training' | 'Profile'

export function FifaHome({
  state,
  starters,
  unread,
  onOpen,
  onContinue,
}: {
  state: GameState
  starters: Player[]
  unread: number
  onOpen: (mode: ModeKey) => void
  onContinue: () => void
}) {
  const level = managerLevelProgress(state.managerXp)
  const hero = starters[0]
  const activeEvent = tournamentForId(state.activeEventId)
  const pendingDecision = state.pendingDecision
  const nextMatch = nextPlayerMatch(state.activeTournament)
  const matchDue = Boolean(nextMatch && compareGameTime(nextMatch.scheduledAt, state.now) <= 0)
  const opponent = opponentForPlayerMatch(state.activeTournament)
  const heroTarget: ModeKey = pendingDecision ? 'Inbox' : matchDue ? 'Play' : activeEvent ? 'Play' : 'World'
  const heroKicker = pendingDecision
    ? 'CLUB DECISION · ACTION REQUIRED'
    : matchDue && activeEvent
      ? 'LIVE EVENT · ' + activeEvent.city.toUpperCase()
      : activeEvent
        ? 'NEXT EVENT · ' + activeEvent.city.toUpperCase()
        : 'GLOBAL CIRCUIT'
  const heroTitle = pendingDecision
    ? pendingDecision.title
    : activeEvent
      ? activeEvent.name
      : 'SELECT EVENT'
  const heroMeta = pendingDecision
    ? pendingDecision.body
    : matchDue
      ? (nextMatch?.label ?? 'OFFICIAL MATCH') + ' · VS ' + (opponent?.name ?? 'OPPONENT')
      : activeEvent
        ? activeEvent.label + ' · ' + activeEvent.prize.toLocaleString('ru-RU') + ' PRIZE'
        : 'Choose the next competition from the global circuit.'
  const currentObjective = currentCareerObjectives(state, 1)[0] ?? null
  const [focusIndex, setFocusIndex] = useState(0)
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([])

  const moveFocus = (delta: number) => {
    const next = (focusIndex + delta + 6) % 6
    setFocusIndex(next)
    tileRefs.current[next]?.focus()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        moveFocus(1)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusIndex])

  const tileProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => { tileRefs.current[index] = node },
    tabIndex: focusIndex === index ? 0 : -1,
    onFocus: () => setFocusIndex(index),
  })

  return (
    <section className="fifa-home-screen template-home">
      <div className="template-home-status">
        <div className="card card-sm">
          <div className="card-body py-2">
            <div className="text-secondary small">CURRENT DATE</div>
            <div className="d-flex align-items-baseline gap-2">
              <strong>{formatGameDate(state.now)}</strong>
              <span className="badge bg-secondary-lt text-secondary">{formatGameTime(state.now)}</span>
              <span className="badge bg-orange-lt text-orange">WEEK {String(state.week).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <button
          className="card card-sm text-start template-continue-card"
          type="button"
          disabled={Boolean(pendingDecision || matchDue || state.seasonEnded)}
          onClick={onContinue}
        >
          <div className="card-body py-2">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-secondary small">CONTINUE</div>
                <strong>ПРОМОТАТЬ ВРЕМЯ</strong>
              </div>
              <span className="btn btn-orange btn-icon" aria-hidden="true">→</span>
            </div>
          </div>
        </button>

        <button className="card card-sm text-start template-manager-card" type="button" onClick={() => onOpen('Profile')}>
          <div className="card-body py-2">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-secondary small">MANAGER LVL {level.level}</span>
              <strong>{level.current}/{level.required} XP</strong>
            </div>
            <div className="progress progress-sm mb-1">
              <div className="progress-bar bg-orange" style={{ width: level.percent + '%' }} />
            </div>
            <div className="text-secondary small text-truncate">
              {currentObjective ? 'NEXT · ' + currentObjective.title : unread > 0 ? unread + ' unread club updates' : 'Career objectives are up to date'}
            </div>
          </div>
        </button>
      </div>

      <div className="fifa-mode-grid template-mode-grid">
        <button
          {...tileProps(0)}
          className="card fifa-mode-tile fifa-mode-hero text-start"
          onClick={() => onOpen(heroTarget)}
        >
          <div className="fifa-mode-art">
            {hero && <PlayerPortrait alias={hero.alias} playerId={hero.profileId} alt={hero.alias} loading="eager" />}
          </div>
          <div className="card-body d-flex flex-column justify-content-end template-tile-body">
            <span className="badge bg-orange text-orange-fg align-self-start mb-2">{heroKicker}</span>
            <h1 className="card-title mb-2">{heroTitle}</h1>
            <p className="card-text text-secondary mb-0">{heroMeta}</p>
          </div>
          <div className="card-footer d-flex align-items-center justify-content-between">
            <span className="text-secondary">Primary action</span>
            <span className="btn btn-orange btn-sm">OPEN →</span>
          </div>
        </button>

        <button
          {...tileProps(1)}
          className="card fifa-mode-tile fifa-world-tile text-start"
          onClick={() => onOpen('World')}
        >
          <div className="card-body d-flex flex-column template-tile-body">
            <span className="badge bg-azure-lt text-azure align-self-start mb-2">GLOBAL CIRCUIT</span>
            <h2 className="card-title">WORLD MAP</h2>
            <div className="list-group list-group-flush mt-auto">
              <div className="list-group-item px-0 bg-transparent d-flex justify-content-between">
                <span className="text-secondary">Status</span><strong>{activeEvent ? 'Registered' : 'Open'}</strong>
              </div>
              <div className="list-group-item px-0 bg-transparent d-flex justify-content-between">
                <span className="text-secondary">Next event</span><strong className="text-truncate ms-3">{activeEvent?.name ?? 'Choose event'}</strong>
              </div>
            </div>
          </div>
          <div className="card-footer">Browse circuit →</div>
        </button>

        <button {...tileProps(2)} className="card fifa-mode-tile fifa-squad-tile text-start" onClick={() => onOpen('Roster')}>
          <div className="card-body d-flex flex-column template-tile-body">
            <span className="badge bg-green-lt text-green align-self-start mb-2">CLUB</span>
            <h2 className="card-title">SQUAD</h2>
            <div className="avatar-list avatar-list-stacked mt-auto">
              {starters.slice(0, 5).map((player) => (
                <span className="avatar avatar-md bg-secondary-lt template-player-avatar" key={player.id}>
                  <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} />
                </span>
              ))}
            </div>
          </div>
          <div className="card-footer d-flex justify-content-between"><span>{starters.length}/5 starters</span><span>Manage →</span></div>
        </button>

        <button {...tileProps(3)} className="card fifa-mode-tile fifa-transfer-tile text-start" onClick={() => onOpen('Scout')}>
          <div className="card-body d-flex flex-column template-tile-body">
            <span className="badge bg-purple-lt text-purple align-self-start mb-2">MARKET</span>
            <h2 className="card-title">TRANSFERS</h2>
            <div className="mt-auto">
              <div className="text-secondary small">CLUB CASH</div>
              <div className="h2 mb-0">{state.credits.toLocaleString('ru-RU')}</div>
            </div>
          </div>
          <div className="card-footer">Scout market →</div>
        </button>

        <button {...tileProps(4)} className="card fifa-mode-tile fifa-packs-tile text-start" onClick={() => onOpen('Packs')}>
          <div className="card-body d-flex flex-column template-tile-body">
            <span className="badge bg-pink-lt text-pink align-self-start mb-2">COLLECTION</span>
            <h2 className="card-title">PACKS</h2>
            <div className="mt-auto">
              <div className="text-secondary small">PACK TOKENS</div>
              <div className="h2 mb-0">{state.packTokens.toLocaleString('ru-RU')}</div>
            </div>
          </div>
          <div className="card-footer">Open collection →</div>
        </button>

        <button {...tileProps(5)} className="card fifa-mode-tile fifa-practice-tile text-start" onClick={() => onOpen('Training')}>
          <div className="card-body d-flex flex-column template-tile-body">
            <span className="badge bg-yellow-lt text-yellow align-self-start mb-2">TRAINING GROUND</span>
            <h2 className="card-title">TRAINING</h2>
            <p className="card-text text-secondary mt-auto mb-0">План недели, scrim, map prep, recovery и развитие состава без фарма OVR.</p>
          </div>
          <div className="card-footer">Open training desk →</div>
        </button>
      </div>

      <div className="template-home-footer d-flex align-items-center justify-content-between">
        <div className="text-secondary small">ARROWS · NAVIGATE &nbsp; ENTER · SELECT</div>
        <div className="btn-list">
          <button type="button" className="btn btn-ghost-secondary btn-sm" onClick={() => onOpen('Finance')}>Finances</button>
          <button type="button" className="btn btn-ghost-secondary btn-sm" onClick={() => onOpen('Profile')}>Manager career</button>
        </div>
      </div>
    </section>
  )
}
