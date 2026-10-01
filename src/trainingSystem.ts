import {
  activeTournamentMatch,
  advancePlayerDevelopment,
  getStartingFive,
  teamRating,
  type GameState,
} from './game'
import { addGameDays, compareGameTime, startOfGameDay } from './calendar'
import { opponentForPlayerMatch } from './tournamentEngine'
import { PLAYER_CLUB_WORLD_ID } from './world'
import {
  TRAINING_MAPS,
  trainingPreparationModifier,
  type TrainingFocus,
  type TrainingIntensity,
  type TrainingMap,
  type TrainingReport,
  type TrainingSession,
  type TrainingSessionType,
} from './trainingTypes'

export const TRAINING_SESSION_DEFS: Record<TrainingSessionType, {
  label: string
  short: string
  description: string
  load: number
  tone: 'team' | 'scrim' | 'map' | 'analysis' | 'recovery' | 'individual'
}> = {
  team: {
    label: 'Team Practice',
    short: 'TEAM',
    description: 'Связки, коммуникация и общий рисунок игры.',
    load: 4,
    tone: 'team',
  },
  scrim: {
    label: 'Scrim',
    short: 'SCRIM',
    description: 'Контрольный BO3 против другой команды с отчётом штаба.',
    load: 7,
    tone: 'scrim',
  },
  map: {
    label: 'Map Practice',
    short: 'MAP LAB',
    description: 'Подготовка конкретной карты без роста permanent OVR.',
    load: 4,
    tone: 'map',
  },
  'anti-strat': {
    label: 'Anti-Strat',
    short: 'ANTI-STRAT',
    description: 'Анализ следующего соперника и подготовка контрплана.',
    load: 2,
    tone: 'analysis',
  },
  utility: {
    label: 'Utility / Tactics',
    short: 'UTILITY',
    description: 'Исполнение сетапов, ретейков и гранатных протоколов.',
    load: 3,
    tone: 'team',
  },
  mechanics: {
    label: 'Mechanics',
    short: 'MECHANICS',
    description: 'Поддержание sharpness без прямой прокачки карточек.',
    load: 5,
    tone: 'individual',
  },
  recovery: {
    label: 'Recovery',
    short: 'RECOVERY',
    description: 'Снижение нагрузки перед следующими тяжёлыми сессиями.',
    load: -9,
    tone: 'recovery',
  },
  'match-prep': {
    label: 'Match Preparation',
    short: 'MATCH PREP',
    description: 'Последняя сборка плана перед официальной серией.',
    load: 2,
    tone: 'analysis',
  },
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)))

const hash = (value: string) => {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const rngFor = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const intensityMultiplier = (intensity: TrainingIntensity) =>
  intensity === 'light' ? 0.7 : intensity === 'high' ? 1.28 : 1

const sessionId = (scheduledAt: string, type: TrainingSessionType) =>
  'training-' + scheduledAt.replace(/[^0-9]/g, '') + '-' + type

export const trainingSlotTime = (
  state: GameState,
  dayOffset: number,
  period: 'am' | 'pm',
) => {
  const base = startOfGameDay(state.now)
  return addGameDays(base, dayOffset, period === 'am' ? 11 : 18)
}

export const trainingWeekRange = (state: GameState) => ({
  from: startOfGameDay(state.now),
  to: addGameDays(startOfGameDay(state.now), 7, 23),
})

export const scrimOpponentCandidates = (state: GameState) => {
  const ourRating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  return state.world.teams
    .filter((team) => team.id !== PLAYER_CLUB_WORLD_ID && team.rosterKeys.length >= 5)
    .map((team) => ({ ...team, delta: Math.abs(team.rating - ourRating) }))
    .sort((a, b) => a.delta - b.delta || a.vrsRank - b.vrsRank)
    .slice(0, 12)
}

export const upsertTrainingSession = (
  state: GameState,
  input: Omit<TrainingSession, 'id' | 'status' | 'reportId'>,
): GameState => {
  if (compareGameTime(input.scheduledAt, state.now) <= 0) return state
  const id = sessionId(input.scheduledAt, input.type)
  const sameSlot = state.training.sessions.find((session) => session.scheduledAt === input.scheduledAt && session.status === 'planned')
  const sessions = [
    ...state.training.sessions.filter((session) => session.id !== sameSlot?.id && session.id !== id),
    { ...input, id, status: 'planned' as const, reportId: null },
  ].sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))

  return {
    ...state,
    training: {
      ...state.training,
      sessions: sessions.slice(-80),
    },
  }
}

