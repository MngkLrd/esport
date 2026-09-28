import { useEffect, useRef, useState } from 'react'
import { managerLevelProgress, type GameState, type Player } from './game'
import { tournamentForId } from './events'
import { PlayerPortrait } from './PlayerPortrait'
import { compareGameTime, formatGameDate, formatGameTime } from './calendar'
import { nextPlayerMatch, opponentForPlayerMatch } from './tournamentEngine'

type ModeKey = 'Play' | 'World' | 'Calendar' | 'Roster' | 'Scout' | 'Packs' | 'Inbox' | 'Training'

export function FifaHome({
  state,
  starters,
  unread,
  onOpen,
}: {
  state: GameState
  starters: Player[]
  unread: number
  onOpen: (mode: ModeKey) => void
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
    : matchDue
      ? 'CURRENT MATCH · TIME LOCKED'
      : activeEvent
        ? 'NEXT EVENT · ' + activeEvent.city.toUpperCase()
        : 'GLOBAL CIRCUIT'
  const heroTitle = pendingDecision
    ? pendingDecision.title
    : matchDue
      ? 'YOUR CLUB vs ' + (opponent?.name ?? 'OPPONENT')
      : activeEvent
        ? activeEvent.name
        : 'SELECT EVENT'
  const heroMeta = pendingDecision
    ? pendingDecision.body
    : matchDue
      ? (nextMatch?.label ?? 'OFFICIAL MATCH') + ' · PLAY TO CONTINUE TIME'
      : activeEvent
        ? activeEvent.label + ' · ' + activeEvent.prize.toLocaleString('ru-RU') + ' PRIZE'
        : null
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
    <section className="fifa-home-screen">
      <div className="fifa-home-status">
        <div>
          <span>{formatGameDate(state.now)}</span>
          <strong>{formatGameTime(state.now)} · WEEK {String(state.week).padStart(2, '0')}</strong>
        </div>
        <div className="fifa-level-strip">
          <span>MANAGER LVL {level.level}</span>
          <i><em style={{ width: level.percent + '%' }} /></i>
          <b>{level.current}/{level.required} XP</b>
        </div>
      </div>

      <div className="fifa-mode-grid">
        <button
          {...tileProps(0)}
          className="fifa-mode-tile fifa-mode-hero"
          onClick={() => onOpen(heroTarget)}
        >
          <div className="fifa-mode-art">
            {hero && <PlayerPortrait alias={hero.alias} playerId={hero.profileId} alt={hero.alias} loading="eager" />}
          </div>
          <div className="fifa-mode-copy">
            <span>{heroKicker}</span>
            <h1>{heroTitle}</h1>
            {heroMeta && <p>{heroMeta}</p>}
          </div>
          <b className="fifa-mode-arrow">→</b>
        </button>

        <button {...tileProps(1)} className="fifa-mode-tile fifa-world-tile" onClick={() => onOpen('World')}>
          <div className="fifa-tile-kicker">GLOBAL CIRCUIT</div>
          <h2>WORLD MAP</h2>
          <div className="fifa-mini-map">
            <i className="pin p1" /><i className="pin p2" /><i className="pin p3" /><i className="pin p4" />
          </div>
        </button>

        <button {...tileProps(2)} className="fifa-mode-tile fifa-squad-tile" onClick={() => onOpen('Roster')}>
          <div className="fifa-tile-kicker">CLUB</div>
          <h2>SQUAD</h2>
          <div className="fifa-mini-lineup">
            {starters.slice(0, 5).map((player) => (
              <span key={player.id}>
                <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} />
              </span>
            ))}
          </div>
        </button>

        <button {...tileProps(3)} className="fifa-mode-tile fifa-transfer-tile" onClick={() => onOpen('Scout')}>
          <div className="fifa-tile-kicker">MARKET</div>
          <h2>TRANSFERS</h2>
          <strong>{state.credits.toLocaleString('ru-RU')} <small>CLUB CASH</small></strong>
        </button>

        <button {...tileProps(4)} className="fifa-mode-tile fifa-packs-tile" onClick={() => onOpen('Packs')}>
          <div className="fifa-tile-kicker">COLLECTION</div>
          <h2>PACKS</h2>
          <strong>{state.packTokens.toLocaleString('ru-RU')} <small>PACK TOKENS</small></strong>
        </button>

        <button {...tileProps(5)} className="fifa-mode-tile fifa-practice-tile" onClick={() => onOpen('Training')}>
          <div className="fifa-tile-kicker">TRAINING GROUND</div>
          <h2>PRACTICE</h2>
          <p>0 CASH · 0 VRS · +1 сыгранность. Отдельная тренировочная комната, не Matchday.</p>
        </button>
      </div>

      <div className="fifa-home-hints">
        <span><b>← → ↑ ↓</b> НАВИГАЦИЯ</span>
        <span><b>ENTER</b> ВЫБРАТЬ</span>
      </div>
    </section>
  )
}
