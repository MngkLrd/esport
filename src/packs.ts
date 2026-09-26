import { REAL_PLAYERS, type RealPlayerRole, type RealPlayerSeed } from './players'

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
  sourceRank: number | null
  packId: PackId
  serial: number
}

export interface PackState {
  version: 1
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

export const PACKS: readonly PackDefinition[] = [
  {
    id: 'academy',
    name: 'Academy Drop',
    eyebrow: 'LOW COST · DEEP POOL',
    description: 'Cheap route into the long tail. Mostly prospects, with a small chance of a star.',
    price: 180,
    accent: '#8ca3b8',
    weights: { common: 52, uncommon: 31, rare: 13, epic: 3.5, legendary: 0.5 },
  },
  {
    id: 'challenger',
    name: 'Challenger Case',
    eyebrow: 'BALANCED · COMPETITIVE',
    description: 'A broader competitive pack with a meaningful blue-and-purple hit rate.',
    price: 420,
    accent: '#54a9ff',
    weights: { common: 30, uncommon: 35, rare: 23, epic: 10, legendary: 2 },
  },
  {
    id: 'major',
    name: 'Major Night',
    eyebrow: 'PREMIUM · STAR HUNT',
    description: 'Expensive, dramatic and biased toward recognizable high-ranked players.',
    price: 850,
    accent: '#9b7cff',
    weights: { common: 12, uncommon: 28, rare: 34, epic: 21, legendary: 5 },
  },
  {
    id: 'afterdark',
    name: 'After Dark',
    eyebrow: 'HIGH ROLLER · NO GREYS',
    description: 'No common cards. Built for late-save collecting and painful credit decisions.',
    price: 1450,
    accent: '#ffb84d',
    weights: { common: 0, uncommon: 20, rare: 37, epic: 33, legendary: 10 },
  },
] as const

export const RARITY_LABEL: Record<PackRarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
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

const playerPower = (player: RealPlayerSeed) => {
  const noise = (hashSeed(player.alias.toLocaleLowerCase('en-US')) % 7) - 3
  if (player.rating != null) return clamp(Math.round(60 + (player.rating - 0.8) * 62 + noise), 58, 99)
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
  const power = playerPower(player)
  return {
    id: ['card', serial, slot, player.alias].join('-'),
    alias: player.alias,
    realName: player.realName,
    country: player.country,
    team: player.team,
    role: player.role,
    power,
    rarity: rarityForPower(power),
    sourceRank: player.vrsRank ?? null,
    packId,
    serial,
  }
}

export const createPackState = (): PackState => ({
  version: 1,
  serial: 0,
  inventory: [],
  history: [],
})

export const migratePackState = (raw: unknown): PackState => {
  if (!raw || typeof raw !== 'object') return createPackState()
  const parsed = raw as Partial<PackState>
  if (parsed.version !== 1 || !Array.isArray(parsed.inventory)) return createPackState()
  return {
    version: 1,
    serial: typeof parsed.serial === 'number' ? parsed.serial : 0,
    inventory: parsed.inventory,
    history: Array.isArray(parsed.history) ? parsed.history : [],
  }
}

export const rollPack = (packId: PackId, serial: number): PackRoll => {
  const pack = PACKS.find((candidate) => candidate.id === packId) ?? PACKS[0]
  const rng = mulberry32(hashSeed(['pack', packId, serial].join(':')))
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
  version: 1,
  serial: Math.max(state.serial + 1, winner.serial + 1),
  inventory: [winner, ...state.inventory],
  history: [winner, ...state.history].slice(0, 40),
})

export const packCollectionStats = (state: PackState) => {
  const unique = new Set(state.inventory.map((card) => card.alias.toLocaleLowerCase('en-US'))).size
  const legendary = state.inventory.filter((card) => card.rarity === 'legendary').length
  const epic = state.inventory.filter((card) => card.rarity === 'epic').length
  return { total: state.inventory.length, unique, legendary, epic }
}

export const PACK_POOL_STATS = {
  totalPlayers: REAL_PLAYERS.length,
  common: pools.common.length,
  uncommon: pools.uncommon.length,
  rare: pools.rare.length,
  epic: pools.epic.length,
  legendary: pools.legendary.length,
} as const
