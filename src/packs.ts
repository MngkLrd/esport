import { REAL_PLAYERS, type RealPlayerSeed } from './players'
import { cardStatsForAlias, hltvSnapshotForAlias, type PlayerCardStats } from './cardStats'
import type {
  PackCard,
  PackDefinition,
  PackId,
  PackRarity,
  PackRoll,
  PackState,
} from './packState'

export * from './packState'

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

const editionForStats = (stats: PlayerCardStats) => {
  if (stats.window === 'calendar-year') return stats.periodEnd.slice(0, 4)
  if (stats.window === 'past3m') {
    return stats.periodStart.slice(5, 7) + '–' + stats.periodEnd.slice(5, 7) + " ’" + stats.periodEnd.slice(2, 4)
  }
  return "’" + stats.periodStart.slice(2, 4) + "–’" + stats.periodEnd.slice(2, 4)
}

// Pack power prefers the current HLTV card OVR. Players without usable HLTV
// statistics keep the old VRS/rating fallback so every roster entry remains packable.
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

const rarityForPercentile = (index: number, total: number): PackRarity => {
  const percentile = (index + 1) / Math.max(1, total)
  if (percentile <= 0.025) return 'legendary'
  if (percentile <= 0.10) return 'epic'
  if (percentile <= 0.30) return 'rare'
  if (percentile <= 0.60) return 'uncommon'
  return 'common'
}

const rankedPool = REAL_PLAYERS
  .map((player) => ({ player, power: playerPower(player) }))
  .sort((a, b) => b.power - a.power || a.player.alias.localeCompare(b.player.alias, 'en-US'))

const rarityByAlias = new Map<string, PackRarity>()
const playerByAlias = new Map<string, RealPlayerSeed>()
const pools: Record<PackRarity, RealPlayerSeed[]> = {
  common: [],
  uncommon: [],
  rare: [],
  epic: [],
  legendary: [],
}

rankedPool.forEach(({ player }, index) => {
  const key = player.alias.toLocaleLowerCase('en-US')
  const rarity = rarityForPercentile(index, rankedPool.length)
  playerByAlias.set(key, player)
  rarityByAlias.set(key, rarity)
  pools[rarity].push(player)
})

const rarityForPlayer = (player: RealPlayerSeed): PackRarity =>
  rarityByAlias.get(player.alias.toLocaleLowerCase('en-US')) ?? 'common'

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
  const snapshot = hltvSnapshotForAlias(player.alias)
  const power = cardStats?.ovr ?? playerPower(player)

  return {
    id: ['card', serial, slot, player.alias].join('-'),
    alias: player.alias,
    realName: player.realName,
    country: player.country,
    team: player.team,
    age: player.age,
    profileId: snapshot?.playerId ?? null,
    role: player.role,
    power,
    rarity: rarityForPlayer(player),
    sourceRating: player.rating,
    sourceRank: player.vrsRank ?? null,
    cardStats,
    edition: cardStats ? editionForStats(cardStats) : 'VRS',
    packId,
    serial,
  }
}

const hydrateCard = (card: PackCard): PackCard => {
  const player = playerByAlias.get(card.alias.toLocaleLowerCase('en-US'))
  const stats = card.cardStats ?? cardStatsForAlias(card.alias, card.role)
  const snapshot = hltvSnapshotForAlias(card.alias)

  return {
    ...card,
    realName: card.realName ?? player?.realName ?? null,
    country: card.country ?? player?.country ?? null,
    team: card.team || player?.team || 'Free agent',
    age: card.age ?? player?.age ?? null,
    profileId: card.profileId ?? snapshot?.playerId ?? null,
    role: card.role ?? player?.role ?? null,
    power: stats?.ovr ?? card.power,
    rarity: player ? rarityForPlayer(player) : card.rarity,
    cardStats: stats,
    edition: stats ? editionForStats(stats) : card.edition,
  }
}

export const hydratePackState = (state: PackState): PackState => ({
  ...state,
  inventory: state.inventory.map(hydrateCard),
  history: state.history.map(hydrateCard),
})

const WELCOME_WEIGHTS: Record<PackRarity, number> = {
  common: 45,
  uncommon: 35,
  rare: 15,
  epic: 4.5,
  legendary: 0.5,
}

const WELCOME_ROLES = ['IGL', 'AWP', 'Entry', 'Support', 'Rifler'] as const

const pickPlayerForRole = (
  role: (typeof WELCOME_ROLES)[number],
  rarity: PackRarity,
  rng: () => number,
  usedAliases: Set<string>,
) => {
  const rolePool = pools[rarity].filter(
    (player) => player.role === role && !usedAliases.has(player.alias.toLocaleLowerCase('en-US')),
  )
  const fallback = REAL_PLAYERS.filter(
    (player) => player.role === role && !usedAliases.has(player.alias.toLocaleLowerCase('en-US')),
  )
  const pool = rolePool.length ? rolePool : fallback.length ? fallback : REAL_PLAYERS
  return pool[Math.floor(rng() * pool.length)]
}

export const rollWelcomePack = (saveId: string): PackCard[] => {
  const rng = mulberry32(hashSeed(['welcome-v1', saveId].join(':')))
  const usedAliases = new Set<string>()

  return WELCOME_ROLES.map((role, index) => {
    const rarity = pickRarity(WELCOME_WEIGHTS, rng)
    const player = pickPlayerForRole(role, rarity, rng, usedAliases)
    usedAliases.add(player.alias.toLocaleLowerCase('en-US'))
    return toCard(player, 'welcome', -1, index)
  })
}

export const rollPack = (packId: Exclude<PackId, 'welcome'>, serial: number, saveId: string): PackRoll => {
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

export const PACK_POOL_STATS = {
  totalPlayers: REAL_PLAYERS.length,
  common: pools.common.length,
  uncommon: pools.uncommon.length,
  rare: pools.rare.length,
  epic: pools.epic.length,
  legendary: pools.legendary.length,
} as const
