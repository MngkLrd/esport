import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeTournamentMatch,
  canPlayMatch,
  chemistry,
  getStartingFive,
  lineupWarnings,
  managerLevelProgress,
  modeInfo,
  overall,
  releasePlayer,
  renewContract,
  restPlayer,
  teamRating,
  toggleStarter,
  trainPlayer,
  weeklyPayroll,
  type GameState,
  type MatchMode,
  type MatchResult,
  type Player,
  type TacticalPlan,
} from './game'
import { PLAYER_PORTRAIT_STATS, cardTier, countryFlag } from './playerVisuals'
import {
  clearPackCollection,
  type PackRoll,
} from './packState'
import { createBrowserSaveRepository } from './saveRepository'
import { rollWelcomePack } from './welcomePack'
import { PlayerPortrait } from './PlayerPortrait'
import { MatchRadar } from './MatchRadar'
import { MatchLobby, type LobbyVetoAction } from './MatchLobby'
import { RosterBoard } from './RosterBoard'
import { tournamentForId, tournamentMode } from './events'
import { addGameDays, compareGameTime, formatGameDate, formatGameTime } from './calendar'
import { opponentForPlayerMatch, type TournamentRosterPlayer } from './tournamentEngine'
import { ScoutMarket } from './ScoutMarket'
import { FifaHome } from './FifaHome'
import { WorldMap } from './WorldMap'
import { ManagerProfile } from './ManagerProfile'
import { TournamentHub } from './TournamentHub'
import { SeasonCalendar } from './SeasonCalendar'
import { rollPack } from './packs'
import { PacksView } from './PacksView'
import { executeGameCommand } from './gameCommands'
import type { PackCard } from './packState'
import { CollectiblePlayerCard, tierForPackRarity } from './CollectiblePlayerCard'
import { metadataForAlias } from './playerMetadata'
import { careerObjectives, completedCareerObjectiveIds, onboardingStep } from './progression'

const CardDetails = lazy(() => import('./CardDetails').then((module) => ({ default: module.CardDetails })))

const saveRepository = createBrowserSaveRepository()
type Tab = 'HQ' | 'World' | 'Calendar' | 'Play' | 'Training' | 'Roster' | 'Packs' | 'Scout' | 'Inbox' | 'Profile'

const TAB_LABELS: Record<Tab, string> = {
  HQ: 'HOME',
  World: 'WORLD MAP',
  Calendar: 'CALENDAR',
  Play: 'MATCHDAY',
  Training: 'PRACTICE',
  Roster: 'SQUAD',
  Packs: 'PACKS',
  Scout: 'TRANSFERS',
  Inbox: 'NEWS',
  Profile: 'PROFILE',
}

const SCREEN_TITLES: Record<Tab, string> = {
  HQ: 'HOME',
  World: 'WORLD CIRCUIT',
  Calendar: 'CALENDAR',
  Play: 'MATCHDAY',
  Training: 'PRACTICE',
  Roster: 'SQUAD',
  Packs: 'PACK STORE',
  Scout: 'BUILD YOUR SHORTLIST',
  Inbox: 'INBOX',
  Profile: 'MANAGER LEVEL',
}

const ROLE_LABELS: Record<Player['role'], string> = {
  IGL: 'IGL',
  Entry: 'Энтри',
  Rifler: 'Рифлер',
  AWP: 'AWP',
  Support: 'Саппорт',
}

const NEWS_KIND_LABELS: Record<GameState['news'][number]['kind'], string> = {
  match: 'матч',
  media: 'медиа',
  contract: 'контракт',
  scout: 'скаутинг',
  finance: 'финансы',
  lineup: 'состав',
}

const RISK_LABELS: Record<string, string> = {
  Low: 'Низкий',
  Medium: 'Средний',
  High: 'Высокий',
}

const format = new Intl.NumberFormat('ru-RU')

type TimeAdvanceTransition = {
  from: string
  to: string
  frames: string[]
  index: number
  nextState: GameState
  label: string
}

