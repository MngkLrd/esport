import { REAL_PLAYERS } from './players'
import { collectPackCards, createPackState, type PackCard, type PackState } from './packState'
import { tournamentEntryCost, tournamentForId, tournamentMode, type TournamentEvent } from './events'
import { INITIAL_SEASON_START, addGameDays, addGameHours, compareGameTime, gameWeekForDate, hoursBetween } from './calendar'
import { advanceTournamentTo, createTournamentRun, nextPlayerMatch, nextTournamentActionTime, opponentForPlayerMatch, resolvePlayerTournamentMatch, tournamentIsFinished, tournamentPrizeForStatus, tournamentStartsAt, type TournamentRun } from './tournamentEngine'

export type Role = 'IGL' | 'Entry' | 'Rifler' | 'AWP' | 'Support'
export type LineupSlot = Role
export type LineupSlots = Record<LineupSlot, string | null>
export const LINEUP_SLOTS: readonly LineupSlot[] = ['Entry', 'AWP', 'Rifler', 'Support', 'IGL']
export type MatchMode = 'scrim' | 'showmatch' | 'cup'
export type TacticalPlan = 'balanced' | 'aggressive' | 'structured'
export type ScoutAgeProfile = 'any' | 'u23' | 'prime' | 'veteran'
export type ScoutRoleTarget = Role | 'Any'
export type SquadPromise = 'starter' | 'rotation'

export interface ScoutBrief {
  role: ScoutRoleTarget
  maxSalary: number
  ageProfile: ScoutAgeProfile
}

export interface NegotiationTerms {
  fee: number
  salary: number
  contractWeeks: number
  squadRole: SquadPromise
}

export interface NegotiationEvaluation {
  score: number
  threshold: number
  accepted: boolean
  interest: 'cold' | 'open' | 'warm' | 'ready'
  askingFee: number
  askingSalary: number
  reason: string
}

export interface Player {
  id: string
  playerKey?: string
  acquiredCardId?: string | null
  profileId?: number | null
  alias: string
  firstName: string
  realName: string
  country: string
  team: string
  age: number | null
  role: Role
  aim: number
  gameSense: number
  utility: number
  clutch: number
  leadership: number
  form: number
  morale: number
  fatigue: number
  potential: number
  salary: number
  contractWeeks: number
  traits: string[]
  bio: string
}

export interface MapResult {
  map: string
  us: number
  them: number
  winChance: number
  topPerformer: string
}

export interface PlayerPerformance {
  playerId: string
  alias: string
  rating: number
}

export interface MatchResult {
  id: string
  season?: number
  week: number
  mode: MatchMode
  tactic: TacticalPlan
  opponent: string
  opponentRating: number
  won: boolean
  maps: MapResult[]
  performances: PlayerPerformance[]
  reward: number
  payroll: number
  net: number
  fansDelta: number
  headline: string
  detail: string
  mvp: string
  playedAt?: string
  tournamentId?: string | null
  tournamentMatchId?: string | null
}

export interface SeasonSummary {
  season: number
  wins: number
  losses: number
  points: number
  reputation: number
  fans: number
  credits: number
  bestPlayer: string | null
  payroll: number
  objective: { label: string; target: number; value: number; completed: boolean }
}

export interface NewsItem {
  id: string
  week: number
  kind: 'match' | 'media' | 'contract' | 'scout' | 'finance' | 'lineup'
  title: string
  body: string
}

export type ClubDecisionKind = 'recovery' | 'sponsor' | 'media'

export interface ClubDecision {
  id: string
  kind: ClubDecisionKind
  title: string
  body: string
  optionA: string
  optionB: string
}

export interface GameState {
  version: 10
  saveId: string
  seed: number
  season: number
  seasonStart: string
  now: string
  week: number
  seasonLength: number
  seasonEnded: boolean
  seasonSummary: SeasonSummary | null
  credits: number
  packTokens: number
  managerXp: number
  fans: number
  reputation: number
  wins: number
  losses: number
  streak: number
  seasonPoints: number
  staffEnergy: number
  activeEventId: string | null
  activeTournament: TournamentRun | null
  tournamentHistory: TournamentRun[]
  pendingDecision: ClubDecision | null
  welcomeComplete: boolean
  roster: Player[]
  startingFive: string[]
  lineupSlots: LineupSlots
  lineupContinuity: number
  prospects: Player[]
  scoutCycle: number
  scoutBrief: ScoutBrief
  history: MatchResult[]
  news: NewsItem[]
  lastPayroll: number
  lastWeekNet: number
  packs: PackState
}

export const DEFAULT_SCOUT_BRIEF: ScoutBrief = {
  role: 'Any',
  maxSalary: 170,
  ageProfile: 'any',
}

