import { REAL_PLAYERS } from './players'
import { rarityForPlayer } from './packs'
import { collectPackCards, createPackState, type PackCard, type PackRarity, type PackState } from './packState'
import { tournamentEntryCost, tournamentForId, tournamentMode, type TournamentEvent } from './events'
import { INITIAL_SEASON_START, addGameDays, addGameHours, compareGameTime, gameWeekForDate, hoursBetween } from './calendar'
import { advanceTournamentTo, createTournamentRun, nextPlayerMatch, nextTournamentActionTime, opponentForPlayerMatch, refreshTournamentTeamsFromWorld, resolvePlayerTournamentMatch, tournamentIsFinished, tournamentPrizeForStatus, tournamentStartsAt, type TournamentPlayerTeamSeed, type TournamentRosterPlayer, type TournamentRun } from './tournamentEngine'
import { PLAYER_CLUB_WORLD_ID, advanceWorldWeeks, awardWorldTeamVrs, claimWorldPlayersForClub, createWorldState, reconcileWorldWithClubRoster, refreshWorldIdentityMetadata, releaseWorldPlayerFromClub, repairWorldIntegrity, worldLineup, worldPlayerByAlias, worldTeamForPlayer, type WorldPlayer, type WorldState } from './world'
import { advanceWorldEcology, ensureWorldEcology, worldEventsSince, type WorldHistoryEvent } from './worldEcology'
import { TRAINING_MAPS, createTrainingState, normalizeTrainingState, trainingPreparationModifier, type PlayerDevelopmentState, type TrainingMap, type TrainingState } from './trainingTypes'
import { cardStatsForAlias } from './cardStats'
import { appendRatingEvidence, buildPlayerRatingV2, type PlayerRatingV2, type RatingEvidence } from './ratingEngine'
import { createFinanceState, normalizeFinanceState, postFinanceEntry, type FinanceAccount, type FinanceLedgerEntry, type FinanceState } from './finance'
import { appendClubEvent, normalizeClubEvents, projectEventToNews, type ClubEvent } from './clubEvents'
import { activeTransferCaseForPlayer, createTransferCase, normalizeTransferCases, transitionTransferCase, type TransferCase } from './transferLifecycle'

export type Role = 'IGL' | 'Entry' | 'Rifler' | 'AWP' | 'Support'
export type LineupSlot = Role
export type LineupSlots = Record<LineupSlot, string | null>
export const LINEUP_SLOTS: readonly LineupSlot[] = ['Entry', 'AWP', 'Rifler', 'Support', 'IGL']
export type MatchMode = 'practice' | 'scrim' | 'showmatch' | 'cup'
export type TacticalPlan = 'balanced' | 'aggressive' | 'structured'
export type ScoutAgeProfile = 'any' | 'u23' | 'prime' | 'veteran'
export type ScoutRoleTarget = Role | 'Any'
export type SquadPromise = 'starter' | 'rotation'

export interface ScoutBrief {
  role: ScoutRoleTarget
  maxSalary: number
  ageProfile: ScoutAgeProfile
}

export interface SquadPlannerState {
  version: 1
  orders: Record<string, string[]>
  excluded: Record<string, string[]>
}

export const createSquadPlannerState = (): SquadPlannerState => ({
  version: 1,
  orders: {},
  excluded: {},
})

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
  cardRarity?: PackRarity | null
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
  ratingV2?: PlayerRatingV2
}

export interface MapResult {
  map: string
  us: number
  them: number
  winChance: number
  topPerformer: string
  story?: MapStory
}

export interface PlayerPerformance {
  playerId: string
  alias: string
  rating: number
}

export type MatchNarrativeTag =
  | 'COMEBACK'
  | 'STOMP'
  | 'CHOKE'
  | 'CLUTCH_HEAVY'
  | 'TACTICAL_OUTPLAY'
  | 'WEAK_MAP'
  | 'PLAYER_COLLAPSE'
  | 'ANTI_STRAT_SUCCESS'
  | 'FATIGUE'
  | 'COMMUNICATION_BREAKDOWN'

export type MatchRoundCause =
  | 'AIM'
  | 'TACTICAL_EDGE'
  | 'ANTI_STRAT'
  | 'CLUTCH'
  | 'PLAYER_ERROR'
  | 'FATIGUE'
  | 'COMMUNICATION'
  | 'MOMENTUM'

export interface MatchRoundStory {
  round: number
  winner: 'US' | 'THEM'
  scoreUs: number
  scoreThem: number
  cause: MatchRoundCause
  keyPlayer?: string
  keyPlayerSide?: 'US' | 'THEM'
  clutch?: boolean
  note: string
}

export interface MapStory {
  map: string
  tags: MatchNarrativeTag[]
  rounds: MatchRoundStory[]
  turningPoint: string
  explanation: string
  factors: {
    tactics: number
    preparation: number
    fatigue: number
    communication: number
    clutch: number
    individual: number
    mapFit?: number
    adaptation?: number
  }
  opponentFactors?: {
    tactics: number
    preparation: number
    fatigue: number
    communication: number
    clutch: number
    individual: number
    mapFit?: number
    adaptation?: number
  }
}

export interface MatchStory {
  tags: MatchNarrativeTag[]
  summary: string
  maps: MapStory[]
}

export interface MatchFixture {
  id: string
  mode: MatchMode
  tactic: TacticalPlan
  opponent: string
  opponentRating: number
  opponentTeamId: string | null
  opponentRoster: TournamentRosterPlayer[]
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
  opponentTeamId?: string | null
  opponentRoster?: TournamentRosterPlayer[]
  vrsDelta?: number
  story?: MatchStory
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

export type NewsScope = 'club' | 'world'
export type NewsAttention = 'info' | 'action'

export interface NewsItem {
  id: string
  week: number
  kind: 'match' | 'media' | 'contract' | 'scout' | 'finance' | 'lineup'
  title: string
  body: string
  scope?: NewsScope
  attention?: NewsAttention
}

export const newsBelongsInInbox = (item: NewsItem) =>
  item.scope === 'club' || (item.scope == null && !item.id.startsWith('ecology-'))

export const newsRequiresAction = (item: NewsItem) =>
  newsBelongsInInbox(item) && item.attention === 'action'

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
  version: 13
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
  clubVrsPoints: number
  staffEnergy: number
  activeEventId: string | null
  activeTournament: TournamentRun | null
  tournamentHistory: TournamentRun[]
  world: WorldState
  pendingDecision: ClubDecision | null
  welcomeComplete: boolean
  roster: Player[]
  startingFive: string[]
  lineupSlots: LineupSlots
  lineupContinuity: number
  prospects: Player[]
  scoutCycle: number
  scoutBrief: ScoutBrief
  squadPlanner: SquadPlannerState
  training: TrainingState
  history: MatchResult[]
  news: NewsItem[]
  clubEvents: ClubEvent[]
  finance: FinanceState
  transferCases: TransferCase[]
  lastPayroll: number
  lastWeekNet: number
  packs: PackState
}

export const worldEventTouchesPlayerClub = (
  state: Pick<GameState, 'roster'>,
  event: WorldHistoryEvent,
) => {
  const playerClubActorIds = new Set<string>([
    PLAYER_CLUB_WORLD_ID,
    ...state.roster.flatMap((player) =>
      [player.id, player.playerKey].filter((value): value is string => Boolean(value)),
    ),
  ])
  return event.actorIds.some((actorId) => playerClubActorIds.has(actorId))
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

const financeStateFor = (state: Pick<GameState, 'finance' | 'credits'>) =>
  state.finance?.version === 1 ? state.finance : createFinanceState(state.credits)

const postClubFinance = (
  state: GameState,
  entry: Omit<FinanceLedgerEntry, 'direction'>,
): GameState => {
  const finance = postFinanceEntry(financeStateFor(state), {
    ...entry,
    direction: entry.amount >= 0 ? 'income' : 'expense',
  })
  return { ...state, finance, credits: finance.cash }
}

const recordClubEvent = (
  state: GameState,
  event: ClubEvent,
  projectNews = true,
): GameState => {
  const clubEvents = appendClubEvent(state.clubEvents ?? [], event)
  if (!projectNews) return { ...state, clubEvents }
  const newsItem = projectEventToNews(event)
  return {
    ...state,
    clubEvents,
    news: [newsItem, ...state.news.filter((item) => item.id !== newsItem.id)].slice(0, 100),
  }
}

const clubWorldRosterProjection = (roster: Player[]) =>
  roster.map((player) => ({
    playerKey: player.playerKey,
    alias: player.alias,
    contractWeeks: player.contractWeeks,
    salary: player.salary,
    rating: overall(player),
  }))

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

const playerRatingSkills = (p: Pick<Player, 'aim' | 'gameSense' | 'utility' | 'clutch' | 'leadership'>) => ({
  aim: p.aim,
  gameSense: p.gameSense,
  utility: p.utility,
  clutch: p.clutch,
  leadership: p.leadership,
})

export const overall = (p: Player) =>
  p.ratingV2?.version === 2
    ? p.ratingV2.rating
    : buildPlayerRatingV2(playerRatingSkills(p), p.role).rating

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
  // Player quality is the primary competitive signal. Chemistry still matters,
  // but it should not flatten a clear skill gap between lineups.
  return Math.round(clamp(raw * 0.94 + chemistry(roster, active.map((p) => p.id), continuity) * 0.06))
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
    cardRarity: card.rarity,
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
  const roster = cards.map(playerFromPackCard).map((player) => ({ ...player, team: 'YOUR CLUB' }))
  const aliases = roster.map((player) => player.alias).join(' · ')
  return {
    ...state,
    welcomeComplete: true,
    roster,
    world: reconcileWorldWithClubRoster(state.world, roster, state.now, state.seed),
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
  version: 13,
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
  clubVrsPoints: 720,
  staffEnergy: 3,
  activeEventId: null,
  activeTournament: null,
  tournamentHistory: [],
  world: createWorldState(),
  pendingDecision: null,
  welcomeComplete: false,
  roster: [],
  startingFive: [],
  lineupSlots: createEmptyLineupSlots(),
  lineupContinuity: 50,
  prospects: [],
  scoutCycle: 0,
  scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
  squadPlanner: createSquadPlannerState(),
  training: createTrainingState(),
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
  clubEvents: [{
    id: 'club-created',
    at: INITIAL_SEASON_START,
    week: 1,
    kind: 'media',
    title: 'Новый проект выходит на сцену',
    detail: 'Клуб начинает карьеру и готовится собрать первую пятёрку.',
    importance: 80,
    actorIds: [],
    teamIds: [PLAYER_CLUB_WORLD_ID],
  }],
  finance: createFinanceState(3200),
  transferCases: [],
  lastPayroll: 0,
  lastWeekNet: 0,
  packs: createPackState(),
})