export const removeTrainingSession = (state: GameState, id: string): GameState => ({
  ...state,
  training: {
    ...state.training,
    sessions: state.training.sessions.filter((session) => session.id !== id || session.status === 'completed'),
  },
})

const weakestTrainingMap = (state: GameState): TrainingMap =>
  [...TRAINING_MAPS].sort((a, b) => state.training.mapPreparation[a] - state.training.mapPreparation[b])[0]

const nextOfficialContext = (state: GameState) => {
  const match = activeTournamentMatch(state)
  const opponent = state.activeTournament ? opponentForPlayerMatch(state.activeTournament) : null
  return {
    match,
    opponent,
    opponentId: opponent?.worldTeamId ?? null,
    opponentName: opponent?.name ?? null,
  }
}

const makeSession = (
  state: GameState,
  dayOffset: number,
  period: 'am' | 'pm',
  type: TrainingSessionType,
  overrides: Partial<Omit<TrainingSession, 'id' | 'scheduledAt' | 'status' | 'reportId'>> = {},
): TrainingSession => {
  const scheduledAt = trainingSlotTime(state, dayOffset, period)
  return {
    id: sessionId(scheduledAt, type),
    scheduledAt,
    type,
    intensity: overrides.intensity ?? 'normal',
    focus: overrides.focus ?? 'general',
    map: overrides.map ?? null,
    opponentTeamId: overrides.opponentTeamId ?? null,
    opponentName: overrides.opponentName ?? null,
    status: 'planned',
    reportId: null,
  }
}

export const autoPlanTrainingWeek = (state: GameState): GameState => {
  const { from, to } = trainingWeekRange(state)
  const context = nextOfficialContext(state)
  const weakMap = weakestTrainingMap(state)
  const starters = getStartingFive(state.roster, state.startingFive)
  const avgFatigue = starters.length
    ? starters.reduce((sum, player) => sum + player.fatigue, 0) / starters.length
    : 0
  const scrimOpponent = scrimOpponentCandidates(state)[0] ?? null
  const matchAt = context.match?.scheduledAt ?? null

  const proposed: TrainingSession[] = []
  const add = (session: TrainingSession) => {
    if (compareGameTime(session.scheduledAt, state.now) <= 0) return
    if (matchAt && compareGameTime(session.scheduledAt, matchAt) >= 0) return
    proposed.push(session)
  }

  if (avgFatigue >= 48) {
    add(makeSession(state, 0, 'am', 'recovery', { intensity: 'light' }))
  } else {
    add(makeSession(state, 0, 'am', 'team'))
  }

  add(makeSession(state, 1, 'pm', 'scrim', {
    map: weakMap,
    opponentTeamId: scrimOpponent?.id ?? null,
    opponentName: scrimOpponent?.name ?? 'Practice partner',
    focus: 'general',
  }))

  add(makeSession(state, 2, 'am', avgFatigue >= 36 ? 'recovery' : 'utility', {
    map: weakMap,
    intensity: avgFatigue >= 36 ? 'light' : 'normal',
  }))

  if (context.opponentId) {
    add(makeSession(state, 3, 'pm', 'anti-strat', {
      opponentTeamId: context.opponentId,
      opponentName: context.opponentName,
      focus: 'ct',
      intensity: 'light',
    }))
  } else {
    add(makeSession(state, 3, 'pm', 'map', { map: weakMap }))
  }

  add(makeSession(state, 4, 'pm', 'map', { map: weakMap, focus: 'retakes' }))
  add(makeSession(state, 5, 'am', 'match-prep', {
    map: weakMap,
    opponentTeamId: context.opponentId,
    opponentName: context.opponentName,
    intensity: 'light',
  }))
  add(makeSession(state, 6, 'am', 'recovery', { intensity: 'light' }))

  const keep = state.training.sessions.filter((session) =>
    session.status === 'completed' ||
    compareGameTime(session.scheduledAt, from) < 0 ||
    compareGameTime(session.scheduledAt, to) > 0,
  )

  return {
    ...state,
    training: {
      ...state.training,
      sessions: [...keep, ...proposed]
        .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))
        .slice(-80),
    },
  }
}

