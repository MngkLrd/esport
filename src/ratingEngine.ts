export type RatingRole = 'IGL' | 'Entry' | 'Rifler' | 'AWP' | 'Support'
export type ProvenTier = 'UNPROVEN' | 'T3' | 'T2' | 'T1'
export type RatingEnvironment = 'LAN' | 'ONLINE'

export interface RatingSkillProfile {
  aim: number
  gameSense: number
  utility: number
  clutch: number
  leadership: number
}

export interface RatingEvidence {
  matchId: string
  at: string
  performance: number
  opponentRating: number
  tier: 0 | 1 | 2 | 3
  environment: RatingEnvironment
  rounds: number
  won: boolean
}

export interface PlayerRatingV2 {
  version: 2
  rating: number
  baseline: number
  adjustedPerformance: number
  opposition: number
  roleAdjustment: number
  stability: number
  confidence: number
  sampleSize: number
  provenTier: ProvenTier
  evidence: RatingEvidence[]
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const roleWeights: Record<RatingRole, RatingSkillProfile> = {
  Entry: { aim: .39, gameSense: .19, utility: .10, clutch: .20, leadership: .12 },
  AWP: { aim: .38, gameSense: .29, utility: .06, clutch: .20, leadership: .07 },
  Rifler: { aim: .32, gameSense: .25, utility: .15, clutch: .20, leadership: .08 },
  Support: { aim: .17, gameSense: .28, utility: .31, clutch: .10, leadership: .14 },
  IGL: { aim: .13, gameSense: .30, utility: .20, clutch: .10, leadership: .27 },
}

const rolePriorAdjustment: Record<RatingRole, number> = {
  Entry: -.4,
  AWP: -.2,
  Rifler: 0,
  Support: 1.1,
  IGL: 1.7,
}

const tierWeight = (tier: RatingEvidence['tier']) =>
  tier === 1 ? 1.38 : tier === 2 ? 1.16 : tier === 3 ? 1 : .28

const environmentWeight = (environment: RatingEnvironment) => environment === 'LAN' ? 1.08 : 1

export const ratingBaselineFromSkills = (skills: RatingSkillProfile, role: RatingRole) => {
  const weights = roleWeights[role] ?? roleWeights.Rifler
  return clamp(
    skills.aim * weights.aim +
    skills.gameSense * weights.gameSense +
    skills.utility * weights.utility +
    skills.clutch * weights.clutch +
    skills.leadership * weights.leadership +
    rolePriorAdjustment[role],
    40,
    99,
  )
}

const weightedObservation = (entry: RatingEvidence, role: RatingRole) => {
  const oppositionAdjustment = (entry.opponentRating - 70) * .18
  const tierAdjustment = entry.tier === 1 ? 2.2 : entry.tier === 2 ? 1.2 : entry.tier === 3 ? .2 : -2.4
  const environmentAdjustment = entry.environment === 'LAN' ? .8 : 0
  const resultAdjustment = entry.won ? .25 : -.15
  return clamp(
    entry.performance +
    oppositionAdjustment +
    tierAdjustment +
    environmentAdjustment +
    rolePriorAdjustment[role] * .35 +
    resultAdjustment,
    35,
    99,
  )
}

const evidenceWeight = (entry: RatingEvidence) => {
  const roundWeight = Math.max(.3, Math.min(2.5, entry.rounds / 24))
  return roundWeight * tierWeight(entry.tier) * environmentWeight(entry.environment)
}

const provenTierFor = (evidence: RatingEvidence[]): ProvenTier => {
  const samples = (tier: 1 | 2 | 3) => evidence
    .filter((entry) => entry.tier === tier)
    .reduce((sum, entry) => sum + entry.rounds, 0)

  if (samples(1) >= 90) return 'T1'
  if (samples(1) >= 35 || samples(2) >= 100) return 'T2'
  if (samples(3) >= 75 || samples(2) >= 35) return 'T3'
  return 'UNPROVEN'
}

const stabilityFor = (observations: Array<{ value: number; weight: number }>) => {
  if (observations.length < 2) return 58
  const weightSum = observations.reduce((sum, item) => sum + item.weight, 0)
  const mean = observations.reduce((sum, item) => sum + item.value * item.weight, 0) / Math.max(.001, weightSum)
  const variance = observations.reduce(
    (sum, item) => sum + Math.pow(item.value - mean, 2) * item.weight,
    0,
  ) / Math.max(.001, weightSum)
  const deviation = Math.sqrt(variance)
  return Math.round(clamp(100 - deviation * 5.2, 20, 98))
}

export const buildPlayerRatingV2 = (
  skills: RatingSkillProfile,
  role: RatingRole,
  evidence: RatingEvidence[] = [],
): PlayerRatingV2 => {
  const baseline = ratingBaselineFromSkills(skills, role)
  const recent = evidence.slice(-24)
  const observations = recent.map((entry) => ({
    value: weightedObservation(entry, role),
    weight: evidenceWeight(entry),
    entry,
  }))
  const totalWeight = observations.reduce((sum, item) => sum + item.weight, 0)
  const adjustedPerformance = observations.length
    ? observations.reduce((sum, item) => sum + item.value * item.weight, 0) / Math.max(.001, totalWeight)
    : baseline
  const sampleSize = recent.reduce((sum, entry) => sum + Math.max(0, entry.rounds), 0)
  const weightedSample = recent.reduce((sum, entry) => sum + entry.rounds * tierWeight(entry.tier) * environmentWeight(entry.environment), 0)
  const confidence = Math.round(clamp(16 + 84 * (1 - Math.exp(-weightedSample / 180)), 16, 99))
  const evidenceShare = Math.min(.78, confidence / 100 * .72)
  const rating = Math.round(clamp(baseline * (1 - evidenceShare) + adjustedPerformance * evidenceShare, 40, 99))
  const opposition = recent.length
    ? Math.round(recent.reduce((sum, entry) => sum + entry.opponentRating, 0) / recent.length)
    : 0

  return {
    version: 2,
    rating,
    baseline: Math.round(baseline),
    adjustedPerformance: Math.round(adjustedPerformance * 10) / 10,
    opposition,
    roleAdjustment: rolePriorAdjustment[role],
    stability: stabilityFor(observations),
    confidence,
    sampleSize,
    provenTier: provenTierFor(recent),
    evidence: recent,
  }
}

export const appendRatingEvidence = (
  current: PlayerRatingV2 | null | undefined,
  skills: RatingSkillProfile,
  role: RatingRole,
  evidence: RatingEvidence,
) => {
  const nextEvidence = [...(current?.evidence ?? []), evidence].slice(-24)
  return buildPlayerRatingV2(skills, role, nextEvidence)
}
