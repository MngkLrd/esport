import type { RealPlayerRole } from './players'
import type { WorldPlayer, WorldState, WorldTeam } from './world'

export type EcologyRegion = 'Europe' | 'CIS' | 'Americas' | 'Asia'
export type EcologyEventType =
  | 'market-clear'
  | 'population-review'
  | 'club-plan'
  | 'operator-plan'
  | 'competition-start'
  | 'competition-finish'

export type WorldHistoryKind =
  | 'player-generated'
  | 'player-retired'
  | 'team-founded'
  | 'team-dissolved'
  | 'operator-founded'
  | 'operator-dissolved'
  | 'tournament-created'
  | 'tournament-completed'
  | 'transfer-offer'
  | 'transfer-completed'
  | 'contract-expired'
  | 'economic-shock'

export interface WorldScheduledEvent {
  id: string
  type: EcologyEventType
  at: string
  sequence: number
  actorId?: string
  subjectId?: string
}

export interface WorldHistoryEvent {
  id: string
  at: string
  kind: WorldHistoryKind
  importance: number
  actorIds: string[]
  title: string
  detail: string
  causes: string[]
  data?: Record<string, string | number | boolean | null>
}

export interface TournamentOperatorAgent {
  id: string
  name: string
  region: EcologyRegion
  capital: number
  reputation: number
  audience: number
  risk: number
  quality: number
  active: boolean
  foundedYear: number
  eventIds: string[]
  consecutiveLosses: number
}

export interface AutonomousMatch {
  id: string
  round: 'quarterfinal' | 'semifinal' | 'final'
  teamAId: string
  teamBId: string
  winnerTeamId: string
  loserTeamId: string
  scoreA: number
  scoreB: number
  fidelity: 0 | 1
}

export interface AutonomousCompetition {
  id: string
  operatorId: string
  name: string
  region: EcologyRegion
  tier: 1 | 2 | 3
  format: 'LAN' | 'ONLINE'
  createdAt: string
  startsAt: string
  endsAt: string
  status: 'announced' | 'running' | 'complete' | 'cancelled'
  prizePool: number
  prestige: number
  audience: number
  participantTeamIds: string[]
  rosterSnapshots: Record<string, string[]>
  matches: AutonomousMatch[]
  winnerTeamId: string | null
  revenue: number
  cost: number
}

export interface TransferMarketOffer {
  id: string
  createdAt: string
  expiresAt: string
  playerKey: string
  buyerTeamId: string
  sellerTeamId: string | null
  fee: number
  salary: number
  buyerUtility: number
  playerUtility: number
  sellerUtility: number
  status: 'open' | 'accepted' | 'rejected' | 'expired'
}

export interface WorldEcologyMetrics {
  sponsorLiquidity: number
  audienceDemand: number
  eventSupply: number
  rosterDemand: number
  playerSupply: number
  activeTeams: number
  activeOperators: number
  completedCompetitions: number
  generatedPlayers: number
  retiredPlayers: number
  foundedTeams: number
  dissolvedTeams: number
}

export interface WorldEcologyState {
  version: 1
  initializedAt: string
  processedUntil: string
  nextSequence: number
  lastAgingYear: number
  carryingCapacityTeams: number
  scheduled: WorldScheduledEvent[]
  operators: Record<string, TournamentOperatorAgent>
  competitions: Record<string, AutonomousCompetition>
  offers: TransferMarketOffer[]
  history: WorldHistoryEvent[]
  retiredPlayerKeys: string[]
  metrics: WorldEcologyMetrics
}

type MutableWorld = WorldState & { ecology?: WorldEcologyState }

const REGIONS: readonly EcologyRegion[] = ['Europe', 'CIS', 'Americas', 'Asia']
const ROLES: readonly RealPlayerRole[] = ['IGL', 'Entry', 'Rifler', 'AWP', 'Support']
const OPERATOR_WORDS = ['Arena', 'Circuit', 'Forge', 'Masters', 'Summit', 'Nexus', 'Crown', 'Frontier']
const TEAM_WORDS = ['Nova', 'Vertex', 'Kinetic', 'Aurora', 'Rift', 'Pulse', 'Helix', 'Orbit', 'Apex', 'Mosaic']
const PLAYER_PREFIX = ['ka', 'ze', 'ro', 'mi', 'ta', 'no', 've', 'lu', 'sa', 'ky', 'dra', 'fi']
const PLAYER_SUFFIX = ['n', 'x', 'ro', 'ko', 'zz', 'r', 'ki', 'to', 'v', 's', 'q', 'y']

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const hashSeed = (input: string) => {
  let h = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    h ^= input.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const mulberry32 = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rngFor = (seed: number, label: string) => mulberry32(hashSeed(seed + ':' + label))

const asDate = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z')
const iso = (date: Date) => date.toISOString().slice(0, 19)
const addDays = (value: string, days: number, hour?: number) => {
  const date = asDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  if (hour != null) date.setUTCHours(hour, 0, 0, 0)
  return iso(date)
}
const yearFor = (value: string) => asDate(value).getUTCFullYear()
const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((asDate(to).getTime() - asDate(from).getTime()) / 86400000))

const regionForCountry = (country: string | null): EcologyRegion => {
  const value = (country ?? '').toLocaleLowerCase('en-US')
  if (['russia', 'ukraine', 'kazakhstan', 'belarus', 'armenia', 'azerbaijan', 'georgia'].some((name) => value.includes(name))) return 'CIS'
  if (['united states', 'canada', 'brazil', 'argentina', 'chile', 'peru', 'mexico'].some((name) => value.includes(name))) return 'Americas'
  if (['china', 'mongolia', 'japan', 'korea', 'india', 'indonesia', 'thailand', 'vietnam', 'singapore', 'australia'].some((name) => value.includes(name))) return 'Asia'
  return 'Europe'
}