const createScrimReport = (state: GameState, session: TrainingSession): TrainingReport => {
  const rng = rngFor(hash(state.saveId + ':' + state.seed + ':' + session.id))
  const opponent = session.opponentTeamId
    ? state.world.teams.find((team) => team.id === session.opponentTeamId)
    : null
  const ourRating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const opponentRating = opponent?.rating ?? Math.max(52, ourRating - 2 + Math.round((rng() - .5) * 8))
  const prep = state.training.readiness * .025 + state.training.tacticalCohesion * .018
  const gap = ourRating + prep - opponentRating
  const winChance = 1 / (1 + Math.exp(-gap / 6.2))
  const mapsWon = rng() < winChance ? 2 : rng() < .55 ? 1 : 0
  const mapsLost = mapsWon === 2 ? (rng() < .58 ? 1 : 0) : 2
  const map = session.map ?? weakestTrainingMap(state)
  const metric = (base: number) => clamp(base + (rng() - .5) * 18)
  const entry = metric(54 + state.training.sharpness * .18)
  const trade = metric(48 + state.training.tacticalCohesion * .25)
  const ct = metric(46 + state.training.mapPreparation[map] * .27)
  const pistols = metric(43 + state.training.readiness * .20)
  const avgFatigue = getStartingFive(state.roster, state.startingFive)
    .reduce((sum, player) => sum + player.fatigue, 0) / Math.max(1, state.startingFive.length)

  const notes = [
    ct < 58 ? map + ': CT setups остаются слабой зоной.' : map + ': структура CT выглядит устойчиво.',
    trade < 60 ? 'Trade rate ниже рабочего стандарта — нужен Team Practice.' : 'Связки и трейды выдерживают темп пракка.',
    avgFatigue > 48 ? 'Штаб рекомендует recovery: нагрузка основы уже высокая.' : 'Нагрузка состава остаётся контролируемой.',
  ]

  return {
    id: 'report-' + session.id,
    sessionId: session.id,
    createdAt: session.scheduledAt,
    type: 'scrim',
    headline: (session.opponentName ?? opponent?.name ?? 'Practice partner') + ' · ' + mapsWon + '–' + mapsLost,
    detail: 'Контрольный BO3 дал данные по ' + map + ' и командной структуре. Результат не влияет на VRS и карточки.',
    opponentName: session.opponentName ?? opponent?.name ?? null,
    map,
    score: mapsWon + '–' + mapsLost,
    metrics: [
      { label: 'ENTRY SUCCESS', value: entry, delta: entry - 55 },
      { label: 'TRADE RATE', value: trade, delta: trade - 58 },
      { label: 'CT STRUCTURE', value: ct, delta: ct - 58 },
      { label: 'PISTOLS', value: pistols, delta: pistols - 52 },
    ],
    notes,
  }
}

