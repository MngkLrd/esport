import { REAL_PLAYERS, type RealPlayerRole, type RealPlayerSeed } from './players'
import { cardStatsForAlias, type PlayerCardStats } from './cardStats'

export type PackRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type PackId = 'academy' | 'challenger' | 'major' | 'afterdark'

export interface PackDefinition {
  id: PackId
  name: string
  eyebrow: string
  description: string
  price: number
  accent: string
  weights: Record<PackRarity, number>
}

export interface PackCard {
  id: string
  alias: string
  realName: string | null
  country: string | null
  team: string
  role: RealPlayerRole | null
  power: number
  rarity: PackRarity
  sourceRating: number | null
  sourceRank: number | null
  cardStats: PlayerCardStats | null
  edition: string
  packId: PackId
  serial: number
}

export interface PackState {
  version: 2
  serial: number
  inventory: PackCard[]
  history: PackCard[]
}

export interface PackRoll {
  pack: PackDefinition
  winner: PackCard
  reel: PackCard[]
  winnerIndex: number
}

export const LEGACY_PACK_SAVE_KEY = 'esport-ai-manager-packs-v1'

export const PACKS: readonly PackDefinition[] = [
  {
    id: 'academy',
    name: 'Академический набор',
    eyebrow: 'НИЗКАЯ ЦЕНА · БОЛЬШОЙ ПУЛ',
    description: 'Дешёвый вход в большой пул. В основном перспективные игроки, но есть небольшой шанс на звезду.',
    price: 180,
    accent: '#8ca3b8',
    weights: { common: 52, uncommon: 31, rare: 13, epic: 3.5, legendary: 0.5 },
  },
  {
    id: 'challenger',
    name: 'Набор претендента',
    eyebrow: 'СБАЛАНСИРОВАННЫЙ · СОРЕВНОВАТЕЛЬНЫЙ',
    description: 'Более сильный соревновательный набор с заметным шансом на редкие и эпические карты.',
    price: 420,
    accent: '#54a9ff',
    weights: { common: 30, uncommon: 35, rare: 23, epic: 10, legendary: 2 },
  },
  {
    id: 'major',
    name: 'Ночь мейджора',
    eyebrow: 'ПРЕМИУМ · ОХОТА ЗА ЗВЁЗДАМИ',
    description: 'Дорогой набор с повышенным шансом на узнаваемых игроков высокого уровня.',
    price: 850,
    accent: '#9b7cff',
    weights: { common: 12, uncommon: 28, rare: 34, epic: 21, legendary: 5 },
  },
  {
    id: 'afterdark',
    name: 'После полуночи',
    eyebrow: 'ВЫСОКИЕ СТАВКИ · БЕЗ ОБЫЧНЫХ',
    description: 'Без обычных карт. Для поздней стадии сохранения, когда коллекция начинает дорого стоить.',
    price: 1450,
    accent: '#ffb84d',
    weights: { common: 0, uncommon: 20, rare: 37, epic: 33, legendary: 10 },
  },
] as const

export const RARITY_LABEL: Record<PackRarity, string> = {
  common: 'ОБЫЧНАЯ',
  uncommon: 'НЕОБЫЧНАЯ',
  rare: 'РЕДКАЯ',
  epic: 'ЭПИЧЕСКАЯ',
  legendary: 'ЛЕГЕНДАРНАЯ',
}

