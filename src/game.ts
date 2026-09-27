import { REAL_PLAYERS } from './players'
import { collectPackCards, createPackState, type PackCard, type PackState } from './packState'

export type Role = 'IGL' | 'Entry' | 'Rifler' | 'AWP' | 'Support'
export type MatchMode = 'scrim' | 'showmatch' | 'cup'
export type TacticalPlan = 'balanced' | 'aggressive' | 'structured'

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

export interface GameState {
  version: 7
  saveId: string
  seed: number
  season: number
  week: number
  seasonLength: number
  seasonEnded: boolean
  seasonSummary: SeasonSummary | null
  credits: number
  fans: number
  reputation: number
  wins: number
  losses: number
  streak: number
  seasonPoints: number
  staffEnergy: number
  welcomeComplete: boolean
  roster: Player[]
  startingFive: string[]
  lineupContinuity: number
  prospects: Player[]
  scoutCycle: number
  history: MatchResult[]
  news: NewsItem[]
  lastPayroll: number
  lastWeekNet: number
  packs: PackState
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
  version: 7,
  saveId: createSaveId(),
  seed: 271828,
  season: 1,
  week: 1,
  seasonLength: 12,
  seasonEnded: false,
  seasonSummary: null,
  credits: 3200,
  fans: 340,
  reputation: 38,
  wins: 0,
  losses: 0,
  streak: 0,
  seasonPoints: 0,
  staffEnergy: 3,
  welcomeComplete: false,
  roster: [],
  startingFive: [],
  lineupContinuity: 50,
  prospects: [],
  scoutCycle: 0,
  history: [],
  news: [
    {
      id: 'welcome',
      week: 1,
      kind: 'media' as const,
      title: 'Новый проект выходит на сцену',
      body: 'Двенадцать недель начинаются с welcome-пака. Пять выпавших игроков становятся первой стартовой пятёркой клуба.',
    },
  ],
  lastPayroll: 0,
  lastWeekNet: 0,
  packs: createPackState(),
})

const normalizePlayers = (players: Player[], packs: PackState): Player[] => players.map((player) => {
  const card = packs.inventory.find((entry) => entry.alias.toLocaleLowerCase('en-US') === player.alias.toLocaleLowerCase('en-US'))
  return {
    ...player,
    playerKey: player.playerKey ?? 'alias:' + player.alias.toLocaleLowerCase('en-US'),
    acquiredCardId: player.acquiredCardId ?? card?.id ?? null,
  }
})