const buildTimeAdvanceFrames = (from: string, to: string) => {
  if (compareGameTime(to, from) <= 0) return [from]

  const frames = [from]
  let cursor = addGameDays(from, 1, 9)

  while (compareGameTime(cursor, to) < 0 && frames.length < 8) {
    frames.push(cursor)
    cursor = addGameDays(cursor, 1, 9)
  }

  if (frames[frames.length - 1] !== to) frames.push(to)
  return frames
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={'metric ' + (accent ? 'metric-accent' : '')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PlayerVisualCard({ player, starter = false, compact = false, onClick }: { player: Player; starter?: boolean; compact?: boolean; onClick?: () => void }) {
  const ovr = overall(player)
  return (
    <CollectiblePlayerCard
      rating={ovr}
      tier={player.cardRarity ? tierForPackRarity(player.cardRarity) : cardTier(ovr)}
      role={player.role}
      alias={player.alias}
      team={player.team}
      country={player.country}
      profileId={player.profileId}
      stats={{
        aim: player.aim,
        utility: player.utility,
        positioning: player.gameSense,
        clutch: player.clutch,
      }}
      starter={starter}
      onOpen={onClick}
      className={compact ? 'compact' : ''}
    />
  )
}


function OpponentVisualCard({ player }: { player: TournamentRosterPlayer }) {
  const metadata = metadataForAlias(player.alias)
  const profileMatch = metadata?.profileUrl?.match(/\/player\/(\d+)/)
  const resolvedProfileId = player.profileId ?? (profileMatch ? Number(profileMatch[1]) : null)
  const resolvedCountry = player.country ?? metadata?.country ?? 'INT'

  return (
    <CollectiblePlayerCard
      rating={player.rating}
      tier={cardTier(player.rating)}
      role={player.role ?? metadata?.role}
      alias={player.alias}
      team="OPPONENT"
      country={resolvedCountry}
      profileId={resolvedProfileId}
      className="match-opponent-card"
      loading="eager"
    />
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
          <div className="eyebrow">{countryFlag(player.country)} {player.country} · {player.team} · {ROLE_LABELS[player.role]} · {isStarter ? 'ОСНОВА' : 'ЗАПАС'}</div>
          <h3>{player.alias}</h3>
          <p>{player.realName} · {player.age == null ? 'Возраст —' : player.age + ' лет'} · РЕЙТ {overall(player)} · ПОТ {player.potential}</p>
        </div>
        <div className="ovr">{overall(player)}</div>
      </div>

      <div className="skill-grid">
        <span>АИМ <b>{player.aim}</b></span>
        <span>СЕНС <b>{player.gameSense}</b></span>
        <span>УТИЛ <b>{player.utility}</b></span>
        <span>КЛАТЧ <b>{player.clutch}</b></span>
      </div>

      <div className="bars">
        <label>Форма <i><em style={{ width: player.form + '%' }} /></i><b>{player.form}</b></label>
        <label>Мораль <i><em style={{ width: player.morale + '%' }} /></i><b>{player.morale}</b></label>
        <label>Усталость <i className="danger"><em style={{ width: player.fatigue + '%' }} /></i><b>{player.fatigue}</b></label>
      </div>

      <p className="bio">{player.bio}</p>
      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>

      <div className="contract-row">
        <span className={expiring ? 'warning' : ''}>
          {expired ? 'КОНТРАКТ ИСТЁК' : 'Контракт: ' + player.contractWeeks + ' нед.'} · {player.salary} кр./нед.
        </span>
        <button className="text-button" onClick={onRenew} disabled={state.credits < player.salary * 4}>
          Extend {player.salary * 4}
        </button>
      </div>

      <div className="lineup-actions">
        <button className={isStarter ? 'secondary' : 'primary'} onClick={onToggleStarter} disabled={!canStart}>
          {isStarter ? 'В запас' : state.startingFive.length >= 5 ? 'Сначала освободи место' : 'В стартовую пятёрку'}
        </button>
        <button className="text-button release" onClick={onRelease} disabled={state.roster.length <= 5 || state.credits < player.salary}>
          Release · {player.salary}
        </button>
      </div>

      <div className="card-actions">
        <button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 120}>Тренировка · 120</button>
        <button className="secondary" onClick={onRest} disabled={state.staffEnergy < 1}>Отдых</button>
      </div>
    </article>
  )
}

function PlayerProfileModal({ player, onClose }: { player: Player; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="card-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="card-detail-modal player-profile-modal" role="dialog" aria-modal="true" aria-label={'Профиль ' + player.alias} onMouseDown={(event) => event.stopPropagation()}>
        <button className="card-detail-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="card-detail-hero">
          <div className="card-detail-rating"><strong>{overall(player)}</strong><span>{ROLE_LABELS[player.role]}</span></div>
          <div className="card-detail-portrait"><span>{player.alias.slice(0, 3).toUpperCase()}</span><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="eager" /></div>
          <div className="card-detail-name"><h2>{player.alias}</h2><p>{player.realName}</p></div>
        </div>
        <div className="card-detail-content">
          <div className="card-detail-kicker">ТЕКУЩЕЕ СОСТОЯНИЕ КЛУБА</div>
          <h3>{countryFlag(player.country)} {player.team}</h3>
          <div className="card-detail-facts"><span><b>Форма</b>{player.form}</span><span><b>Мораль</b>{player.morale}</span><span><b>Усталость</b>{player.fatigue}</span><span><b>Контракт</b>{player.contractWeeks} нед.</span><span><b>Зарплата</b>{player.salary} кр./нед.</span><span><b>Потенциал</b>{player.potential}</span></div>
          <div className="card-detail-section-title">Базовые характеристики</div>
          <div className="card-detail-scores"><span><b>{player.aim}</b>АИМ</span><span><b>{player.utility}</b>УТИЛИТИ</span><span><b>{player.gameSense}</b>ПОЗИЦИЯ</span><span><b>{player.clutch}</b>КЛАТЧ</span></div>
        </div>
      </section>
    </div>
  )
}

function HqStarterRow({ player, index, onOpen }: { player: Player; index: number; onOpen: () => void }) {
  const role = ROLE_LABELS[player.role]
  return (
    <button type="button" className="hq-starter-row" onClick={onOpen} aria-label={'Открыть профиль ' + player.alias}>
      <span className="hq-starter-number">0{index + 1}</span>
      <span className="hq-starter-portrait"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="lazy" /></span>
      <span className="hq-starter-copy"><strong>{player.alias}</strong><small>{role} · {player.team}</small></span>
      <span className="hq-starter-form"><b>{overall(player)}</b><i style={{ width: player.form + '%' }} /><small>{player.form} F / {player.fatigue} T</small></span>
      <span className="hq-starter-arrow">↗</span>
    </button>
  )
}

function RosterRow({ player, starter, state, onOpen, onTrain, onRest, onRenew, onToggleStarter, onRelease }: {
  player: Player
  starter: boolean
  state: GameState
  onOpen: () => void
  onTrain: () => void
  onRest: () => void
  onRenew: () => void
  onToggleStarter: () => void
  onRelease: () => void
}) {
  const expiring = player.contractWeeks <= 2
  const expired = player.contractWeeks <= 0
  const canStart = starter || (state.startingFive.length < 5 && !expired)
  return (
    <article className={'roster-player-row ' + (starter ? 'is-starter' : 'is-bench')}>
      <button className="roster-player-main" onClick={onOpen} aria-label={'Открыть профиль ' + player.alias}>
        <span className="roster-player-state"><b>{starter ? 'START' : 'BENCH'}</b><i /></span>
        <span className="roster-player-photo"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="lazy" /></span>
        <span className="roster-player-identity"><strong>{player.alias}</strong><small>{player.realName} · {countryFlag(player.country)} {player.country} · {player.team}</small></span>
        <span className="roster-player-role"><b>{ROLE_LABELS[player.role]}</b><small>{player.traits.slice(0, 2).join(' · ')}</small></span>
        <span className="roster-player-ovr"><b>{overall(player)}</b><small>OVR · POT {player.potential}</small></span>
        <span className="roster-player-bars"><label>Форма <i><em style={{ width: player.form + '%' }} /></i><b>{player.form}</b></label><label>Мораль <i><em style={{ width: player.morale + '%' }} /></i><b>{player.morale}</b></label><label>Усталость <i className="danger"><em style={{ width: player.fatigue + '%' }} /></i><b>{player.fatigue}</b></label></span>
        <span className="roster-player-contract"><b className={expiring ? 'warning' : ''}>{expired ? 'ИСТЁК' : player.contractWeeks + ' нед.'}</b><small>{player.salary} кр./нед.</small></span>
      </button>
      <div className="roster-row-actions"><button className={starter ? 'secondary' : 'primary'} onClick={onToggleStarter} disabled={!canStart}>{starter ? 'В запас' : 'В старт'}</button><button onClick={onRenew} disabled={state.credits < player.salary * 4}>Продлить · {player.salary * 4}</button><button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 120}>Тренировка</button><button onClick={onRest} disabled={state.staffEnergy < 1}>Отдых</button><button className="text-button release" onClick={onRelease} disabled={state.roster.length <= 5 || state.credits < player.salary}>Убрать</button></div>
    </article>
  )
}

