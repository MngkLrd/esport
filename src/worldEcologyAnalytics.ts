import type { WorldPlayer, WorldState, WorldTeam } from './world'
import type { EcologyRegion, WorldEcologyState } from './worldEcology'

export interface RegionalEcologyMetrics {
  region: EcologyRegion
  teams: number
  rosteredPlayers: number
  freePlayers: number
  operators: number
  activeEvents: number
}

export interface WorldEcologySnapshot {
  at: string
  activeTeams: number
  activePlayers: number
  freePlayers: number
  generatedPlayers: number
  medianPlayerAge: number
  medianClubCash: number
  clubCashGini: number
  vrsTopFiveShare: number
  activeOperators: number
  medianOperatorCapital: number
  activeEvents: number
  completedEvents: number
  openOffers: number
  transfersLast365Days: number
  generatedLast365Days: number
  retiredLast365Days: number
  sponsorLiquidity: number
  audienceDemand: number
  regions: RegionalEcologyMetrics[]
}

export interface EcologyInvariantViolation {
  code:
    | 'TEAM_WITHOUT_FIVE'
    | 'DUPLICATE_ROSTER_OWNERSHIP'
    | 'ROSTER_TEAM_MISMATCH'
    | 'RETIRED_ON_ROSTER'
    | 'NEGATIVE_OPERATOR_POPULATION'
    | 'NO_FUTURE_EVENTS'
    | 'SPONSOR_LIQUIDITY_OUT_OF_RANGE'
    | 'TEAM_CAPACITY_EXPLOSION'
  detail: string
}