const teamRegion = (world: WorldState, team: WorldTeam): EcologyRegion => {
  const countries = team.rosterKeys
    .map((key) => world.players[key]?.country ?? null)
    .filter((country): country is string => Boolean(country))
  if (!countries.length) return 'Europe'
  const counts = new Map<EcologyRegion, number>()
  for (const country of countries) {
    const region = regionForCountry(country)
    counts.set(region, (counts.get(region) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Europe'
}

const effectiveRating = (player: WorldPlayer) =>
  player.currentRating + (player.form - 50) * .05 + (player.morale - 50) * .025 - player.fatigue * .035

const teamStrength = (world: WorldState, team: WorldTeam) => {
  const lineup = team.rosterKeys
    .map((key) => world.players[key])
    .filter((player): player is WorldPlayer => Boolean(player) && !player.retiredAt)
    .sort((a, b) => effectiveRating(b) - effectiveRating(a))
    .slice(0, 5)
  if (!lineup.length) return 45
  return clamp(lineup.reduce((sum, player) => sum + effectiveRating(player), 0) / lineup.length, 45, 99)
}

const eventSort = (a: WorldScheduledEvent, b: WorldScheduledEvent) =>
  a.at.localeCompare(b.at) || a.sequence - b.sequence || a.id.localeCompare(b.id)

const pushHistory = (
  ecology: WorldEcologyState,
  event: Omit<WorldHistoryEvent, 'id'>,
) => {
  const id = 'history-' + ecology.nextSequence + '-' + hashSeed(event.kind + ':' + event.at + ':' + event.title).toString(36)
  ecology.nextSequence += 1
  ecology.history.unshift({ id, ...event })
  ecology.history = ecology.history.slice(0, 3000)
  return id
}

const schedule = (
  ecology: WorldEcologyState,
  type: EcologyEventType,
  at: string,
  actorId?: string,
  subjectId?: string,
) => {
  const sequence = ecology.nextSequence
  ecology.nextSequence += 1
  ecology.scheduled.push({
    id: 'scheduled-' + sequence + '-' + type,
    type,
    at,
    sequence,
    actorId,
    subjectId,
  })
}

const defaultMetrics = (): WorldEcologyMetrics => ({
  sponsorLiquidity: 62,
  audienceDemand: 58,
  eventSupply: 0,
  rosterDemand: 0,
  playerSupply: 0,
  activeTeams: 0,
  activeOperators: 0,
  completedCompetitions: 0,
  generatedPlayers: 0,
  retiredPlayers: 0,
  foundedTeams: 0,
  dissolvedTeams: 0,
})

const operatorName = (region: EcologyRegion, serial: number) => {
  const prefix = region === 'Europe' ? 'Euro' : region === 'CIS' ? 'Eastern' : region === 'Americas' ? 'Atlantic' : 'Pacific'
  return prefix + ' ' + OPERATOR_WORDS[serial % OPERATOR_WORDS.length]
}

const createSeedOperator = (
  ecology: WorldEcologyState,
  region: EcologyRegion,
  index: number,
  seed: number,
  at: string,
) => {
  const rng = rngFor(seed, 'seed-operator:' + region + ':' + index)
  const id = 'operator-' + region.toLocaleLowerCase('en-US') + '-' + index
  ecology.operators[id] = {
    id,
    name: operatorName(region, index),
    region,
    capital: Math.round(18000 + rng() * 24000),
    reputation: Math.round(42 + rng() * 28),
    audience: Math.round(40 + rng() * 35),
    risk: Math.round(30 + rng() * 55),
    quality: Math.round(45 + rng() * 35),
    active: true,
    foundedYear: yearFor(at) - Math.floor(rng() * 8),
    eventIds: [],
    consecutiveLosses: 0,
  }
  schedule(ecology, 'operator-plan', addDays(at, 2 + Math.floor(rng() * 8), 10), id)
}

export const createWorldEcology = (world: WorldState, seed: number, at: string): WorldEcologyState => {
  const ecology: WorldEcologyState = {
    version: 1,
    initializedAt: at,
    processedUntil: at,
    nextSequence: 1,
    lastAgingYear: yearFor(at),
    carryingCapacityTeams: Math.max(24, world.teams.length),
    scheduled: [],
    operators: {},
    competitions: {},
    offers: [],
    history: [],
    retiredPlayerKeys: [],
    metrics: defaultMetrics(),
  }

  REGIONS.forEach((region, index) => createSeedOperator(ecology, region, index, seed, at))
  world.teams.forEach((team, index) => {
    const rng = rngFor(seed, 'club-plan:' + team.id)
    schedule(ecology, 'club-plan', addDays(at, 1 + Math.floor(rng() * 12), 9 + (index % 8)), team.id)
  })
  schedule(ecology, 'market-clear', addDays(at, 2, 18))
  schedule(ecology, 'population-review', addDays(at, 14, 7))
  return ecology
}

export const ensureWorldEcology = (source: WorldState, seed: number, at: string): WorldState => {
  const world = source as MutableWorld
  if (world.ecology?.version === 1) return source
  return { ...source, ecology: createWorldEcology(source, seed, at) } as WorldState
}

const activeTeams = (world: WorldState) => world.teams.filter((team) => team.active !== false && team.rosterKeys.length >= 5)
const activeOperators = (ecology: WorldEcologyState) => Object.values(ecology.operators).filter((operator) => operator.active)
const activeCompetitions = (ecology: WorldEcologyState) =>
  Object.values(ecology.competitions).filter((competition) => competition.status === 'announced' || competition.status === 'running')

const recalcMetrics = (world: WorldState, ecology: WorldEcologyState) => {
  const teams = activeTeams(world)
  const operators = activeOperators(ecology)
  const free = Object.values(world.players).filter((player) => !player.teamId && !player.retiredAt)
  const openSlots = world.teams.reduce((sum, team) => sum + Math.max(0, 6 - team.rosterKeys.length), 0)
  const activeEvents = activeCompetitions(ecology)
  ecology.metrics.activeTeams = teams.length
  ecology.metrics.activeOperators = operators.length
  ecology.metrics.playerSupply = free.length
  ecology.metrics.rosterDemand = openSlots
  ecology.metrics.eventSupply = activeEvents.length
  const reputationMass = teams.reduce((sum, team) => sum + (team.prestige ?? clamp(105 - team.vrsRank, 5, 95)), 0)
  ecology.metrics.audienceDemand = clamp(35 + Math.sqrt(Math.max(1, reputationMass)) * 2.2)
  ecology.metrics.sponsorLiquidity = clamp(
    ecology.metrics.sponsorLiquidity * .94 +
    ecology.metrics.audienceDemand * .06 +
    (operators.length < 3 ? 2 : 0),
    25,
    95,
  )
}

const roleNeedScore = (world: WorldState, team: WorldTeam, role: RealPlayerRole) => {
  const roster = team.rosterKeys.map((key) => world.players[key]).filter((player): player is WorldPlayer => Boolean(player))
  const sameRole = roster.filter((player) => player.role === role)
  if (!sameRole.length) return 24
  const best = Math.max(...sameRole.map((player) => effectiveRating(player)))
  const average = roster.length ? roster.reduce((sum, player) => sum + effectiveRating(player), 0) / roster.length : 55
  return clamp((average - best) * 1.4 + (sameRole.length === 1 ? 7 : 0), 0, 24)
}

const playerMarketValue = (player: WorldPlayer) => {
  if (typeof player.marketValue === 'number') return player.marketValue
  const age = player.age ?? 24
  const ageFactor = age <= 22 ? 1.25 : age <= 26 ? 1.08 : age <= 29 ? .86 : .62
  return Math.max(80, Math.round(Math.pow(Math.max(45, player.currentRating) - 38, 2) * ageFactor * 4.5))
}

const clubBudget = (team: WorldTeam) =>
  typeof team.cash === 'number' ? team.cash : Math.max(3500, Math.round(18000 - Math.min(150, team.vrsRank) * 70))

const clubPrestige = (team: WorldTeam) =>
  typeof team.prestige === 'number' ? team.prestige : clamp(104 - team.vrsRank * .72, 12, 94)

const clubPersonality = (team: WorldTeam, seed: number) => {
  const rng = rngFor(seed, 'club-personality:' + team.id)
  return {
    risk: 25 + rng() * 65,
    stability: 30 + rng() * 65,
    youthBias: 20 + rng() * 75,
    travelTolerance: 25 + rng() * 70,
    marketPatience: 20 + rng() * 75,
  }
}

const recentClubPressure = (ecology: WorldEcologyState, teamId: string, at: string) => {
  const cutoff = addDays(at, -90)
  let losses = 0
  let wins = 0
  for (const competition of Object.values(ecology.competitions)) {
    if (competition.status !== 'complete' || competition.endsAt < cutoff || !competition.participantTeamIds.includes(teamId)) continue
    for (const match of competition.matches) {
      if (match.winnerTeamId === teamId) wins += 1
      if (match.loserTeamId === teamId) losses += 1
    }
  }
  return clamp(losses * 5 - wins * 2, 0, 28)
}

const playerMoveUtility = (world: WorldState, player: WorldPlayer, buyer: WorldTeam, salary: number) => {
  const current = player.teamId ? world.teams.find((team) => team.id === player.teamId) : null
  const prestigeGain = clubPrestige(buyer) - (current ? clubPrestige(current) : 20)
  const salaryBase = player.salary ?? Math.max(70, Math.round(player.currentRating * 1.8))
  const salaryGain = (salary - salaryBase) / Math.max(1, salaryBase) * 22
  const roleNeed = player.role ? roleNeedScore(world, buyer, player.role) : 5
  const age = player.age ?? 24
  const ambition = age <= 25 ? prestigeGain * .5 : prestigeGain * .3
  return salaryGain + ambition + roleNeed * .55 + (player.teamId ? 0 : 12)
}

const sellerUtility = (world: WorldState, player: WorldPlayer, seller: WorldTeam | null, fee: number) => {
  if (!seller) return 30
  const value = playerMarketValue(player)
  const depth = seller.rosterKeys.length
  const importance = effectiveRating(player) - teamStrength(world, seller)
  return (fee - value) / Math.max(100, value) * 35 + (depth > 5 ? 12 : -8) - importance * 1.4
}

const createTransferOffer = (
  world: WorldState,
  ecology: WorldEcologyState,
  buyer: WorldTeam,
  player: WorldPlayer,
  at: string,
  seed: number,
) => {
  if (ecology.offers.some((offer) => offer.status === 'open' && offer.playerKey === player.key && offer.buyerTeamId === buyer.id)) return
  const rng = rngFor(seed, 'offer:' + buyer.id + ':' + player.key + ':' + at)
  const seller = player.teamId ? world.teams.find((team) => team.id === player.teamId) ?? null : null
  const value = playerMarketValue(player)
  const fee = seller ? Math.round(value * (.82 + rng() * .48)) : 0
  const salary = Math.round((player.salary ?? Math.max(70, player.currentRating * 1.8)) * (1.03 + rng() * .35))
  const roleNeed = player.role ? roleNeedScore(world, buyer, player.role) : 4
  const qualityGain = effectiveRating(player) - Math.min(...buyer.rosterKeys.map((key) => effectiveRating(world.players[key])).filter(Number.isFinite))
  const buyerUtility = roleNeed * 1.8 + qualityGain * 2.2 - fee / Math.max(1200, clubBudget(buyer)) * 35
  const playerUtility = playerMoveUtility(world, player, buyer, salary)
  const sellUtility = sellerUtility(world, player, seller, fee)
  const id = 'offer-' + hashSeed(buyer.id + ':' + player.key + ':' + at).toString(36)
  ecology.offers.push({
    id,
    createdAt: at,
    expiresAt: addDays(at, 5 + Math.floor(rng() * 5), 20),
    playerKey: player.key,
    buyerTeamId: buyer.id,
    sellerTeamId: seller?.id ?? null,
    fee,
    salary,
    buyerUtility,
    playerUtility,
    sellerUtility: sellUtility,
    status: 'open',
  })
  pushHistory(ecology, {
    at,
    kind: 'transfer-offer',
    importance: 18,
    actorIds: [buyer.id, player.key, ...(seller ? [seller.id] : [])],
    title: buyer.name + ' opens talks for ' + player.alias,
    detail: 'Offer created from roster need, affordability and player career utility.',
    causes: ['club-plan:' + buyer.id],
    data: { fee, salary, buyerUtility: Math.round(buyerUtility), playerUtility: Math.round(playerUtility) },
  })
}

const planClub = (world: WorldState, ecology: WorldEcologyState, teamId: string, at: string, seed: number) => {
  const team = world.teams.find((candidate) => candidate.id === teamId)
  if (!team || team.active === false) return
  const rng = rngFor(seed, 'club:' + team.id + ':' + at)
  const personality = clubPersonality(team, seed)
  const performancePressure = recentClubPressure(ecology, team.id, at)
  const roster = team.rosterKeys.map((key) => world.players[key]).filter((player): player is WorldPlayer => Boolean(player) && !player.retiredAt)

  for (const player of roster) {
    if (player.teamId === 'club') continue
    player.contractWeeks = Math.max(0, player.contractWeeks - (rng() < .35 ? 1 : 0))
    if (player.contractWeeks === 0) {
      const renewalUtility = effectiveRating(player) - teamStrength(world, team) + clubPrestige(team) * .08 + (player.morale - 50) * .04
      if (renewalUtility > -2 && clubBudget(team) > 1200) {
        player.contractWeeks = 18 + Math.floor(rng() * 35)
        player.salary = Math.round((player.salary ?? player.currentRating * 1.7) * (1.02 + rng() * .18))
      } else {
        player.teamId = null
        team.rosterKeys = team.rosterKeys.filter((key) => key !== player.key)
        pushHistory(ecology, {
          at,
          kind: 'contract-expired',
          importance: 28,
          actorIds: [team.id, player.key],
          title: player.alias + ' leaves ' + team.name,
          detail: 'Contract expired after the club and player failed to find enough mutual utility to renew.',
          causes: ['contract-expiry:' + player.key],
        })
      }
    }
  }

  const roles = [...ROLES].sort((a, b) => roleNeedScore(world, team, b) - roleNeedScore(world, team, a))
  const need = roles[0]
  const needScore = roleNeedScore(world, team, need)
  const weakest = roster.length
    ? [...roster].sort((a, b) => effectiveRating(a) - effectiveRating(b))[0]
    : null
  const targetFloor = weakest ? effectiveRating(weakest) + Math.max(1, needScore * .12) : 55

  if (roster.length < 6 || needScore >= 9) {
    const candidates = Object.values(world.players)
      .filter((player) =>
        !player.retiredAt &&
        player.teamId !== 'club' &&
        player.teamId !== team.id &&
        (player.role === need || needScore < 13) &&
        effectiveRating(player) >= targetFloor - 3,
      )
      .map((player) => {
        const seller = player.teamId ? world.teams.find((candidate) => candidate.id === player.teamId) : null
        const accessibility = player.teamId ? (seller && seller.rosterKeys.length > 5 ? 8 : -5) : 18
        const age = player.age ?? 24
        const ageBonus = age <= 23 ? personality.youthBias * .08 : age >= 29 ? -personality.youthBias * .035 : 0
        const regionFit = regionForCountry(player.country) === (team.region ?? teamRegion(world, team)) ? 4 : -2
        const stabilityCost = player.teamId ? personality.stability * .035 : 0
        const fit = (player.role === need ? 14 : 2) + effectiveRating(player) + accessibility + ageBonus + regionFit - stabilityCost
        const noise = (hashSeed(team.id + ':' + player.key + ':' + at) % 1000) / 1000 * 5
        return { player, score: fit + noise }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    if (candidates.length) {
      const candidate = candidates[Math.floor(rng() * Math.min(3, candidates.length))].player
      if (playerMarketValue(candidate) <= clubBudget(team) * .55 || !candidate.teamId) {
        createTransferOffer(world, ecology, team, candidate, at, seed)
      }
    }
  }

  const weeklyBurn = roster.reduce((sum, player) => sum + (player.salary ?? player.currentRating * 1.6), 0)
  const sponsorIncome = (team.fanbase ?? 5000) * .006 + clubPrestige(team) * 8 + ecology.metrics.sponsorLiquidity * 3
  team.cash = Math.round(clubBudget(team) + sponsorIncome - weeklyBurn)
  team.prestige = clamp(clubPrestige(team) * .985 + clamp(105 - team.vrsRank, 5, 95) * .015)
  team.ambition = clamp((team.ambition ?? clubPrestige(team)) * .97 + team.prestige * .03)

  if (team.cash < -2500 && team.prestige < 24) {
    const survival = team.prestige * .8 + (team.fanbase ?? 1000) / 500 + rng() * 18
    if (survival < 35) dissolveTeam(world, ecology, team, at)
  }

  const turbulence =
    needScore +
    performancePressure +
    Math.max(0, 6 - roster.length) * 4 +
    (team.cash < 0 ? 8 : 0) -
    personality.stability * .08
  const nextDays = Math.max(3, Math.round(16 - Math.min(11, turbulence * .35) + personality.marketPatience * .035 + rng() * 7))
  schedule(ecology, 'club-plan', addDays(at, nextDays, 9 + Math.floor(rng() * 9)), team.id)
}

const executeTransfer = (
  world: WorldState,
  ecology: WorldEcologyState,
  offer: TransferMarketOffer,
  at: string,
) => {
  const player = world.players[offer.playerKey]
  const buyer = world.teams.find((team) => team.id === offer.buyerTeamId)
  const seller = offer.sellerTeamId ? world.teams.find((team) => team.id === offer.sellerTeamId) ?? null : null
  if (!player || !buyer || buyer.active === false || player.retiredAt) {
    offer.status = 'expired'
    return
  }
  if (player.teamId !== (seller?.id ?? null)) {
    offer.status = 'expired'
    return
  }

  const competing = ecology.offers
    .filter((candidate) => candidate.status === 'open' && candidate.playerKey === player.key)
    .sort((a, b) => (b.playerUtility + b.buyerUtility * .25) - (a.playerUtility + a.buyerUtility * .25))
  const winner = competing[0]
  if (!winner || winner.id !== offer.id) return

  const mutual = Math.min(offer.buyerUtility, offer.playerUtility, seller ? offer.sellerUtility : 99)
  if (mutual < -4 || clubBudget(buyer) < offer.fee + offer.salary * 4) {
    offer.status = 'rejected'
    return
  }

  if (seller) {
    seller.rosterKeys = seller.rosterKeys.filter((key) => key !== player.key)
    seller.cash = clubBudget(seller) + offer.fee
  }
  if (!buyer.rosterKeys.includes(player.key)) buyer.rosterKeys.push(player.key)
  buyer.cash = clubBudget(buyer) - offer.fee
  player.teamId = buyer.id
  player.salary = offer.salary
  player.contractWeeks = 24 + (hashSeed(offer.id) % 54)
  player.morale = clamp(player.morale + 5)
  world.transferHistory = [{
    id: 'eco-transfer-' + offer.id,
    date: at,
    playerKey: player.key,
    alias: player.alias,
    fromTeamId: seller?.id ?? null,
    toTeamId: buyer.id,
    kind: 'ai-transfer' as const,
  }, ...world.transferHistory].slice(0, 240)
  offer.status = 'accepted'
  for (const rival of competing.slice(1)) rival.status = 'rejected'

  pushHistory(ecology, {
    at,
    kind: 'transfer-completed',
    importance: clamp(35 + player.currentRating * .45, 35, 88),
    actorIds: [buyer.id, player.key, ...(seller ? [seller.id] : [])],
    title: player.alias + ' joins ' + buyer.name,
    detail: (seller ? seller.name + ' accepted ' + offer.fee + '. ' : 'Free-agent signing. ') +
      'The move cleared buyer, player and seller utility thresholds against competing offers.',
    causes: [offer.id],
    data: { fee: offer.fee, salary: offer.salary, rating: player.currentRating },
  })
}

const clearMarket = (world: WorldState, ecology: WorldEcologyState, at: string, seed: number) => {
  const open = ecology.offers.filter((offer) => offer.status === 'open')
  const byPlayer = new Map<string, TransferMarketOffer[]>()
  for (const offer of open) {
    if (offer.expiresAt < at) {
      offer.status = 'expired'
      continue
    }
    const list = byPlayer.get(offer.playerKey) ?? []
    list.push(offer)
    byPlayer.set(offer.playerKey, list)
  }

  for (const offers of byPlayer.values()) {
    offers.sort((a, b) => (b.playerUtility + b.buyerUtility * .25) - (a.playerUtility + a.buyerUtility * .25))
    executeTransfer(world, ecology, offers[0], at)
  }

  ecology.offers = ecology.offers.filter((offer) => offer.status === 'open' || daysBetween(offer.createdAt, at) <= 30).slice(-500)
  schedule(ecology, 'market-clear', addDays(at, 3 + (hashSeed(seed + ':' + at) % 3), 18))
}

const generatedAlias = (seed: number, serial: number) => {
  const rng = rngFor(seed, 'alias:' + serial)
  return PLAYER_PREFIX[Math.floor(rng() * PLAYER_PREFIX.length)] +
    PLAYER_SUFFIX[Math.floor(rng() * PLAYER_SUFFIX.length)] +
    (rng() < .28 ? String(1 + Math.floor(rng() * 9)) : '')
}

const createGeneratedPlayer = (
  world: WorldState,
  ecology: WorldEcologyState,
  region: EcologyRegion,
  at: string,
  seed: number,
  serial: number,
) => {
  const rng = rngFor(seed, 'newgen:' + region + ':' + serial + ':' + at)
  let alias = generatedAlias(seed ^ hashSeed(region), serial)
  let key = 'gen:' + yearFor(at) + ':' + region.toLocaleLowerCase('en-US') + ':' + serial
  while (world.players[key]) {
    key += 'x'
    alias += 'x'
  }
  const role = ROLES[Math.floor(rng() * ROLES.length)]
  const age = 16 + Math.floor(rng() * 6)
  const baseRating = Math.round(46 + rng() * 20 + ecology.metrics.audienceDemand * .05)
  const potential = clamp(Math.round(baseRating + 8 + rng() * 25 + (ecology.metrics.sponsorLiquidity - 50) * .05), baseRating + 2, 96)
  const countries: Record<EcologyRegion, string[]> = {
    Europe: ['Denmark', 'Sweden', 'Finland', 'Germany', 'France', 'Poland', 'Estonia', 'United Kingdom'],
    CIS: ['Ukraine', 'Russia', 'Kazakhstan', 'Georgia', 'Armenia'],
    Americas: ['Brazil', 'United States', 'Canada', 'Argentina', 'Chile'],
    Asia: ['China', 'Mongolia', 'Japan', 'South Korea', 'Australia'],
  }
  const country = countries[region][Math.floor(rng() * countries[region].length)]
  const player: WorldPlayer = {
    key,
    alias,
    realName: null,
    country,
    age,
    role,
    profileId: null,
    teamId: null,
    baseRating,
    currentRating: baseRating,
    form: Math.round(48 + rng() * 24),
    morale: Math.round(52 + rng() * 30),
    fatigue: Math.round(rng() * 8),
    contractWeeks: 1,
    generated: true,
    potentialRating: potential,
    salary: Math.round(55 + baseRating * .85),
    marketValue: Math.round(Math.pow(baseRating - 38, 2) * 3.2),
    careerStartedAt: at,
    retiredAt: null,
    region,
  }
  world.players[key] = player
  ecology.metrics.generatedPlayers += 1
  pushHistory(ecology, {
    at,
    kind: 'player-generated',
    importance: potential >= 85 ? 42 : 12,
    actorIds: [key],
    title: alias + ' enters the professional talent pool',
    detail: region + ' ecosystem produced a ' + age + '-year-old ' + role + ' because roster demand exceeded available suitable talent.',
    causes: ['talent-demand:' + region],
    data: { age, rating: baseRating, potential, region },
  })
}

const retirePlayer = (world: WorldState, ecology: WorldEcologyState, player: WorldPlayer, at: string) => {
  const team = player.teamId ? world.teams.find((candidate) => candidate.id === player.teamId) : null
  if (team) team.rosterKeys = team.rosterKeys.filter((key) => key !== player.key)
  player.teamId = null
  player.retiredAt = at
  ecology.retiredPlayerKeys.push(player.key)
  ecology.metrics.retiredPlayers += 1
  pushHistory(ecology, {
    at,
    kind: 'player-retired',
    importance: clamp(20 + player.currentRating * .35, 20, 70),
    actorIds: [player.key, ...(team ? [team.id] : [])],
    title: player.alias + ' retires from competition',
    detail: 'Career exit emerged from age, current level, contract status and market demand.',
    causes: ['career-hazard:' + player.key],
    data: { age: player.age, rating: player.currentRating },
  })
}

const foundTeam = (world: WorldState, ecology: WorldEcologyState, region: EcologyRegion, at: string, seed: number) => {
  const rng = rngFor(seed, 'found-team:' + region + ':' + at + ':' + ecology.metrics.foundedTeams)
  const free = Object.values(world.players)
    .filter((player) => !player.teamId && !player.retiredAt && regionForCountry(player.country) === region)
    .sort((a, b) => effectiveRating(b) - effectiveRating(a))
  if (free.length < 5) return

  const selected = free.slice(0, 10).sort((a, b) => {
    const aNoise = hashSeed(a.key + ':' + at) % 500
    const bNoise = hashSeed(b.key + ':' + at) % 500
    return (effectiveRating(b) * 100 + bNoise) - (effectiveRating(a) * 100 + aNoise)
  }).slice(0, 5)
  const serial = ecology.metrics.foundedTeams + 1
  const id = 'generated-team-' + yearFor(at) + '-' + serial
  const name = TEAM_WORDS[serial % TEAM_WORDS.length] + ' ' + (region === 'Americas' ? 'Americas' : region)
  const average = selected.reduce((sum, player) => sum + effectiveRating(player), 0) / selected.length
  const team: WorldTeam = {
    id,
    name,
    vrsRank: Math.max(80, world.teams.length + 1),
    vrsPoints: Math.round(280 + average * 5),
    rosterKeys: selected.map((player) => player.key),
    rating: Math.round(average),
    form: 50,
    generated: true,
    active: true,
    region,
    foundedYear: yearFor(at),
    cash: Math.round(5000 + ecology.metrics.sponsorLiquidity * 90 + rng() * 8000),
    prestige: Math.round(14 + average * .22),
    ambition: Math.round(35 + rng() * 35),
    fanbase: Math.round(800 + rng() * 4200),
  }
  for (const player of selected) {
    player.teamId = id
    player.contractWeeks = 18 + Math.floor(rng() * 35)
  }
  world.teams.push(team)
  ecology.metrics.foundedTeams += 1
  schedule(ecology, 'club-plan', addDays(at, 2 + Math.floor(rng() * 6), 11), id)
  pushHistory(ecology, {
    at,
    kind: 'team-founded',
    importance: 46,
    actorIds: [id, ...selected.map((player) => player.key)],
    title: name + ' enters the circuit',
    detail: 'A regional capital opportunity, available five-player roster and event demand made a new organization viable.',
    causes: ['regional-opportunity:' + region, 'free-agent-pool:' + free.length],
    data: { region, startingCash: team.cash ?? 0, rosterRating: Math.round(average) },
  })
}

const dissolveTeam = (world: WorldState, ecology: WorldEcologyState, team: WorldTeam, at: string) => {
  if (team.active === false) return
  team.active = false
  for (const key of team.rosterKeys) {
    const player = world.players[key]
    if (player && player.teamId === team.id) player.teamId = null
  }
  team.rosterKeys = []
  ecology.metrics.dissolvedTeams += 1
  pushHistory(ecology, {
    at,
    kind: 'team-dissolved',
    importance: 52,
    actorIds: [team.id],
    title: team.name + ' exits professional competition',
    detail: 'Low prestige and sustained negative cash made the organization non-viable.',
    causes: ['financial-distress:' + team.id],
    data: { cash: team.cash ?? 0, prestige: Math.round(team.prestige ?? 0) },
  })
}

const maybeFoundOperator = (world: WorldState, ecology: WorldEcologyState, at: string, seed: number) => {
  const active = activeOperators(ecology)
  const competitions = activeCompetitions(ecology)
  const teams = activeTeams(world)
  const desiredEvents = Math.max(4, Math.round(teams.length / 10))
  const capacityGap = desiredEvents - competitions.length
  if (capacityGap <= 2 || ecology.metrics.sponsorLiquidity < 48) return

  const regionCounts = new Map<EcologyRegion, number>(REGIONS.map((region) => [region, 0]))
  for (const competition of competitions) regionCounts.set(competition.region, (regionCounts.get(competition.region) ?? 0) + 1)
  const region = [...regionCounts.entries()].sort((a, b) => a[1] - b[1])[0][0]
  const entryUtility = capacityGap * 9 + ecology.metrics.sponsorLiquidity * .45 + ecology.metrics.audienceDemand * .35 - active.length * 6
  const rng = rngFor(seed, 'operator-entry:' + at + ':' + region)
  if (entryUtility + rng() * 18 < 70) return

  const serial = Object.keys(ecology.operators).length + 1
  const id = 'operator-generated-' + yearFor(at) + '-' + serial
  const operator: TournamentOperatorAgent = {
    id,
    name: operatorName(region, serial),
    region,
    capital: Math.round(12000 + ecology.metrics.sponsorLiquidity * 180 + rng() * 12000),
    reputation: Math.round(24 + rng() * 22),
    audience: Math.round(30 + rng() * 22),
    risk: Math.round(35 + rng() * 55),
    quality: Math.round(38 + rng() * 28),
    active: true,
    foundedYear: yearFor(at),
    eventIds: [],
    consecutiveLosses: 0,
  }
  ecology.operators[id] = operator
  schedule(ecology, 'operator-plan', addDays(at, 2 + Math.floor(rng() * 8), 10), id)
  pushHistory(ecology, {
    at,
    kind: 'operator-founded',
    importance: 58,
    actorIds: [id],
    title: operator.name + ' launches as a tournament operator',
    detail: 'Unsatisfied event demand and available sponsor liquidity created a profitable entry opportunity.',
    causes: ['event-capacity-gap:' + capacityGap],
    data: { region, capital: operator.capital, entryUtility: Math.round(entryUtility) },
  })
}

const reviewPopulation = (world: WorldState, ecology: WorldEcologyState, at: string, seed: number) => {
  const rng = rngFor(seed, 'population:' + at)
  const year = yearFor(at)
  if (year > ecology.lastAgingYear) {
    const years = year - ecology.lastAgingYear
    for (const player of Object.values(world.players)) {
      if (player.retiredAt || player.teamId === 'club') continue
      if (player.age != null) player.age += years
      const age = player.age ?? 24
      const potential = player.potentialRating ?? Math.max(player.baseRating, player.currentRating + 4)
      const developmentRoom = potential - player.currentRating
      const development = age <= 22
        ? Math.max(0, Math.round(developmentRoom * (.08 + rng() * .08)))
        : age <= 25
          ? Math.max(0, Math.round(developmentRoom * (.03 + rng() * .04)))
          : -Math.max(0, Math.round((age - 25) * (.12 + rng() * .16)))
      player.currentRating = clamp(player.currentRating + development, 40, 99)
      player.baseRating = clamp(player.baseRating + Math.round(development * .65), 40, 99)
    }
    ecology.lastAgingYear = year
  }

  for (const player of Object.values(world.players)) {
    if (player.retiredAt || player.teamId === 'club') continue
    const age = player.age ?? 24
    const unemployed = !player.teamId
    const ageHazard = age <= 25 ? .002 : age <= 28 ? .008 : age <= 31 ? .025 : .075 + (age - 31) * .025
    const marketHazard = unemployed ? (player.currentRating < 58 ? .045 : .012) : 0
    const performanceHazard = player.currentRating < 50 ? .025 : 0
    if (rng() < Math.min(.45, ageHazard + marketHazard + performanceHazard)) retirePlayer(world, ecology, player, at)
  }

  recalcMetrics(world, ecology)
  const regionDemand = new Map<EcologyRegion, number>(REGIONS.map((region) => [region, 0]))
  for (const team of world.teams.filter((team) => team.active !== false)) {
    const region = team.region ?? teamRegion(world, team)
    const missing = Math.max(0, 6 - team.rosterKeys.length)
    regionDemand.set(region, (regionDemand.get(region) ?? 0) + missing)
  }
  for (const region of REGIONS) {
    const available = Object.values(world.players).filter((player) =>
      !player.teamId && !player.retiredAt && regionForCountry(player.country) === region && player.currentRating >= 50,
    ).length
    const demand = regionDemand.get(region) ?? 0
    const scarcity = Math.max(0, demand + Math.round(activeTeams(world).length * .025) - available)
    const intake = Math.min(8, Math.max(0, scarcity))
    for (let index = 0; index < intake; index += 1) {
      createGeneratedPlayer(world, ecology, region, at, seed, ecology.metrics.generatedPlayers + index + 1)
    }
  }

  recalcMetrics(world, ecology)
  const activeTeamCount = activeTeams(world).length
  const sustainableTeamCapacity = ecology.carryingCapacityTeams + Math.max(0, Math.floor((ecology.metrics.audienceDemand - 55) / 8))
  for (const region of REGIONS) {
    if (activeTeamCount >= sustainableTeamCapacity) break
    const regionalFree = Object.values(world.players).filter((player) =>
      !player.teamId && !player.retiredAt && regionForCountry(player.country) === region && player.currentRating >= 53,
    )
    const regionalTeams = activeTeams(world).filter((team) => (team.region ?? teamRegion(world, team)) === region)
    const tournamentAccess = activeCompetitions(ecology).filter((event) => event.region === region).length
    const regionalShare = regionalTeams.length / Math.max(1, activeTeams(world).length)
    const underRepresentation = Math.max(0, .18 - regionalShare) * 80
    const entryUtility =
      Math.min(28, regionalFree.length * 1.4) +
      tournamentAccess * 4 +
      ecology.metrics.sponsorLiquidity * .18 +
      underRepresentation -
      regionalTeams.length * .28
    if (regionalFree.length >= 7 && entryUtility + rng() * 12 > 50) foundTeam(world, ecology, region, at, seed)
  }

  maybeFoundOperator(world, ecology, at, seed)
  recalcMetrics(world, ecology)
  schedule(ecology, 'population-review', addDays(at, 28 + Math.floor(rng() * 8), 7))
}

const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart <= bEnd && bStart <= aEnd

const selectCompetitionTeams = (
  world: WorldState,
  ecology: WorldEcologyState,
  operator: TournamentOperatorAgent,
  tier: 1 | 2 | 3,
  startsAt: string,
  endsAt: string,
  seed: number,
) => {
  const rng = rngFor(seed, 'participants:' + operator.id + ':' + startsAt)
  const teams = activeTeams(world)
    .filter((team) => !activeCompetitions(ecology).some((competition) =>
      competition.participantTeamIds.includes(team.id) &&
      rangesOverlap(startsAt, endsAt, competition.startsAt, competition.endsAt),
    ))
    .map((team) => {
      const strength = teamStrength(world, team)
      const prestige = clubPrestige(team)
      const personality = clubPersonality(team, seed)
      const sameRegion = (team.region ?? teamRegion(world, team)) === operator.region
      const regional = sameRegion ? 12 : tier === 1 ? 0 : -8
      const tierFit = tier === 1
        ? prestige * .6 + strength * .45
        : tier === 2
          ? strength * .65 + prestige * .2
          : (100 - prestige) * .12 + strength * .65
      const prizeValue = (tier === 1 ? 15 : tier === 2 ? 9 : 5) * (1 + (100 - prestige) / 180)
      const fatigue = team.rosterKeys
        .map((key) => world.players[key]?.fatigue ?? 0)
        .reduce((sum, value) => sum + value, 0) / Math.max(1, team.rosterKeys.length)
      const travelCost = sameRegion ? 0 : (100 - personality.travelTolerance) * .09
      const fatigueCost = fatigue * .12
      const riskFit = tier === 1 ? personality.risk * .03 : (100 - personality.risk) * .015
      return { team, utility: tierFit + regional + prizeValue + riskFit + rng() * 6 - travelCost - fatigueCost }
    })
    .sort((a, b) => b.utility - a.utility)
  return teams.slice(0, 8).map((entry) => entry.team.id)
}

const createCompetition = (
  world: WorldState,
  ecology: WorldEcologyState,
  operator: TournamentOperatorAgent,
  at: string,
  seed: number,
) => {
  const rng = rngFor(seed, 'competition:' + operator.id + ':' + at)
  const tier: 1 | 2 | 3 = operator.reputation >= 72 && rng() < .45 ? 1 : operator.reputation >= 45 && rng() < .68 ? 2 : 3
  const format = rng() < (tier === 1 ? .78 : .38) ? 'LAN' as const : 'ONLINE' as const
  const startsAt = addDays(at, 8 + Math.floor(rng() * 24), 12 + Math.floor(rng() * 7))
  const duration = tier === 1 ? 8 : tier === 2 ? 6 : 4
  const endsAt = addDays(startsAt, duration, 23)
  const basePrize = tier === 1 ? 7000 : tier === 2 ? 3300 : 1300
  const prizePool = Math.round(basePrize * (.75 + ecology.metrics.sponsorLiquidity / 160 + rng() * .22))
  const serial = operator.eventIds.length + 1
  const id = 'eco-event-' + operator.id + '-' + yearFor(at) + '-' + serial
  const participants = selectCompetitionTeams(world, ecology, operator, tier, startsAt, endsAt, seed)
  if (participants.length < 8) return

  const competition: AutonomousCompetition = {
    id,
    operatorId: operator.id,
    name: operator.name + ' ' + (tier === 1 ? 'Championship' : tier === 2 ? 'Masters' : 'Open') + ' ' + serial,
    region: operator.region,
    tier,
    format,
    createdAt: at,
    startsAt,
    endsAt,
    status: 'announced',
    prizePool,
    prestige: clamp(operator.reputation * .72 + (tier === 1 ? 24 : tier === 2 ? 12 : 3)),
    audience: 0,
    participantTeamIds: participants,
    rosterSnapshots: {},
    matches: [],
    winnerTeamId: null,
    revenue: 0,
    cost: Math.round(prizePool * (format === 'LAN' ? 1.72 : 1.18)),
  }
  ecology.competitions[id] = competition
  operator.eventIds.push(id)
  operator.capital -= Math.round(competition.cost * .22)
  schedule(ecology, 'competition-start', startsAt, operator.id, id)
  schedule(ecology, 'competition-finish', endsAt, operator.id, id)
  pushHistory(ecology, {
    at,
    kind: 'tournament-created',
    importance: tier === 1 ? 70 : tier === 2 ? 48 : 28,
    actorIds: [operator.id, ...participants],
    title: competition.name + ' announced',
    detail: operator.name + ' committed capital after comparing audience demand, sponsor liquidity, regional supply and its own risk appetite.',
    causes: ['operator-plan:' + operator.id],
    data: { tier, prizePool, region: operator.region, participants: participants.length },
  })
}

const planOperator = (world: WorldState, ecology: WorldEcologyState, operatorId: string, at: string, seed: number) => {
  const operator = ecology.operators[operatorId]
  if (!operator?.active) return
  const rng = rngFor(seed, 'operator:' + operator.id + ':' + at)
  const live = activeCompetitions(ecology).filter((competition) => competition.operatorId === operator.id)
  const regionalTeams = activeTeams(world).filter((team) => (team.region ?? teamRegion(world, team)) === operator.region).length
  const opportunity =
    ecology.metrics.audienceDemand * .38 +
    ecology.metrics.sponsorLiquidity * .34 +
    regionalTeams * 1.8 +
    operator.reputation * .22 -
    live.length * 18 -
    (operator.capital < 5000 ? 18 : 0)

  if (live.length < 2 && opportunity + rng() * 15 > 55 && operator.capital > 3500) {
    createCompetition(world, ecology, operator, at, seed)
  }

  if (operator.capital < -5000 && operator.consecutiveLosses >= 3) {
    operator.active = false
    pushHistory(ecology, {
      at,
      kind: 'operator-dissolved',
      importance: 64,
      actorIds: [operator.id],
      title: operator.name + ' ceases operations',
      detail: 'Repeated event losses exhausted the operator capital base.',
      causes: operator.eventIds.slice(-3),
      data: { capital: operator.capital, losses: operator.consecutiveLosses },
    })
    return
  }

  const nextDays = Math.max(5, Math.round(18 - opportunity * .08 + rng() * 12))
  schedule(ecology, 'operator-plan', addDays(at, nextDays, 10), operator.id)
}

const startCompetition = (
  world: WorldState,
  ecology: WorldEcologyState,
  competitionId: string,
  at: string,
) => {
  const competition = ecology.competitions[competitionId]
  if (!competition || competition.status !== 'announced') return

  const existing = new Set<string>()
  const participants = competition.participantTeamIds
    .map((id) => world.teams.find((team) => team.id === id))
    .filter((team): team is WorldTeam => Boolean(team) && team.active !== false && team.rosterKeys.length >= 5)

  for (const team of participants) existing.add(team.id)
  if (participants.length < 8) {
    const replacements = activeTeams(world)
      .filter((team) =>
        !existing.has(team.id) &&
        !activeCompetitions(ecology).some((other) =>
          other.id !== competition.id &&
          other.status === 'running' &&
          other.participantTeamIds.includes(team.id),
        ),
      )
      .sort((a, b) => a.vrsRank - b.vrsRank)
      .slice(0, 8 - participants.length)
    participants.push(...replacements)
  }

  if (participants.length < 8) {
    competition.status = 'cancelled'
    const operator = ecology.operators[competition.operatorId]
    if (operator) {
      operator.capital -= Math.round(competition.cost * .18)
      operator.consecutiveLosses += 1
    }
    pushHistory(ecology, {
      at,
      kind: 'economic-shock',
      importance: competition.tier === 1 ? 55 : 30,
      actorIds: [competition.operatorId],
      title: competition.name + ' cancelled',
      detail: 'The event failed to secure eight eligible organizations at roster lock.',
      causes: [competition.id],
      data: { participants: participants.length },
    })
    return
  }

  competition.participantTeamIds = participants.slice(0, 8).map((team) => team.id)
  competition.rosterSnapshots = Object.fromEntries(
    participants.slice(0, 8).map((team) => [team.id, [...team.rosterKeys].slice(0, 5)]),
  )
  competition.status = 'running'
}

const simulateAutonomousSeries = (
  world: WorldState,
  competition: AutonomousCompetition,
  teamA: WorldTeam,
  teamB: WorldTeam,
  round: AutonomousMatch['round'],
  index: number,
  seed: number,
): { match: AutonomousMatch; winner: WorldTeam; loser: WorldTeam } => {
  const rng = rngFor(seed, 'series:' + competition.id + ':' + round + ':' + index + ':' + teamA.id + ':' + teamB.id)
  const snapshotStrength = (team: WorldTeam) => {
    const keys = competition.rosterSnapshots?.[team.id]
    if (!keys?.length) return teamStrength(world, team)
    const players = keys
      .map((key) => world.players[key])
      .filter((player): player is WorldPlayer => Boolean(player))
      .sort((a, b) => effectiveRating(b) - effectiveRating(a))
      .slice(0, 5)
    return players.length
      ? clamp(players.reduce((sum, player) => sum + effectiveRating(player), 0) / players.length, 45, 99)
      : teamStrength(world, team)
  }
  const strengthA = snapshotStrength(teamA) + ((teamA.form ?? 50) - 50) * .08
  const strengthB = snapshotStrength(teamB) + ((teamB.form ?? 50) - 50) * .08
  const winProbabilityA = clamp(1 / (1 + Math.exp(-(strengthA - strengthB) / 5.2)), .08, .92)
  const aWins = rng() < winProbabilityA
  const closeSeries = rng() > Math.abs(winProbabilityA - .5) * 1.25
  const scoreA = aWins ? 2 : closeSeries ? 1 : 0
  const scoreB = aWins ? (closeSeries ? 1 : 0) : 2
  const winner = aWins ? teamA : teamB
  const loser = aWins ? teamB : teamA
  const fidelity: 0 | 1 = competition.tier === 1 || round === 'final' ? 1 : 0
  return {
    winner,
    loser,
    match: {
      id: competition.id + '-' + round + '-' + (index + 1),
      round,
      teamAId: teamA.id,
      teamBId: teamB.id,
      winnerTeamId: winner.id,
      loserTeamId: loser.id,
      scoreA,
      scoreB,
      fidelity,
    },
  }
}

const finishCompetition = (
  world: WorldState,
  ecology: WorldEcologyState,
  competitionId: string,
  at: string,
  seed: number,
) => {
  const competition = ecology.competitions[competitionId]
  if (!competition || competition.status === 'complete' || competition.status === 'cancelled') return
  const operator = ecology.operators[competition.operatorId]
  const rng = rngFor(seed, 'finish:' + competition.id)
  const entrants = competition.participantTeamIds
    .map((id) => world.teams.find((team) => team.id === id))
    .filter((team): team is WorldTeam => team != null)
  if (entrants.length < 8) {
    competition.status = 'cancelled'
    if (operator) {
      operator.capital -= Math.round(competition.cost * .25)
      operator.consecutiveLosses += 1
    }
    return
  }

  const seeded = [...entrants].sort((a, b) => a.vrsRank - b.vrsRank || b.vrsPoints - a.vrsPoints)
  const quarterPairs: Array<[WorldTeam, WorldTeam]> = [
    [seeded[0], seeded[7]],
    [seeded[3], seeded[4]],
    [seeded[1], seeded[6]],
    [seeded[2], seeded[5]],
  ]
  const quarterResults = quarterPairs.map(([a, b], index) =>
    simulateAutonomousSeries(world, competition, a, b, 'quarterfinal', index, seed),
  )
  const semiPairs: Array<[WorldTeam, WorldTeam]> = [
    [quarterResults[0].winner, quarterResults[1].winner],
    [quarterResults[2].winner, quarterResults[3].winner],
  ]
  const semiResults = semiPairs.map(([a, b], index) =>
    simulateAutonomousSeries(world, competition, a, b, 'semifinal', index, seed),
  )
  const finalResult = simulateAutonomousSeries(
    world,
    competition,
    semiResults[0].winner,
    semiResults[1].winner,
    'final',
    0,
    seed,
  )
  competition.matches = [
    ...quarterResults.map((result) => result.match),
    ...semiResults.map((result) => result.match),
    finalResult.match,
  ]
  const winner = finalResult.winner
  const runnerUp = finalResult.loser
  competition.winnerTeamId = winner.id
  competition.status = 'complete'

  const matchPointValue = competition.tier === 1 ? 16 : competition.tier === 2 ? 9 : 5
  for (const match of competition.matches) {
    const team = world.teams.find((candidate) => candidate.id === match.winnerTeamId)
    if (team) team.vrsPoints = Math.round(team.vrsPoints + matchPointValue)
  }
  competition.audience = Math.round(
    (competition.prestige * 900 + entrants.reduce((sum, team) => sum + (team.fanbase ?? 1500), 0) * .4) *
    (.8 + rng() * .45),
  )
  competition.revenue = Math.round(
    competition.audience * (.08 + ecology.metrics.sponsorLiquidity * .0022) +
    competition.prizePool * (.45 + competition.prestige / 150),
  )

  winner.vrsPoints = Math.round(winner.vrsPoints + (competition.tier === 1 ? 95 : competition.tier === 2 ? 55 : 28))
  runnerUp.vrsPoints = Math.round(runnerUp.vrsPoints + (competition.tier === 1 ? 58 : competition.tier === 2 ? 34 : 17))
  winner.cash = clubBudget(winner) + Math.round(competition.prizePool * .5)
  runnerUp.cash = clubBudget(runnerUp) + Math.round(competition.prizePool * .25)
  winner.prestige = clamp(clubPrestige(winner) + (competition.tier === 1 ? 5 : 2))
  runnerUp.prestige = clamp(clubPrestige(runnerUp) + 1)

  if (operator) {
    const profit = competition.revenue - competition.cost
    operator.capital += competition.revenue - Math.round(competition.cost * .78)
    operator.audience = clamp(operator.audience * .82 + Math.min(100, competition.audience / 1200) * .18)
    operator.reputation = clamp(operator.reputation + (profit >= 0 ? 1.5 : -.8) + (competition.tier === 1 ? .8 : 0))
    operator.consecutiveLosses = profit < 0 ? operator.consecutiveLosses + 1 : 0
  }

  ecology.metrics.completedCompetitions += 1
  pushHistory(ecology, {
    at,
    kind: 'tournament-completed',
    importance: competition.tier === 1 ? 88 : competition.tier === 2 ? 60 : 38,
    actorIds: [competition.operatorId, winner.id, runnerUp.id],
    title: winner.name + ' wins ' + competition.name,
    detail: winner.name + ' beat the autonomous field. The result changed VRS, club cash, prestige and the organizer economy.',
    causes: [competition.id],
    data: {
      tier: competition.tier,
      prizePool: competition.prizePool,
      audience: competition.audience,
      revenue: competition.revenue,
      winnerRating: Math.round(teamStrength(world, winner)),
    },
  })
}

const syncDerivedWorld = (world: WorldState) => {
  const active = world.teams.filter((team) => team.active !== false)
    .sort((a, b) => b.vrsPoints - a.vrsPoints || a.name.localeCompare(b.name, 'en-US'))
  active.forEach((team, index) => {
    team.vrsRank = index + 1
    team.rating = Math.round(teamStrength(world, team))
    const roster = team.rosterKeys.map((key) => world.players[key]).filter((player): player is WorldPlayer => Boolean(player))
    team.form = roster.length ? Math.round(roster.reduce((sum, player) => sum + player.form, 0) / roster.length) : 45
  })
  const inactive = world.teams.filter((team) => team.active === false)
  world.teams = [...active, ...inactive]
  world.freeAgentKeys = Object.values(world.players)
    .filter((player) => !player.teamId && !player.retiredAt)
    .map((player) => player.key)
}

export const advanceWorldEcology = (
  source: WorldState,
  from: string,
  to: string,
  seed: number,
): WorldState => {
  if (to <= from) return source
  const hydrated = ensureWorldEcology(source, seed, from) as MutableWorld
  const world = {
    ...hydrated,
    players: Object.fromEntries(Object.entries(hydrated.players).map(([key, player]) => [key, { ...player }])),
    teams: hydrated.teams.map((team) => ({ ...team, rosterKeys: [...team.rosterKeys] })),
    freeAgentKeys: [...hydrated.freeAgentKeys],
    transferHistory: [...hydrated.transferHistory],
  } as MutableWorld
  const ecology: WorldEcologyState = {
    ...hydrated.ecology!,
    scheduled: hydrated.ecology!.scheduled.map((event) => ({ ...event })),
    operators: Object.fromEntries(Object.entries(hydrated.ecology!.operators).map(([id, operator]) => [id, { ...operator, eventIds: [...operator.eventIds] }])),
    competitions: Object.fromEntries(Object.entries(hydrated.ecology!.competitions).map(([id, competition]) => [id, {
      ...competition,
      participantTeamIds: [...competition.participantTeamIds],
      rosterSnapshots: Object.fromEntries(Object.entries(competition.rosterSnapshots ?? {}).map(([teamId, keys]) => [teamId, [...keys]])),
      matches: [...(competition.matches ?? [])],
    }])),
    offers: hydrated.ecology!.offers.map((offer) => ({ ...offer })),
    history: hydrated.ecology!.history.map((event) => ({ ...event, actorIds: [...event.actorIds], causes: [...event.causes], data: event.data ? { ...event.data } : undefined })),
    retiredPlayerKeys: [...hydrated.ecology!.retiredPlayerKeys],
    metrics: { ...hydrated.ecology!.metrics },
  }
  world.ecology = ecology

  recalcMetrics(world, ecology)
  ecology.scheduled.sort(eventSort)
  let guard = 0
  while (ecology.scheduled.length && ecology.scheduled[0].at <= to && guard < 20000) {
    guard += 1
    const event = ecology.scheduled.shift()!
    if (event.at < ecology.processedUntil) continue
    ecology.processedUntil = event.at

    switch (event.type) {
      case 'club-plan':
        if (event.actorId) planClub(world, ecology, event.actorId, event.at, seed)
        break
      case 'market-clear':
        clearMarket(world, ecology, event.at, seed)
        break
      case 'population-review':
        reviewPopulation(world, ecology, event.at, seed)
        break
      case 'operator-plan':
        if (event.actorId) planOperator(world, ecology, event.actorId, event.at, seed)
        break
      case 'competition-start':
        if (event.subjectId) startCompetition(world, ecology, event.subjectId, event.at)
        break
      case 'competition-finish':
        if (event.subjectId) finishCompetition(world, ecology, event.subjectId, event.at, seed)
        break
    }
    ecology.scheduled.sort(eventSort)
  }

  ecology.processedUntil = to
  recalcMetrics(world, ecology)
  syncDerivedWorld(world)
  return world as WorldState
}

export const worldEventsSince = (
  world: WorldState,
  since: string,
  minimumImportance = 25,
): WorldHistoryEvent[] => {
  const ecology = (world as MutableWorld).ecology
  if (!ecology) return []
  return ecology.history
    .filter((event) => event.at > since && event.importance >= minimumImportance)
    .sort((a, b) => b.at.localeCompare(a.at) || b.importance - a.importance)
}