export const RARITY_COLOR: Record<PackRarity, string> = {
  common: '#9aa5b1',
  uncommon: '#5ab5ff',
  rare: '#596cff',
  epic: '#b45cff',
  legendary: '#ffc857',
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

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

const aliasNoise = (alias: string) => (hashSeed(alias.toLocaleLowerCase('en-US')) % 7) - 3

// Pack power is a 1–100 presentation scale. The current pro pool intentionally
// occupies roughly 54–99: curated profiles use the public rating seed, while
// long-tail VRS players use the ranking of their snapshot team.
export const playerPower = (player: RealPlayerSeed) => {
  const hltv = cardStatsForAlias(player.alias, player.role)
  if (hltv) return hltv.ovr

  const noise = aliasNoise(player.alias)
  if (player.rating != null) {
    return clamp(Math.round(60 + (player.rating - 0.8) * 62 + noise), 58, 99)
  }
  const rank = player.vrsRank ?? 401
  if (rank <= 10) return clamp(91 + noise, 88, 96)
  if (rank <= 30) return clamp(85 + noise, 82, 91)
  if (rank <= 75) return clamp(79 + noise, 75, 86)
  if (rank <= 160) return clamp(72 + noise, 67, 80)
  return clamp(63 + noise - Math.floor((rank - 160) / 90), 54, 70)
}

export const rarityForPower = (power: number): PackRarity => {
  if (power >= 91) return 'legendary'
  if (power >= 84) return 'epic'
  if (power >= 76) return 'rare'
  if (power >= 67) return 'uncommon'
  return 'common'
}

const pools: Record<PackRarity, RealPlayerSeed[]> = {
  common: [],
  uncommon: [],
  rare: [],
  epic: [],
  legendary: [],
}

for (const player of REAL_PLAYERS) pools[rarityForPower(playerPower(player))].push(player)

const pickRarity = (weights: Record<PackRarity, number>, rng: () => number) => {
  const rarities = Object.keys(weights) as PackRarity[]
  const total = rarities.reduce((sum, rarity) => sum + weights[rarity], 0)
  let cursor = rng() * total
  for (const rarity of rarities) {
    cursor -= weights[rarity]
    if (cursor <= 0) return rarity
  }
  return 'common' as PackRarity
}

const pickPlayer = (rarity: PackRarity, rng: () => number) => {
  const pool = pools[rarity].length ? pools[rarity] : REAL_PLAYERS
  return pool[Math.floor(rng() * pool.length)]
}

const toCard = (player: RealPlayerSeed, packId: PackId, serial: number, slot: number): PackCard => {
  const cardStats = cardStatsForAlias(player.alias, player.role)
  const power = cardStats?.ovr ?? playerPower(player)
  const edition = cardStats
    ? cardStats.periodStart.slice(2, 4) + '–' + cardStats.periodEnd.slice(2, 4)
    : 'VRS'
  return {
    id: ['card', serial, slot, player.alias].join('-'),
    alias: player.alias,
    realName: player.realName,
    country: player.country,
    team: player.team,
    role: player.role,
    power,
    rarity: rarityForPower(power),
    sourceRating: player.rating,
    sourceRank: player.vrsRank ?? null,
    cardStats,
    edition,
    packId,
    serial,
  }
}

export const createPackState = (): PackState => ({
  version: 2,
  serial: 0,
  inventory: [],
  history: [],
})

const migrateCard = (raw: unknown): PackCard | null => {
  if (!raw || typeof raw !== 'object') return null
  const card = raw as Partial<PackCard>
  if (typeof card.alias !== 'string' || typeof card.power !== 'number' || typeof card.packId !== 'string') return null
  return {
    ...(card as PackCard),
    sourceRating: typeof card.sourceRating === 'number' ? card.sourceRating : null,
    sourceRank: typeof card.sourceRank === 'number' ? card.sourceRank : null,
    cardStats: card.cardStats ?? cardStatsForAlias(card.alias, card.role ?? null),
    edition: typeof card.edition === 'string'
      ? card.edition
      : (cardStatsForAlias(card.alias, card.role ?? null)
          ? cardStatsForAlias(card.alias, card.role ?? null)!.periodStart.slice(2, 4) + '–' + cardStatsForAlias(card.alias, card.role ?? null)!.periodEnd.slice(2, 4)
          : 'VRS'),
  }
}

export const migratePackState = (raw: unknown): PackState => {
  if (!raw || typeof raw !== 'object') return createPackState()
  const parsed = raw as { version?: number; serial?: number; inventory?: unknown[]; history?: unknown[] }
  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.inventory)) return createPackState()
  return {
    version: 2,
    serial: typeof parsed.serial === 'number' ? Math.max(0, Math.floor(parsed.serial)) : 0,
    inventory: parsed.inventory.map(migrateCard).filter((card): card is PackCard => Boolean(card)),
    history: Array.isArray(parsed.history)
      ? parsed.history.map(migrateCard).filter((card): card is PackCard => Boolean(card)).slice(0, 60)
      : [],
  }
}

export const rollPack = (packId: PackId, serial: number, saveId: string): PackRoll => {
  const pack = PACKS.find((candidate) => candidate.id === packId) ?? PACKS[0]
  const rng = mulberry32(hashSeed(['pack-v2', saveId, packId, serial].join(':')))
  const winnerRarity = pickRarity(pack.weights, rng)
  const winnerPlayer = pickPlayer(winnerRarity, rng)
  const winnerIndex = 37
  const reel = Array.from({ length: 46 }, (_, index) => {
    const visualRarity = pickRarity(pack.weights, rng)
    return toCard(pickPlayer(visualRarity, rng), pack.id, serial, index)
  })
  const winner = toCard(winnerPlayer, pack.id, serial, winnerIndex)
  reel[winnerIndex] = winner
  return { pack, winner, reel, winnerIndex }
}

export const collectPackWinner = (state: PackState, winner: PackCard): PackState => ({
  version: 2,
  serial: Math.max(state.serial + 1, winner.serial + 1),
  inventory: [winner, ...state.inventory],
  history: [winner, ...state.history].slice(0, 60),
})

export const clearPackCollection = (state: PackState): PackState => ({
  version: 2,
  serial: state.serial,
  inventory: [],
  history: [],
})

export const packCollectionStats = (state: PackState) => {
  const aliases = state.inventory.map((card) => card.alias.toLocaleLowerCase('en-US'))
  const unique = new Set(aliases).size
  const legendary = state.inventory.filter((card) => card.rarity === 'legendary').length
  const epic = state.inventory.filter((card) => card.rarity === 'epic').length
  const bestPower = state.inventory.reduce((best, card) => Math.max(best, card.power), 0)
  return {
    total: state.inventory.length,
    unique,
    duplicates: state.inventory.length - unique,
    legendary,
    epic,
    bestPower,
  }
}

export const packAliasCount = (state: PackState, alias: string) =>
  state.inventory.filter((card) => card.alias.toLocaleLowerCase('en-US') === alias.toLocaleLowerCase('en-US')).length

export const PACK_POOL_STATS = {
  totalPlayers: REAL_PLAYERS.length,
  common: pools.common.length,
  uncommon: pools.uncommon.length,
  rare: pools.rare.length,
  epic: pools.epic.length,
  legendary: pools.legendary.length,
} as const