export const migrateState = (raw: unknown): GameState => {
  if (!raw || typeof raw !== 'object') return createInitialState()
  const parsed = raw as { version?: number; roster?: Player[]; prospects?: Player[]; packs?: PackState; saveId?: string; [key: string]: unknown }
  if (parsed.version === 7 && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    return {
      ...(parsed as unknown as GameState),
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: Boolean(parsed.welcomeComplete),
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      roster: normalizePlayers(parsed.roster, packs),
      packs,
    }
  }

  if ((parsed.version === 6 || parsed.version === 5) && Array.isArray(parsed.roster)) {
    const packs = parsed.packs?.version === 2 ? parsed.packs : createPackState()
    return {
      ...(parsed as unknown as Omit<GameState, 'version' | 'welcomeComplete'>),
      version: 7,
      saveId: typeof parsed.saveId === 'string' && parsed.saveId ? parsed.saveId : createSaveId(),
      welcomeComplete: parsed.version === 6 ? Boolean(parsed.welcomeComplete) : true,
      season: typeof parsed.season === 'number' ? parsed.season : 1,
      seasonEnded: Boolean(parsed.seasonEnded),
      seasonSummary: (parsed.seasonSummary as SeasonSummary | null | undefined) ?? null,
      roster: normalizePlayers(parsed.roster, packs),
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

    return {
      ...base,
      ...(parsed as object),
      version: 7,
      saveId: createSaveId(),
      welcomeComplete: true,
      season: 1,
      seasonEnded: false,
      seasonSummary: null,
      seasonLength: 12,
      roster,
      startingFive: Array.isArray(parsed.startingFive) ? parsed.startingFive as string[] : roster.slice(0, 5).map((p) => p.id),
      lineupContinuity: typeof parsed.lineupContinuity === 'number' ? parsed.lineupContinuity : 55,
      prospects,
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

const mapPool = ['Foundry', 'Harbor', 'Citadel', 'Metro', 'Rift', 'Archive'] as const

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

const generateOpponent = (state: GameState, mode: MatchMode, rng: () => number) => {
  const tune = modeTuning[mode]
  const rating = Math.round(clamp(53 + state.reputation * 0.4 + tune.difficulty + (rng() - 0.5) * 9, 48, 94))
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

export const canPlayMatch = (state: GameState, mode: MatchMode) => {
  if (!state.welcomeComplete) return { ok: false, reason: 'Сначала открой стартовый набор и собери пятёрку.' }
  if (state.seasonEnded || state.week > state.seasonLength) return { ok: false, reason: 'Сезон завершён. Открой итог и начни следующий сезон.' }
  const active = getStartingFive(state.roster, state.startingFive)
  if (active.length !== 5) return { ok: false, reason: 'Выбери ровно пять игроков в основу.' }
  if (active.some((p) => p.contractWeeks <= 0)) return { ok: false, reason: 'Продли контракт или убери из основы каждого игрока с истёкшим контрактом.' }
  if (mode === 'cup' && state.wins < 2 && state.reputation < 45) {
    return { ok: false, reason: 'Онлайн-кубок откроется после 2 побед или при 45 репутации.' }
  }
  return { ok: true, reason: '' }
}

export const playMatch = (state: GameState, mode: MatchMode, tactic: TacticalPlan): GameState => {
  const gate = canPlayMatch(state, mode)
  if (!gate.ok) return state

  const rng = mulberry32(hashSeed([state.seed, state.week, state.history.length, mode, tactic, state.startingFive.join(',')].join(':')))
  const opponent = generateOpponent(state, mode, rng)
  const active = getStartingFive(state.roster, state.startingFive)
  const baseRating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const tacticMod = tacticalModifier(active, tactic)
  const rolePenalty = (!active.some((p) => p.role === 'IGL') ? 4 : 0) + (!active.some((p) => p.role === 'AWP') ? 2.5 : 0)
  const maps: MapResult[] = []
  let ourMaps = 0
  let theirMaps = 0
  let momentum = 0

  while (ourMaps < 2 && theirMaps < 2) {
    const map = pick(mapPool.filter((name) => !maps.some((m) => m.map === name)), rng)
    const mapFatigue = maps.length * (tactic === 'aggressive' ? 1.6 : tactic === 'structured' ? 0.7 : 1)
    const effectiveRating = baseRating + tacticMod + momentum - rolePenalty - mapFatigue
    const volatility = tactic === 'aggressive' ? 6.8 : tactic === 'structured' ? 8.8 : 7.8
    const probability = 1 / (1 + Math.exp((opponent.rating - effectiveRating) / volatility))
    const wonMap = rng() < probability
    const closeness = 1 - Math.min(1, Math.abs(probability - 0.5) * 2)
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
  const performances = active
    .map((player) => ({ playerId: player.id, alias: player.alias, rating: performanceRating(player, won, tactic, rng) }))
    .sort((a, b) => b.rating - a.rating)
  const mvpPerf = performances[0]
  const mvp = active.find((p) => p.id === mvpPerf.playerId) ?? active[0]
  const tune = modeTuning[mode]
  const reward = Math.round(tune.baseReward * (won ? 1 : 0.42))
  const payroll = weeklyPayroll(state)
  const net = reward - payroll
  const fansDelta = Math.round(tune.fans * (won ? 1 : 0.25))
  const story = narrative(state, opponent.name, won, mvp, mode, tactic, net, rng)

  const activeIds = new Set(active.map((p) => p.id))
  const roster = state.roster.map((player) => {
    const played = activeIds.has(player.id)
    const formDelta = played ? (won ? 3 : -2) + Math.round((rng() - 0.5) * 3) : Math.round((rng() - 0.5) * 2)
    const moraleDelta = played ? (won ? 4 : -4) : (won ? 1 : 0)
    const fatigueGain = tactic === 'aggressive' ? 12 : tactic === 'structured' ? 8 : 10
    return {
      ...player,
      form: clamp(player.form + formDelta),
      morale: clamp(player.morale + moraleDelta + (net < 0 ? -1 : 0)),
      fatigue: clamp(player.fatigue + (played ? fatigueGain : -9)),
      contractWeeks: Math.max(0, player.contractWeeks - 1),
    }
  })

  const expired = roster.filter((p) => p.contractWeeks === 0)
  const result: MatchResult = {
    id: 'm-' + state.week + '-' + state.history.length,
    season: state.season,
    week: state.week,
    mode,
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
  }

  const contractNews: NewsItem[] = expired.length
    ? [{
        id: 'contracts-' + state.week,
        week: state.week + 1,
        kind: 'contract' as const,
        title: 'Контракт истёк',
        body: expired.map((p) => p.alias).join(', ') + ': нельзя выпускать на следующий матч без продления или замены.',
      }]
    : roster.some((p) => p.contractWeeks <= 2)
      ? [{
          id: 'contracts-warning-' + state.week,
          week: state.week + 1,
          kind: 'contract' as const,
          title: 'Контрактное давление растёт',
          body: 'До окончания контрактов осталось не больше двух недель: ' + roster.filter((p) => p.contractWeeks <= 2).map((p) => p.alias).join(', ') + '.',
        }]
      : []

  const financeNews: NewsItem = {
    id: 'finance-' + result.id,
    week: state.week,
    kind: 'finance' as const,
    title: net >= 0 ? 'Матчевая неделя покрыла зарплаты' : 'Зарплаты превысили доход от матча',
    body: 'Доход за участие и результат: ' + reward + ' кр. Зарплаты: ' + payroll + ' кр. Итог: ' + (net >= 0 ? '+' : '') + net + ' кр.',
  }

  const seasonEnded = state.week >= state.seasonLength
  const seasonPerformances = [result, ...state.history.filter((match) => match.season === state.season)].reduce<Record<string, { alias: string; total: number }>>((scores, match) => {
    for (const performance of match.performances) {
      const current = scores[performance.playerId] ?? { alias: performance.alias, total: 0 }
      scores[performance.playerId] = { alias: current.alias, total: current.total + performance.rating }
    }
    return scores
  }, {})
  const bestPlayer = Object.values(seasonPerformances).sort((a, b) => b.total - a.total)[0]?.alias ?? mvp.alias
  const seasonSummary: SeasonSummary | null = seasonEnded
    ? {
        season: state.season,
        wins: state.wins + (won ? 1 : 0),
        losses: state.losses + (won ? 0 : 1),
        points: state.seasonPoints + (won ? (mode === 'cup' ? 5 : mode === 'showmatch' ? 3 : 1) : 0),
        reputation: clamp(state.reputation + (won ? (mode === 'cup' ? 5 : 3) : -1)),
        fans: Math.max(0, state.fans + fansDelta),
        credits: Math.max(0, state.credits + net),
        bestPlayer,
        payroll,
        objective: {
          label: 'Выиграть минимум 5 матчей',
          target: 5,
          value: state.wins + (won ? 1 : 0),
          completed: state.wins + (won ? 1 : 0) >= 5,
        },
      }
    : null

  return {
    ...state,
    week: seasonEnded ? state.week : state.week + 1,
    seasonEnded,
    seasonSummary,
    credits: Math.max(0, state.credits + net),
    fans: Math.max(0, state.fans + fansDelta),
    reputation: clamp(state.reputation + (won ? (mode === 'cup' ? 5 : 3) : -1)),
    wins: state.wins + (won ? 1 : 0),
    losses: state.losses + (won ? 0 : 1),
    streak: won ? Math.max(1, state.streak + 1) : Math.min(-1, state.streak - 1),
    seasonPoints: state.seasonPoints + (won ? (mode === 'cup' ? 5 : mode === 'showmatch' ? 3 : 1) : 0),
    staffEnergy: 3,
    roster,
    lineupContinuity: clamp(state.lineupContinuity + (won ? 3 : 1), 0, 100),
    history: [result, ...state.history].slice(0, 30),
    news: [
      { id: 'news-' + result.id, week: state.week, kind: 'match' as const, title: story.headline, body: story.detail },
      financeNews,
      ...contractNews,
      ...state.news,
    ].slice(0, 50),
    lastPayroll: payroll,
    lastWeekNet: net,
  }
}

export const startNextSeason = (state: GameState): GameState => {
  if (!state.seasonEnded) return state
  const roster = state.roster.map((player) => ({
    ...player,
    fatigue: clamp(Math.round(player.fatigue * 0.35)),
    morale: clamp(Math.round((player.morale + 60) / 2)),
    form: clamp(Math.round((player.form + 55) / 2)),
  }))
  return {
    ...state,
    season: state.season + 1,
    week: 1,
    seasonEnded: false,
    seasonSummary: null,
    wins: 0,
    losses: 0,
    streak: 0,
    seasonPoints: 0,
    roster,
    news: [{
      id: 'season-start-' + (state.season + 1),
      week: 1,
      kind: 'media' as const,
      title: 'Начался новый сезон',
      body: 'Контракты и коллекция продолжаются. Форма и усталость игроков восстановлены частично.',
    }, ...state.news].slice(0, 50),
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

export const toggleStarter = (state: GameState, playerId: string): GameState => {
  const player = state.roster.find((p) => p.id === playerId)
  if (!player) return state
  const isStarter = state.startingFive.includes(playerId)
  if (!isStarter && (state.startingFive.length >= 5 || player.contractWeeks <= 0)) return state
  const startingFive = isStarter
    ? state.startingFive.filter((id) => id !== playerId)
    : [...state.startingFive, playerId]
  return {
    ...state,
    startingFive,
    lineupContinuity: clamp(state.lineupContinuity - 8),
    news: [{
      id: 'lineup-' + state.week + '-' + playerId + '-' + startingFive.length,
      week: state.week,
      kind: 'lineup' as const,
      title: isStarter ? player.alias + ' отправляется в запас' : player.alias + ' выходит в стартовую пятёрку',
      body: 'Изменение активной пятёрки временно снижает стабильность. Постоянный состав восстанавливает химию через матчи.',
    }, ...state.news].slice(0, 50),
  }
}

const proPlayerIdentities = REAL_PLAYERS
const simulationRoles: readonly Role[] = ['IGL', 'Entry', 'Rifler', 'AWP', 'Support']

const traits = ['Чистый аим', 'Ученик игры', 'Не боится большой сцены', 'Рабочая лошадка', 'Креативный коллер', 'Чутьё в позднем раунде'] as const

const makeProspect = (
  state: GameState,
  index: number,
  identity: (typeof proPlayerIdentities)[number],
  rng: () => number,
): Player => {
  const base = Math.round(54 + state.reputation * 0.22 + rng() * 14)
  return {
    id: 'prospect-' + state.scoutCycle + '-' + index + '-' + identity.alias,
    playerKey: 'alias:' + identity.alias.toLocaleLowerCase('en-US'),
    acquiredCardId: null,
    alias: identity.alias,
    firstName: identity.realName ?? identity.alias,
    realName: identity.realName ?? identity.alias,
    country: identity.country ?? 'Неизвестно',
    team: identity.team,
        age: identity.age,
    role: identity.role ?? pick(simulationRoles, rng),
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

export const scout = (state: GameState): GameState => {
  if (state.credits < 300) return state
  const rng = mulberry32(hashSeed([state.seed, 'scout', state.scoutCycle, state.week].join(':')))
  const unavailable = new Set([...state.roster, ...state.prospects].map((p) => p.alias))
  const available = proPlayerIdentities.filter((p) => !unavailable.has(p.alias))
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }
  const selected = available.slice(0, 3)
  const prospects = selected.map((identity, index) => makeProspect(state, index, identity, rng))
  return {
    ...state,
    credits: state.credits - 300,
    scoutCycle: state.scoutCycle + 1,
    prospects,
    news: [{
      id: 'scout-' + state.scoutCycle,
      week: state.week,
      kind: 'scout' as const,
      title: 'Скаутский отчёт готов',
      body: 'Три реальных CS2-ника выбраны из расширенной базы игроков. Для проработанных профилей используются проверенные данные личности, длинный хвост берётся из срезов Valve VRS от 2026-09-07. Рейтинги, роли, зарплаты и потенциал рассчитывает менеджерская симуляция.',
    }, ...state.news].slice(0, 50),
  }
}

export const signProspect = (state: GameState, playerId: string): GameState => {
  if (state.roster.length >= 8) return state
  const prospect = state.prospects.find((p) => p.id === playerId)
  if (!prospect) return state
  const fee = prospect.salary * 3
  if (state.credits < fee) return state
  return {
    ...state,
    credits: state.credits - fee,
    roster: [...state.roster, { ...prospect, contractWeeks: 10, morale: clamp(prospect.morale + 5) }],
    prospects: state.prospects.filter((p) => p.id !== playerId),
    news: [{
      id: 'sign-' + playerId,
      week: state.week,
      kind: 'contract' as const,
      title: prospect.alias + ' присоединяется к проекту',
      body: 'Подписание: ' + fee + ' кр. Недельная зарплата: ' + prospect.salary + ' кр. Игрок начинает в запасе.',
    }, ...state.news].slice(0, 50),
  }
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