function App() {
  const [state, setState] = useState<GameState>(() => saveRepository.load())
  const [tab, setTab] = useState<Tab>('HQ')
  const tactic: TacticalPlan = 'balanced'
  const [seenNewsId, setSeenNewsId] = useState<string | null>(null)
  const [welcomeStep, setWelcomeStep] = useState<'intro' | 'reveal' | 'complete'>('intro')
  const [welcomeRevealed, setWelcomeRevealed] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedCard, setSelectedCard] = useState<PackCard | null>(null)
  const [transition, setTransition] = useState<{ target: Tab; title: string } | null>(null)
  const [pendingMatch, setPendingMatch] = useState<{
    nextState: GameState
    result: MatchResult
    returnTab: Tab
    stage: 'lobby' | 'simulation' | 'result'
    veto: LobbyVetoAction[]
  } | null>(null)
  const [worldFocusId, setWorldFocusId] = useState<string | null>(null)
  const [tutorialDismissed, setTutorialDismissed] = useState(() =>
    window.localStorage.getItem('eam:tutorial:' + state.saveId) === 'dismissed',
  )
  const [progressToast, setProgressToast] = useState<{ title: string; reward: string } | null>(null)
  const [timeAdvance, setTimeAdvance] = useState<TimeAdvanceTransition | null>(null)
  const completedObjectivesRef = useRef<Set<string> | null>(null)

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
  const activeEvent = tournamentForId(state.activeEventId)
  const activeEventMode = activeEvent ? tournamentMode(activeEvent) : null
  const bracketMatch = activeTournamentMatch(state)
  const bracketOpponent = opponentForPlayerMatch(state.activeTournament)
  const bracketRoster = bracketOpponent?.roster ?? []
  const currentFixtureDue = Boolean(bracketMatch && compareGameTime(bracketMatch.scheduledAt, state.now) <= 0)
  const currentPlayGate = activeEventMode
    ? canPlayMatch(state, activeEventMode)
    : { ok: false, reason: 'Нет текущего официального матча.' }
  const practiceGate = canPlayMatch(state, 'practice')
  const canAdvanceTournamentClock = Boolean(
    state.activeTournament &&
    (!bracketMatch || compareGameTime(state.now, bracketMatch.scheduledAt) < 0) &&
    !state.pendingDecision,
  )
  const unreadNews = seenNewsId === state.news[0]?.id ? 0 : Math.min(state.news.length, 9)
  const unread = Math.min(9, unreadNews + (state.pendingDecision ? 1 : 0))
  const coachStep = useMemo(
    () => tutorialDismissed ? null : onboardingStep(state),
    [state, tutorialDismissed],
  )

  useEffect(() => {
    saveRepository.save(state)
  }, [state])

  useEffect(() => {
    setTutorialDismissed(window.localStorage.getItem('eam:tutorial:' + state.saveId) === 'dismissed')
    completedObjectivesRef.current = completedCareerObjectiveIds(state)
  }, [state.saveId])

  useEffect(() => {
    const current = completedCareerObjectiveIds(state)
    const previous = completedObjectivesRef.current

    if (previous) {
      const newlyCompleted = [...current].filter((id) => !previous.has(id))
      if (newlyCompleted.length > 0) {
        const objective = careerObjectives(state).find((entry) => entry.id === newlyCompleted[0])
        if (objective) setProgressToast({ title: objective.title, reward: objective.rewardLabel })
      }
    }

    completedObjectivesRef.current = current
  }, [state])

  useEffect(() => {
    if (!progressToast) return
    const timer = window.setTimeout(() => setProgressToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [progressToast])

  useEffect(() => {
    if (!transition) return
    const switchTimer = window.setTimeout(() => {
      setTab(transition.target)
      if (transition.target === 'Inbox') setSeenNewsId(state.news[0]?.id ?? null)
    }, 180)
    const clearTimer = window.setTimeout(() => setTransition(null), 620)
    return () => {
      window.clearTimeout(switchTimer)
      window.clearTimeout(clearTimer)
    }
  }, [transition, state.news])

  useEffect(() => {
    if (!timeAdvance) return

    const atLastFrame = timeAdvance.index >= timeAdvance.frames.length - 1
    const timer = window.setTimeout(() => {
      if (atLastFrame) {
        setState(timeAdvance.nextState)
        setTimeAdvance(null)
        return
      }

      setTimeAdvance((current) => current
        ? { ...current, index: Math.min(current.frames.length - 1, current.index + 1) }
        : null,
      )
    }, atLastFrame ? 360 : timeAdvance.index === 0 ? 220 : 280)

    return () => window.clearTimeout(timer)
  }, [timeAdvance])

  const openTab = (next: Tab) => {
    if (next === tab && !transition) return
    setTransition({ target: next, title: TAB_LABELS[next] })
  }

  const openWorldEvent = (eventId?: string) => {
    setWorldFocusId(eventId ?? null)
    openTab('World')
  }

  const dismissTutorial = () => {
    window.localStorage.setItem('eam:tutorial:' + state.saveId, 'dismissed')
    setTutorialDismissed(true)
  }

  const openCoachStep = () => {
    if (!coachStep) return
    openTab(coachStep.target)
  }

  const finishPendingMatch = useCallback(() => {
    setPendingMatch((current) => {
      if (!current) return null
      setState(current.nextState)
      setTab(current.returnTab)
      return null
    })
  }, [])

  const startPendingSeries = useCallback((maps: string[], veto: LobbyVetoAction[]) => {
    setPendingMatch((current) => {
      if (!current) return null
      const remappedResult: MatchResult = {
        ...current.result,
        maps: current.result.maps.map((map, index) => ({
          ...map,
          map: maps[index] ?? map.map,
        })),
      }
      const nextState: GameState = {
        ...current.nextState,
        history: current.nextState.history.map((entry, index) => index === 0 ? remappedResult : entry),
      }
      return {
        ...current,
        nextState,
        result: remappedResult,
        veto,
        stage: 'simulation',
      }
    })
  }, [])

  const completePendingSimulation = useCallback(() => {
    setPendingMatch((current) => current ? { ...current, stage: 'result' } : null)
  }, [])

  const play = (mode: MatchMode) => {
    const gate = canPlayMatch(state, mode)
    if (!gate.ok || pendingMatch) return
    const result = executeGameCommand(state, { type: 'PLAY_MATCH', mode, tactic })
    const match = result.state.history[0]
    if (result.state === state || !match) return
    setPendingMatch({
      nextState: result.state,
      result: match,
      returnTab: mode === 'practice' ? 'Training' : result.state.activeTournament ? 'Play' : 'HQ',
      stage: 'lobby',
      veto: [],
    })
  }

  const reset = () => {
    if (window.confirm('Сбросить текущее сохранение и начать новый проект? Коллекция наборов этого сейва тоже будет удалена.')) {
      const fresh = saveRepository.reset()
      setState(fresh)
      setTab('HQ')
      setWelcomeStep('intro')
      setWelcomeRevealed(0)
    }
  }

  const commitPackBatch = (packId: Exclude<PackRoll['pack']['id'], 'welcome'>, quantity: number) => {
    let next = state
    const rolls: PackRoll[] = []
    for (let index = 0; index < quantity; index += 1) {
      const roll = rollPack(packId, next.packs.serial, next.saveId)
      const result = executeGameCommand(next, { type: 'OPEN_PACK', roll })
      if (result.state === next) return null
      rolls.push(roll)
      next = result.state
    }
    setState(next)
    return rolls
  }

  const clearPacks = () => {
    setState((current) => ({ ...current, packs: clearPackCollection(current.packs) }))
  }

  const bookEvent = (eventId: string) => {
    const result = executeGameCommand(state, { type: 'BOOK_EVENT', eventId })
    if (result.state === state) return
    setState(result.state)
    openTab('Play')
  }

  const beginTimeAdvance = (nextState: GameState, label: string) => {
    if (timeAdvance || nextState === state || nextState.now === state.now) {
      if (!timeAdvance && nextState !== state) setState(nextState)
      return
    }

    setTimeAdvance({
      from: state.now,
      to: nextState.now,
      frames: buildTimeAdvanceFrames(state.now, nextState.now),
      index: 0,
      nextState,
      label,
    })
  }

  const advanceToTournamentMatch = () => {
    if (timeAdvance) return
    const result = executeGameCommand(state, { type: 'ADVANCE_TO_MATCH' })
    if (result.state === state) return
    beginTimeAdvance(result.state, 'ADVANCING TO MATCH')
  }

  const advanceTime = (target: string) => {
    if (timeAdvance) return
    const result = executeGameCommand(state, { type: 'ADVANCE_TIME', target })
    if (result.state === state) return
    const frameCount = buildTimeAdvanceFrames(state.now, result.state.now).length
    beginTimeAdvance(result.state, frameCount <= 2 ? 'NEXT DAY' : 'ADVANCING CALENDAR')
  }

  const resolveDecision = (choice: 'a' | 'b') => {
    const result = executeGameCommand(state, { type: 'RESOLVE_DECISION', choice })
    if (result.state === state) return
    setState(result.state)
    openTab('HQ')
  }

  const welcomeCards = useMemo(() => rollWelcomePack(state.saveId), [state.saveId])

  const finishWelcome = () => {
    setState((current) => executeGameCommand(current, { type: 'OPEN_WELCOME_PACK', cards: welcomeCards }).state)
    setWelcomeStep('complete')
    setTab('HQ')
  }


  const managerProgress = managerLevelProgress(state.managerXp)
  const visualNow = timeAdvance?.frames[Math.min(timeAdvance.index, timeAdvance.frames.length - 1)] ?? state.now
  const timeAdvanceProgress = timeAdvance
    ? Math.round((timeAdvance.index / Math.max(1, timeAdvance.frames.length - 1)) * 100)
    : 0

  return (
    <div className="app-shell">
      {!state.welcomeComplete && (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <section className="welcome-panel">
            <div className="welcome-brand">ESPORT AI MANAGER</div>
            {welcomeStep === 'intro' && <>
              <div className="eyebrow">ПЕРВЫЙ СЕЙВ · СТАРТОВЫЙ НАБОР</div>
              <h1 id="welcome-title">Собери свою первую пятёрку.</h1>
              <div className="welcome-grid">
                <article><b>01</b><strong>Пять игроков</strong><span>IGL, AWP, Entry, Support и Rifler — роли закрыты заранее.</span></article>
                <article><b>02</b><strong>Один результат</strong></article>
                <article><b>03</b><strong>Дальше — сезон</strong></article>
              </div>
              <div className="welcome-actions"><button className="primary" onClick={() => { setWelcomeStep('reveal'); setWelcomeRevealed(0) }}>Открыть стартовый набор</button></div>
            </>}
            {welcomeStep !== 'intro' && <>
              <div className="eyebrow">WELCOME PACK · {Math.min(welcomeRevealed, 5)}/5</div>
              <h1 id="welcome-title">Ваша первая пятёрка</h1>
              <div className="welcome-card-grid">
                {welcomeCards.map((card, index) => {
                  const visible = index < welcomeRevealed
                  return (
                    <div key={card.id} className={'welcome-card-shell ' + (visible ? 'is-visible' : 'is-hidden')}>
                      <CollectiblePlayerCard
                        rating={card.power}
                        tier={visible ? tierForPackRarity(card.rarity) : 'silver'}
                        role={card.role}
                        alias={card.alias}
                        team={card.team}
                        country={card.country}
                        profileId={card.profileId}
                        stats={card.cardStats ? {
                          aim: card.cardStats.aim,
                          utility: card.cardStats.utility,
                          positioning: card.cardStats.positioning,
                          clutch: card.cardStats.clutch,
                        } : null}
                        onOpen={visible ? () => setSelectedCard(card) : undefined}
                        loading="eager"
                        className={'welcome-shared-card' + (visible ? '' : ' show-back')}
                        badge={visible ? card.edition : undefined}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="welcome-actions">
                {welcomeRevealed < 5 && <button className="secondary" onClick={() => setWelcomeRevealed(5)}>Показать сразу</button>}
                {welcomeRevealed < 5 && <button className="primary" onClick={() => setWelcomeRevealed((count) => Math.min(5, count + 1))}>Открыть карту</button>}
                {welcomeRevealed >= 5 && <button className="primary" onClick={finishWelcome}>Перейти в штаб</button>}
              </div>
            </>}
          </section>
        </div>
      )}
      {selectedCard && <Suspense fallback={null}><CardDetails card={selectedCard} onClose={() => setSelectedCard(null)} /></Suspense>}
      {selectedPlayer && <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      {transition && (
        <div className="fifa-title-transition" aria-hidden="true">
          <div><span>ESPORT AI MANAGER</span><strong>{transition.title}</strong><i /></div>
        </div>
      )}
      {timeAdvance && (
        <div className="time-advance-overlay" aria-live="polite" aria-label="Время в игре продвигается">
          <div className="time-advance-card">
            <span>{timeAdvance.label}</span>
            <div className="time-advance-date" key={visualNow}>
              <strong>{formatGameDate(visualNow)}</strong>
              <b>{formatGameTime(visualNow)}</b>
            </div>
            <div className="time-advance-meta">
              <small>{formatGameDate(timeAdvance.from)}</small>
              <i><em style={{ width: timeAdvanceProgress + '%' }} /></i>
              <small>{formatGameDate(timeAdvance.to)}</small>
            </div>
          </div>
        </div>
      )}
      <header className="fifa-topbar">
        <button
          className="fifa-brand fifa-screen-title"
          onClick={() => openTab('HQ')}
          aria-label={tab === 'HQ' ? 'Home' : 'Вернуться на главную'}
        >
          {tab !== 'HQ' && <span className="fifa-screen-back-mark" aria-hidden="true">←</span>}
          <strong>{SCREEN_TITLES[tab]}</strong>
        </button>
        {currentFixtureDue ? (
          <button className="fifa-topbar-center fifa-current-match-button" onClick={() => openTab('Play')}>
            <span>CURRENT MATCH</span>
            <b>YOUR CLUB <em>VS</em> {bracketOpponent?.name ?? 'OPPONENT'}</b>
            <i />
            <strong>PLAY →</strong>
          </button>
        ) : (
          <button className="fifa-topbar-center fifa-clock-button" onClick={() => openTab('Calendar')}>
            <span>{formatGameDate(visualNow)}</span>
            <b>{formatGameTime(visualNow)}</b>
            <i />
            <span>{activeEvent ? 'NEXT · ' + activeEvent.name.toUpperCase() : 'OPEN CALENDAR'}</span>
          </button>
        )}
        <div className="fifa-wallets">
          <button onClick={() => openTab('Inbox')} className={unread > 0 ? 'has-unread' : ''}><span>INBOX</span><b>{unread > 0 ? unread + ' NEW' : 'CLEAR'}</b></button>
          <button onClick={() => openTab('Profile')}><span>MANAGER LVL {managerProgress.level}</span><b>{managerProgress.percent}%</b></button>
          <div><span>CLUB CASH</span><b>{format.format(state.credits)}</b></div>
          <div><span>PACK TOKENS</span><b>{format.format(state.packTokens)}</b></div>
        </div>
      </header>



      <main className={'app-main app-main-' + tab.toLowerCase()}>
        {tab !== 'HQ' && !pendingMatch && (
          <button className="screen-back-button" onClick={() => openTab('HQ')} aria-label="Назад">
            <span>←</span> НАЗАД
          </button>
        )}
        {tab === 'HQ' && (
          <>
            {state.seasonEnded && state.seasonSummary && (
              <article className="season-summary-panel fifa-season-summary">
                <div className="eyebrow">SEASON {state.seasonSummary.season} · COMPLETE</div>
                <h1>SEASON COMPLETE</h1>
                <div className="season-summary-grid">
                  <span><b>{state.seasonSummary.wins}–{state.seasonSummary.losses}</b>Record</span>
                  <span><b>{state.seasonSummary.points}</b>Points</span>
                  <span><b>{state.seasonSummary.reputation}</b>Reputation</span>
                  <span><b>{state.seasonSummary.credits}</b>Club cash</span>
                  <span><b>{state.seasonSummary.bestPlayer ?? '—'}</b>MVP</span>
                </div>
                <button className="fifa-primary-cta" onClick={() => setState((current) => executeGameCommand(current, { type: 'START_NEXT_SEASON' }).state)}>START SEASON {state.season + 1} <span>→</span></button>
              </article>
            )}
            <FifaHome state={state} starters={starters} unread={unread} onOpen={(mode) => openTab(mode)} />
          </>
        )}

        {tab === 'World' && <WorldMap state={state} onBook={bookEvent} onPrepareMatch={() => openTab('Play')} focusEventId={worldFocusId} />}

        {tab === 'Calendar' && (
          <SeasonCalendar
            state={state}
            displayNow={visualNow}
            timeAnimating={Boolean(timeAdvance)}
            onAdvance={advanceTime}
            onAdvanceToMatch={advanceToTournamentMatch}
            onOpenMatch={() => openTab('Play')}
            onOpenWorld={openWorldEvent}
            onBook={bookEvent}
          />
        )}

        {tab === 'Play' && (
          <section className="sim-screen sim-matchday">
            {state.activeTournament && <TournamentHub state={state} onAdvance={advanceToTournamentMatch} />}
            <div className="sim-match-head"><div><span className="eyebrow">{activeEvent ? activeEvent.city.toUpperCase() + ' · TIER ' + activeEvent.circuitTier + ' · ' + activeEvent.format : 'TACTICAL DESK · WEEK ' + state.week}</span><h1>{activeEvent ? activeEvent.name : 'Решение до серии.'}</h1></div><div className="sim-match-prize"><span>{activeEvent ? 'PRIZE POOL' : 'ЗАРПЛАТА'}</span><b>{activeEvent ? activeEvent.prize.toLocaleString('ru-RU') : payroll} кр.</b><small>{state.credits.toLocaleString('ru-RU')} кр. в кассе</small></div></div>
            <div className="sim-match-stage">
              <section className="sim-team-deck sim-team-home"><div className="sim-team-kicker">YOUR CLUB</div><div className="sim-team-name">STARTING FIVE</div><div className="sim-team-meta"><span>{rating} OVR</span><span>{chem} CHEM</span><span>{state.lineupContinuity} CONTINUITY</span></div><div className="sim-match-roster">{starters.map((player) => <PlayerVisualCard key={player.id} player={player} starter compact onClick={() => setSelectedPlayer(player)} />)}</div><button className="sim-ghost-action sim-team-edit" onClick={() => openTab('Roster')}>EDIT FIVE</button></section>
              <div className="sim-match-versus"><span>BO3</span><strong>VS</strong></div>
              <section className="sim-team-deck sim-team-away"><span className="eyebrow">{activeEvent ? (bracketMatch?.label ?? 'EVENT FORMAT') : 'SERIES'}</span><h2>{bracketOpponent?.name ?? modeInfo[activeEventMode ?? 'scrim'].name}</h2><p>{bracketOpponent ? bracketOpponent.rating + ' OVR' : modeInfo[activeEventMode ?? 'scrim'].description}</p>{bracketRoster.length > 0 && <div className="sim-match-roster sim-opponent-roster">{bracketRoster.map((player) => <OpponentVisualCard key={player.playerKey} player={player} />)}</div>}</section>
            </div>
            <div className="sim-match-actions">
              <div className="sim-match-format-wrap">
                <div className="control-label">EVENT FORMAT</div>
                {activeEventMode && activeEvent ? (
                  <div className="sim-match-format">
                    <span>OFFICIAL · TIER {activeEvent.circuitTier} · {activeEvent.format}</span>
                    <small>{bracketMatch?.label ?? activeEvent.label} · VRS ENABLED</small>
                  </div>
                ) : (
                  <div className="sim-match-format is-muted">
                    <span>NO OFFICIAL FIXTURE</span>
                    <small>Выбери турнир на World Map. Пракки находятся в Training.</small>
                  </div>
                )}
              </div>
              <div className="sim-match-launch">
                <span className="control-label">MATCH ACTION</span>
                {activeEvent && canAdvanceTournamentClock
                  ? <button className="sim-primary-action" onClick={advanceToTournamentMatch}>К СЛЕДУЮЩЕМУ МАТЧУ <span>→</span></button>
                  : activeEventMode
                    ? <button className="sim-primary-action" disabled={!currentPlayGate.ok} onClick={() => play(activeEventMode)}>ИГРАТЬ МАТЧ <span>→</span></button>
                    : <button className="sim-primary-action" onClick={() => openTab('World')}>ВЫБРАТЬ ТУРНИР <span>→</span></button>}
                {activeEventMode && !currentPlayGate.ok && !canAdvanceTournamentClock
                  ? <small>{currentPlayGate.reason}</small>
                  : warnings.length > 0 && <small>{warnings[0]}</small>}
              </div>
            </div>
            {last && <div className="sim-match-recap"><span>ПОСЛЕДНИЙ RECAP · {last.opponent}</span><b>{last.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'} {last.maps.map((map) => map.us + ':' + map.them).join(' ')}</b><button className="text-button" onClick={() => openTab('Inbox')}>Открыть ленту</button></div>}
          </section>
        )}


        {tab === 'Training' && (
          <section className="sim-screen sim-practice">
            <div className="sim-screen-head sim-practice-head">
              <div>
                <span>TRAINING GROUND · NO VRS · NO CASH</span>
                <h1>PRACTICE</h1>
              </div>
              <div className="sim-practice-continuity">
                <small>LINEUP CONTINUITY</small>
                <b>{state.lineupContinuity}</b>
                <i><em style={{ width: state.lineupContinuity + '%' }} /></i>
              </div>
            </div>

            <div className="sim-practice-body">
              <section className="sim-practice-squad">
                <div className="sim-practice-squad-head">
                  <div>
                    <span>ACTIVE FIVE · {rating} OVR</span>
                    <strong>{starters.map((player) => player.alias).join(' · ')}</strong>
                  </div>
                  <button className="secondary" onClick={() => openTab('Roster')}>EDIT FIVE</button>
                </div>
                <div className="sim-practice-cards">
                  {starters.map((player) => (
                    <PlayerVisualCard key={player.id} player={player} starter compact onClick={() => setSelectedPlayer(player)} />
                  ))}
                </div>
              </section>

              <aside className="sim-practice-console">
                <span className="control-label">SESSION RULES</span>
                <h2>BO3 PRACTICE</h2>
                <div className="sim-practice-rules">
                  <span><b>0</b>CASH</span>
                  <span><b>0</b>VRS</span>
                  <span><b>+1</b>CONTINUITY</span>
                  <span><b>+4</b>FATIGUE</span>
                </div>
                <div className="sim-practice-note">
                  <span>STANDARD PRACTICE</span>
                  <small>Тактические планы временно отключены. Пракк проходит в стандартном режиме.</small>
                </div>
                <button className="sim-primary-action sim-practice-start" disabled={!practiceGate.ok} onClick={() => play('practice')}>
                  PLAY PRACC <span>→</span>
                </button>
                {!practiceGate.ok && <p className="sim-practice-block">{practiceGate.reason}</p>}
                {state.activeTournament && !currentFixtureDue && bracketMatch && (
                  <p className="sim-practice-next">NEXT OFFICIAL · {formatGameDate(bracketMatch.scheduledAt)} · {formatGameTime(bracketMatch.scheduledAt)}</p>
                )}
              </aside>
            </div>
          </section>
        )}

        {tab === 'Roster' && (
          <RosterBoard
            state={state}
            setState={setState}
            onOpenPlayer={setSelectedPlayer}
            onOpenScout={() => openTab('Scout')}
          />
        )}

        {tab === 'Packs' && (
          <Suspense
            fallback={(
              <section className="screen">
                <div className="empty-state">
                  <span>НАГРАДЫ</span>
                  <h2>Загрузка…</h2>
                </div>
              </section>
            )}
          >
            <PacksView
              packTokens={state.packTokens}
              packState={state.packs}
              roster={state.roster}
              onOpenBatch={commitPackBatch}
              onClear={clearPacks}
            />
          </Suspense>
        )}

        {tab === 'Scout' && (
          <ScoutMarket
            state={state}
            setState={setState}
          />
        )}

        {tab === 'Profile' && <ManagerProfile state={state} />}

        {tab === 'Inbox' && (
          <section className="sim-screen sim-inbox">
            <div className="sim-screen-head">
              <div>
                <span>CLUB FEED · WEEK {state.week}</span>
                <h1>INBOX</h1>
              </div>
              <div className="sim-head-stat"><small>EVENTS</small><b>{state.news.length + (state.pendingDecision ? 1 : 0)}</b></div>
            </div>
            {state.pendingDecision && (
              <article className={'sim-decision-card decision-' + state.pendingDecision.kind}>
                <span>DECISION REQUIRED</span>
                <h2>{state.pendingDecision.title}</h2>
                <p>{state.pendingDecision.body}</p>
                <div>
                  <button onClick={() => resolveDecision('a')}>{state.pendingDecision.optionA}</button>
                  <button onClick={() => resolveDecision('b')}>{state.pendingDecision.optionB}</button>
                </div>
              </article>
            )}
            <div className="sim-inbox-body">
              <div className="sim-inbox-season"><span>SEASON</span><b>{state.season}</b><small>WEEK {state.week}/{state.seasonLength}</small></div>
              <div className="sim-feed">
                {state.news.map((item) => {
                  const target: Tab | null =
                    item.kind === 'contract' || item.kind === 'lineup' ? 'Roster' :
                    item.kind === 'scout' ? 'Scout' :
                    item.kind === 'match' ? 'World' :
                    item.kind === 'media' ? 'World' :
                    item.kind === 'finance' ? 'Profile' : null
                  return (
                    <article key={item.id}>
                      <div className="sim-feed-marker">{NEWS_KIND_LABELS[item.kind].slice(0, 1).toUpperCase()}</div>
                      <div>
                        <span>Неделя {item.week} · {NEWS_KIND_LABELS[item.kind]}</span>
                        <h2>{item.title}</h2>
                        <p>{item.body}</p>
                        {target && <button className="sim-feed-action" onClick={() => openTab(target)}>ОТКРЫТЬ <b>→</b></button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            <button className="sim-danger-action sim-reset" onClick={reset}>Сбросить сохранение</button>
          </section>
        )}
      </main>

      {pendingMatch?.stage === 'lobby' && (
        <MatchLobby
          result={pendingMatch.result}
          starters={starters}
          phase="prematch"
          onStart={startPendingSeries}
        />
      )}

      {pendingMatch?.stage === 'simulation' && (
        <MatchRadar
          result={pendingMatch.result}
          starters={starters}
          onComplete={completePendingSimulation}
          onSkip={completePendingSimulation}
        />
      )}

      {pendingMatch?.stage === 'result' && (
        <MatchLobby
          result={pendingMatch.result}
          starters={starters}
          phase="result"
          initialVeto={pendingMatch.veto}
          onContinue={finishPendingMatch}
        />
      )}

      {state.welcomeComplete && coachStep && !pendingMatch && (
        <aside className="career-coach" aria-live="polite">
          <div className="career-coach-progress">
            <span>ROOKIE PATH</span>
            <b>{coachStep.index}/{coachStep.total}</b>
          </div>
          <strong>{coachStep.title}</strong>
          <p>{coachStep.body}</p>
          <div>
            <button onClick={openCoachStep}>{coachStep.action} <span>→</span></button>
            <button className="career-coach-skip" onClick={dismissTutorial}>SKIP TUTORIAL</button>
          </div>
        </aside>
      )}

      {progressToast && (
        <div className="career-progress-toast" role="status">
          <span>OBJECTIVE COMPLETE</span>
          <strong>{progressToast.title}</strong>
          <b>{progressToast.reward}</b>
        </div>
      )}
    </div>
  )
}

export default App
