import { useEffect, useRef, useState } from 'react'
import { managerLevelProgress, type GameState, type Player } from './game'
import { tournamentForId } from './events'
import { PlayerPortrait } from './PlayerPortrait'
import { compareGameTime } from './calendar'
import { nextPlayerMatch, opponentForPlayerMatch } from './tournamentEngine'
import { currentCareerObjectives } from './progression'
import HorizonCard from './horizon/Card'
import homeHero from './assets/ui/home-hero-arena.jpg'
import worldMap from './assets/ui/world-map-background.jpg'
import squadRoom from './assets/ui/squad-room-hq.jpg'
import packsArena from './assets/ui/packs-arena.jpg'
import packsShowcase from './assets/ui/packs-showcase-hq.jpg'
import practiceGround from './assets/ui/practice-ground-hq.jpg'

type ModeKey = 'Play' | 'World' | 'Calendar' | 'Roster' | 'Scout' | 'Packs' | 'Finance' | 'Inbox' | 'Training' | 'Profile'

function Tile({
  title,
  kicker,
  image,
  children,
  onClick,
  className = '',
  tileRef,
  tabIndex,
  onFocus,
}: {
  title: string
  kicker: string
  image: string
  children?: React.ReactNode
  onClick: () => void
  className?: string
  tileRef: (node: HTMLButtonElement | null) => void
  tabIndex: number
  onFocus: () => void
}) {
  return (
    <button
      ref={tileRef}
      tabIndex={tabIndex}
      onFocus={onFocus}
      type="button"
      onClick={onClick}
      className={'text-left ' + className}
    >
      <HorizonCard extra="h-full w-full !p-4">
        <div className="h-full w-full">
          <div className="relative h-full w-full overflow-hidden rounded-xl">
            <img src={image} className="absolute inset-0 h-full w-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-sm font-medium text-gray-300">{kicker}</p>
              <p className="mt-1 text-2xl font-bold text-white">{title}</p>
              {children}
            </div>
          </div>
        </div>
      </HorizonCard>
    </button>
  )
}

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
    tileRef: (node: HTMLButtonElement | null) => { tileRefs.current[index] = node },
    tabIndex: focusIndex === index ? 0 : -1,
    onFocus: () => setFocusIndex(index),
  })

  return (
    <div className="mt-3 h-[calc(100vh-120px)] overflow-auto pr-1">
      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <HorizonCard extra="px-6 py-4">
          <p className="text-sm font-medium text-gray-600">Manager Level</p>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-2xl font-bold text-navy-700 dark:text-white">LVL {level.level}</p>
            <p className="text-sm font-bold text-brand-500">{level.current}/{level.required} XP</p>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-navy-700">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: level.percent + '%' }} />
          </div>
          <p className="mt-2 truncate text-xs font-medium text-gray-600">{currentObjective ? currentObjective.title : 'Career objectives are up to date'}</p>
        </HorizonCard>

        <button type="button" onClick={onContinue} disabled={Boolean(pendingDecision || matchDue || state.seasonEnded)} className="text-left disabled:opacity-40">
          <HorizonCard extra="h-full px-6 py-4">
            <p className="text-sm font-medium text-gray-600">Continue</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xl font-bold text-navy-700 dark:text-white">ПРОМОТАТЬ ВРЕМЯ</p>
              <span className="linear rounded-[20px] bg-brand-900 px-4 py-2 text-base font-medium text-white dark:bg-brand-400">→</span>
            </div>
          </HorizonCard>
        </button>

        <button type="button" onClick={() => onOpen('Inbox')} className="text-left">
          <HorizonCard extra="h-full px-6 py-4">
            <p className="text-sm font-medium text-gray-600">Club Inbox</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-2xl font-bold text-navy-700 dark:text-white">{unread} NEW</p>
              <span className="rounded-full bg-brand-500 px-3 py-1 text-sm font-bold text-white">OPEN</span>
            </div>
          </HorizonCard>
        </button>
      </div>

      <div className="grid min-h-[650px] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
        <Tile
          {...tileProps(0)}
          title={heroTitle}
          kicker={heroKicker}
          image={homeHero}
          onClick={() => onOpen(heroTarget)}
          className="xl:row-span-2"
        >
          <p className="mt-3 max-w-[34rem] text-sm font-medium text-gray-300">{heroMeta}</p>
          {hero && (
            <div className="mt-4 flex items-center gap-3">
              <span className="h-12 w-12 overflow-hidden rounded-full border-2 border-white/40 bg-white/10">
                <PlayerPortrait alias={hero.alias} playerId={hero.profileId} alt={hero.alias} loading="eager" />
              </span>
              <span>
                <span className="block text-sm font-bold text-white">{hero.alias}</span>
                <span className="block text-xs font-medium text-gray-300">{hero.role}</span>
              </span>
            </div>
          )}
        </Tile>

        <Tile {...tileProps(1)} title="WORLD MAP" kicker="GLOBAL CIRCUIT" image={worldMap} onClick={() => onOpen('World')}>
          <p className="mt-2 text-sm font-medium text-gray-300">{activeEvent ? activeEvent.name : 'Browse tournaments and global standings'}</p>
        </Tile>

        <Tile {...tileProps(2)} title="SQUAD" kicker="CLUB" image={squadRoom} onClick={() => onOpen('Roster')}>
          <div className="mt-3 flex flex-row-reverse justify-end">
            {starters.slice(0, 5).map((player) => (
              <span key={player.id} className="-mr-3 h-9 w-9 overflow-hidden rounded-full border-2 border-white dark:!border-navy-800">
                <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} />
              </span>
            ))}
          </div>
        </Tile>

        <Tile {...tileProps(3)} title="TRANSFERS" kicker="MARKET" image={packsArena} onClick={() => onOpen('Scout')}>
          <p className="mt-2 text-sm font-bold text-white">{state.credits.toLocaleString('ru-RU')} <span className="font-medium text-gray-300">CLUB CASH</span></p>
        </Tile>

        <Tile {...tileProps(4)} title="PACKS" kicker="COLLECTION" image={packsShowcase} onClick={() => onOpen('Packs')}>
          <p className="mt-2 text-sm font-bold text-white">{state.packTokens.toLocaleString('ru-RU')} <span className="font-medium text-gray-300">PACK TOKENS</span></p>
        </Tile>

        <Tile
          {...tileProps(5)}
          title="TRAINING"
          kicker="TRAINING GROUND"
          image={practiceGround}
          onClick={() => onOpen('Training')}
          className="xl:col-span-2"
        >
          <p className="mt-2 max-w-[34rem] text-sm font-medium text-gray-300">План недели, scrim, map prep, recovery и развитие состава без фарма OVR.</p>
        </Tile>
      </div>
    </div>
  )
}