const applySession = (state: GameState, session: TrainingSession): GameState => {
  const multiplier = intensityMultiplier(session.intensity)
  const map = session.map
  const opponentKey = session.opponentTeamId
  const currentMapPrep = map ? state.training.mapPreparation[map] : 0

  let readiness = state.training.readiness
  let cohesion = state.training.tacticalCohesion
  let sharpness = state.training.sharpness
  let fatigueDelta = TRAINING_SESSION_DEFS[session.type].load
  let mapDelta = 0
  let knowledgeDelta = 0

  if (session.type === 'team') {
    readiness += 2.2 * multiplier
    cohesion += 3.4 * multiplier
    sharpness += 0.8 * multiplier
  } else if (session.type === 'scrim') {
    readiness += 3.2 * multiplier
    cohesion += 2.3 * multiplier
    sharpness += 1.8 * multiplier
    mapDelta = 3.5 * multiplier
    knowledgeDelta = 2 * multiplier
  } else if (session.type === 'map') {
    readiness += 1.8 * multiplier
    mapDelta = 6 * multiplier
  } else if (session.type === 'anti-strat') {
    readiness += 1.6 * multiplier
    knowledgeDelta = 8 * multiplier
  } else if (session.type === 'utility') {
    readiness += 1.2 * multiplier
    cohesion += 1.4 * multiplier
    mapDelta = 3.2 * multiplier
  } else if (session.type === 'mechanics') {
    readiness += 0.8 * multiplier
    sharpness += 4.2 * multiplier
  } else if (session.type === 'recovery') {
    readiness += 0.8
    sharpness -= 0.6
    fatigueDelta = -9
  } else if (session.type === 'match-prep') {
    readiness += 5 * multiplier
    cohesion += 1.2 * multiplier
    mapDelta = 1.8 * multiplier
    knowledgeDelta = 2.5 * multiplier
  }

  const report = session.type === 'scrim' ? createScrimReport(state, session) : null
  const reportId = report?.id ?? null

  const nextMapPreparation = { ...state.training.mapPreparation }
  if (map) nextMapPreparation[map] = clamp(currentMapPrep + mapDelta)

  const nextKnowledge = { ...state.training.opponentKnowledge }
  if (opponentKey) nextKnowledge[opponentKey] = clamp((nextKnowledge[opponentKey] ?? 0) + knowledgeDelta)

  const activeIds = new Set(state.startingFive)
  const nextDevelopment = { ...state.training.development }
  const nextRoster = state.roster.map((player) => {
    if (!activeIds.has(player.id)) return player

    let developed = player
    if (session.type === 'mechanics') {
      const development = nextDevelopment[player.id] ?? { focus: 'balanced' as const, progress: 0 }
      const advanced = advancePlayerDevelopment(player, development, Math.max(1, Math.round(2 * multiplier)))
      developed = advanced.player
      nextDevelopment[player.id] = advanced.development
    }

    return {
      ...developed,
      fatigue: clamp(developed.fatigue + fatigueDelta * multiplier),
      form: clamp(developed.form + (session.type === 'scrim' || session.type === 'mechanics' ? 1 : 0)),
      morale: clamp(developed.morale + (session.type === 'team' ? 1 : 0)),
    }
  })

  const sessions = state.training.sessions.map((item) =>
    item.id === session.id ? { ...item, status: 'completed' as const, reportId } : item,
  )

  return {
    ...state,
    roster: nextRoster,
    lineupContinuity: clamp(state.lineupContinuity + (session.type === 'team' ? 2 : session.type === 'scrim' ? 1 : 0)),
    training: {
      ...state.training,
      readiness: clamp(readiness),
      tacticalCohesion: clamp(cohesion),
      sharpness: clamp(sharpness),
      mapPreparation: nextMapPreparation,
      opponentKnowledge: nextKnowledge,
      sessions,
      development: nextDevelopment,
      reports: report ? [report, ...state.training.reports].slice(0, 40) : state.training.reports,
    },
  }
}

export const processTrainingSessionsThrough = (state: GameState, upTo: string): GameState => {
  const due = state.training.sessions
    .filter((session) => session.status === 'planned' && compareGameTime(session.scheduledAt, upTo) <= 0)
    .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))

  return due.reduce((current, session) => applySession(current, session), state)
}

export const nextPlannedTrainingSession = (
  state: GameState,
  after: string,
  before?: string,
) =>
  state.training.sessions
    .filter((session) =>
      session.status === 'planned' &&
      compareGameTime(session.scheduledAt, after) > 0 &&
      (!before || compareGameTime(session.scheduledAt, before) <= 0),
    )
    .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))[0] ?? null

export const setDevelopmentFocus = (
  state: GameState,
  playerId: string,
  focus: GameState['training']['development'][string]['focus'],
): GameState => ({
  ...state,
  training: {
    ...state.training,
    development: {
      ...state.training.development,
      [playerId]: {
        focus,
        progress: state.training.development[playerId]?.progress ?? 0,
      },
    },
  },
})

export const trainingMatchModifier = (
  state: GameState,
  map: string,
  opponentTeamId: string | null,
) => trainingPreparationModifier(state.training, map, opponentTeamId)