const REGIONS: readonly EcologyRegion[] = ['Europe', 'CIS', 'Americas', 'Asia']

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const gini = (values: number[]) => {
  const normalized = values.map((value) => Math.max(0, value))
  const total = normalized.reduce((sum, value) => sum + value, 0)
  if (!normalized.length || total <= 0) return 0
  const sorted = [...normalized].sort((a, b) => a - b)
  let weighted = 0
  sorted.forEach((value, index) => { weighted += (index + 1) * value })
  return Math.max(0, Math.min(1, (2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length))
}

const regionForPlayer = (player: WorldPlayer): EcologyRegion => {
  if (player.region) return player.region
  const country = (player.country ?? '').toLocaleLowerCase('en-US')
  if (['russia', 'ukraine', 'kazakhstan', 'belarus', 'armenia', 'azerbaijan', 'georgia'].some((value) => country.includes(value))) return 'CIS'
  if (['united states', 'canada', 'brazil', 'argentina', 'chile', 'peru', 'mexico'].some((value) => country.includes(value))) return 'Americas'
  if (['china', 'mongolia', 'japan', 'korea', 'india', 'indonesia', 'thailand', 'vietnam', 'singapore', 'australia'].some((value) => country.includes(value))) return 'Asia'
  return 'Europe'
}

const regionForTeam = (world: WorldState, team: WorldTeam): EcologyRegion => {
  if (team.region) return team.region
  const counts = new Map<EcologyRegion, number>()
  for (const key of team.rosterKeys) {
    const player = world.players[key]
    if (!player) continue
    const region = regionForPlayer(player)
    counts.set(region, (counts.get(region) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Europe'
}

const after = (at: string, days: number) => {
  const date = new Date(at.endsWith('Z') ? at : at + 'Z')
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 19)
}

export const snapshotWorldEcology = (world: WorldState, at: string): WorldEcologySnapshot => {
  const ecology = world.ecology
  const activeTeams = world.teams.filter((team) => team.active !== false && team.rosterKeys.length >= 5)
  const activePlayers = Object.values(world.players).filter((player) => !player.retiredAt)
  const freePlayers = activePlayers.filter((player) => !player.teamId)
  const operators = ecology ? Object.values(ecology.operators).filter((operator) => operator.active) : []
  const competitions = ecology ? Object.values(ecology.competitions) : []
  const activeEvents = competitions.filter((competition) => competition.status === 'announced' || competition.status === 'running')
  const completedEvents = competitions.filter((competition) => competition.status === 'complete')
  const yearAgo = after(at, 365)
  const history = ecology?.history ?? []
  const vrsTotal = activeTeams.reduce((sum, team) => sum + Math.max(0, team.vrsPoints), 0)
  const topFive = [...activeTeams]
    .sort((a, b) => b.vrsPoints - a.vrsPoints)
    .slice(0, 5)
    .reduce((sum, team) => sum + Math.max(0, team.vrsPoints), 0)

  const regions = REGIONS.map((region): RegionalEcologyMetrics => ({
    region,
    teams: activeTeams.filter((team) => regionForTeam(world, team) === region).length,
    rosteredPlayers: activePlayers.filter((player) => player.teamId && player.teamId !== 'club' && regionForPlayer(player) === region).length,
    freePlayers: freePlayers.filter((player) => regionForPlayer(player) === region).length,
    operators: operators.filter((operator) => operator.region === region).length,
    activeEvents: activeEvents.filter((event) => event.region === region).length,
  }))

  return {
    at,
    activeTeams: activeTeams.length,
    activePlayers: activePlayers.length,
    freePlayers: freePlayers.length,
    generatedPlayers: activePlayers.filter((player) => player.generated).length,
    medianPlayerAge: Math.round(median(activePlayers.map((player) => player.age ?? 24)) * 10) / 10,
    medianClubCash: Math.round(median(activeTeams.map((team) => team.cash ?? 0))),
    clubCashGini: Math.round(gini(activeTeams.map((team) => team.cash ?? 0)) * 1000) / 1000,
    vrsTopFiveShare: vrsTotal > 0 ? Math.round(topFive / vrsTotal * 1000) / 1000 : 0,
    activeOperators: operators.length,
    medianOperatorCapital: Math.round(median(operators.map((operator) => operator.capital))),
    activeEvents: activeEvents.length,
    completedEvents: completedEvents.length,
    openOffers: ecology?.offers.filter((offer) => offer.status === 'open').length ?? 0,
    transfersLast365Days: history.filter((event) => event.kind === 'transfer-completed' && event.at >= yearAgo).length,
    generatedLast365Days: history.filter((event) => event.kind === 'player-generated' && event.at >= yearAgo).length,
    retiredLast365Days: history.filter((event) => event.kind === 'player-retired' && event.at >= yearAgo).length,
    sponsorLiquidity: ecology?.metrics.sponsorLiquidity ?? 0,
    audienceDemand: ecology?.metrics.audienceDemand ?? 0,
    regions,
  }
}

export const validateWorldEcology = (world: WorldState): EcologyInvariantViolation[] => {
  const violations: EcologyInvariantViolation[] = []
  const ecology: WorldEcologyState | undefined = world.ecology
  const activeTeams = world.teams.filter((team) => team.active !== false)
  const owners = new Map<string, string>()

  for (const team of activeTeams) {
    if (team.rosterKeys.length < 5) {
      violations.push({ code: 'TEAM_WITHOUT_FIVE', detail: team.id + ' has ' + team.rosterKeys.length + ' rostered players' })
    }
    for (const key of team.rosterKeys) {
      const player = world.players[key]
      const previous = owners.get(key)
      if (previous && previous !== team.id) {
        violations.push({ code: 'DUPLICATE_ROSTER_OWNERSHIP', detail: key + ' belongs to ' + previous + ' and ' + team.id })
      }
      owners.set(key, team.id)
      if (!player || player.teamId !== team.id) {
        violations.push({ code: 'ROSTER_TEAM_MISMATCH', detail: key + ' roster/team ownership mismatch for ' + team.id })
      }
      if (player?.retiredAt) {
        violations.push({ code: 'RETIRED_ON_ROSTER', detail: key + ' is retired but rostered by ' + team.id })
      }
    }
  }

  if (ecology) {
    if (ecology.metrics.sponsorLiquidity < 0 || ecology.metrics.sponsorLiquidity > 100) {
      violations.push({ code: 'SPONSOR_LIQUIDITY_OUT_OF_RANGE', detail: String(ecology.metrics.sponsorLiquidity) })
    }
    const activeOperators = Object.values(ecology.operators).filter((operator) => operator.active)
    if (activeOperators.length < 1) {
      violations.push({ code: 'NEGATIVE_OPERATOR_POPULATION', detail: 'No active tournament operator remains' })
    }
    if (!ecology.scheduled.some((event) => event.at >= ecology.processedUntil)) {
      violations.push({ code: 'NO_FUTURE_EVENTS', detail: 'World event queue has no future work' })
    }
    const capacity = ecology.carryingCapacityTeams + 8
    if (activeTeams.length > capacity) {
      violations.push({ code: 'TEAM_CAPACITY_EXPLOSION', detail: activeTeams.length + ' active teams exceeds soft cap ' + capacity })
    }
  }

  return violations
}