export const SCOUT_REPORT_COST = 300
export const managerLevelFromXp = (xp: number) => Math.max(1, Math.floor(Math.max(0, xp) / 500) + 1)
export const managerLevelProgress = (xp: number) => {
  const level = managerLevelFromXp(xp)
  const floor = (level - 1) * 500
  const next = level * 500
  return { level, current: Math.max(0, xp - floor), required: next - floor, percent: Math.max(0, Math.min(100, Math.round((xp - floor) / Math.max(1, next - floor) * 100))) }
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const createSaveId = () => {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
  if (randomUUID) return randomUUID()
  return 'save-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

const hashSeed = (input: string) => {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = <T,>(items: readonly T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)]

export const overall = (p: Player) =>
  Math.round(
    p.aim * 0.31 +
      p.gameSense * 0.24 +
      p.utility * 0.15 +
      p.clutch * 0.15 +
      p.leadership * 0.15,
  )

export const getStartingFive = (roster: Player[], startingFive: string[]) =>
  startingFive
    .map((id) => roster.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
    .slice(0, 5)

export const createEmptyLineupSlots = (): LineupSlots => ({
  Entry: null,
  AWP: null,
  Rifler: null,
  Support: null,
  IGL: null,
})

export const lineupSlotIds = (slots: LineupSlots) =>
  LINEUP_SLOTS.map((slot) => slots[slot]).filter((id): id is string => Boolean(id))

export const inferLineupSlots = (roster: Player[], startingFive: string[]): LineupSlots => {
  const slots = createEmptyLineupSlots()
  const active = getStartingFive(roster, startingFive)
  const remaining = [...active]

  for (const slot of LINEUP_SLOTS) {
    const exact = remaining.findIndex((player) => player.role === slot)
    if (exact >= 0) {
      slots[slot] = remaining[exact].id
      remaining.splice(exact, 1)
    }
  }

  for (const slot of LINEUP_SLOTS) {
    if (!slots[slot] && remaining.length > 0) {
      slots[slot] = remaining.shift()?.id ?? null
    }
  }

  return slots
}

const roleCoverage = (active: Player[]) => {
  const roles = new Set(active.map((p) => p.role))
  let score = 0
  if (roles.has('IGL')) score += 9
  if (roles.has('AWP')) score += 7
  if (roles.has('Support')) score += 5
  if (roles.has('Entry')) score += 5
  score += Math.min(8, roles.size * 2)
  return score
}

export const lineupWarnings = (roster: Player[], startingFive: string[]) => {
  const active = getStartingFive(roster, startingFive)
  const warnings: string[] = []
  if (active.length !== 5) warnings.push('Выбери ровно пять игроков в основу.')
  if (active.some((p) => p.contractWeeks <= 0)) warnings.push('У игрока основы истёк контракт.')
  if (!active.some((p) => p.role === 'IGL')) warnings.push('Нет IGL: структура игры по ходу раунда слабее.')
  if (!active.some((p) => p.role === 'AWP')) warnings.push('Нет выделенного AWP: контроль карты становится слабее.')
  if (active.filter((p) => p.fatigue >= 75).length >= 2) warnings.push('Два или больше игроков основы сильно устали.')
  return warnings
}

export const chemistry = (roster: Player[], startingFive?: string[], continuity = 50) => {
  const active = startingFive
    ? getStartingFive(roster, startingFive)
    : [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5)
  if (active.length === 0) return 0
  const morale = active.reduce((sum, p) => sum + p.morale, 0) / active.length
  const leadership = active.reduce((sum, p) => sum + p.leadership, 0) / active.length
  const fatiguePenalty = active.reduce((sum, p) => sum + p.fatigue, 0) / active.length
  const coverage = roleCoverage(active)
  return Math.round(
    clamp(24 + coverage + morale * 0.2 + leadership * 0.11 + continuity * 0.13 - fatiguePenalty * 0.07),
  )
}

export const teamRating = (roster: Player[], startingFive?: string[], continuity = 50) => {
  const active = startingFive
    ? getStartingFive(roster, startingFive)
    : [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5)
  if (active.length === 0) return 0
  const raw =
    active.reduce((sum, p) => {
      const condition = (p.form - 50) * 0.08 + (p.morale - 50) * 0.05 - p.fatigue * 0.07
      return sum + overall(p) + condition
    }, 0) / active.length
  return Math.round(clamp(raw * 0.87 + chemistry(roster, active.map((p) => p.id), continuity) * 0.13))
}

const roleFitBonus: Record<LineupSlot, Record<Role, number>> = {
  Entry: { Entry: 16, Rifler: 8, AWP: 4, Support: 3, IGL: 2 },
  AWP: { AWP: 16, Rifler: 6, Entry: 4, Support: 2, IGL: 2 },
  Rifler: { Rifler: 16, Entry: 9, Support: 7, IGL: 5, AWP: 4 },
  Support: { Support: 16, IGL: 9, Rifler: 7, Entry: 3, AWP: 2 },
  IGL: { IGL: 16, Support: 8, Rifler: 5, Entry: 2, AWP: 1 },
}

export const lineupFitScore = (player: Player, slot: LineupSlot) => {
  const skill =
    slot === 'Entry'
      ? player.aim * 0.42 + player.gameSense * 0.22 + player.clutch * 0.2 + player.utility * 0.08 + player.leadership * 0.08
      : slot === 'AWP'
        ? player.aim * 0.43 + player.gameSense * 0.3 + player.clutch * 0.2 + player.utility * 0.04 + player.leadership * 0.03
        : slot === 'Support'
          ? player.utility * 0.38 + player.gameSense * 0.28 + player.leadership * 0.16 + player.aim * 0.1 + player.clutch * 0.08
          : slot === 'IGL'
            ? player.leadership * 0.38 + player.gameSense * 0.3 + player.utility * 0.15 + player.clutch * 0.1 + player.aim * 0.07
            : player.aim * 0.34 + player.gameSense * 0.27 + player.utility * 0.15 + player.clutch * 0.18 + player.leadership * 0.06
  const condition = player.form * 0.45 + player.morale * 0.35 + (100 - player.fatigue) * 0.2
  return Math.round(clamp(skill * 0.82 + condition * 0.08 + roleFitBonus[slot][player.role]))
}

export const playerFromPackCard = (card: PackCard, index: number): Player => {
  const role = card.role ?? 'Rifler'
  const aim = card.cardStats?.aim ?? card.power
  const gameSense = card.cardStats?.positioning ?? clamp(card.power - 2)
  const utility = card.cardStats?.utility ?? clamp(card.power - 5)
  const clutch = card.cardStats?.clutch ?? clamp(card.power - 1)
  const leadership = role === 'IGL'
    ? clamp(gameSense + 12)
    : role === 'Support'
      ? clamp(gameSense + 3)
      : clamp(gameSense - 8)
  const age = card.age
  const potential = clamp(card.power + Math.max(2, 27 - (age ?? 25)) + (role === 'Entry' ? 3 : 0), 45, 99)
  const salary = Math.max(55, Math.round(35 + card.power * 1.05))

  return {
    id: 'welcome-' + index + '-' + card.alias.toLocaleLowerCase('en-US'),
    playerKey: card.playerKey,
    acquiredCardId: card.id,
    profileId: card.profileId,
    alias: card.alias,
    firstName: card.realName ?? card.alias,
    realName: card.realName ?? card.alias,
    country: card.country ?? 'Неизвестно',
    team: card.team,
    age,
    role,
    aim,
    gameSense,
    utility,
    clutch,
    leadership,
    form: 60,
    morale: 72,
    fatigue: 0,
    potential,
    salary,
    contractWeeks: 10 + (index % 3),
    traits: role === 'IGL'
      ? ['Коллер', 'Структура']
      : role === 'AWP'
        ? ['Снайпер', 'Контроль карты']
        : role === 'Support'
          ? ['Командный игрок', 'Гранаты']
          : role === 'Entry'
            ? ['Первый контакт', 'Темп']
            : ['Рифлер', 'Гибкий'],
    bio: (card.realName ?? card.alias) + ' · ' + (card.country ?? 'страна неизвестна') + ' · ' + card.team + '.',
  }
}

export const applyWelcomePack = (state: GameState, cards: PackCard[]): GameState => {
  if (state.welcomeComplete || state.roster.length > 0 || cards.length !== 5) return state
  const roster = cards.map(playerFromPackCard)
  const aliases = roster.map((player) => player.alias).join(' · ')
  return {
    ...state,
    welcomeComplete: true,
    roster,
    startingFive: roster.map((player) => player.id),
    lineupSlots: inferLineupSlots(roster, roster.map((player) => player.id)),
    lineupContinuity: 50,
    packs: collectPackCards(state.packs, cards),
    news: [{
      id: 'welcome-complete-' + state.saveId,
      week: 1,
      kind: 'lineup' as const,
      title: 'Первая пятёрка собрана',
      body: aliases + ' теперь составляют стартовую пятёрку клуба.',
    }, ...state.news].slice(0, 50),
  }
}

const initialRoster: Player[] = [
  {
    id: 'p-donk', alias: 'donk', firstName: 'Danil Kryshkovets', realName: 'Danil Kryshkovets', country: 'Russia', team: 'Spirit', age: 19, role: 'Entry',
    aim: 78, gameSense: 65, utility: 55, clutch: 63, leadership: 48,
    form: 68, morale: 74, fatigue: 12, potential: 90, salary: 105, contractWeeks: 8,
    traits: ['Бесстрашный', 'Набирает темп'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
  {
    id: 'p-apex', alias: 'apEX', firstName: 'Dan Madesclaire', realName: 'Dan Madesclaire', country: 'France', team: 'Vitality', age: 33, role: 'IGL',
    aim: 62, gameSense: 82, utility: 79, clutch: 69, leadership: 88,
    form: 61, morale: 70, fatigue: 8, potential: 82, salary: 120, contractWeeks: 10,
    traits: ['Коллер', 'Хладнокровный'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
  {
    id: 'p-zywoo', alias: 'ZywOo', firstName: 'Mathieu Herbaut', realName: 'Mathieu Herbaut', country: 'France', team: 'Vitality', age: 25, role: 'AWP',
    aim: 82, gameSense: 70, utility: 44, clutch: 76, leadership: 41,
    form: 72, morale: 66, fatigue: 15, potential: 94, salary: 135, contractWeeks: 7,
    traits: ['Вундеркинд', 'Нестабильный пик'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
  {
    id: 'p-mezii', alias: 'mezii', firstName: 'William Merriman', realName: 'William Merriman', country: 'United Kingdom', team: 'Vitality', age: 27, role: 'Support',
    aim: 58, gameSense: 76, utility: 86, clutch: 61, leadership: 73,
    form: 59, morale: 78, fatigue: 5, potential: 76, salary: 95, contractWeeks: 12,
    traits: ['Связующее звено', 'Мастер гранат'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
  {
    id: 'p-ropz', alias: 'ropz', firstName: 'Robin Kool', realName: 'Robin Kool', country: 'Estonia', team: 'Vitality', age: 26, role: 'Rifler',
    aim: 73, gameSense: 72, utility: 64, clutch: 74, leadership: 58,
    form: 64, morale: 69, fatigue: 10, potential: 85, salary: 110, contractWeeks: 9,
    traits: ['Клоузер', 'Гибкий'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
  {
    id: 'p-flamez', alias: 'flameZ', firstName: 'Shahar Shushan', realName: 'Shahar Shushan', country: 'Israel', team: 'Vitality', age: 23, role: 'Rifler',
    aim: 70, gameSense: 66, utility: 68, clutch: 58, leadership: 52,
    form: 60, morale: 72, fatigue: 3, potential: 83, salary: 85, contractWeeks: 11,
    traits: ['Шестой игрок', 'Стабильный'],
    bio: 'Реальный профиль CS2-про. Игровые рейтинги вымышлены специально для этой симуляции.',
  },
]

export const createInitialState = (): GameState => ({
  version: 10,
  saveId: createSaveId(),
  seed: 271828,
  season: 1,
  seasonStart: INITIAL_SEASON_START,
  now: INITIAL_SEASON_START,
  week: 1,
  seasonLength: 16,
  seasonEnded: false,
  seasonSummary: null,
  credits: 3200,
  packTokens: 2600,
  managerXp: 0,
  fans: 340,
  reputation: 38,
  wins: 0,
  losses: 0,
  streak: 0,
  seasonPoints: 0,
  staffEnergy: 3,
  activeEventId: null,
  activeTournament: null,
  tournamentHistory: [],
  pendingDecision: null,
  welcomeComplete: false,
  roster: [],
  startingFive: [],
  lineupSlots: createEmptyLineupSlots(),
  lineupContinuity: 50,
  prospects: [],
  scoutCycle: 0,
  scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
  history: [],
  news: [
    {
      id: 'welcome',
      week: 1,
      kind: 'media' as const,
      title: 'Новый проект выходит на сцену',
      body: 'Шестнадцать недель начинаются с welcome-пака. Пять выпавших игроков становятся первой стартовой пятёркой клуба.',
    },
  ],
  lastPayroll: 0,
  lastWeekNet: 0,
  packs: createPackState(),
})

const normalizePlayers = (players: Player[], packs: PackState): Player[] => players.map((player) => {
  const aliasKey = player.alias.toLocaleLowerCase('en-US')
  const card = packs.inventory.find((entry) => entry.alias.toLocaleLowerCase('en-US') === aliasKey)
  const identity = REAL_PLAYERS.find((entry) => entry.alias.toLocaleLowerCase('en-US') === aliasKey)
  const profileMatch = identity?.profileUrl?.match(/\/player\/(\d+)/)
  return {
    ...player,
    playerKey: player.playerKey ?? (profileMatch ? 'hltv:' + profileMatch[1] : 'alias:' + aliasKey),
    acquiredCardId: player.acquiredCardId ?? card?.id ?? null,
    profileId: player.profileId ?? card?.profileId ?? (profileMatch ? Number(profileMatch[1]) : null),
    realName: player.realName && player.realName !== player.alias ? player.realName : identity?.realName ?? player.realName,
    firstName: player.firstName && player.firstName !== player.alias ? player.firstName : identity?.realName ?? player.firstName,
    country: player.country && player.country !== 'Неизвестно' ? player.country : identity?.country ?? player.country,
    age: player.age ?? identity?.age ?? null,
  }
})

const normalizeScoutBrief = (raw: unknown): ScoutBrief => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SCOUT_BRIEF }
  const source = raw as Partial<ScoutBrief>
  const validRole = source.role === 'Any' || LINEUP_SLOTS.includes(source.role as LineupSlot)
  const validAge = source.ageProfile === 'any' || source.ageProfile === 'u23' || source.ageProfile === 'prime' || source.ageProfile === 'veteran'
  return {
    role: validRole ? source.role as ScoutRoleTarget : DEFAULT_SCOUT_BRIEF.role,
    maxSalary: typeof source.maxSalary === 'number' ? Math.round(clamp(source.maxSalary, 80, 260)) : DEFAULT_SCOUT_BRIEF.maxSalary,
    ageProfile: validAge ? source.ageProfile as ScoutAgeProfile : DEFAULT_SCOUT_BRIEF.ageProfile,
  }
}

const normalizeLineupSlots = (roster: Player[], startingFive: string[], raw: unknown): LineupSlots => {
  const slots = createEmptyLineupSlots()
  const validIds = new Set(roster.map((player) => player.id))
  const used = new Set<string>()

  if (raw && typeof raw === 'object') {
    const source = raw as Partial<Record<LineupSlot, unknown>>
    for (const slot of LINEUP_SLOTS) {
      const id = source[slot]
      if (typeof id === 'string' && validIds.has(id) && !used.has(id)) {
        slots[slot] = id
        used.add(id)
      }
    }
  }

  const remaining = startingFive.filter((id) => validIds.has(id) && !used.has(id))
  for (const slot of LINEUP_SLOTS) {
    if (slots[slot]) continue
    const exact = remaining.findIndex((id) => roster.find((player) => player.id === id)?.role === slot)
    const id = exact >= 0 ? remaining.splice(exact, 1)[0] : remaining.shift()
    if (id) {
      slots[slot] = id
      used.add(id)
    }
  }

  return slots
}

export const migrateState = (raw: unknown): GameState => {
  if (!raw || typeof raw !== 'object') return createInitialState()
  const parsed = raw as { version?: number; roster?: Player[]; prospects?: Player[]; packs?: PackState; saveId?: string; [key: string]: unknown }
  if ((parsed.version === 10 || parsed.version === 9) && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    const seasonStart = typeof parsed.seasonStart === 'string' ? parsed.seasonStart : INITIAL_SEASON_START
    const now = typeof parsed.now === 'string'
      ? parsed.now
      : addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9)
    const activeEventId = typeof parsed.activeEventId === 'string' ? parsed.activeEventId : null
    const legacyEvent = tournamentForId(activeEventId)
    const activeTournament = parsed.activeTournament && typeof parsed.activeTournament === 'object'
      ? parsed.activeTournament as TournamentRun
      : legacyEvent
        ? createTournamentRun(
            legacyEvent,
            seasonStart,
            now,
            (typeof parsed.seed === 'number' ? parsed.seed : 271828) + (typeof parsed.season === 'number' ? parsed.season : 1) * 100 + legacyEvent.startDay,
          )
        : null
    return {
      ...(parsed as unknown as GameState),
      version: 10,
      seasonStart,
      now,
      activeTournament,
      tournamentHistory: Array.isArray(parsed.tournamentHistory) ? parsed.tournamentHistory as TournamentRun[] : [],
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: typeof parsed.packTokens === 'number' ? parsed.packTokens : 2600,
      managerXp: typeof parsed.managerXp === 'number' ? parsed.managerXp : 0,
      activeEventId: activeTournament?.eventId ?? activeEventId,
      pendingDecision: parsed.pendingDecision && typeof parsed.pendingDecision === 'object' ? parsed.pendingDecision as ClubDecision : null,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      packs,
    }
  }

  if (parsed.version === 8 && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'packTokens' | 'managerXp'>),
      version: 10,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: 2600,
      managerXp: 0,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      packs,
    } as GameState
  }

  if (parsed.version === 7 && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'scoutBrief' | 'packTokens' | 'managerXp'>),
      version: 10,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: typeof parsed.packTokens === 'number' ? parsed.packTokens : 2600,
      managerXp: typeof parsed.managerXp === 'number' ? parsed.managerXp : 0,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      packs,
    } as GameState
  }

  if ((parsed.version === 6 || parsed.version === 5) && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'welcomeComplete' | 'lineupSlots' | 'scoutBrief' | 'packTokens' | 'managerXp'>),
      version: 10,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: parsed.version === 6 ? Boolean(parsed.welcomeComplete) : true,
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, null),
      scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
      packTokens: 2600,
      managerXp: 0,
      packs,
    } as GameState
  }

  if ((parsed.version === 4 || parsed.version === 3 || parsed.version === 2 || parsed.version === 1) && Array.isArray(parsed.roster)) {
    const base = createInitialState()
    const identities = proPlayerIdentities

    const enrichIdentity = (player: Player, index: number): Player => {
      const identity =
        identities.find((candidate) => candidate.alias.toLowerCase() === player.alias.toLowerCase()) ??
        identities[index % identities.length]
      return {
        ...player,
        alias: identity.alias,
        profileId: player.profileId ?? profileIdFromUrl(identity.profileUrl),
        firstName: identity.realName ?? identity.alias,
        realName: identity.realName ?? identity.alias,
        country: identity.country ?? 'Неизвестно',
        team: identity.team,
        age: identity.age ?? player.age,
        role: identity.role ?? player.role,
        bio: identity.realName
          ? identity.realName + ' · ' + (identity.country ?? 'страна неизвестна') + ' · команда в профиле: ' + identity.team + '. Игровые рейтинги вымышлены специально для этой симуляции.'
          : identity.alias + ' · команда по срезу Valve VRS: ' + identity.team + ' (2026-09-07). Полные данные профиля пока не обогащены; рейтинг и роль являются данными симуляции.',
        salary: parsed.version === 1 ? Math.max(70, Math.round((player.salary ?? 200) * 0.45)) : player.salary,
      }
    }

    const roster = parsed.roster.map(enrichIdentity)
    if (roster.length === 5) roster.push({ ...initialRoster[5], traits: [...initialRoster[5].traits] })
    const prospects = Array.isArray(parsed.prospects) ? parsed.prospects.map(enrichIdentity) : []
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : roster.slice(0, 5).map((p) => p.id)

    return {
      ...base,
      ...(parsed as object),
      version: 10,
      saveId: createSaveId(),
      welcomeComplete: true,
      season: 1,
      seasonStart: INITIAL_SEASON_START,
      now: INITIAL_SEASON_START,
      activeTournament: null,
      tournamentHistory: [],
      seasonEnded: false,
      seasonSummary: null,
      seasonLength: 16,
      roster,
      startingFive,
      lineupSlots: inferLineupSlots(roster, startingFive),
      lineupContinuity: typeof parsed.lineupContinuity === 'number' ? parsed.lineupContinuity : 55,
      prospects,
      scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
      packTokens: 2600,
      managerXp: 0,
      history: Array.isArray(parsed.history) ? parsed.history as MatchResult[] : [],
      news: Array.isArray(parsed.news) ? parsed.news as NewsItem[] : base.news,
      lastPayroll: typeof parsed.lastPayroll === 'number' ? parsed.lastPayroll : 0,
      lastWeekNet: typeof parsed.lastWeekNet === 'number' ? parsed.lastWeekNet : 0,
      packs: createPackState(),
    } as GameState
  }
  return createInitialState()
}

const opponentNames = [
  'Northstar', 'Red Static', 'Morrow Five', 'Pixel Union',
  'Zero Hour', 'Nightshift', 'Kinetic', 'Blackbird',
] as const

const mapPool = ['Dust II', 'Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis'] as const

const modeTuning: Record<MatchMode, { difficulty: number; baseReward: number; fans: number; label: string }> = {
  scrim: { difficulty: -5, baseReward: 700, fans: 25, label: 'Тренировочный контур' },
  showmatch: { difficulty: 1, baseReward: 950, fans: 70, label: 'Шоуматч сообщества' },
  cup: { difficulty: 7, baseReward: 1450, fans: 150, label: 'Онлайн-кубок' },
}

export const tacticInfo: Record<TacticalPlan, { name: string; description: string }> = {
  balanced: { name: 'Сбалансированно', description: 'Без крупных модификаторов. Минимальный разброс и обычная усталость.' },
  aggressive: { name: 'Агрессивно', description: 'Упор на стрельбу, выше разброс и усталость. Лучше подходит механически сильным составам.' },
  structured: { name: 'Структурно', description: 'Вознаграждает понимание игры, гранаты и лидерство. Разброс ниже.' },
}

const eventDifficulty = (event: TournamentEvent | null) =>
  event ? (event.circuitTier === 1 ? 7 : event.circuitTier === 2 ? 3 : 0) : 0

const generateOpponent = (state: GameState, mode: MatchMode, rng: () => number) => {
  const tune = modeTuning[mode]
  const event = tournamentForId(state.activeEventId)
  const rating = Math.round(clamp(53 + state.reputation * 0.4 + tune.difficulty + eventDifficulty(event) + (rng() - 0.5) * 9, 48, 96))
  return { name: pick(opponentNames, rng), rating }
}

const tacticalModifier = (active: Player[], tactic: TacticalPlan) => {
  const avg = (key: keyof Pick<Player, 'aim' | 'gameSense' | 'utility' | 'leadership'>) =>
    active.reduce((sum, p) => sum + p[key], 0) / active.length
  if (tactic === 'aggressive') return (avg('aim') - 68) * 0.08
  if (tactic === 'structured') {
    const structure = avg('gameSense') * 0.45 + avg('utility') * 0.3 + avg('leadership') * 0.25
    return (structure - 68) * 0.09
  }
  return 0
}

const mapScore = (won: boolean, closeness: number, rng: () => number): [number, number] => {
  const floor = closeness > 0.72 ? 9 : closeness > 0.5 ? 7 : 4
  const loser = Math.floor(floor + rng() * (12 - floor))
  return won ? [13, loser] : [loser, 13]
}

const narrative = (
  state: GameState,
  opponent: string,
  won: boolean,
  mvp: Player,
  mode: MatchMode,
  tactic: TacticalPlan,
  net: number,
  rng: () => number,
) => {
  const winHeads = [
    mvp.alias + ' превращает подготовку в победу в серии',
    'Стартовая пятёрка выдерживает проверку давлением',
    'Цельный план на игру приносит убедительную серию',
  ]
  const lossHeads = [
    'Серия вскрывает реальную проблему менеджмента',
    'Хороших раундов недостаточно, чтобы удержать серию',
    'Под давлением мелкие слабости состава превращаются в поражение',
  ]
  const financial = net >= 0
    ? ' Неделя завершилась на ' + net + ' кредитов выше зарплатных расходов.'
    : ' Дохода от результата не хватило на зарплаты: дефицит ' + Math.abs(net) + ' кредитов.'
  const detail = won
    ? 'Победа над ' + opponent + ' оправдала выбранный план. ' + mvp.alias + ' стал лучшим на сервере, а стабильность состава и состояние игроков повлияли на перевес между картами.'
    : 'Поражение от ' + opponent + ' показало слабости выбранного плана. Штабу теперь нужно отделить тактическую ошибку от усталости, контрактных проблем и обычного разброса.'
  return {
    headline: pick(won ? winHeads : lossHeads, rng),
    detail: detail + financial + ' Режим: ' + modeTuning[mode].label + '.',
  }
}

const performanceRating = (player: Player, won: boolean, tactic: TacticalPlan, rng: () => number) => {
  const tacticFit =
    tactic === 'aggressive'
      ? (player.aim - 65) * 0.08
      : tactic === 'structured'
        ? ((player.gameSense + player.utility + player.leadership) / 3 - 65) * 0.07
        : 0
  return Math.round(clamp(overall(player) + (player.form - 50) * 0.1 - player.fatigue * 0.06 + tacticFit + (won ? 4 : -3) + (rng() - 0.5) * 12, 35, 99))
}

export const weeklyPayroll = (state: GameState) =>
  state.roster.reduce((sum, player) => sum + (player.contractWeeks > 0 ? player.salary : 0), 0)

const weeklyDecision = (state: GameState, won: boolean): ClubDecision => {
  const cycle = (state.week + state.season + (won ? 1 : 0)) % 3
  if (cycle === 0) {
    return {
      id: 'decision-recovery-' + state.season + '-' + state.week,
      kind: 'recovery',
      title: 'Штаб просит разгрузить неделю',
      body: 'После серии игрокам нужен восстановительный блок. Это снизит усталость, но съест часть бюджета.',
      optionA: 'ДАТЬ ВОССТАНОВЛЕНИЕ',
      optionB: 'ДЕРЖАТЬ ТЕМП',
    }
  }
  if (cycle === 1) {
    return {
      id: 'decision-sponsor-' + state.season + '-' + state.week,
      kind: 'sponsor',
      title: 'Спонсор просит быструю активацию',
      body: 'Партнёр готов заплатить за дополнительную медиа-активность между матчами.',
      optionA: 'ПРИНЯТЬ АКТИВАЦИЮ',
      optionB: 'ОТКАЗАТЬ',
    }
  }
  return {
    id: 'decision-media-' + state.season + '-' + state.week,
    kind: 'media',
    title: 'Пресса ждёт позицию клуба',
    body: won ? 'После победы можно снять давление с состава или поднять планку ожиданий.' : 'После поражения нужно выбрать публичный тон на следующую неделю.',
    optionA: 'ПОДДЕРЖАТЬ СОСТАВ',
    optionB: 'ДАВИТЬ НА РЕЗУЛЬТАТ',
  }
}

export const resolveClubDecision = (state: GameState, choice: 'a' | 'b'): GameState => {
  const decision = state.pendingDecision
  if (!decision) return state

  let next: GameState = { ...state, pendingDecision: null }
  let result = ''

  if (decision.kind === 'recovery') {
    if (choice === 'a') {
      next = {
        ...next,
        credits: Math.max(0, next.credits - 120),
        roster: next.roster.map((player) => ({ ...player, fatigue: clamp(player.fatigue - 12), morale: clamp(player.morale + 2) })),
      }
      result = 'Клуб оплатил восстановительный блок. Усталость состава снизилась.'
    } else {
      next = {
        ...next,
        managerXp: next.managerXp + 35,
        roster: next.roster.map((player) => ({ ...player, fatigue: clamp(player.fatigue + 4), morale: clamp(player.morale - 2) })),
      }
      result = 'Штаб сохранил высокий темп. Менеджер получил опыт, но состав заплатил усталостью.'
    }
  } else if (decision.kind === 'sponsor') {
    if (choice === 'a') {
      next = { ...next, credits: next.credits + 450, fans: next.fans + 40 }
      result = 'Активация принесла 450 кр. и дополнительный охват.'
    } else {
      next = { ...next, reputation: clamp(next.reputation + 2), managerXp: next.managerXp + 25 }
      result = 'Клуб отказался от быстрой сделки и сохранил спортивный фокус.'
    }
  } else if (choice === 'a') {
    next = {
      ...next,
      fans: next.fans + 50,
      roster: next.roster.map((player) => ({ ...player, morale: clamp(player.morale + 4) })),
    }
    result = 'Публичная поддержка подняла мораль и отклик аудитории.'
  } else {
    next = {
      ...next,
      reputation: clamp(next.reputation + 3),
      roster: next.roster.map((player) => ({ ...player, morale: clamp(player.morale - 3) })),
    }
    result = 'Жёсткая позиция повысила ожидания вокруг клуба, но добавила давления игрокам.'
  }

  return {
    ...next,
    news: [{
      id: 'resolved-' + decision.id,
      week: state.week,
      kind: decision.kind === 'sponsor' ? 'finance' as const : 'media' as const,
      title: decision.title,
      body: result,
    }, ...state.news].slice(0, 50),
  }
}

export const activeTournamentMatch = (state: GameState) => {
  if (!state.activeTournament) return null
  const run = advanceTournamentTo(state.activeTournament, state.now, state.seed + state.season)
  return nextPlayerMatch(run)
}

const settleFinishedTournament = (state: GameState, run: TournamentRun): GameState => {
  if (!tournamentIsFinished(run)) return { ...state, activeTournament: run }

  const event = tournamentForId(run.eventId)
  const prize = run.prizePaid ? 0 : tournamentPrizeForStatus(run.eventId, run)
  const settledRun: TournamentRun = {
    ...run,
    earnedPrize: run.earnedPrize + prize,
    prizePaid: true,
  }

  return {
    ...state,
    credits: state.credits + prize,
    activeEventId: null,
    activeTournament: null,
    tournamentHistory: [settledRun, ...state.tournamentHistory].slice(0, 30),
    news: event ? [{
      id: 'tournament-finish-' + settledRun.id,
      week: state.week,
      kind: 'match' as const,
      title: event.name + ' · ' + (settledRun.placement ?? settledRun.status).toUpperCase(),
      body: prize > 0
        ? 'Турнир завершён. Призовые: ' + prize + ' кр.'
        : 'Турнир завершён без призовых.',
    }, ...state.news].slice(0, 50) : state.news,
  }
}

export const advanceCareerTo = (state: GameState, target: string): GameState => {
  if (state.pendingDecision || compareGameTime(target, state.now) <= 0 || state.seasonEnded) return state

  const projectedTournament = state.activeTournament
    ? advanceTournamentTo(state.activeTournament, target, state.seed + state.season)
    : null
  const mandatoryMatch = nextPlayerMatch(projectedTournament)
  const effectiveTarget = mandatoryMatch && compareGameTime(target, mandatoryMatch.scheduledAt) > 0
    ? mandatoryMatch.scheduledAt
    : target
  const preparedTournament = state.activeTournament
    ? advanceTournamentTo(state.activeTournament, effectiveTarget, state.seed + state.season)
    : null

  const previousWeek = gameWeekForDate(state.seasonStart, state.now)
  const nextWeekRaw = gameWeekForDate(state.seasonStart, effectiveTarget)
  const payrollCycles = Math.max(0, nextWeekRaw - previousWeek)
  const payrollPerWeek = weeklyPayroll(state)
  const payrollCost = payrollPerWeek * payrollCycles
  const elapsedDays = Math.max(0, Math.floor(hoursBetween(state.now, effectiveTarget) / 24))

  let next: GameState = {
    ...state,
    activeTournament: preparedTournament,
    now: effectiveTarget,
    week: Math.min(state.seasonLength, nextWeekRaw),
    credits: Math.max(0, state.credits - payrollCost),
    staffEnergy: payrollCycles > 0 ? 3 : state.staffEnergy,
    roster: state.roster.map((player) => ({
      ...player,
      fatigue: clamp(player.fatigue - Math.min(18, elapsedDays * 2)),
      contractWeeks: Math.max(0, player.contractWeeks - payrollCycles),
    })),
    lastPayroll: payrollCycles > 0 ? payrollPerWeek : state.lastPayroll,
    lastWeekNet: payrollCycles > 0 ? -payrollPerWeek : state.lastWeekNet,
  }

  if (payrollCycles > 0) {
    next = {
      ...next,
      news: [{
        id: 'payroll-' + effectiveTarget,
        week: next.week,
        kind: 'finance' as const,
        title: 'Недельный расчёт клуба',
        body: 'Зарплаты: ' + payrollCost + ' кр. · прошло недель: ' + payrollCycles + '.',
      }, ...next.news].slice(0, 50),
    }
  }

  if (next.activeTournament) {
    const advanced = advanceTournamentTo(next.activeTournament, effectiveTarget, next.seed + next.season)
    next = settleFinishedTournament(next, advanced)
  }

  const seasonExpired = nextWeekRaw > state.seasonLength
  if (seasonExpired && !next.activeTournament) {
    const bestPlayer = [...next.history]
      .filter((match) => match.season === next.season)
      .flatMap((match) => match.performances)
      .sort((a, b) => b.rating - a.rating)[0]?.alias ?? null

    next = {
      ...next,
      seasonEnded: true,
      seasonSummary: {
        season: next.season,
        wins: next.wins,
        losses: next.losses,
        points: next.seasonPoints,
        reputation: next.reputation,
        fans: next.fans,
        credits: next.credits,
        bestPlayer,
        payroll: weeklyPayroll(next),
        objective: {
          label: 'Выиграть минимум 5 матчей',
          target: 5,
          value: next.wins,
          completed: next.wins >= 5,
        },
      },
    }
  }

  return next
}

export const canBookTournament = (state: GameState, eventId: string) => {
  const event = tournamentForId(eventId)
  if (!event) return { ok: false, reason: 'Событие недоступно.' }
  if (state.pendingDecision) return { ok: false, reason: 'Сначала закрой решение недели в Inbox.' }
  if (state.seasonEnded) return { ok: false, reason: 'Сезон завершён.' }

  const level = managerLevelFromXp(state.managerXp)
  if (level < event.unlockLevel) return { ok: false, reason: 'Откроется на уровне менеджера ' + event.unlockLevel + '.' }
  if (event.circuitTier === 1 && state.wins < 2 && state.reputation < 45) return { ok: false, reason: 'T1 требует 2 победы или 45 репутации.' }

  if (state.activeTournament && !tournamentIsFinished(state.activeTournament) && state.activeEventId !== eventId) {
    return { ok: false, reason: 'Сначала заверши уже выбранный турнир.' }
  }

  const startsAt = tournamentStartsAt(event, state.seasonStart)
  if (compareGameTime(state.now, startsAt) >= 0 && state.activeEventId !== eventId) {
    return { ok: false, reason: 'Регистрация уже закрыта.' }
  }

  const cost = tournamentEntryCost(event)
  if (state.credits < cost) return { ok: false, reason: 'Недостаточно средств на поездку.' }

  return { ok: true, reason: '' }
}

export const bookTournament = (state: GameState, eventId: string): GameState => {
  const event = tournamentForId(eventId)
  const gate = canBookTournament(state, eventId)
  if (!event || !gate.ok) return state
  if (state.activeEventId === eventId && state.activeTournament) return state

  const cost = tournamentEntryCost(event)
  const activeTournament = createTournamentRun(
    event,
    state.seasonStart,
    state.now,
    state.seed + state.season * 100 + event.startDay,
  )

  return {
    ...state,
    credits: Math.max(0, state.credits - cost),
    activeEventId: event.id,
    activeTournament,
    news: [{
      id: 'event-' + event.id + '-' + state.season,
      week: state.week,
      kind: 'media' as const,
      title: event.name + ' подтверждён',
      body: event.format === 'ONLINE'
        ? 'Онлайн-регистрация бесплатна. Первый матч появится в турнирной сетке по расписанию.'
        : 'Поездка подтверждена: ' + cost + ' кр. Первый матч появится в турнирной сетке по расписанию.',
    }, ...state.news].slice(0, 50),
  }
}

export const advanceToNextTournamentMatch = (state: GameState): GameState => {
  if (!state.activeTournament || state.seasonEnded) return state
  let current = state

  for (let guard = 0; guard < 24; guard += 1) {
    if (!current.activeTournament) return current

    const run = advanceTournamentTo(current.activeTournament, current.now, current.seed + current.season)
    current = settleFinishedTournament({ ...current, activeTournament: run }, run)
    if (!current.activeTournament) return current

    const playerMatch = nextPlayerMatch(current.activeTournament)
    if (playerMatch) {
      if (compareGameTime(current.now, playerMatch.scheduledAt) < 0) {
        current = advanceCareerTo(current, playerMatch.scheduledAt)
      }
      return current
    }

    const nextAction = nextTournamentActionTime(current.activeTournament)
    if (compareGameTime(nextAction, current.now) <= 0) {
      current = advanceCareerTo(current, addGameHours(current.now, 1))
    } else {
      current = advanceCareerTo(current, nextAction)
    }
  }

  return current
}

export const canPlayMatch = (state: GameState, mode: MatchMode) => {
  if (!state.welcomeComplete) return { ok: false, reason: 'Сначала открой стартовый набор и собери пятёрку.' }
  if (state.pendingDecision) return { ok: false, reason: 'Сначала закрой решение недели в Inbox.' }
  if (state.seasonEnded) return { ok: false, reason: 'Сезон завершён. Открой итог и начни следующий сезон.' }

  const active = getStartingFive(state.roster, state.startingFive)
  if (active.length !== 5) return { ok: false, reason: 'Выбери ровно пять игроков в основу.' }
  if (active.some((player) => player.contractWeeks <= 0)) {
    return { ok: false, reason: 'Продли контракт или убери из основы каждого игрока с истёкшим контрактом.' }
  }

  if (state.activeTournament) {
    const run = advanceTournamentTo(state.activeTournament, state.now, state.seed + state.season)
    if (tournamentIsFinished(run)) return { ok: false, reason: 'Турнир завершён.' }
    const match = nextPlayerMatch(run)
    if (!match) return { ok: false, reason: 'Ожидаются результаты других матчей сетки.' }
    if (compareGameTime(state.now, match.scheduledAt) < 0) return { ok: false, reason: 'Матч ещё не начался по расписанию.' }
    if (match.status !== 'ready') return { ok: false, reason: 'Сетка ещё не определила соперника.' }
  }

  const event = tournamentForId(state.activeEventId)
  const effectiveMode = event ? tournamentMode(event) : mode
  if (effectiveMode === 'cup' && !event && state.wins < 2 && state.reputation < 45) {
    return { ok: false, reason: 'Кубок откроется после 2 побед или при 45 репутации.' }
  }

  return { ok: true, reason: '' }
}

export const playMatch = (state: GameState, mode: MatchMode, tactic: TacticalPlan): GameState => {
  const gate = canPlayMatch(state, mode)
  if (!gate.ok) return state

  const event = tournamentForId(state.activeEventId)
  const effectiveMode = event ? tournamentMode(event) : mode
  const preparedRun = state.activeTournament
    ? advanceTournamentTo(state.activeTournament, state.now, state.seed + state.season)
    : null
  const tournamentMatch = preparedRun ? nextPlayerMatch(preparedRun) : null
  const tournamentOpponent = preparedRun ? opponentForPlayerMatch(preparedRun) : null

  const rng = mulberry32(hashSeed([
    state.seed,
    state.season,
    state.now,
    state.history.length,
    effectiveMode,
    tactic,
    tournamentMatch?.id ?? state.activeEventId ?? 'open',
    state.startingFive.join(','),
  ].join(':')))

  const opponent = tournamentOpponent
    ? { name: tournamentOpponent.name, rating: tournamentOpponent.rating }
    : generateOpponent(state, effectiveMode, rng)

  const active = getStartingFive(state.roster, state.startingFive)
  const baseRating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const tacticMod = tacticalModifier(active, tactic)
  const rolePenalty = (!active.some((player) => player.role === 'IGL') ? 4 : 0) + (!active.some((player) => player.role === 'AWP') ? 2.5 : 0)
  const maps: MapResult[] = []
  let ourMaps = 0
  let theirMaps = 0
  let momentum = 0

  while (ourMaps < 2 && theirMaps < 2) {
    const map = pick(mapPool.filter((name) => !maps.some((current) => current.map === name)), rng)
    const mapFatigue = maps.length * (tactic === 'aggressive' ? 1.6 : tactic === 'structured' ? .7 : 1)
    const effectiveRating = baseRating + tacticMod + momentum - rolePenalty - mapFatigue
    const volatility = tactic === 'aggressive' ? 6.8 : tactic === 'structured' ? 8.8 : 7.8
    const probability = 1 / (1 + Math.exp((opponent.rating - effectiveRating) / volatility))
    const wonMap = rng() < probability
    const closeness = 1 - Math.min(1, Math.abs(probability - .5) * 2)
    const [us, them] = mapScore(wonMap, closeness, rng)
    const mapTop = [...active].sort((a, b) => performanceRating(b, wonMap, tactic, rng) - performanceRating(a, wonMap, tactic, rng))[0]
    maps.push({ map, us, them, winChance: Math.round(probability * 100), topPerformer: mapTop.alias })
    if (wonMap) {
      ourMaps += 1
      momentum = Math.min(2.5, momentum + 1.2)
    } else {
      theirMaps += 1
      momentum = Math.max(-2.5, momentum - 1.2)
    }
  }

  const won = ourMaps > theirMaps
  const matchEnd = addGameHours(state.now, 3)
  let resolvedRun = preparedRun
    ? resolvePlayerTournamentMatch(preparedRun, won, ourMaps, theirMaps)
    : null
  if (resolvedRun) resolvedRun = advanceTournamentTo(resolvedRun, matchEnd, state.seed + state.season)

  const tournamentFinished = Boolean(resolvedRun && tournamentIsFinished(resolvedRun))
  const tournamentPrize = resolvedRun && tournamentFinished && !resolvedRun.prizePaid
    ? tournamentPrizeForStatus(resolvedRun.eventId, resolvedRun)
    : 0

  if (resolvedRun && tournamentFinished) {
    resolvedRun = {
      ...resolvedRun,
      earnedPrize: resolvedRun.earnedPrize + tournamentPrize,
      prizePaid: true,
    }
  }

  const tune = modeTuning[effectiveMode]
  const reward = event ? tournamentPrize : Math.round(tune.baseReward * (won ? 1 : .42))
  const payroll = 0
  const net = reward
  const fansDelta = Math.round(tune.fans * (won ? 1 : .25))

  const performances = active
    .map((player) => ({ playerId: player.id, alias: player.alias, rating: performanceRating(player, won, tactic, rng) }))
    .sort((a, b) => b.rating - a.rating)
  const mvpPerf = performances[0]
  const mvp = active.find((player) => player.id === mvpPerf.playerId) ?? active[0]
  const storyBase = narrative(state, opponent.name, won, mvp, effectiveMode, tactic, net, rng)
  const story = event
    ? {
        ...storyBase,
        detail: storyBase.detail + ' · ' + event.name + ' · ' + (tournamentMatch?.label ?? 'MATCH') + '.',
      }
    : storyBase

  const activeIds = new Set(active.map((player) => player.id))
  const roster = state.roster.map((player) => {
    const played = activeIds.has(player.id)
    const formDelta = played ? (won ? 3 : -2) + Math.round((rng() - .5) * 3) : Math.round((rng() - .5) * 2)
    const moraleDelta = played ? (won ? 4 : -4) : (won ? 1 : 0)
    const fatigueGain = (tactic === 'aggressive' ? 12 : tactic === 'structured' ? 8 : 10) + (event ? Math.round(event.fatigue * .35) : 0)
    return {
      ...player,
      form: clamp(player.form + formDelta),
      morale: clamp(player.morale + moraleDelta),
      fatigue: clamp(player.fatigue + (played ? fatigueGain : -6)),
    }
  })

  const result: MatchResult = {
    id: 'm-' + state.season + '-' + state.history.length + '-' + state.now.replace(/[^0-9]/g, ''),
    season: state.season,
    week: state.week,
    mode: effectiveMode,
    tactic,
    opponent: opponent.name,
    opponentRating: opponent.rating,
    won,
    maps,
    performances,
    reward,
    payroll,
    net,
    fansDelta,
    headline: story.headline,
    detail: story.detail,
    mvp: mvp.alias,
    playedAt: state.now,
    tournamentId: event?.id ?? null,
    tournamentMatchId: tournamentMatch?.id ?? null,
  }

  const contractNews: NewsItem[] = roster.some((player) => player.contractWeeks <= 2)
    ? [{
        id: 'contracts-warning-' + result.id,
        week: state.week,
        kind: 'contract' as const,
        title: 'Контрактное давление растёт',
        body: 'До окончания контрактов осталось не больше двух недель: ' + roster.filter((player) => player.contractWeeks <= 2).map((player) => player.alias).join(', ') + '.',
      }]
    : []

  const financeNews: NewsItem[] = reward > 0
    ? [{
        id: 'finance-' + result.id,
        week: state.week,
        kind: 'finance' as const,
        title: event ? 'Турнир выплатил призовые' : 'Доход от матча',
        body: 'Доход: +' + reward + ' кр.',
      }]
    : []

  const nextWeek = Math.min(state.seasonLength, gameWeekForDate(state.seasonStart, matchEnd))
  const nextActiveTournament = resolvedRun && !tournamentFinished ? resolvedRun : null
  const finishedHistory = resolvedRun && tournamentFinished
    ? [resolvedRun, ...state.tournamentHistory].slice(0, 30)
    : state.tournamentHistory

  const next: GameState = {
    ...state,
    now: matchEnd,
    week: nextWeek,
    credits: state.credits + reward,
    fans: Math.max(0, state.fans + fansDelta),
    reputation: clamp(state.reputation + (won ? (effectiveMode === 'cup' ? 5 : 3) : -1)),
    wins: state.wins + (won ? 1 : 0),
    losses: state.losses + (won ? 0 : 1),
    streak: won ? Math.max(1, state.streak + 1) : Math.min(-1, state.streak - 1),
    seasonPoints: state.seasonPoints + (won ? (effectiveMode === 'cup' ? 5 : effectiveMode === 'showmatch' ? 3 : 1) : 0),
    roster,
    lineupContinuity: clamp(state.lineupContinuity + (won ? 3 : 1), 0, 100),
    history: [result, ...state.history].slice(0, 80),
    news: [
      { id: 'news-' + result.id, week: state.week, kind: 'match' as const, title: story.headline, body: story.detail },
      ...financeNews,
      ...contractNews,
      ...state.news,
    ].slice(0, 80),
    managerXp: state.managerXp + (effectiveMode === 'cup' ? 100 : effectiveMode === 'showmatch' ? 75 : 55) + (won ? 35 : 10),
    packTokens: state.packTokens + (won ? (effectiveMode === 'cup' ? 55 : effectiveMode === 'showmatch' ? 40 : 25) : 10),
    activeEventId: nextActiveTournament?.eventId ?? null,
    activeTournament: nextActiveTournament,
    tournamentHistory: finishedHistory,
    pendingDecision: event
      ? (tournamentFinished ? weeklyDecision(state, won) : null)
      : weeklyDecision(state, won),
    lastWeekNet: reward,
  }

  const seasonWeekAfterMatch = gameWeekForDate(next.seasonStart, next.now)
  if (seasonWeekAfterMatch > next.seasonLength && !next.activeTournament) {
    return advanceCareerTo(next, addGameHours(next.now, 1))
  }

  return next
}

export const startNextSeason = (state: GameState): GameState => {
  if (!state.seasonEnded) return state
  const roster = state.roster.map((player) => ({
    ...player,
    fatigue: clamp(Math.round(player.fatigue * .35)),
    morale: clamp(Math.round((player.morale + 60) / 2)),
    form: clamp(Math.round((player.form + 55) / 2)),
  }))
  const seasonStart = addGameDays(state.seasonStart, state.seasonLength * 7 + 7, 9)

  return {
    ...state,
    season: state.season + 1,
    seasonStart,
    now: seasonStart,
    week: 1,
    seasonLength: 16,
    seasonEnded: false,
    seasonSummary: null,
    wins: 0,
    losses: 0,
    streak: 0,
    seasonPoints: 0,
    activeEventId: null,
    activeTournament: null,
    pendingDecision: null,
    roster,
    news: [{
      id: 'season-start-' + (state.season + 1),
      week: 1,
      kind: 'media' as const,
      title: 'Начался новый сезон',
      body: 'Календарь обновлён. Турниры снова распределены по датам, а форма и усталость состава частично восстановлены.',
    }, ...state.news].slice(0, 80),
  }
}

export const trainPlayer = (state: GameState, playerId: string): GameState => {
  if (state.staffEnergy < 1 || state.credits < 120) return state
  return {
    ...state,
    credits: state.credits - 120,
    staffEnergy: state.staffEnergy - 1,
    roster: state.roster.map((player) => {
      if (player.id !== playerId) return player
      const skills = [
        ['aim', player.aim],
        ['gameSense', player.gameSense],
        ['utility', player.utility],
        ['clutch', player.clutch],
        ['leadership', player.leadership],
      ] as const
      const weakest = [...skills].sort((a, b) => a[1] - b[1])[0][0]
      return {
        ...player,
        [weakest]: clamp(player[weakest] + 1),
        form: clamp(player.form + 2),
        morale: clamp(player.morale + 1),
        fatigue: clamp(player.fatigue + 7),
      }
    }),
  }
}

export const restPlayer = (state: GameState, playerId: string): GameState => {
  if (state.staffEnergy < 1) return state
  return {
    ...state,
    staffEnergy: state.staffEnergy - 1,
    roster: state.roster.map((player) =>
      player.id === playerId
        ? { ...player, fatigue: clamp(player.fatigue - 22), morale: clamp(player.morale + 2), form: clamp(player.form - 1) }
        : player,
    ),
  }
}

const currentLineupSlots = (state: GameState) =>
  state.lineupSlots ?? inferLineupSlots(state.roster, state.startingFive)

export const assignLineupSlot = (state: GameState, slot: LineupSlot, playerId: string): GameState => {
  const player = state.roster.find((candidate) => candidate.id === playerId)
  if (!player || player.contractWeeks <= 0) return state

  const slots = { ...currentLineupSlots(state) }
  const fromSlot = LINEUP_SLOTS.find((candidate) => slots[candidate] === playerId)
  const displacedId = slots[slot]

  if (fromSlot === slot) return state
  if (fromSlot) slots[fromSlot] = displacedId ?? null
  slots[slot] = playerId

  const startingFive = lineupSlotIds(slots)
  return {
    ...state,
    lineupSlots: slots,
    startingFive,
    lineupContinuity: clamp(state.lineupContinuity - 6),
    news: [{
      id: 'lineup-slot-' + state.week + '-' + slot + '-' + playerId,
      week: state.week,
      kind: 'lineup' as const,
      title: player.alias + ' занимает слот ' + slot,
      body: displacedId
        ? 'Игроки поменялись местами в активной пятёрке. Стабильность временно снижается после перестановки.'
        : 'Изменение активной пятёрки временно снижает стабильность. Постоянный состав восстанавливает химию через матчи.',
    }, ...state.news].slice(0, 50),
  }
}

export const clearLineupSlot = (state: GameState, slot: LineupSlot): GameState => {
  const slots = { ...currentLineupSlots(state) }
  const playerId = slots[slot]
  if (!playerId) return state
  const player = state.roster.find((candidate) => candidate.id === playerId)
  slots[slot] = null
  return {
    ...state,
    lineupSlots: slots,
    startingFive: lineupSlotIds(slots),
    lineupContinuity: clamp(state.lineupContinuity - 8),
    news: [{
      id: 'lineup-clear-' + state.week + '-' + slot + '-' + playerId,
      week: state.week,
      kind: 'lineup' as const,
      title: (player?.alias ?? 'Игрок') + ' отправляется в запас',
      body: 'Слот ' + slot + ' освобождён. Матч потребует полностью собранную пятёрку.',
    }, ...state.news].slice(0, 50),
  }
}

export const toggleStarter = (state: GameState, playerId: string): GameState => {
  const player = state.roster.find((candidate) => candidate.id === playerId)
  if (!player) return state
  const slots = currentLineupSlots(state)
  const occupiedSlot = LINEUP_SLOTS.find((slot) => slots[slot] === playerId)
  if (occupiedSlot) return clearLineupSlot(state, occupiedSlot)
  if (state.startingFive.length >= 5 || player.contractWeeks <= 0) return state

  const emptySlots = LINEUP_SLOTS.filter((slot) => !slots[slot])
  const bestSlot = [...emptySlots].sort((a, b) => lineupFitScore(player, b) - lineupFitScore(player, a))[0]
  return bestSlot ? assignLineupSlot(state, bestSlot, playerId) : state
}

const proPlayerIdentities = REAL_PLAYERS
const profileIdFromUrl = (profileUrl: string | null | undefined) => {
  const match = profileUrl?.match(/\/player\/(\d+)/)
  return match ? Number(match[1]) : null
}
const simulationRoles: readonly Role[] = ['IGL', 'Entry', 'Rifler', 'AWP', 'Support']

const traits = ['Чистый аим', 'Ученик игры', 'Не боится большой сцены', 'Рабочая лошадка', 'Креативный коллер', 'Чутьё в позднем раунде'] as const

const matchesAgeProfile = (age: number | null, profile: ScoutAgeProfile) => {
  if (profile === 'any' || age == null) return true
  if (profile === 'u23') return age <= 23
  if (profile === 'prime') return age >= 24 && age <= 28
  return age >= 29
}

const makeProspect = (
  state: GameState,
  index: number,
  identity: (typeof proPlayerIdentities)[number],
  rng: () => number,
  brief: ScoutBrief,
): Player => {
  const base = Math.round(54 + state.reputation * 0.22 + rng() * 14)
  const role = identity.role ?? (brief.role === 'Any' ? pick(simulationRoles, rng) : brief.role)
  return {
    id: 'prospect-' + state.scoutCycle + '-' + index + '-' + identity.alias,
    playerKey: 'alias:' + identity.alias.toLocaleLowerCase('en-US'),
    acquiredCardId: null,
    profileId: profileIdFromUrl(identity.profileUrl),
    alias: identity.alias,
    firstName: identity.realName ?? identity.alias,
    realName: identity.realName ?? identity.alias,
    country: identity.country ?? 'Неизвестно',
    team: identity.team,
    age: identity.age,
    role,
    aim: clamp(base + Math.round((rng() - 0.5) * 14)),
    gameSense: clamp(base + Math.round((rng() - 0.5) * 14)),
    utility: clamp(base + Math.round((rng() - 0.5) * 14)),
    clutch: clamp(base + Math.round((rng() - 0.5) * 14)),
    leadership: clamp(base + Math.round((rng() - 0.5) * 14)),
    form: Math.round(48 + rng() * 25),
    morale: Math.round(55 + rng() * 30),
    fatigue: Math.round(rng() * 12),
    potential: clamp(base + 15 + Math.round(rng() * 15)),
    salary: Math.round(70 + base * 0.72),
    contractWeeks: 8,
    traits: [pick(traits, rng), pick(traits, rng)],
    bio: identity.realName
      ? identity.realName + ' · ' + (identity.country ?? 'страна неизвестна') + ' · команда в профиле: ' + identity.team + '. Рейтинг, зарплата и потенциал вымышлены для игрового процесса.'
      : identity.alias + ' · команда по срезу Valve VRS: ' + identity.team + ' (2026-09-07). Полное имя, национальность и возраст пока не обогащены; роль, рейтинг, зарплата и потенциал являются данными симуляции.',
  }
}

export const scoutFitScore = (player: Player, brief: ScoutBrief) => {
  const roleScore = brief.role === 'Any' ? overall(player) : lineupFitScore(player, brief.role)
  const budgetPenalty = Math.max(0, player.salary - brief.maxSalary) * 0.45
  const ageBonus =
    brief.ageProfile === 'u23' && player.age != null && player.age <= 23 ? 7
      : brief.ageProfile === 'prime' && player.age != null && player.age >= 24 && player.age <= 28 ? 6
        : brief.ageProfile === 'veteran' && player.age != null && player.age >= 29 ? 5
          : brief.ageProfile === 'any' ? 2 : 0
  return Math.round(roleScore + player.potential * 0.12 + ageBonus - budgetPenalty)
}

export const scout = (state: GameState, rawBrief: ScoutBrief = state.scoutBrief ?? DEFAULT_SCOUT_BRIEF): GameState => {
  if (state.credits < SCOUT_REPORT_COST) return state
  const brief = normalizeScoutBrief(rawBrief)
  const rng = mulberry32(hashSeed([
    state.seed,
    'scout-v2',
    state.scoutCycle,
    state.week,
    brief.role,
    brief.maxSalary,
    brief.ageProfile,
  ].join(':')))
  const rosterAliases = new Set(state.roster.map((player) => player.alias.toLocaleLowerCase('en-US')))
  const available = proPlayerIdentities
    .filter((identity) => !rosterAliases.has(identity.alias.toLocaleLowerCase('en-US')))
    .filter((identity) => brief.role === 'Any' || identity.role === brief.role || identity.role == null)
    .filter((identity) => matchesAgeProfile(identity.age, brief.ageProfile))

  const pool = [...available]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const generated = pool
    .slice(0, Math.min(120, pool.length))
    .map((identity, index) => makeProspect(state, index, identity, rng, brief))

  const shortlistSize = managerLevelFromXp(state.managerXp) >= 5 ? 7 : managerLevelFromXp(state.managerXp) >= 3 ? 6 : 5
  const ranked = generated
    .sort((a, b) =>
      Number(b.salary <= brief.maxSalary) - Number(a.salary <= brief.maxSalary) ||
      scoutFitScore(b, brief) - scoutFitScore(a, brief) ||
      overall(b) - overall(a),
    )
    .slice(0, shortlistSize)

  return {
    ...state,
    credits: state.credits - SCOUT_REPORT_COST,
    scoutCycle: state.scoutCycle + 1,
    scoutBrief: brief,
    prospects: ranked,
    news: [{
      id: 'scout-' + state.scoutCycle,
      week: state.week,
      kind: 'scout' as const,
      title: 'Скаутский shortlist готов',
      body: 'Запрос: ' + (brief.role === 'Any' ? 'любая роль' : brief.role) + ', зарплата до ' + brief.maxSalary + ' кр./нед. Штаб вернул ' + ranked.length + ' кандидатов.',
    }, ...state.news].slice(0, 50),
  }
}

export const prospectAskingFee = (player: Player) =>
  Math.max(180, Math.round(player.salary * 2.15 + overall(player) * 3.1 + player.potential * 1.15))

export const defaultNegotiationTerms = (player: Player): NegotiationTerms => ({
  fee: prospectAskingFee(player),
  salary: player.salary,
  contractWeeks: 12,
  squadRole: 'rotation',
})

export const evaluateNegotiation = (
  state: GameState,
  player: Player,
  terms: NegotiationTerms,
): NegotiationEvaluation => {
  const askingFee = prospectAskingFee(player)
  const askingSalary = player.salary
  const normalized: NegotiationTerms = {
    fee: Math.max(0, Math.round(terms.fee)),
    salary: Math.max(0, Math.round(terms.salary)),
    contractWeeks: Math.round(clamp(terms.contractWeeks, 6, 16)),
    squadRole: terms.squadRole === 'starter' ? 'starter' : 'rotation',
  }

  const feeScore = clamp(normalized.fee / askingFee, 0, 1.3) * 40
  const salaryScore = clamp(normalized.salary / askingSalary, 0, 1.3) * 36
  const contractScore = normalized.contractWeeks >= 14 ? 11 : normalized.contractWeeks >= 12 ? 9 : normalized.contractWeeks >= 10 ? 7 : normalized.contractWeeks >= 8 ? 4 : 1
  const roleScore = normalized.squadRole === 'starter' ? 10 : 4
  const reputationBonus = clamp((state.reputation - 40) * 0.16, -4, 8)
  const score = Math.round(feeScore + salaryScore + contractScore + roleScore + reputationBonus)
  const threshold = Math.round(91 + Math.max(0, overall(player) - 76) * 0.28 + Math.max(0, player.potential - 82) * 0.12)
  const affordable = state.credits >= normalized.fee
  const accepted = affordable && score >= threshold
  const gap = threshold - score
  const interest: NegotiationEvaluation['interest'] = accepted ? 'ready' : gap <= 5 ? 'warm' : gap <= 13 ? 'open' : 'cold'
  const reason = !affordable
    ? 'В кассе недостаточно средств на трансферный платёж.'
    : accepted
      ? 'Условия устраивают игрока и текущий клуб.'
      : gap <= 5
        ? 'Почти договорились: немного улучши зарплату, платёж или роль.'
        : gap <= 13
          ? 'Интерес есть, но пакет условий пока слабый.'
          : 'Игрок не готов переходить на этих условиях.'

  return { score, threshold, accepted, interest, askingFee, askingSalary, reason }
}

export const negotiateProspect = (
  state: GameState,
  playerId: string,
  terms: NegotiationTerms,
): { state: GameState; evaluation: NegotiationEvaluation } => {
  const prospect = state.prospects.find((player) => player.id === playerId)
  if (!prospect) {
    const dummy: Player = state.roster[0] ?? {
      id: 'missing', alias: '—', firstName: '—', realName: '—', country: '—', team: '—', age: null, role: 'Rifler',
      aim: 0, gameSense: 0, utility: 0, clutch: 0, leadership: 0, form: 0, morale: 0, fatigue: 0, potential: 0,
      salary: 1, contractWeeks: 0, traits: [], bio: '',
    }
    return { state, evaluation: { ...evaluateNegotiation(state, dummy, terms), accepted: false, reason: 'Кандидат больше не доступен.' } }
  }

  const evaluation = evaluateNegotiation(state, prospect, terms)
  if (state.roster.length >= 8) {
    return { state, evaluation: { ...evaluation, accepted: false, reason: 'В ростере нет свободного места.' } }
  }
  if (!evaluation.accepted) return { state, evaluation }

  const signed: Player = {
    ...prospect,
    salary: Math.max(1, Math.round(terms.salary)),
    contractWeeks: Math.round(clamp(terms.contractWeeks, 6, 16)),
    morale: clamp(prospect.morale + (terms.squadRole === 'starter' ? 7 : 3)),
  }

  let next: GameState = {
    ...state,
    credits: state.credits - Math.max(0, Math.round(terms.fee)),
    roster: [...state.roster, signed],
    prospects: state.prospects.filter((player) => player.id !== playerId),
    news: [{
      id: 'sign-' + playerId + '-' + state.week,
      week: state.week,
      kind: 'contract' as const,
      title: prospect.alias + ' подписывает контракт',
      body: 'Трансфер: ' + Math.round(terms.fee) + ' кр. Зарплата: ' + Math.round(terms.salary) + ' кр./нед. Срок: ' + Math.round(terms.contractWeeks) + ' нед. Роль: ' + (terms.squadRole === 'starter' ? 'основа' : 'ротация') + '.',
    }, ...state.news].slice(0, 50),
  }

  if (terms.squadRole === 'starter') {
    const bestSlot = [...LINEUP_SLOTS].sort((a, b) => lineupFitScore(signed, b) - lineupFitScore(signed, a))[0]
    next = assignLineupSlot(next, bestSlot, signed.id)
  }

  return { state: next, evaluation }
}

export const signProspect = (state: GameState, playerId: string): GameState => {
  const prospect = state.prospects.find((player) => player.id === playerId)
  if (!prospect) return state
  const terms = defaultNegotiationTerms(prospect)
  return negotiateProspect(state, playerId, { ...terms, fee: Math.round(terms.fee * 1.08), squadRole: 'starter' }).state
}

export const renewContract = (state: GameState, playerId: string): GameState => {
  const player = state.roster.find((p) => p.id === playerId)
  if (!player) return state
  const cost = player.salary * 4
  if (state.credits < cost) return state
  return {
    ...state,
    credits: state.credits - cost,
    roster: state.roster.map((p) =>
      p.id === playerId ? { ...p, contractWeeks: p.contractWeeks + 6, morale: clamp(p.morale + 3) } : p,
    ),
    news: [{
      id: 'renew-' + playerId + '-' + state.week,
      week: state.week,
      kind: 'contract' as const,
      title: player.alias + ' продлевает контракт на шесть недель',
      body: 'Стоимость продления: ' + cost + ' кр. Недельная зарплата остаётся ' + player.salary + ' кр.',
    }, ...state.news].slice(0, 50),
  }
}

export const releasePlayer = (state: GameState, playerId: string): GameState => {
  if (state.roster.length <= 5) return state
  const player = state.roster.find((p) => p.id === playerId)
  if (!player) return state
  const severance = player.contractWeeks <= 0 ? 0 : player.salary
  if (state.credits < severance) return state
  return {
    ...state,
    credits: state.credits - severance,
    roster: state.roster.filter((p) => p.id !== playerId),
    startingFive: state.startingFive.filter((id) => id !== playerId),
    lineupSlots: Object.fromEntries(
      LINEUP_SLOTS.map((slot) => [slot, currentLineupSlots(state)[slot] === playerId ? null : currentLineupSlots(state)[slot]]),
    ) as LineupSlots,
    lineupContinuity: clamp(state.lineupContinuity - (state.startingFive.includes(playerId) ? 12 : 4)),
    news: [{
      id: 'release-' + playerId + '-' + state.week,
      week: state.week,
      kind: 'contract' as const,
      title: player.alias + ' покидает проект',
      body: 'Компенсация: ' + severance + ' кр. Зарплатная нагрузка состава снижается сразу.',
    }, ...state.news].slice(0, 50),
  }
}

export const modeInfo: Record<MatchMode, { name: string; description: string; risk: string }> = {
  scrim: {
    name: 'Тренировочный микс',
    description: 'Меньше давления и слабее соперник. Подходит для стабилизации изменённого состава, но доход ограничен.',
    risk: 'Low',
  },
  showmatch: {
    name: 'Шоуматч сообщества',
    description: 'Публичный BO3 с заметным ростом аудитории и доходом, достаточным для дисциплинированного состава.',
    risk: 'Medium',
  },
  cup: {
    name: 'Онлайн-кубок',
    description: 'Сильные соперники и лучший потенциальный выигрыш. Открывается после 2 побед или при 45 репутации.',
    risk: 'High',
  },
}
