import type { PlayerCardStats } from './cardStats'
import type { RealPlayerRole } from './players'

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

export const createPackState = (): PackState => ({
  version: 2,
  serial: 0,
  inventory: [],
  history: [],
})

const migrateCard = (raw: unknown): PackCard | null => {
  if (!raw || typeof raw !== 'object') return null
  const card = raw as Partial<PackCard>
  if (
    typeof card.alias !== 'string' ||
    typeof card.power !== 'number' ||
    typeof card.packId !== 'string' ||
    typeof card.rarity !== 'string'
  ) return null

  return {
    ...(card as PackCard),
    sourceRating: typeof card.sourceRating === 'number' ? card.sourceRating : null,
    sourceRank: typeof card.sourceRank === 'number' ? card.sourceRank : null,
    cardStats: card.cardStats ?? null,
    edition: typeof card.edition === 'string' ? card.edition : 'VRS',
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
  state.inventory.filter(
    (card) => card.alias.toLocaleLowerCase('en-US') === alias.toLocaleLowerCase('en-US'),
  ).length
