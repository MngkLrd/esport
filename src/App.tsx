import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeTournamentMatch,
  canPlayMatch,
  chemistry,
  getStartingFive,
  lineupWarnings,
  managerLevelProgress,
  modeInfo,
  newsBelongsInInbox,
  newsRequiresAction,
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
import { TimeProgressionOverlay, type TimeProgressionSession, type TimeProgressionSpeed, type TimeProgressionStop } from './TimeProgression'
import { TrainingGround } from './TrainingGround'
import { WorldPortal } from './WorldPortal'
import { nextPlannedTrainingSession, processTrainingSessionsThrough } from './trainingSystem'

const CardDetails = lazy(() => import('./CardDetails').then((module) => ({ default: module.CardDetails })))

const saveRepository = createBrowserSaveRepository()
type Tab = 'HQ' | 'World' | 'Calendar' | 'Play' | 'Training' | 'Roster' | 'Packs' | 'Scout' | 'Inbox' | 'Profile'

const TAB_LABELS: Record<Tab, string> = {
  HQ: 'HOME',
  World: 'WORLD MAP',
  Calendar: 'CALENDAR',
  Play: 'MATCHDAY',
  Training: 'TRAINING',
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
  Training: 'TRAINING GROUND',
  Roster: 'SQUAD',
  Packs: 'PACK STORE',
  Scout: 'BUILD YOUR SHORTLIST',
  Inbox: 'NEWSROOM',
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

const TIME_PROGRESSION_DELAY: Record<TimeProgressionSpeed, number> = {
  1: 720,
  2: 300,
  3: 110,
}

const detectTimeProgressionStop = (before: GameState, after: GameState): TimeProgressionStop | null => {
  if (after.pendingDecision && after.pendingDecision.id !== before.pendingDecision?.id) {
    return {
      kind: 'decision',
      title: after.pendingDecision.title,
      detail: after.pendingDecision.body,
      action: 'Inbox',
      actionLabel: 'ОТКРЫТЬ INBOX',
    }
  }

  const expired = after.roster.find((player) => {
    const previous = before.roster.find((candidate) => candidate.id === player.id)
    return Boolean(previous && previous.contractWeeks > 0 && player.contractWeeks <= 0)
  })
  if (expired) {
    return {
      kind: 'contract',
      title: 'Контракт ' + expired.alias + ' истёк',
      detail: 'Игрок требует решения по контракту до следующего официального матча.',
      action: 'Roster',
      actionLabel: 'ОТКРЫТЬ СОСТАВ',
    }
  }

  const knownNews = new Set(before.news.map((item) => item.id))
  const actionableNews = after.news.find((item) =>
    !knownNews.has(item.id) && newsRequiresAction(item),
  )
  if (actionableNews) {
    const action =
      actionableNews.kind === 'contract' || actionableNews.kind === 'lineup'
        ? 'Roster' as const
        : actionableNews.kind === 'match'
          ? 'World' as const
          : 'Inbox' as const
    const actionLabel =
      action === 'Roster' ? 'ОТКРЫТЬ СОСТАВ'
        : action === 'World' ? 'ОТКРЫТЬ WORLD'
          : 'ОТКРЫТЬ INBOX'

    return {
      kind: actionableNews.kind === 'contract' ? 'contract' : actionableNews.kind === 'match' ? 'tournament' : 'message',
      title: actionableNews.title,
      detail: actionableNews.body,
      action,
      actionLabel,
    }
  }

  const match = activeTournamentMatch(after)
  if (
    match &&
    compareGameTime(match.scheduledAt, after.now) <= 0 &&
    compareGameTime(match.scheduledAt, before.now) > 0
  ) {
    const event = tournamentForId(after.activeEventId)
    const opponent = opponentForPlayerMatch(after.activeTournament)
    return {
      kind: 'match',
      title: 'Матч готов к старту',
      detail: (event ? event.name + ' · ' : '') + (opponent ? 'YOUR CLUB vs ' + opponent.name : match.label),
      action: 'Play',
      actionLabel: 'К МАТЧУ',
    }
  }

  if (after.seasonEnded && !before.seasonEnded) {
    return {
      kind: 'season',
      title: 'Сезон завершён',
      detail: 'Промотка остановлена на итогах сезона.',
      action: 'HQ',
      actionLabel: 'К ИТОГАМ',
    }
  }

  return null
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
  const [timeAdvance, setTimeAdvance] = useState<TimeProgressionSession | null>(null)
  const [saveSignal, setSaveSignal] = useState<{ revision: number; status: 'saved' | 'error' }>({ revision: 0, status: 'saved' })
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
  const canAdvanceTournamentClock = Boolean(
    state.activeTournament &&
    (!bracketMatch || compareGameTime(state.now, bracketMatch.scheduledAt) < 0) &&
    !state.pendingDecision,
  )
  const inboxNews = useMemo(() => state.news.filter(newsBelongsInInbox), [state.news])
  const unreadNews = seenNewsId === inboxNews[0]?.id ? 0 : Math.min(inboxNews.length, 9)
  const unread = Math.min(9, unreadNews + (state.pendingDecision ? 1 : 0))
  const coachStep = useMemo(
    () => tutorialDismissed ? null : onboardingStep(state),
    [state, tutorialDismissed],
  )

  useEffect(() => {
    const saved = saveRepository.save(state)
    setSaveSignal((current) => ({
      revision: current.revision + 1,
      status: saved ? 'saved' : 'error',
    }))
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
      if (transition.target === 'Inbox') setSeenNewsId(inboxNews[0]?.id ?? null)
    }, 180)
    const clearTimer = window.setTimeout(() => setTransition(null), 620)
    return () => {
      window.clearTimeout(switchTimer)
      window.clearTimeout(clearTimer)
    }
  }, [transition, inboxNews])

  useEffect(() => {
    if (!timeAdvance || timeAdvance.status !== 'running') return

    const timer = window.setTimeout(() => {
      if (compareGameTime(state.now, timeAdvance.target) >= 0) {
        setTimeAdvance((current) => current ? { ...current, status: 'complete' } : null)
        return
      }

      const alreadyProcessed = processTrainingSessionsThrough(state, state.now)
      if (alreadyProcessed !== state) {
        setState(alreadyProcessed)
        return
      }

      const nextDay = addGameDays(state.now, 1, 9)
      const nextTraining = nextPlannedTrainingSession(state, state.now, timeAdvance.target)
      let stepTarget = compareGameTime(nextDay, timeAdvance.target) > 0 ? timeAdvance.target : nextDay
      if (nextTraining && compareGameTime(nextTraining.scheduledAt, stepTarget) < 0) {
        stepTarget = nextTraining.scheduledAt
      }

      const result = executeGameCommand(state, { type: 'ADVANCE_TIME', target: stepTarget })

      if (result.state === state || result.state.now === state.now) {
        const stop = state.pendingDecision
          ? {
              kind: 'decision' as const,
              title: state.pendingDecision.title,
              detail: state.pendingDecision.body,
              action: 'Inbox' as const,
              actionLabel: 'ОТКРЫТЬ INBOX',
            }
          : null
        setTimeAdvance((current) => current
          ? { ...current, status: stop ? 'stopped' : 'complete', stop }
          : null,
        )
        return
      }

      const nextState = processTrainingSessionsThrough(result.state, stepTarget)
      const stop = detectTimeProgressionStop(state, nextState)
      const reachedTarget = compareGameTime(nextState.now, timeAdvance.target) >= 0

      setState(nextState)
      setTimeAdvance((current) => current
        ? {
            ...current,
            status: stop ? 'stopped' : reachedTarget ? 'complete' : 'running',
            stop,
          }
        : null,
      )
    }, TIME_PROGRESSION_DELAY[timeAdvance.speed])

    return () => window.clearTimeout(timer)
  }, [timeAdvance, state])

  useEffect(() => {
    if (timeAdvance?.status !== 'complete') return
    const timer = window.setTimeout(() => setTimeAdvance(null), 520)
    return () => window.clearTimeout(timer)
  }, [timeAdvance?.status])

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
      const remappedMaps = current.result.maps.map((map, index) => {
        const nextMap = maps[index] ?? map.map
        return {
          ...map,
          map: nextMap,
          story: map.story ? { ...map.story, map: nextMap } : undefined,
        }
      })
      const remappedResult: MatchResult = {
        ...current.result,
        maps: remappedMaps,
        story: current.result.story
          ? {
              ...current.result.story,
              maps: remappedMaps.flatMap((map) => map.story ? [map.story] : []),
            }
          : undefined,
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

  const beginTimeProgression = (target: string, label: string) => {
    if (timeAdvance || compareGameTime(target, state.now) <= 0 || state.seasonEnded) return
    if (state.pendingDecision) {
      openTab('Inbox')
      return
    }
    if (currentFixtureDue) {
      openTab('Play')
      return
    }

    setTimeAdvance({
      from: state.now,
      target,
      speed: 1,
      status: 'running',
      label,
      stop: null,
    })
  }

  const continueTime = () => {
    if (timeAdvance) return

    if (bracketMatch && compareGameTime(bracketMatch.scheduledAt, state.now) > 0) {
      beginTimeProgression(bracketMatch.scheduledAt, 'CONTINUE · TO NEXT MATCH')
      return
    }

    if (state.activeTournament) {
      const projected = executeGameCommand(state, { type: 'ADVANCE_TO_MATCH' })
      if (projected.state !== state && compareGameTime(projected.state.now, state.now) > 0) {
        beginTimeProgression(projected.state.now, 'CONTINUE · TO NEXT MATCH')
        return
      }
    }

    beginTimeProgression(addGameDays(state.now, 7, 9), 'CONTINUE')
  }

  const advanceToTournamentMatch = () => {
    if (timeAdvance) return
    const result = executeGameCommand(state, { type: 'ADVANCE_TO_MATCH' })
    if (result.state === state) return
    if (result.state.now === state.now) {
      setState(result.state)
      return
    }
    beginTimeProgression(result.state.now, 'ADVANCE TO MATCH')
  }

  const advanceTime = (target: string) => {
    if (timeAdvance) return
    beginTimeProgression(target, state.now.slice(0, 10) === target.slice(0, 10) ? 'ADVANCE TIME' : 'ADVANCE CALENDAR')
  }

  const setTimeProgressionSpeed = (speed: TimeProgressionSpeed) => {
    setTimeAdvance((current) => current && current.status === 'running' ? { ...current, speed } : current)
  }

  const handleTimeProgressionStop = () => {
    const action = timeAdvance?.stop?.action
    setTimeAdvance(null)
    if (action) openTab(action)
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
  const visualNow = state.now

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
        <TimeProgressionOverlay
          state={state}
          session={timeAdvance}
          onSpeedChange={setTimeProgressionSpeed}
          onStopAction={handleTimeProgressionStop}
        />
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
            <FifaHome state={state} starters={starters} unread={unread} onOpen={(mode) => openTab(mode)} onContinue={continueTime} />
          </>
        )}

        {tab === 'World' && <WorldMap state={state} onBook={bookEvent} onPrepareMatch={() => openTab('Play')} focusEventId={worldFocusId} />}

        {tab === 'Calendar' && (
          <SeasonCalendar
            state={state}
            displayNow={visualNow}
            timeAnimating={Boolean(timeAdvance)}
            onAdvance={advanceTime}
            onContinue={continueTime}
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
          <TrainingGround
            state={state}
            setState={setState}
          />
        )}

        {tab === 'Roster' && (
          <RosterBoard
            state={state}
            setState={setState}
            saveSignal={saveSignal}
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
          <WorldPortal
            state={state}
            onResolveDecision={resolveDecision}
            onNavigate={(target) => openTab(target)}
            onReset={reset}
          />
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
