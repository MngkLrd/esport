import { HLTV_CARD_SNAPSHOTS } from './hltvCardStats.generated'
import type { RealPlayerRole } from './players'

export interface HltvRawStats {
  maps: number
  rating: number | null
  adr: number | null
  kast: number | null
  roundSwing: number | null
  killsPerMap: number | null
  deathsPerMap: number | null
}

export interface DerivedCardScores {
  aim: number
  utility: number
  positioning: number
  clutch: number
}

export interface HltvPlayerSnapshot {
  alias: string
  playerId: number | null
  profileUrl: string | null
  status: 'ok' | 'no-data' | 'unmatched' | 'error'
  matchMethod: 'hltv-id' | 'exact-alias' | 'normalized-alias' | null
  window: 'last12m' | 'calendar-year'
  periodStart: string
  periodEnd: string
  raw: HltvRawStats
  cardScores: DerivedCardScores | null
  error?: string | null
}

export interface PlayerCardStats extends DerivedCardScores {
  ovr: number
  confidence: 'low' | 'medium' | 'high'
  source: 'hltv'
  window: HltvPlayerSnapshot['window']
  periodStart: string
  periodEnd: string
  maps: number
  rating: number | null
}

const clamp = (value: number, min = 1, max = 99) => Math.max(min, Math.min(max, Math.round(value)))

const overallWeights: Record<RealPlayerRole | 'Unknown', [number, number, number, number]> = {
  IGL: [0.20, 0.25, 0.38, 0.17],
  Support: [0.22, 0.34, 0.30, 0.14],
  Entry: [0.38, 0.12, 0.32, 0.18],
  AWP: [0.38, 0.10, 0.30, 0.22],
  Rifler: [0.34, 0.16, 0.28, 0.22],
  Unknown: [0.32, 0.18, 0.30, 0.20],
}

export const cardStatsFromHltv = (
  snapshot: HltvPlayerSnapshot | null | undefined,
  role: RealPlayerRole | null,
): PlayerCardStats | null => {
  if (!snapshot || snapshot.status !== 'ok' || !snapshot.cardScores) return null

  const { aim, utility, positioning, clutch } = snapshot.cardScores
  const [aimWeight, utilityWeight, posWeight, clutchWeight] = overallWeights[role ?? 'Unknown']
  const ovr = clamp(
    aim * aimWeight +
    utility * utilityWeight +
    positioning * posWeight +
    clutch * clutchWeight,
  )
  const maps = snapshot.raw.maps

  return {
    ovr,
    aim,
    utility,
    positioning,
    clutch,
    confidence: maps >= 60 ? 'high' : maps >= 20 ? 'medium' : 'low',
    source: 'hltv',
    window: snapshot.window,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    maps,
    rating: snapshot.raw.rating,
  }
}

export const hltvSnapshotForAlias = (alias: string) =>
  HLTV_CARD_SNAPSHOTS[alias.toLocaleLowerCase('en-US')] ?? null

export const cardStatsForAlias = (alias: string, role: RealPlayerRole | null) =>
  cardStatsFromHltv(hltvSnapshotForAlias(alias), role)