const normalizePlayers = (players: Player[], packs: PackState): Player[] => players.map((player) => {
  const aliasKey = player.alias.toLocaleLowerCase('en-US')
  const card = (player.acquiredCardId
    ? packs.inventory.find((entry) => entry.id === player.acquiredCardId)
    : undefined) ?? packs.inventory.find((entry) => entry.alias.toLocaleLowerCase('en-US') === aliasKey)
  const identity = REAL_PLAYERS.find((entry) => entry.alias.toLocaleLowerCase('en-US') === aliasKey)
  const profileMatch = identity?.profileUrl?.match(/\/player\/(\d+)/)
  const semanticCardRarity = identity && card ? rarityForPlayer(identity) : card?.rarity ?? null
  return {
    ...player,
    playerKey: player.playerKey ?? (profileMatch ? 'hltv:' + profileMatch[1] : 'alias:' + aliasKey),
    acquiredCardId: player.acquiredCardId ?? card?.id ?? null,
    cardRarity: player.cardRarity ?? semanticCardRarity,
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

const normalizeSquadPlanner = (raw: unknown): SquadPlannerState => {
  if (!raw || typeof raw !== 'object') return createSquadPlannerState()
  const source = raw as Partial<SquadPlannerState>
  const normalizeMap = (value: unknown) => {
    if (!value || typeof value !== 'object') return {} as Record<string, string[]>
    const result: Record<string, string[]> = {}
    for (const [key, items] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(items)) continue
      result[key] = items.filter((item): item is string => typeof item === 'string').slice(0, 16)
    }
    return result
  }
  return {
    version: 1,
    orders: normalizeMap(source.orders),
    excluded: normalizeMap(source.excluded),
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

const tournamentPlayerSeedFromRoster = (
  roster: Player[],
  startingFive: string[],
  continuity = 50,
): TournamentPlayerTeamSeed => {
  const active = getStartingFive(roster, startingFive)
  return {
    rating: active.length === 5 ? teamRating(roster, startingFive, continuity) : 55,
    roster: active.map((player) => ({
      playerKey: player.playerKey ?? 'alias:' + player.alias.toLocaleLowerCase('en-US'),
      alias: player.alias,
      role: player.role,
      rating: overall(player),
      profileId: player.profileId ?? null,
      country: player.country || null,
    })),
  }
}

const normalizedWorld = (
  raw: unknown,
  roster: Player[],
  now: string,
  seed: number,
) => {
  const source = raw && typeof raw === 'object' && (raw as { version?: number }).version === 1
    ? raw as WorldState
    : createWorldState()
  const refreshed = refreshWorldIdentityMetadata(source)
  const ecological = ensureWorldEcology(refreshed, seed, now)
  return reconcileWorldWithClubRoster(ecological, clubWorldRosterProjection(roster), now, seed)
}

export const migrateState = (raw: unknown): GameState => {
  if (!raw || typeof raw !== 'object') return createInitialState()
  const parsed = raw as { version?: number; roster?: Player[]; prospects?: Player[]; packs?: PackState; saveId?: string; [key: string]: unknown }
  if ((parsed.version === 13 || parsed.version === 12 || parsed.version === 11 || parsed.version === 10 || parsed.version === 9) && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    const seasonStart = typeof parsed.seasonStart === 'string' ? parsed.seasonStart : INITIAL_SEASON_START
    const now = typeof parsed.now === 'string'
      ? parsed.now
      : addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9)
    const seed = typeof parsed.seed === 'number' ? parsed.seed : 271828
    const world = normalizedWorld(parsed.world, roster, now, seed)
    const activeEventId = typeof parsed.activeEventId === 'string' ? parsed.activeEventId : null
    const legacyEvent = tournamentForId(activeEventId)
    const clubSeed = tournamentPlayerSeedFromRoster(
      roster,
      startingFive,
      typeof parsed.lineupContinuity === 'number' ? parsed.lineupContinuity : 50,
    )
    const clubKeys = new Set(clubSeed.roster.map((player) => player.playerKey))
    const activeTournament = (parsed.version === 13 || parsed.version === 12 || parsed.version === 11) && parsed.activeTournament && typeof parsed.activeTournament === 'object'
      ? refreshTournamentTeamsFromWorld(parsed.activeTournament as TournamentRun, world, clubKeys)
      : legacyEvent
        ? createTournamentRun(
            legacyEvent,
            seasonStart,
            now,
            seed + (typeof parsed.season === 'number' ? parsed.season : 1) * 100 + legacyEvent.startDay,
            world,
            clubSeed,
          )
        : null
    return {
      ...(parsed as unknown as GameState),
      version: 13,
      seasonStart,
      now,
      world,
      activeTournament,
      tournamentHistory: Array.isArray(parsed.tournamentHistory) ? parsed.tournamentHistory as TournamentRun[] : [],
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonLength: (parsed.version === 13 || parsed.version === 12 || parsed.version === 11) && typeof parsed.seasonLength === 'number' ? parsed.seasonLength : 16,
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: typeof parsed.packTokens === 'number' ? parsed.packTokens : 2600,
      managerXp: typeof parsed.managerXp === 'number' ? parsed.managerXp : 0,
      clubVrsPoints: typeof parsed.clubVrsPoints === 'number' ? parsed.clubVrsPoints : 720,
      activeEventId: activeTournament?.eventId ?? activeEventId,
      pendingDecision: parsed.pendingDecision && typeof parsed.pendingDecision === 'object' ? parsed.pendingDecision as ClubDecision : null,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      squadPlanner: normalizeSquadPlanner(parsed.squadPlanner),
      training: normalizeTrainingState(parsed.training),
      packs,
      finance: normalizeFinanceState(parsed.finance, typeof parsed.credits === 'number' ? parsed.credits : 3200),
      clubEvents: normalizeClubEvents(parsed.clubEvents),
      transferCases: normalizeTransferCases(parsed.transferCases),
    }
  }

  if (parsed.version === 8 && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'packTokens' | 'managerXp'>),
      version: 13,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      world: normalizedWorld(parsed.world, roster, addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9), typeof parsed.seed === 'number' ? parsed.seed : 271828),
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: 2600,
      managerXp: 0,
      clubVrsPoints: 720,

      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      squadPlanner: normalizeSquadPlanner(parsed.squadPlanner),
      training: normalizeTrainingState(parsed.training),
      packs,
      finance: normalizeFinanceState(parsed.finance, typeof parsed.credits === 'number' ? parsed.credits : 3200),
      clubEvents: normalizeClubEvents(parsed.clubEvents),
      transferCases: normalizeTransferCases(parsed.transferCases),
    } as GameState
  }

  if (parsed.version === 7 && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'scoutBrief' | 'packTokens' | 'managerXp'>),
      version: 13,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      world: normalizedWorld(parsed.world, roster, addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9), typeof parsed.seed === 'number' ? parsed.seed : 271828),
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      packTokens: typeof parsed.packTokens === 'number' ? parsed.packTokens : 2600,
      managerXp: typeof parsed.managerXp === 'number' ? parsed.managerXp : 0,
      clubVrsPoints: 720,

      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, parsed.lineupSlots),
      scoutBrief: normalizeScoutBrief(parsed.scoutBrief),
      training: normalizeTrainingState(parsed.training),
      packs,
      finance: normalizeFinanceState(parsed.finance, typeof parsed.credits === 'number' ? parsed.credits : 3200),
      clubEvents: normalizeClubEvents(parsed.clubEvents),
      transferCases: normalizeTransferCases(parsed.transferCases),
    } as GameState
  }

  if ((parsed.version === 6 || parsed.version === 5) && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    const roster = normalizePlayers(parsed.roster, packs)
    const startingFive = Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : []
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'welcomeComplete' | 'lineupSlots' | 'scoutBrief' | 'packTokens' | 'managerXp'>),
      version: 13,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: parsed.version === 6 ? Boolean(parsed.welcomeComplete) : true,
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonStart: INITIAL_SEASON_START,
      now: addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9),
      activeTournament: null,
      tournamentHistory: [],
      world: normalizedWorld(parsed.world, roster, addGameDays(INITIAL_SEASON_START, Math.max(0, ((typeof parsed.week === 'number' ? parsed.week : 1) - 1) * 7), 9), typeof parsed.seed === 'number' ? parsed.seed : 271828),
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      roster,
      startingFive,
      lineupSlots: normalizeLineupSlots(roster, startingFive, null),
      scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
      squadPlanner: createSquadPlannerState(),
      training: createTrainingState(),
      packTokens: 2600,
      managerXp: 0,
      clubVrsPoints: 720,
      finance: normalizeFinanceState(parsed.finance, typeof parsed.credits === 'number' ? parsed.credits : 3200),
      clubEvents: normalizeClubEvents(parsed.clubEvents),
      transferCases: normalizeTransferCases(parsed.transferCases),

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
      version: 13,
      saveId: createSaveId(),
      squadPlanner: createSquadPlannerState(),
      training: createTrainingState(),
      welcomeComplete: true,
      season: 1,
      seasonStart: INITIAL_SEASON_START,
      now: INITIAL_SEASON_START,
      activeTournament: null,
      tournamentHistory: [],
      world: normalizedWorld(parsed.world, roster, INITIAL_SEASON_START, typeof parsed.seed === 'number' ? parsed.seed : 271828),
      seasonEnded: false,
      seasonSummary: null,
      seasonLength: 16,
      roster,
      startingFive,
      lineupSlots: inferLineupSlots(roster, startingFive),
      lineupContinuity: typeof parsed.lineupContinuity === 'number' ? parsed.lineupContinuity : 55,
      finance: normalizeFinanceState(parsed.finance, typeof parsed.credits === 'number' ? parsed.credits : base.credits),
      clubEvents: normalizeClubEvents(parsed.clubEvents),
      transferCases: normalizeTransferCases(parsed.transferCases),
      prospects,
      scoutBrief: { ...DEFAULT_SCOUT_BRIEF },
      packTokens: 2600,
      managerXp: 0,
      clubVrsPoints: 720,

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
  practice: { difficulty: -5, baseReward: 0, fans: 0, label: 'Пракк-матч' },
  scrim: { difficulty: -2, baseReward: 700, fans: 25, label: 'Tier 3 official' },
  showmatch: { difficulty: 1, baseReward: 950, fans: 70, label: 'Tier 2 official' },
  cup: { difficulty: 7, baseReward: 1450, fans: 150, label: 'Tier 1 official' },
}

export const tacticInfo: Record<TacticalPlan, { name: string; description: string }> = {
  balanced: { name: 'Сбалансированно', description: 'Без крупных модификаторов. Минимальный разброс и обычная усталость.' },
  aggressive: { name: 'Агрессивно', description: 'Упор на стрельбу, выше разброс и усталость. Лучше подходит механически сильным составам.' },
  structured: { name: 'Структурно', description: 'Вознаграждает понимание игры, гранаты и лидерство. Разброс ниже.' },
}

const eventDifficulty = (event: TournamentEvent | null) =>
  event ? (event.circuitTier === 1 ? 7 : event.circuitTier === 2 ? 3 : 0) : 0

const matchVrsBase = (mode: MatchMode, event: TournamentEvent | null) => {
  if (event) return event.circuitTier === 1 ? 22 : event.circuitTier === 2 ? 15 : 10
  if (mode === 'cup') return 13
  if (mode === 'showmatch') return 8
  if (mode === 'scrim') return 3
  return 0
}

const matchVrsAward = (
  mode: MatchMode,
  event: TournamentEvent | null,
  won: boolean,
  opponentRating: number,
  ourRating: number,
) => {
  if (!won) return 0
  const base = matchVrsBase(mode, event)
  if (base <= 0) return 0
  const strength = Math.round(clamp((opponentRating - ourRating) * .32, -3, 8))
  return Math.max(1, base + strength)
}

