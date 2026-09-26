import { HLTV_CARD_SNAPSHOTS } from './hltvCardStats.generated'
import type { RealPlayerRole } from './players'

export interface HltvSkillScores {
  firepower: number | null
  entrying: number | null
  trading: number | null
  opening: number | null
  clutching: number | null
  sniping: number | null
  utility: number | null
}

export interface HltvPlayerSnapshot {
  alias: string
  playerId: number | null
  profileUrl: string | null
  status: 'ok' | 'no-data' | 'unmatched' | 'error'
  window: 'past3m' | 'year'
  periodStart: string
  periodEnd: string
  maps: number | null
  rating: number | null
  ratingVersion: string | null
  kpr: number | null
  dpr: number | null
  adr: number | null
  kast: number | null
  multiKillPct: number | null
  skills: HltvSkillScores
  error?: string | null
}

export interface PlayerCardStats {
  ovr: number
  aim: number
  utility: number
  positioning: number
  clutch: number
  confidence: 'low' | 'medium' | 'high'
  source: 'hltv'
  window: HltvPlayerSnapshot['window']
  periodStart: string
  periodEnd: string
}

const clamp = (value: number, min = 1, max = 99) => Math.max(min, Math.min(max, Math.round(value)))
const score = (value: number | null | undefined, fallback = 50) => value == null ? fallback : clamp(value)

const positioningWeights: Record<RealPlayerRole | 'Unknown', [number, number, number]> = {
  IGL: [0.52, 0.28, 0.20],
  Support: [0.50, 0.25, 0.25],
  Entry: [0.22, 0.38, 0.40],
  AWP: [0.34, 0.50, 0.16],
  Rifler: [0.40, 0.35, 0.25],
  Unknown: [0.40, 0.35, 0.25],
}

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
  if (!snapshot || snapshot.status !== 'ok') return null

  const key = role ?? 'Unknown'
  const aim = score(snapshot.skills.firepower)
  const utility = score(snapshot.skills.utility)
  const clutch = score(snapshot.skills.clutching)
  const [tradeWeight, openingWeight, entryWeight] = positioningWeights[key]
  const positioning = clamp(
    score(snapshot.skills.trading) * tradeWeight +
    score(snapshot.skills.opening) * openingWeight +
    score(snapshot.skills.entrying) * entryWeight,
  )

  const [aimWeight, utilityWeight, posWeight, clutchWeight] = overallWeights[key]
  const ovr = clamp(
    aim * aimWeight +
    utility * utilityWeight +
    positioning * posWeight +
    clutch * clutchWeight,
  )

  const maps = snapshot.maps
  const populatedSkills = Object.values(snapshot.skills).filter((value) => value != null).length
  return {
    ovr,
    aim,
    utility,
    positioning,
    clutch,
    confidence: maps != null
      ? (maps >= 60 ? 'high' : maps >= 20 ? 'medium' : 'low')
      : (populatedSkills >= 6 ? 'medium' : 'low'),
    source: 'hltv',
    window: snapshot.window,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
  }
}

export const hltvSnapshotForAlias = (alias: string) =>
  HLTV_CARD_SNAPSHOTS[alias.toLocaleLowerCase('en-US')] ?? null

export const cardStatsForAlias = (alias: string, role: RealPlayerRole | null) =>
  cardStatsFromHltv(hltvSnapshotForAlias(alias), role)