const tournamentVrsAward = (event: TournamentEvent | null, run: TournamentRun | null) => {
  if (!event || !run) return 0
  const tierBase = event.circuitTier === 1 ? 90 : event.circuitTier === 2 ? 55 : 32
  if (run.status === 'champion') return tierBase
  if (run.placement === 'RUNNER-UP') return Math.round(tierBase * .62)
  if (run.placement === 'PLAYOFFS' || run.placement === 'SEMIFINAL') return Math.round(tierBase * .34)
  if (run.placement === 'GROUP STAGE') return Math.round(tierBase * .14)
  return 0
}

const worldRosterSnapshot = (state: GameState, teamId: string): TournamentRosterPlayer[] =>
  worldLineup(state.world, teamId).map((player) => ({
    playerKey: player.key,
    alias: player.alias,
    role: player.role,
    rating: player.currentRating,
    profileId: player.profileId,
    country: player.country,
  }))

const generateOpponent = (state: GameState, mode: MatchMode, rng: () => number) => {
  const tune = modeTuning[mode]
  const event = tournamentForId(state.activeEventId)
  const targetRating = Math.round(clamp(53 + state.reputation * 0.4 + tune.difficulty + eventDifficulty(event) + (rng() - 0.5) * 9, 48, 96))
  const candidates = state.world.teams
    .filter((team) => team.rosterKeys.length >= 5)
    .map((team) => ({ team, delta: Math.abs(team.rating - targetRating) }))
    .sort((a, b) => a.delta - b.delta || a.team.vrsRank - b.team.vrsRank)
    .slice(0, 12)

  if (candidates.length) {
    const chosen = candidates[Math.floor(rng() * Math.min(6, candidates.length))].team
    return {
      name: chosen.name,
      rating: chosen.rating,
      teamId: chosen.id,
      roster: worldRosterSnapshot(state, chosen.id),
    }
  }

  const name = pick(opponentNames, rng)
  const fallbackRoles: TournamentRosterPlayer['role'][] = ['Entry', 'AWP', 'Rifler', 'Support', 'IGL']
  const stem = name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'RIVAL'
  return {
    name,
    rating: targetRating,
    teamId: null,
    roster: fallbackRoles.map((role, index) => ({
      playerKey: 'sim:' + stem.toLocaleLowerCase('en-US') + ':' + index,
      alias: stem + '-' + (index + 1),
      role,
      rating: Math.round(clamp(targetRating + [-1, 2, 1, -2, 0][index], 40, 99)),
      profileId: null,
      country: null,
    })),
  }
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

const averagePlayerStat = (
  active: Player[],
  key: keyof Pick<Player, 'aim' | 'gameSense' | 'utility' | 'clutch' | 'leadership' | 'form' | 'morale' | 'fatigue'>,
) => active.length ? active.reduce((sum, player) => sum + player[key], 0) / active.length : 50

type MatchSkillProfile = {
  aim: number
  gameSense: number
  utility: number
  clutch: number
  leadership: number
}

const MAP_STYLE_WEIGHTS: Record<(typeof mapPool)[number], MatchSkillProfile> = {
  'Dust II': { aim: .42, gameSense: .18, utility: .10, clutch: .22, leadership: .08 },
  Mirage: { aim: .30, gameSense: .25, utility: .18, clutch: .17, leadership: .10 },
  Inferno: { aim: .18, gameSense: .28, utility: .32, clutch: .10, leadership: .12 },
  Nuke: { aim: .16, gameSense: .32, utility: .25, clutch: .10, leadership: .17 },
  Ancient: { aim: .24, gameSense: .24, utility: .27, clutch: .13, leadership: .12 },
  Anubis: { aim: .30, gameSense: .20, utility: .25, clutch: .15, leadership: .10 },
}

export const mapStyleFit = (skills: MatchSkillProfile, map: string) => {
  const weights = MAP_STYLE_WEIGHTS[map as (typeof mapPool)[number]]
  if (!weights) return (
    skills.aim + skills.gameSense + skills.utility + skills.clutch + skills.leadership
  ) / 5
  return (
    skills.aim * weights.aim +
    skills.gameSense * weights.gameSense +
    skills.utility * weights.utility +
    skills.clutch * weights.clutch +
    skills.leadership * weights.leadership
  )
}

export const matchDurationHoursForRounds = (rounds: number, maps: number) =>
  Math.max(1, Math.min(5, Math.ceil((Math.max(0, rounds) * 2 + Math.max(1, maps) * 12) / 60)))

export const mapWinProbabilityFromRoundChance = (roundChance: number) => {
  const p = clamp(roundChance, 0, 1)
  if (p <= 0) return 0
  if (p >= 1) return 1
  const q = 1 - p

  const choose6 = [1, 6, 15, 20, 15, 6, 1]
  let overtimeWinBlock = 0
  for (let wins = 4; wins <= 6; wins += 1) {
    overtimeWinBlock += choose6[wins] * Math.pow(p, wins) * Math.pow(q, 6 - wins)
  }
  const overtimeTieBlock = choose6[3] * Math.pow(p, 3) * Math.pow(q, 3)
  const overtimeWin = overtimeWinBlock / Math.max(1e-9, 1 - overtimeTieBlock)

  const memo = new Map<string, number>()
  const solve = (us: number, them: number): number => {
    if (us >= 13) return 1
    if (them >= 13) return 0
    if (us === 12 && them === 12) return overtimeWin
    const key = us + ':' + them
    const cached = memo.get(key)
    if (cached != null) return cached
    const value = p * solve(us + 1, them) + q * solve(us, them + 1)
    memo.set(key, value)
    return value
  }

  return solve(0, 0)
}


const opponentRoleBoost = (
  role: TournamentRosterPlayer['role'],
  stat: 'aim' | 'sense' | 'utility' | 'clutch' | 'leadership',
) => {
  if (stat === 'aim') return role === 'AWP' ? 5 : role === 'Entry' ? 4 : role === 'Rifler' ? 2 : role === 'IGL' ? -2 : -1
  if (stat === 'sense') return role === 'IGL' ? 7 : role === 'Support' ? 4 : role === 'AWP' ? 2 : 0
  if (stat === 'utility') return role === 'Support' ? 8 : role === 'IGL' ? 5 : role === 'Rifler' ? 1 : -2
  if (stat === 'clutch') return role === 'AWP' ? 4 : role === 'Rifler' ? 3 : role === 'IGL' ? 2 : 0
  return role === 'IGL' ? 10 : role === 'Support' ? 3 : 0
}

export const lineupMapStyleFit = (active: Player[], map: string) => {
  if (!active.length) return 50
  return mapStyleFit({
    aim: averagePlayerStat(active, 'aim'),
    gameSense: averagePlayerStat(active, 'gameSense'),
    utility: averagePlayerStat(active, 'utility'),
    clutch: averagePlayerStat(active, 'clutch'),
    leadership: averagePlayerStat(active, 'leadership'),
  }, map)
}

const opponentRosterSkillProfile = (
  roster: TournamentRosterPlayer[] | undefined,
  teamRatingValue: number,
): MatchSkillProfile => {
  const players = (roster ?? []).slice(0, 5)
  if (!players.length) {
    return {
      aim: teamRatingValue,
      gameSense: teamRatingValue,
      utility: teamRatingValue,
      clutch: teamRatingValue,
      leadership: teamRatingValue,
    }
  }

  const enriched = players.map((player) => ({
    player,
    stats: cardStatsForAlias(player.alias, player.role),
  }))
  const stat = (kind: 'aim' | 'sense' | 'utility' | 'clutch' | 'leadership') =>
    clamp(enriched.reduce((sum, entry) => {
      const { player, stats } = entry
      if (!stats) return sum + player.rating + opponentRoleBoost(player.role, kind)
      if (kind === 'aim') return sum + stats.aim
      if (kind === 'sense') return sum + clamp(stats.positioning + opponentRoleBoost(player.role, 'sense') * .45)
      if (kind === 'utility') return sum + stats.utility
      if (kind === 'clutch') return sum + stats.clutch
      return sum + clamp(player.rating + opponentRoleBoost(player.role, 'leadership'))
    }, 0) / enriched.length)

  return {
    aim: stat('aim'),
    gameSense: stat('sense'),
    utility: stat('utility'),
    clutch: stat('clutch'),
    leadership: stat('leadership'),
  }
}

export const opponentRosterMapStyleFit = (
  roster: TournamentRosterPlayer[] | undefined,
  teamRatingValue: number,
  map: string,
) => mapStyleFit(opponentRosterSkillProfile(roster, teamRatingValue), map)

const roundCauseLabel: Record<MatchRoundCause, string> = {
  AIM: 'чистая реализация дуэлей',
  TACTICAL_EDGE: 'тактическое преимущество',
  ANTI_STRAT: 'прочитанный паттерн соперника',
  CLUTCH: 'клатч в концовке',
  PLAYER_ERROR: 'индивидуальная ошибка',
  FATIGUE: 'просадка из-за усталости',
  COMMUNICATION: 'ошибка коммуникации',
  MOMENTUM: 'серия выигранных раундов',
}

const scoreLeadBefore = (round: MatchRoundStory) =>
  round.winner === 'US'
    ? (round.scoreThem - (round.scoreUs - 1))
    : ((round.scoreThem - 1) - round.scoreUs)

export const deriveMapNarrativeTags = (
  rounds: MatchRoundStory[],
  factors: MapStory['factors'],
): MatchNarrativeTag[] => {
  if (!rounds.length) return []
  const final = rounds[rounds.length - 1]
  const usWon = final.scoreUs > final.scoreThem
  let maxUsLead = 0
  let maxThemLead = 0
  let usTactical = 0
  let themTactical = 0
  let antiStratWins = 0
  let fatigueLosses = 0
  let communicationLosses = 0
  let playerErrors = 0
  let clutchRounds = 0

  for (const round of rounds) {
    const usBefore = round.scoreUs - (round.winner === 'US' ? 1 : 0)
    const themBefore = round.scoreThem - (round.winner === 'THEM' ? 1 : 0)
    maxUsLead = Math.max(maxUsLead, usBefore - themBefore)
    maxThemLead = Math.max(maxThemLead, themBefore - usBefore)
    if (round.cause === 'TACTICAL_EDGE') {
      if (round.winner === 'US') usTactical += 1
      else themTactical += 1
    }
    if (round.cause === 'ANTI_STRAT' && round.winner === 'US') antiStratWins += 1
    if (round.cause === 'FATIGUE' && round.winner === 'THEM' && round.keyPlayerSide !== 'THEM') fatigueLosses += 1
    if (round.cause === 'COMMUNICATION' && round.winner === 'THEM' && round.keyPlayerSide !== 'THEM') communicationLosses += 1
    if (round.cause === 'PLAYER_ERROR' && round.winner === 'THEM' && round.keyPlayerSide !== 'THEM') playerErrors += 1
    if (round.clutch) clutchRounds += 1
  }

  const tags: MatchNarrativeTag[] = []
  if (usWon && maxThemLead >= 5) tags.push('COMEBACK')
  if (!usWon && maxUsLead >= 5) tags.push('CHOKE')
  if (Math.min(final.scoreUs, final.scoreThem) <= 5) tags.push('STOMP')
  if (clutchRounds >= 4) tags.push('CLUTCH_HEAVY')
  if ((usWon && usTactical - themTactical >= 3) || (!usWon && themTactical - usTactical >= 3)) tags.push('TACTICAL_OUTPLAY')
  if (!usWon && (factors.preparation <= 38 || final.scoreUs <= 7)) tags.push('WEAK_MAP')
  if (playerErrors >= 3) tags.push('PLAYER_COLLAPSE')
  if (antiStratWins >= 3) tags.push('ANTI_STRAT_SUCCESS')
  if (fatigueLosses >= 3) tags.push('FATIGUE')
  if (communicationLosses >= 3) tags.push('COMMUNICATION_BREAKDOWN')
  return tags
}

interface OpponentMatchProfile {
  aim: number
  gameSense: number
  utility: number
  clutch: number
  leadership: number
  form: number
  morale: number
  fatigue: number
  communication: number
  tactical: number
  preparation: number
  vulnerableAlias?: string
  clutchAlias?: string
}

interface OpponentSeriesCondition {
  form: number
  morale: number
  baseFatigue: number
  preparationBias: number
}

const createOpponentSeriesCondition = (
  teamRatingValue: number,
  rng: () => number,
): OpponentSeriesCondition => ({
  form: clamp(teamRatingValue + (rng() - .5) * 12),
  morale: clamp(62 + (teamRatingValue - 65) * .18 + (rng() - .5) * 18),
  baseFatigue: clamp(18 + rng() * 22),
  preparationBias: (rng() - .5) * 10,
})

const buildOpponentMatchProfile = (
  roster: TournamentRosterPlayer[] | undefined,
  teamRatingValue: number,
  seriesRoundsPlayed: number,
  adaptation: number,
  condition: OpponentSeriesCondition,
  rng: () => number,
): OpponentMatchProfile => {
  const players = (roster ?? []).slice(0, 5)
  const averageRating = players.length
    ? players.reduce((sum, player) => sum + player.rating, 0) / players.length
    : teamRatingValue
  const baseSkills = opponentRosterSkillProfile(players, teamRatingValue)
  const { aim, gameSense, utility, clutch, leadership } = baseSkills
  const enrichedPlayers = players.map((player) => ({
    player,
    stats: cardStatsForAlias(player.alias, player.role),
  }))
  const form = condition.form
  const morale = condition.morale
  const fatigue = clamp(condition.baseFatigue + seriesRoundsPlayed * .24)
  const communication = clamp(
    38 + gameSense * .18 + leadership * .24 + morale * .17 - Math.max(0, fatigue - 50) * .28 + adaptation * 1.5,
  )
  const tactical = clamp(45 + (gameSense - 60) * .42 + (utility - 60) * .3 + (leadership - 60) * .22 + adaptation * 4)
  const preparation = clamp(
    47 + (gameSense - 65) * .22 + condition.preparationBias + (rng() - .5) * 6 + adaptation * 6,
  )
  const vulnerable = [...enrichedPlayers].sort((a, b) =>
    (a.stats?.ovr ?? a.player.rating) - (b.stats?.ovr ?? b.player.rating),
  )[0]?.player
  const clutchPlayer = [...enrichedPlayers].sort((a, b) =>
    (b.stats?.clutch ?? b.player.rating + opponentRoleBoost(b.player.role, 'clutch')) -
    (a.stats?.clutch ?? a.player.rating + opponentRoleBoost(a.player.role, 'clutch')),
  )[0]?.player

  return {
    aim,
    gameSense,
    utility,
    clutch,
    leadership,
    form,
    morale,
    fatigue,
    communication,
    tactical,
    preparation,
    vulnerableAlias: vulnerable?.alias,
    clutchAlias: clutchPlayer?.alias,
  }
}

export const findTurningPoint = (rounds: MatchRoundStory[]) => {
  if (!rounds.length) return undefined
  const final = rounds[rounds.length - 1]
  const winner = final.scoreUs > final.scoreThem ? 'US' : 'THEM'
  let lowestWinnerLead = Number.POSITIVE_INFINITY
  let lowestIndex = -1

  rounds.forEach((round, index) => {
    const usBefore = round.scoreUs - (round.winner === 'US' ? 1 : 0)
    const themBefore = round.scoreThem - (round.winner === 'THEM' ? 1 : 0)
    const lead = winner === 'US' ? usBefore - themBefore : themBefore - usBefore
    if (lead < lowestWinnerLead) {
      lowestWinnerLead = lead
      lowestIndex = index
    }
  })

  if (lowestWinnerLead < 0) {
    const comebackStart = rounds.find((round, index) => index >= lowestIndex && round.winner === winner)
    if (comebackStart) return comebackStart
  }

  let bestStart = 0
  let bestLength = 0
  let currentStart = 0
  let currentLength = 0
  rounds.forEach((round, index) => {
    if (round.winner === winner) {
      if (currentLength === 0) currentStart = index
      currentLength += 1
      if (currentLength > bestLength) {
        bestLength = currentLength
        bestStart = currentStart
      }
    } else {
      currentLength = 0
    }
  })
  return rounds[bestStart] ?? rounds[0]
}

const simulateStoryMap = (
  active: Player[],
  opponentRoster: TournamentRosterPlayer[] | undefined,
  opponentRating: number,
  map: string,
  mapIndex: number,
  seriesRoundsPlayed: number,
  tactic: TacticalPlan,
  probability: number,
  tacticMod: number,
  preparationMod: number,
  continuity: number,
  ourAdaptation: number,
  opponentAdaptation: number,
  opponentCondition: OpponentSeriesCondition,
  rng: () => number,
): MapResult => {
  const avgAim = averagePlayerStat(active, 'aim')
  const avgGameSense = averagePlayerStat(active, 'gameSense')
  const avgUtility = averagePlayerStat(active, 'utility')
  const avgLeadership = averagePlayerStat(active, 'leadership')
  const avgMorale = averagePlayerStat(active, 'morale')
  const baseFatigue = averagePlayerStat(active, 'fatigue')
  const avgClutch = averagePlayerStat(active, 'clutch')
  const seriesFatigueGain = seriesRoundsPlayed * (
    tactic === 'aggressive' ? .32 : tactic === 'structured' ? .18 : .25
  )
  const avgFatigue = clamp(baseFatigue + seriesFatigueGain)
  const communication = clamp(
    continuity * .42 + avgLeadership * .25 + avgMorale * .23 - Math.max(0, avgFatigue - 50) * .28 + 10 + ourAdaptation * 1.5,
  )
  const tacticalQuality = clamp(
    50 + tacticMod * 6 + (avgGameSense - 65) * .35 + (avgUtility - 65) * .25 + ourAdaptation * 4,
  )
  const preparation = clamp(50 + preparationMod * 8 + ourAdaptation * 6)
  const fatigueFactor = clamp(100 - avgFatigue)
  const clutchFactor = clamp(avgClutch)
  const individual = clamp(avgAim * .58 + averagePlayerStat(active, 'form') * .42)
  const vulnerable = [...active].sort((a, b) =>
    (a.form - a.fatigue * .72 + a.gameSense * .16) - (b.form - b.fatigue * .72 + b.gameSense * .16),
  )[0] ?? active[0]
  const clutchPlayer = [...active].sort((a, b) => b.clutch - a.clutch || b.form - a.form)[0] ?? active[0]
  const opponent = buildOpponentMatchProfile(
    opponentRoster,
    opponentRating,
    seriesRoundsPlayed,
    opponentAdaptation,
    opponentCondition,
    rng,
  )
  const ourMapFit = lineupMapStyleFit(active, map)
  const opponentMapFit = opponentRosterMapStyleFit(opponentRoster, opponentRating, map)
  const mapEdge = clamp((ourMapFit - opponentMapFit) * .0022, -.05, .05)

  const rounds: MatchRoundStory[] = []
  let us = 0
  let them = 0
  let streak = 0
  let lastWinner: 'US' | 'THEM' | null = null
  let overtimeTarget = 13

  const roundComplete = () => {
    if (overtimeTarget === 13) {
      if (us === 13 || them === 13) return true
      if (us === 12 && them === 12) overtimeTarget = 16
      return false
    }
    if ((us >= overtimeTarget || them >= overtimeTarget) && Math.abs(us - them) >= 2) return true
    if (us === overtimeTarget - 1 && them === overtimeTarget - 1) overtimeTarget += 3
    return false
  }

  const appendRound = (
    winner: 'US' | 'THEM',
    cause: MatchRoundCause,
    keyPlayer?: string,
    keyPlayerSide?: 'US' | 'THEM',
    clutch = false,
  ) => {
    if (winner === 'US') us += 1
    else them += 1

    const notePrefix = keyPlayer ? keyPlayer + ': ' : ''
    const consequence = winner === 'US' ? 'Раунд забирает наша команда.' : 'Раунд уходит сопернику.'
    rounds.push({
      round: rounds.length + 1,
      winner,
      scoreUs: us,
      scoreThem: them,
      cause,
      keyPlayer,
      keyPlayerSide,
      clutch,
      note: notePrefix + roundCauseLabel[cause] + '. ' + consequence,
    })

    if (lastWinner === winner) streak += 1
    else {
      lastWinner = winner
      streak = 1
    }
  }

  while (rounds.length < 96 && !roundComplete()) {
    const roundNumber = rounds.length + 1
    const lateRound = roundNumber >= 15
    const closeScore = Math.abs(us - them) <= 2
    const momentum = lastWinner === 'US'
      ? Math.min(.045, streak * .01)
      : lastWinner === 'THEM'
        ? -Math.min(.045, streak * .01)
        : 0
    const tacticalEdge = clamp(
      ((tacticalQuality + preparation * .28) - (opponent.tactical + opponent.preparation * .28)) * .00115,
      -.075,
      .075,
    )
    const clutchEdge = closeScore && lateRound
      ? clamp((avgClutch - opponent.clutch) * .0014, -.055, .055)
      : 0

    let roundProbability = clamp(probability + mapEdge + momentum + tacticalEdge + clutchEdge, .10, .90)
    const ourMistakeChance = clamp(
      (55 - (vulnerable?.form ?? 55)) * .005 +
      (((vulnerable?.fatigue ?? 45) + seriesFatigueGain) - 55) * .0035,
      .025,
      .24,
    )
    const theirMistakeChance = clamp((55 - opponent.form) * .0045 + (opponent.fatigue - 55) * .003, .025, .20)

    type RoundIncident = {
      side: 'US' | 'THEM'
      cause: Extract<MatchRoundCause, 'ANTI_STRAT' | 'COMMUNICATION' | 'FATIGUE' | 'PLAYER_ERROR'>
      chance: number
      delta: number
      keyPlayer?: string
      keyPlayerSide: 'US' | 'THEM'
    }

    const incidentCandidates: RoundIncident[] = []
    if (preparation >= 62) {
      incidentCandidates.push({
        side: 'US',
        cause: 'ANTI_STRAT',
        chance: clamp((preparation - 55) * .012, .05, .27),
        delta: .065,
        keyPlayerSide: 'US',
      })
    }
    if (opponent.preparation >= 62) {
      incidentCandidates.push({
        side: 'THEM',
        cause: 'ANTI_STRAT',
        chance: clamp((opponent.preparation - 55) * .012, .05, .27),
        delta: -.065,
        keyPlayerSide: 'THEM',
      })
    }
    if (communication < 60 && lateRound) {
      incidentCandidates.push({
        side: 'THEM',
        cause: 'COMMUNICATION',
        chance: clamp((64 - communication) * .012, .04, .24),
        delta: -.065,
        keyPlayerSide: 'US',
      })
    }
    if (opponent.communication < 60 && lateRound) {
      incidentCandidates.push({
        side: 'US',
        cause: 'COMMUNICATION',
        chance: clamp((64 - opponent.communication) * .012, .04, .24),
        delta: .065,
        keyPlayerSide: 'THEM',
      })
    }
    if (avgFatigue >= 56 && lateRound) {
      incidentCandidates.push({
        side: 'THEM',
        cause: 'FATIGUE',
        chance: clamp((avgFatigue - 48) * .01, .05, .28),
        delta: -.06,
        keyPlayer: vulnerable?.alias,
        keyPlayerSide: 'US',
      })
    }
    if (opponent.fatigue >= 56 && lateRound) {
      incidentCandidates.push({
        side: 'US',
        cause: 'FATIGUE',
        chance: clamp((opponent.fatigue - 48) * .01, .05, .28),
        delta: .06,
        keyPlayer: opponent.vulnerableAlias,
        keyPlayerSide: 'THEM',
      })
    }
    if (vulnerable) {
      incidentCandidates.push({
        side: 'THEM',
        cause: 'PLAYER_ERROR',
        chance: ourMistakeChance,
        delta: -.055,
        keyPlayer: vulnerable.alias,
        keyPlayerSide: 'US',
      })
    }
    if (opponent.vulnerableAlias) {
      incidentCandidates.push({
        side: 'US',
        cause: 'PLAYER_ERROR',
        chance: theirMistakeChance,
        delta: .055,
        keyPlayer: opponent.vulnerableAlias,
        keyPlayerSide: 'THEM',
      })
    }

    const totalIncidentWeight = incidentCandidates.reduce((sum, candidate) => sum + candidate.chance, 0)
    const incidentChance = Math.min(.40, totalIncidentWeight * .62)
    let incident: RoundIncident | undefined
    if (incidentCandidates.length && rng() < incidentChance) {
      let cursor = rng() * totalIncidentWeight
      for (const candidate of incidentCandidates) {
        cursor -= candidate.chance
        if (cursor <= 0) {
          incident = candidate
          break
        }
      }
      incident ??= incidentCandidates[incidentCandidates.length - 1]
    }

    if (incident) roundProbability += incident.delta
    roundProbability = clamp(roundProbability, .06, .94)

    const winner: 'US' | 'THEM' = rng() < roundProbability ? 'US' : 'THEM'
    let cause: MatchRoundCause = 'AIM'
    let keyPlayer: string | undefined
    let keyPlayerSide: 'US' | 'THEM' | undefined
    const incidentConverted = incident && incident.side === winner

    if (incidentConverted && incident) {
      cause = incident.cause
      keyPlayer = incident.keyPlayer
      keyPlayerSide = incident.keyPlayerSide
    } else {
      const clutchRound = closeScore && lateRound && rng() < .22
      if (clutchRound) {
        cause = 'CLUTCH'
        keyPlayer = winner === 'US' ? clutchPlayer?.alias : opponent.clutchAlias
        keyPlayerSide = winner
      } else if (Math.abs(tacticalEdge) >= .018 && ((tacticalEdge > 0) === (winner === 'US'))) {
        cause = 'TACTICAL_EDGE'
        keyPlayerSide = winner
      } else if (Math.abs(momentum) >= .02 && ((momentum > 0) === (winner === 'US'))) {
        cause = 'MOMENTUM'
        keyPlayerSide = winner
      }
    }

    appendRound(winner, cause, keyPlayer, keyPlayerSide, cause === 'CLUTCH')
  }

  // The simulation must never hand a tied map to the opponent because of a guard.
  // If an extreme overtime reaches the safety cap, finish it with a legal two-round edge.
  if (!roundComplete()) {
    const forcedWinner: 'US' | 'THEM' = us === them
      ? (probability >= .5 ? 'US' : 'THEM')
      : (us > them ? 'US' : 'THEM')
    for (let guard = 0; guard < 12 && !roundComplete(); guard += 1) {
      appendRound(forcedWinner, 'MOMENTUM', undefined, forcedWinner)
    }
  }

  const usWon = us > them
  const tacticalWins = rounds.filter((round) => round.winner === 'US' && (round.cause === 'TACTICAL_EDGE' || round.cause === 'ANTI_STRAT')).length
  const tacticalLosses = rounds.filter((round) => round.winner === 'THEM' && (round.cause === 'TACTICAL_EDGE' || round.cause === 'ANTI_STRAT')).length
  const clutchWins = rounds.filter((round) => round.winner === 'US' && round.cause === 'CLUTCH').length
  const errorCounts = new Map<string, number>()
  for (const round of rounds) {
    if (round.cause === 'PLAYER_ERROR' && round.keyPlayer && round.keyPlayerSide === 'US') {
      errorCounts.set(round.keyPlayer, (errorCounts.get(round.keyPlayer) ?? 0) + 1)
    }
  }

  const factors: MapStory['factors'] = {
    tactics: Math.round(tacticalQuality),
    preparation: Math.round(preparation),
    fatigue: Math.round(fatigueFactor),
    communication: Math.round(communication),
    clutch: Math.round(clutchFactor),
    individual: Math.round(individual),
    mapFit: Math.round(ourMapFit),
    adaptation: Math.round(ourAdaptation * 10) / 10,
  }
  const opponentFactors: NonNullable<MapStory['opponentFactors']> = {
    tactics: Math.round(opponent.tactical),
    preparation: Math.round(opponent.preparation),
    fatigue: Math.round(100 - opponent.fatigue),
    communication: Math.round(opponent.communication),
    clutch: Math.round(opponent.clutch),
    individual: Math.round(opponent.aim * .58 + opponent.form * .42),
    mapFit: Math.round(opponentMapFit),
    adaptation: Math.round(opponentAdaptation * 10) / 10,
  }
  const tags = deriveMapNarrativeTags(rounds, factors)
  const turningPoint = findTurningPoint(rounds)
  const errors = [...errorCounts.entries()].sort((a, b) => b[1] - a[1])
  const collapse = errors[0]
  const explanationParts: string[] = []

  if (tags.includes('COMEBACK')) explanationParts.push('Команда вернулась после крупного отставания и перевернула карту.')
  if (tags.includes('CHOKE')) explanationParts.push('Преимущество было потеряно: соперник наказал за концовку карты.')
  if (tags.includes('STOMP')) explanationParts.push('Карта быстро вышла из конкурентного состояния и закончилась разгромом.')
  if (tags.includes('CLUTCH_HEAVY')) explanationParts.push('Исход слишком часто решался в клатчах и поздних ситуациях.')
  if (tags.includes('TACTICAL_OUTPLAY')) explanationParts.push('Системное преимущество пришло из структуры раундов, а не только из стрельбы.')
  if (tags.includes('ANTI_STRAT_SUCCESS')) explanationParts.push('Подготовка прочитала повторяющиеся паттерны соперника и дала бесплатные открытия.')
  if (tags.includes('FATIGUE')) explanationParts.push('Поздние раунды просели из-за накопленной усталости.')
  if (tags.includes('COMMUNICATION_BREAKDOWN')) explanationParts.push('В концовках возникли повторяющиеся ошибки коммуникации.')
  if (tags.includes('WEAK_MAP')) explanationParts.push('Подготовка к карте не дала достаточной опоры, и карта стала слабым местом серии.')
  if (tags.includes('PLAYER_COLLAPSE') && collapse) explanationParts.push(collapse[0] + ' допустил ' + collapse[1] + ' ключевые ошибки.')
  if (ourMapFit - opponentMapFit >= 7 && usWon) {
    explanationParts.push('Профиль состава лучше соответствовал требованиям этой карты.')
  } else if (opponentMapFit - ourMapFit >= 7 && !usWon) {
    explanationParts.push('Профиль соперника лучше соответствовал требованиям этой карты.')
  }
  if (opponentAdaptation >= 1.1 && !usWon) {
    explanationParts.push('По ходу серии соперник адаптировался к повторяющемуся плану и усилил чтение раундов.')
  }
  if (ourAdaptation >= 1.1 && usWon) {
    explanationParts.push('Штаб и игроки перестроились по ходу серии и лучше читали повторяющиеся решения соперника.')
  }
  if (!explanationParts.length) {
    const opponentCollapse = rounds.filter((round) =>
      round.winner === 'US' &&
      (round.cause === 'PLAYER_ERROR' || round.cause === 'FATIGUE' || round.cause === 'COMMUNICATION') &&
      round.keyPlayerSide === 'THEM',
    ).length
    explanationParts.push(
      opponentCollapse >= 3
        ? 'Соперник начал терять качество решений, а команда стабильно конвертировала его ошибки.'
        : usWon
          ? 'Карта была выиграна за счёт более стабильной реализации ключевых раундов.'
          : 'Соперник стабильнее реализовал ключевые раунды и не дал переломить темп.',
    )
  }

  const topPerformer = [...active].sort((a, b) => {
    const aErrors = errorCounts.get(a.alias) ?? 0
    const bErrors = errorCounts.get(b.alias) ?? 0
    const aImpact = a.form + a.clutch * .22 + a.aim * .18 - a.fatigue * .18 - aErrors * 9
    const bImpact = b.form + b.clutch * .22 + b.aim * .18 - b.fatigue * .18 - bErrors * 9
    return bImpact - aImpact
  })[0] ?? active[0]

  return {
    map,
    us,
    them,
    winChance: Math.round(mapWinProbabilityFromRoundChance(
      clamp(
        probability +
        mapEdge +
        ((tacticalQuality + preparation * .28) - (opponent.tactical + opponent.preparation * .28)) * .00115,
        .05,
        .95,
      ),
    ) * 100),
    topPerformer: topPerformer?.alias ?? '—',
    story: {
      map,
      tags,
      rounds,
      turningPoint: turningPoint
        ? 'R' + turningPoint.round + ' · ' + turningPoint.scoreUs + ':' + turningPoint.scoreThem + ' · ' + turningPoint.note
        : 'Карта прошла без одного выраженного перелома.',
      explanation: explanationParts.join(' '),
      factors: {
        ...factors,
        tactics: clamp(factors.tactics + (tacticalWins - tacticalLosses) * 2),
        clutch: clamp(factors.clutch + clutchWins * 2),
      },
      opponentFactors,
    },
  }
}

const matchStoryHeadline = (tags: MatchNarrativeTag[], won: boolean, mvp: Player) => {
  if (tags.includes('COMEBACK')) return mvp.alias + ' ведёт команду через камбэк'
  if (tags.includes('CHOKE')) return 'Преимущество рассыпалось в концовке серии'
  if (tags.includes('STOMP')) return won ? 'Серия превращается в односторонний разгром' : 'Соперник не оставляет пространства для ответа'
  if (tags.includes('TACTICAL_OUTPLAY')) return won ? 'План на игру переигрывает соперника' : 'Соперник выигрывает серию на уровне решений'
  if (tags.includes('CLUTCH_HEAVY')) return 'Серию решили поздние раунды и клатчи'
  return won ? mvp.alias + ' становится ключевой фигурой победы' : 'Ключевые раунды уходят сопернику'
}

const buildMatchStory = (
  maps: MapResult[],
  won: boolean,
  opponent: string,
  mvp: Player,
  mode: MatchMode,
  net: number,
  eventLabel?: string,
): { headline: string; detail: string; story: MatchStory } => {
  const mapStories = maps.flatMap((map) => map.story ? [map.story] : [])
  const tags = [...new Set(mapStories.flatMap((story) => story.tags))]
  const decisive = mapStories.find((story) => story.tags.length > 0) ?? mapStories[mapStories.length - 1]
  const core = decisive?.explanation ?? (won
    ? 'Команда стабильнее провела ключевые отрезки серии.'
    : 'Соперник стабильнее провёл ключевые отрезки серии.')
  const economy = mode === 'practice'
    ? ' Пракк не влияет на рейтинг и призовые.'
    : net >= 0
      ? ' Финансовый итог матча: +' + net + ' кр.'
      : ' Финансовый итог матча: -' + Math.abs(net) + ' кр.'
  const eventText = eventLabel ? ' · ' + eventLabel + '.' : ''
  const summary = (won ? 'Победа над ' : 'Поражение от ') + opponent + '. ' + core

  return {
    headline: matchStoryHeadline(tags, won, mvp),
    detail: summary + economy + eventText + ' Режим: ' + modeTuning[mode].label + '.',
    story: { tags, summary, maps: mapStories },
  }
}

const performanceRating = (player: Player, won: boolean, tactic: TacticalPlan, rng: () => number) => {
  const tacticFit =
    tactic === 'aggressive'
      ? (player.aim - 65) * 0.08
      : tactic === 'structured'
        ? ((player.gameSense + player.utility + player.leadership) / 3 - 65) * 0.07
        : 0
  return Math.round(clamp(overall(player) + (player.form - 50) * 0.1 - player.fatigue * 0.06 + tacticFit + (won ? 4 : -3) + (rng() - 0.5) * 6, 35, 99))
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
  const vrs = run.vrsPaid ? 0 : tournamentVrsAward(event, run)
  const settledRun: TournamentRun = {
    ...run,
    earnedPrize: run.earnedPrize + prize,
    prizePaid: true,
    vrsPaid: true,
  }

  return {
    ...state,
    credits: state.credits + prize,
    clubVrsPoints: state.clubVrsPoints + vrs,
    activeEventId: null,
    activeTournament: null,
    tournamentHistory: [settledRun, ...state.tournamentHistory].slice(0, 30),
    news: event ? [{
      id: 'tournament-finish-' + settledRun.id,
      week: state.week,
      kind: 'match' as const,
      title: event.name + ' · ' + (settledRun.placement ?? settledRun.status).toUpperCase(),
      body: (prize > 0
        ? 'Турнир завершён. Призовые: ' + prize + ' кр.'
        : 'Турнир завершён без призовых.') + (vrs > 0 ? ' · VRS +' + vrs : ''),
    }, ...state.news].slice(0, 50) : state.news,
  }
}

export const advanceCareerTo = (state: GameState, target: string): GameState => {
  if (state.pendingDecision || compareGameTime(target, state.now) <= 0 || state.seasonEnded) return state

  const projectedTournament = state.activeTournament
    ? advanceTournamentTo(state.activeTournament, target, state.seed + state.season)
    : null
  const mandatoryMatch = nextPlayerMatch(projectedTournament)
  if (mandatoryMatch && compareGameTime(mandatoryMatch.scheduledAt, state.now) <= 0) return state
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

  const ecologySeed = state.seed + previousWeek * 4099 + state.season * 131
  let advancedWorld = advanceWorldEcology(state.world, state.now, effectiveTarget, ecologySeed)
  if (payrollCycles > 0) {
    advancedWorld = advanceWorldWeeks(advancedWorld, payrollCycles, ecologySeed, effectiveTarget)
  }
  const worldEvents = worldEventsSince(advancedWorld, state.now, 28).slice(0, 24)

  let next: GameState = {
    ...state,
    world: advancedWorld,
    activeTournament: preparedTournament,
    now: effectiveTarget,
    week: Math.min(state.seasonLength, nextWeekRaw),
    credits: Math.max(0, state.credits - payrollCost),
    staffEnergy: payrollCycles > 0 ? 3 : state.staffEnergy,
    training: payrollCycles > 0
      ? {
          ...(state.training ?? createTrainingState()),
          readiness: clamp((state.training?.readiness ?? 56) - payrollCycles * 3),
          tacticalCohesion: clamp((state.training?.tacticalCohesion ?? 50) - payrollCycles),
          sharpness: clamp((state.training?.sharpness ?? 55) - payrollCycles * 2),
          mapPreparation: Object.fromEntries(
            TRAINING_MAPS.map((map) => [map, clamp((state.training?.mapPreparation[map] ?? 50) - payrollCycles * 2)]),
          ) as Record<TrainingMap, number>,
          opponentKnowledge: Object.fromEntries(
            Object.entries(state.training?.opponentKnowledge ?? {}).map(([teamId, value]) => [teamId, clamp(value - payrollCycles * 6)]),
          ),
        }
      : state.training,
    roster: state.roster.map((player) => ({
      ...player,
      fatigue: clamp(player.fatigue - Math.min(18, elapsedDays * 2)),
      contractWeeks: Math.max(0, player.contractWeeks - payrollCycles),
    })),
    lastPayroll: payrollCycles > 0 ? payrollPerWeek : state.lastPayroll,
    lastWeekNet: payrollCycles > 0 ? -payrollPerWeek : state.lastWeekNet,
  }

  const worldNewsKind = (event: WorldHistoryEvent): NewsItem['kind'] =>
    event.kind === 'transfer-completed' || event.kind === 'transfer-offer' || event.kind === 'contract-expired'
      ? 'contract'
      : event.kind === 'tournament-completed' || event.kind === 'tournament-created'
        ? 'match'
        : 'media'

  const ecologyNews: NewsItem[] = worldEvents
    .filter((event) => worldEventTouchesPlayerClub(state, event))
    .map((event) => ({
      id: 'ecology-' + event.id,
      week: next.week,
      kind: worldNewsKind(event),
      title: event.title,
      body: event.detail,
      scope: 'club' as const,
      // Ecology currently has no player-facing resolver for offers/invitations.
      // Keep these informative until a real decision flow exists.
      attention: 'info' as const,
    }))

  if (payrollCycles > 0 || ecologyNews.length > 0) {
    next = {
      ...next,
      news: [
        ...ecologyNews,
        ...(payrollCycles > 0 ? [{
          id: 'payroll-' + effectiveTarget,
          week: next.week,
          kind: 'finance' as const,
          title: 'Недельный расчёт клуба',
          body: 'Зарплаты: ' + payrollCost + ' кр. · прошло недель: ' + payrollCycles + '.',
        }] : []),
        ...next.news,
      ].slice(0, 80),
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
  const registrationClosesAt = addGameHours(startsAt, -72)
  if (compareGameTime(state.now, registrationClosesAt) > 0 && state.activeEventId !== eventId) {
    return { ok: false, reason: 'Регистрация закрывается за 3 дня до старта.' }
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
    state.world,
    tournamentPlayerSeedFromRoster(state.roster, state.startingFive, state.lineupContinuity),
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

    if (mode === 'practice') {
      if (match && compareGameTime(state.now, match.scheduledAt) >= 0) {
        return { ok: false, reason: 'Сначала сыграй текущий официальный матч.' }
      }
    } else {
      if (!match) return { ok: false, reason: 'Ожидаются результаты других матчей сетки.' }
      if (compareGameTime(state.now, match.scheduledAt) < 0) return { ok: false, reason: 'Матч ещё не начался по расписанию.' }
      if (match.status !== 'ready') return { ok: false, reason: 'Сетка ещё не определила соперника.' }
    }
  }

  const event = mode === 'practice' ? null : tournamentForId(state.activeEventId)
  const effectiveMode = event ? tournamentMode(event) : mode
  if (effectiveMode === 'cup' && !event && state.wins < 2 && state.reputation < 45) {
    return { ok: false, reason: 'Кубок откроется после 2 побед или при 45 репутации.' }
  }

  return { ok: true, reason: '' }
}

interface PreparedMatchContext {
  event: TournamentEvent | null
  effectiveMode: MatchMode
  isPractice: boolean
  preparedRun: TournamentRun | null
  tournamentMatch: ReturnType<typeof nextPlayerMatch>
  opponent: {
    name: string
    rating: number
    teamId: string | null
    roster: TournamentRosterPlayer[]
  }
  fixtureSeed: number
}

const prepareMatchContext = (state: GameState, mode: MatchMode): PreparedMatchContext => {
  const event = mode === 'practice' ? null : tournamentForId(state.activeEventId)
  const effectiveMode = event ? tournamentMode(event) : mode
  const isPractice = effectiveMode === 'practice' && !event
  const preparedRun = event && state.activeTournament
    // Tournament rosters are registration snapshots. The surrounding world keeps
    // trading while the event is running, but an already registered opponent does
    // not lose a player mid-bracket because of an external transfer.
    ? advanceTournamentTo(state.activeTournament, state.now, state.seed + state.season)
    : null
  const tournamentMatch = preparedRun ? nextPlayerMatch(preparedRun) : null
  const tournamentOpponent = preparedRun ? opponentForPlayerMatch(preparedRun) : null
  const fixtureSeed = hashSeed([
    state.seed,
    state.season,
    state.now,
    state.history.length,
    effectiveMode,
    tournamentMatch?.id ?? state.activeEventId ?? 'open',
  ].join(':'))
  const opponentRng = mulberry32(fixtureSeed)
  const generated = tournamentOpponent
    ? {
        name: tournamentOpponent.name,
        rating: tournamentOpponent.rating,
        teamId: tournamentOpponent.worldTeamId,
        roster: tournamentOpponent.roster,
      }
    : generateOpponent(state, effectiveMode, opponentRng)
  const opponent = {
    name: generated.name,
    rating: generated.rating,
    teamId: generated.teamId ?? null,
    roster: generated.roster ?? [],
  }

  return {
    event,
    effectiveMode,
    isPractice,
    preparedRun,
    tournamentMatch,
    opponent,
    fixtureSeed,
  }
}

export const prepareMatchFixture = (
  state: GameState,
  mode: MatchMode,
  tactic: TacticalPlan = 'balanced',
): MatchFixture | null => {
  const gate = canPlayMatch(state, mode)
  if (!gate.ok) return null
  const context = prepareMatchContext(state, mode)
  return {
    id: resultId,
    mode: context.effectiveMode,
    tactic,
    opponent: context.opponent.name,
    opponentRating: context.opponent.rating,
    opponentTeamId: context.opponent.teamId,
    opponentRoster: context.opponent.roster,
  }
}

export const playMatch = (
  state: GameState,
  mode: MatchMode,
  tactic: TacticalPlan,
  selectedMaps: string[] = [],
): GameState => {
  const gate = canPlayMatch(state, mode)
  if (!gate.ok) return state

  const {
    event,
    effectiveMode,
    isPractice,
    preparedRun,
    tournamentMatch,
    opponent,
    fixtureSeed,
  } = prepareMatchContext(state, mode)

  // The fixture must not change because the manager picked another tactic.
  // Outcome randomness may change, opponent identity may not.
  const matchSeed = hashSeed([
    fixtureSeed,
    tactic,
    state.startingFive.join(','),
    opponent.teamId ?? opponent.name,
  ].join(':'))
  const rng = mulberry32(matchSeed)

  const active = getStartingFive(state.roster, state.startingFive)
  const baseRating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const tacticMod = tacticalModifier(active, tactic)
  const rolePenalty = (!active.some((player) => player.role === 'IGL') ? 4 : 0) + (!active.some((player) => player.role === 'AWP') ? 2.5 : 0)
  const maps: MapResult[] = []
  let ourMaps = 0
  let theirMaps = 0
  let seriesRoundsPlayed = 0
  let momentum = 0
  let ourAdaptation = 0
  let opponentAdaptation = 0
  const avgGameSense = averagePlayerStat(active, 'gameSense')
  const avgLeadership = averagePlayerStat(active, 'leadership')
  const ourAdaptationRate = clamp(
    (avgGameSense * .45 + avgLeadership * .35 + state.lineupContinuity * .20) / 70,
    .72,
    1.28,
  )
  const opponentBaseSkills = opponentRosterSkillProfile(opponent.roster, opponent.rating)
  const opponentCondition = createOpponentSeriesCondition(
    opponent.rating,
    mulberry32(hashSeed(matchSeed + ':opponent-condition')),
  )
  const opponentAdaptationRate = clamp(
    (opponentBaseSkills.gameSense * .55 + opponentBaseSkills.leadership * .45) / 70,
    .72,
    1.28,
  )

  while (ourMaps < 2 && theirMaps < 2) {
    const availableMaps = mapPool.filter((name) => !maps.some((current) => current.map === name))
    const forcedMap = selectedMaps[maps.length] as (typeof mapPool)[number] | undefined
    const map = forcedMap && availableMaps.includes(forcedMap) ? forcedMap : pick(availableMaps, rng)
    const preparationMod = isPractice ? 0 : trainingPreparationModifier(state.training ?? createTrainingState(), map, opponent.teamId)
    // Rating is the baseline. Series fatigue is modelled inside causal rounds,
    // so it must not also be subtracted here as a second hidden penalty.
    const effectiveRating = baseRating + momentum - rolePenalty
    const ratingGap = effectiveRating - opponent.rating
    // This is round-level probability, so the scale must be much wider than a
    // map-level Elo/logistic model. Otherwise a small rating gap compounds into
    // near-certain 13-x maps.
    const volatility = tactic === 'aggressive' ? 48 : tactic === 'structured' ? 42 : 44
    const rawProbability = 1 / (1 + Math.exp(-ratingGap / volatility))
    const probability = clamp(rawProbability, .08, .92)
    const mapRng = mulberry32(hashSeed(matchSeed + ':map:' + map + ':' + maps.length))
    const mapResult = simulateStoryMap(
      active,
      opponent.roster,
      opponent.rating,
      map,
      maps.length,
      seriesRoundsPlayed,
      tactic,
      probability,
      tacticMod,
      preparationMod,
      state.lineupContinuity,
      ourAdaptation,
      opponentAdaptation,
      opponentCondition,
      mapRng,
    )
    maps.push(mapResult)
    seriesRoundsPlayed += mapResult.us + mapResult.them
    if (mapResult.us > mapResult.them) {
      ourMaps += 1
      momentum = Math.min(2.5, momentum + 1.2)
    } else {
      theirMaps += 1
      momentum = Math.max(-2.5, momentum - 1.2)
    }

    const storyRounds = mapResult.story?.rounds ?? []
    const systemRoundsLostByOpponent = storyRounds.filter((round) =>
      round.winner === 'US' &&
      (round.cause === 'ANTI_STRAT' || round.cause === 'TACTICAL_EDGE'),
    ).length
    const systemRoundsLostByUs = storyRounds.filter((round) =>
      round.winner === 'THEM' &&
      (round.cause === 'ANTI_STRAT' || round.cause === 'TACTICAL_EDGE'),
    ).length

    ourAdaptation = Math.min(
      3,
      ourAdaptation +
      ((mapResult.us < mapResult.them ? .65 : .25) + Math.min(.55, systemRoundsLostByUs * .045)) * ourAdaptationRate,
    )
    opponentAdaptation = Math.min(
      3,
      opponentAdaptation +
      ((mapResult.us > mapResult.them ? .65 : .25) + Math.min(.55, systemRoundsLostByOpponent * .045)) * opponentAdaptationRate,
    )
  }

  const won = ourMaps > theirMaps
  const totalRoundsPlayed = maps.reduce((sum, map) => sum + map.us + map.them, 0)
  const matchDurationHours = matchDurationHoursForRounds(totalRoundsPlayed, maps.length)
  const resultId = 'm-' + state.season + '-' + state.history.length + '-' + state.now.replace(/[^0-9]/g, '')
  const ratingTier: RatingEvidence['tier'] = isPractice
    ? 0
    : event?.circuitTier ?? (effectiveMode === 'cup' ? 1 : effectiveMode === 'showmatch' ? 2 : 3)
  const ratingEnvironment: RatingEvidence['environment'] = event?.format ?? 'ONLINE'
  const matchVrs = matchVrsAward(effectiveMode, event ?? null, won, opponent.rating, baseRating)
  const opponentVrs = !won ? matchVrsBase(effectiveMode, event ?? null) : 0
  const matchEnd = addGameHours(state.now, matchDurationHours)
  let resolvedRun = preparedRun
    ? resolvePlayerTournamentMatch(preparedRun, won, ourMaps, theirMaps)
    : null
  if (resolvedRun) resolvedRun = advanceTournamentTo(resolvedRun, matchEnd, state.seed + state.season)

  const tournamentFinished = Boolean(resolvedRun && tournamentIsFinished(resolvedRun))
  const tournamentPrize = resolvedRun && tournamentFinished && !resolvedRun.prizePaid
    ? tournamentPrizeForStatus(resolvedRun.eventId, resolvedRun)
    : 0
  const tournamentVrs = resolvedRun && tournamentFinished && !resolvedRun.vrsPaid
    ? tournamentVrsAward(event ?? null, resolvedRun)
    : 0

  if (resolvedRun && tournamentFinished) {
    resolvedRun = {
      ...resolvedRun,
      earnedPrize: resolvedRun.earnedPrize + tournamentPrize,
      prizePaid: true,
      vrsPaid: true,
    }
  }

  const tune = modeTuning[effectiveMode]
  const reward = isPractice ? 0 : event ? tournamentPrize : Math.round(tune.baseReward * (won ? 1 : .42))
  const payroll = 0
  const net = reward
  const fansDelta = isPractice ? 0 : Math.round(tune.fans * (won ? 1 : .25))
  const roundLoad = Math.max(1, Math.round(totalRoundsPlayed / 14))

  const storyErrors = new Map<string, number>()
  const storyClutches = new Map<string, number>()
  for (const map of maps) {
    for (const round of map.story?.rounds ?? []) {
      if (!round.keyPlayer) continue
      if (round.cause === 'PLAYER_ERROR' && round.keyPlayerSide !== 'THEM') {
        storyErrors.set(round.keyPlayer, (storyErrors.get(round.keyPlayer) ?? 0) + 1)
      }
      if (round.cause === 'CLUTCH' && round.winner === 'US' && round.keyPlayerSide !== 'THEM') {
        storyClutches.set(round.keyPlayer, (storyClutches.get(round.keyPlayer) ?? 0) + 1)
      }
    }
  }
  const performances = active
    .map((player) => ({
      playerId: player.id,
      alias: player.alias,
      rating: Math.round(clamp(
        performanceRating(player, won, tactic, rng)
        - (storyErrors.get(player.alias) ?? 0) * 3
        + (storyClutches.get(player.alias) ?? 0) * 2,
        35,
        99,
      )),
    }))
    .sort((a, b) => b.rating - a.rating)
  const mvpPerf = performances[0]
  const mvp = active.find((player) => player.id === mvpPerf.playerId) ?? active[0]
  const story = buildMatchStory(
    maps,
    won,
    opponent.name,
    mvp,
    effectiveMode,
    net,
    event ? event.name + ' · ' + (tournamentMatch?.label ?? 'MATCH') : undefined,
  )

  const activeIds = new Set(active.map((player) => player.id))
  const roster = state.roster.map((player) => {
    const played = activeIds.has(player.id)
    const performance = performances.find((entry) => entry.playerId === player.id)
    const formDelta = isPractice
      ? (played ? Math.round((rng() - .5) * 2) : 0)
      : played
        ? (won ? 3 : -2) + Math.round((rng() - .5) * 3)
        : Math.round((rng() - .5) * 2)
    const moraleDelta = isPractice
      ? (played && won ? 1 : 0)
      : played
        ? (won ? 4 : -4)
        : (won ? 1 : 0)
    const fatigueGain = isPractice
      ? 2 + Math.max(1, Math.round(roundLoad * .65))
      : (tactic === 'aggressive' ? 8 : tactic === 'structured' ? 5 : 6)
        + roundLoad
        + (event ? Math.round(event.fatigue * .35) : 0)
    const ratingV2 = played && performance
      ? appendRatingEvidence(
          player.ratingV2,
          playerRatingSkills(player),
          player.role,
          {
            matchId: resultId,
            at: matchEnd,
            performance: performance.rating,
            opponentRating: opponent.rating,
            tier: ratingTier,
            environment: ratingEnvironment,
            rounds: totalRoundsPlayed,
            won,
          },
        )
      : player.ratingV2
    return {
      ...player,
      ratingV2,
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
    story: story.story,
    mvp: mvp.alias,
    playedAt: state.now,
    tournamentId: event?.id ?? null,
    tournamentMatchId: tournamentMatch?.id ?? null,
    opponentTeamId: opponent.teamId ?? null,
    opponentRoster: opponent.roster ?? [],
    vrsDelta: isPractice ? 0 : matchVrs + tournamentVrs,
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
  const nextActiveTournament = event
    ? (resolvedRun && !tournamentFinished ? resolvedRun : null)
    : state.activeTournament
      ? advanceTournamentTo(state.activeTournament, matchEnd, state.seed + state.season)
      : null
  const finishedHistory = resolvedRun && tournamentFinished
    ? [resolvedRun, ...state.tournamentHistory].slice(0, 30)
    : state.tournamentHistory

  const vrsWorld = !isPractice && opponent.teamId && opponent.teamId !== PLAYER_CLUB_WORLD_ID
    ? awardWorldTeamVrs(state.world, opponent.teamId, opponentVrs)
    : state.world
  const updatedWorld = reconcileWorldWithClubRoster(
    vrsWorld,
    clubWorldRosterProjection(roster),
    matchEnd,
    state.seed + state.history.length * 43,
  )

  const next: GameState = {
    ...state,
    world: updatedWorld,
    now: matchEnd,
    week: nextWeek,
    credits: state.credits + reward,
    fans: Math.max(0, state.fans + fansDelta),
    reputation: isPractice ? state.reputation : clamp(state.reputation + (won ? (effectiveMode === 'cup' ? 5 : 3) : -1)),
    wins: state.wins + (!isPractice && won ? 1 : 0),
    losses: state.losses + (!isPractice && !won ? 1 : 0),
    streak: isPractice ? state.streak : won ? Math.max(1, state.streak + 1) : Math.min(-1, state.streak - 1),
    seasonPoints: state.seasonPoints + (!isPractice && won ? (effectiveMode === 'cup' ? 5 : effectiveMode === 'showmatch' ? 3 : 1) : 0),
    clubVrsPoints: state.clubVrsPoints + (isPractice ? 0 : matchVrs + tournamentVrs),
    roster,
    lineupContinuity: clamp(state.lineupContinuity + (isPractice ? 1 : won ? 3 : 1), 0, 100),
    training: isPractice
      ? state.training
      : {
          ...(state.training ?? createTrainingState()),
          readiness: clamp((state.training?.readiness ?? 56) - 7),
          sharpness: clamp((state.training?.sharpness ?? 55) - 3),
        },
    history: [result, ...state.history].slice(0, 80),
    news: [
      { id: 'news-' + result.id, week: state.week, kind: 'match' as const, title: story.headline, body: story.detail + (result.vrsDelta ? ' · VRS +' + result.vrsDelta : '') },
      ...financeNews,
      ...contractNews,
      ...state.news,
    ].slice(0, 80),
    managerXp: state.managerXp + (isPractice ? 15 : (effectiveMode === 'cup' ? 100 : effectiveMode === 'showmatch' ? 75 : 55) + (won ? 35 : 10)),
    packTokens: state.packTokens + (isPractice ? 0 : won ? (effectiveMode === 'cup' ? 55 : effectiveMode === 'showmatch' ? 40 : 25) : 10),
    activeEventId: nextActiveTournament?.eventId ?? null,
    activeTournament: nextActiveTournament,
    tournamentHistory: finishedHistory,
    pendingDecision: isPractice
      ? null
      : event
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
    training: {
      ...(state.training ?? createTrainingState()),
      readiness: 54,
      tacticalCohesion: clamp((state.training?.tacticalCohesion ?? 50) * .82 + 8),
      sharpness: 52,
      opponentKnowledge: {},
      sessions: [],
    },
    news: [{
      id: 'season-start-' + (state.season + 1),
      week: 1,
      kind: 'media' as const,
      title: 'Начался новый сезон',
      body: 'Календарь обновлён. Турниры снова распределены по датам, а форма и усталость состава частично восстановлены.',
    }, ...state.news].slice(0, 80),
  }
}

export const playerDevelopmentThreshold = (player: Player) => {
  const currentOverall = overall(player)
  const age = player.age ?? 25
  return (
    (currentOverall < 70 ? 90 : currentOverall < 80 ? 125 : currentOverall < 88 ? 175 : 240) +
    Math.max(0, age - 23) * 8
  )
}

export const advancePlayerDevelopment = (
  player: Player,
  development: PlayerDevelopmentState,
  gain: number,
) => {
  const currentOverall = overall(player)
  const threshold = playerDevelopmentThreshold(player)
  const nextProgress = development.progress + Math.max(0, gain)
  const earnsPoint = nextProgress >= threshold && currentOverall < player.potential

  const focusKey =
    development.focus === 'mechanics' ? 'aim'
      : development.focus === 'game-sense' ? 'gameSense'
        : development.focus === 'utility' ? 'utility'
          : development.focus === 'leadership' ? 'leadership'
            : null

  const skills = [
    ['aim', player.aim],
    ['gameSense', player.gameSense],
    ['utility', player.utility],
    ['clutch', player.clutch],
    ['leadership', player.leadership],
  ] as const
  const targetKey = focusKey ?? [...skills].sort((a, b) => a[1] - b[1])[0][0]

  return {
    player: earnsPoint ? { ...player, [targetKey]: clamp(player[targetKey] + 1) } : player,
    development: {
      ...development,
      progress: earnsPoint ? nextProgress - threshold : nextProgress,
    },
  }
}

export const trainPlayer = (state: GameState, playerId: string): GameState => {
  if (state.staffEnergy < 1 || state.credits < 120) return state
  const training = state.training ?? createTrainingState()
  const player = state.roster.find((candidate) => candidate.id === playerId)
  if (!player) return state

  const currentOverall = overall(player)
  const development = training.development[playerId] ?? { focus: 'balanced' as const, progress: 0 }
  const age = player.age ?? 25
  const headroom = Math.max(0, player.potential - currentOverall)
  const ageGain = age <= 21 ? 6 : age <= 24 ? 5 : age <= 27 ? 3 : age <= 30 ? 2 : 1
  const gain = headroom <= 0 ? 0 : Math.max(1, Math.min(ageGain, Math.ceil(headroom / 4)))
  const advanced = advancePlayerDevelopment(player, development, gain)

  return {
    ...state,
    credits: state.credits - 120,
    staffEnergy: state.staffEnergy - 1,
    training: {
      ...training,
      sharpness: clamp(training.sharpness + 1),
      development: {
        ...training.development,
        [playerId]: advanced.development,
      },
    },
    roster: state.roster.map((candidate) =>
      candidate.id === playerId
        ? {
            ...advanced.player,
            form: clamp(candidate.form + 1),
            morale: clamp(candidate.morale + 1),
            fatigue: clamp(candidate.fatigue + 4),
          }
        : candidate,
    ),
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
  identity: WorldPlayer,
  rng: () => number,
  brief: ScoutBrief,
): Player => {
  const base = Math.round(clamp(identity.currentRating + (rng() - .5) * 6, 48, 97))
  const role = identity.role ?? (brief.role === 'Any' ? pick(simulationRoles, rng) : brief.role)
  const currentTeam = worldTeamForPlayer(state.world, identity.key)
  const teamName = currentTeam?.name ?? 'Free agent'
  return {
    id: 'prospect-' + state.scoutCycle + '-' + index + '-' + identity.alias,
    playerKey: identity.key,
    acquiredCardId: null,
    profileId: identity.profileId,
    alias: identity.alias,
    firstName: identity.realName ?? identity.alias,
    realName: identity.realName ?? identity.alias,
    country: identity.country ?? 'Неизвестно',
    team: teamName,
    age: identity.age,
    role,
    aim: clamp(base + Math.round((rng() - .5) * 10)),
    gameSense: clamp(base + Math.round((rng() - .5) * 10)),
    utility: clamp(base + Math.round((rng() - .5) * 10)),
    clutch: clamp(base + Math.round((rng() - .5) * 10)),
    leadership: clamp(base + Math.round((rng() - .5) * 10)),
    form: identity.form,
    morale: identity.morale,
    fatigue: identity.fatigue,
    potential: clamp(base + Math.max(3, 27 - (identity.age ?? 25)) + Math.round(rng() * 6), 45, 99),
    salary: Math.round(60 + base * .82),
    contractWeeks: identity.contractWeeks,
    traits: [pick(traits, rng), pick(traits, rng)],
    bio: (identity.realName ?? identity.alias) + ' · ' + (identity.country ?? 'страна неизвестна') + ' · ' + teamName + '.',
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
  const rosterKeys = new Set(state.roster.map((player) => player.playerKey).filter((key): key is string => Boolean(key)))
  const rosterAliases = new Set(state.roster.map((player) => player.alias.toLocaleLowerCase('en-US')))
  const available = Object.values(state.world.players)
    .filter((identity) => identity.teamId !== PLAYER_CLUB_WORLD_ID)
    .filter((identity) => !rosterKeys.has(identity.key))
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

  const worldIdentity = (prospect.playerKey ? state.world.players[prospect.playerKey] : null) ?? worldPlayerByAlias(state.world, prospect.alias)
  if (worldIdentity?.teamId === PLAYER_CLUB_WORLD_ID) {
    return {
      state,
      evaluation: { ...evaluation, accepted: false, reason: 'Игрок уже принадлежит вашему клубу.' },
    }
  }

  const sourceTeam = worldIdentity ? worldTeamForPlayer(state.world, worldIdentity.key) : null
  const signed: Player = {
    ...prospect,
    playerKey: worldIdentity?.key ?? prospect.playerKey,
    team: 'YOUR CLUB',
    salary: Math.max(1, Math.round(terms.salary)),
    contractWeeks: Math.round(clamp(terms.contractWeeks, 6, 16)),
    morale: clamp(prospect.morale + (terms.squadRole === 'starter' ? 7 : 3)),
  }
  const nextRoster = [...state.roster, signed]
  const nextWorld = claimWorldPlayersForClub(
    state.world,
    [signed.playerKey ?? 'alias:' + signed.alias.toLocaleLowerCase('en-US')],
    state.now,
    state.seed + state.scoutCycle * 97,
  )
  const clubKeys = new Set(
    nextRoster
      .map((player) => player.playerKey ?? worldPlayerByAlias(nextWorld, player.alias)?.key)
      .filter((key): key is string => Boolean(key)),
  )

  let next: GameState = {
    ...state,
    world: nextWorld,
    activeTournament: state.activeTournament
      ? refreshTournamentTeamsFromWorld(state.activeTournament, nextWorld, clubKeys)
      : null,
    credits: state.credits - Math.max(0, Math.round(terms.fee)),
    roster: nextRoster,
    prospects: state.prospects.filter((player) => player.id !== playerId && player.playerKey !== signed.playerKey),
    news: [{
      id: 'sign-' + playerId + '-' + state.week,
      week: state.week,
      kind: 'contract' as const,
      title: prospect.alias + ' подписывает контракт',
      body: (sourceTeam ? 'Переход из ' + sourceTeam.name + '. ' : 'Переход свободного агента. ') + 'Трансфер: ' + Math.round(terms.fee) + ' кр. Зарплата: ' + Math.round(terms.salary) + ' кр./нед. Срок: ' + Math.round(terms.contractWeeks) + ' нед. Роль: ' + (terms.squadRole === 'starter' ? 'основа' : 'ротация') + '.',
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
  const nextRoster = state.roster.filter((p) => p.id !== playerId)
  const nextWorld = releaseWorldPlayerFromClub(state.world, player.playerKey, player.alias, state.now)
  const clubKeys = new Set(
    nextRoster
      .map((candidate) => candidate.playerKey ?? worldPlayerByAlias(nextWorld, candidate.alias)?.key)
      .filter((key): key is string => Boolean(key)),
  )

  return {
    ...state,
    world: nextWorld,
    activeTournament: state.activeTournament
      ? refreshTournamentTeamsFromWorld(state.activeTournament, nextWorld, clubKeys)
      : null,
    credits: state.credits - severance,
    roster: nextRoster,
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
  practice: {
    name: 'Пракк-матч',
    description: 'Тренировочная BO3: 0 денег, 0 VRS, +1 к сыгранности. Нужна для проверки пятёрки между официальными матчами.',
    risk: 'Low',
  },
  scrim: {
    name: 'Официальный матч T3',
    description: 'Рейтинговый матч Tier 3. Результат влияет на турнир, VRS и карьерную статистику.',
    risk: 'Medium',
  },
  showmatch: {
    name: 'Официальный матч T2',
    description: 'Рейтинговый матч Tier 2. Результат влияет на турнир, VRS и карьерную статистику.',
    risk: 'Medium',
  },
  cup: {
    name: 'Официальный матч T1',
    description: 'Рейтинговый матч Tier 1. Максимальная турнирная ценность и влияние на VRS.',
    risk: 'High',
  },
}
