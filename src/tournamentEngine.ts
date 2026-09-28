import { addGameDays, addGameHours, compareGameTime } from './calendar'
import { tournamentForId, type TournamentEvent, type TournamentStructure } from './events'
import { worldLineup, worldTeamRating, type WorldState } from './world'
import type { RealPlayerRole } from './players'

export const PLAYER_TEAM_ID = 'club'

export type TournamentStatus =
  | 'registered'
  | 'group_stage'
  | 'playoffs'
  | 'eliminated'
  | 'champion'
  | 'complete'

export type TournamentStage = 'group' | 'quarterfinal' | 'semifinal' | 'upper' | 'lower' | 'final'
export type TournamentMatchStatus = 'scheduled' | 'ready' | 'complete'

export interface TournamentRosterPlayer {
  playerKey: string
  alias: string
  role: RealPlayerRole | null
  rating: number
  profileId: number | null
  country: string | null
}

export interface TournamentPlayerTeamSeed {
  rating: number
  roster: TournamentRosterPlayer[]
}

export interface TournamentTeam {
  id: string
  worldTeamId: string | null
  name: string
  rating: number
  seed: number
  isPlayer: boolean
  roster: TournamentRosterPlayer[]
}

export interface TournamentMatchSource {
  type: 'team' | 'winner' | 'loser' | 'group_seed'
  value: string
  group?: 'A' | 'B'
  rank?: 1 | 2
}

export interface TournamentMatch {
  id: string
  stage: TournamentStage
  group?: 'A' | 'B'
  round: number
  order: number
  label: string
  scheduledAt: string
  sourceA: TournamentMatchSource
  sourceB: TournamentMatchSource
  teamAId: string | null
  teamBId: string | null
  status: TournamentMatchStatus
  scoreA: number | null
  scoreB: number | null
  winnerId: string | null
  loserId: string | null
}

export interface GroupStanding {
  teamId: string
  played: number
  wins: number
  losses: number
  mapDiff: number
}

export interface TournamentRun {
  id: string
  eventId: string
  structure: TournamentStructure
  status: TournamentStatus
  registeredAt: string
  startsAt: string
  endsAt: string
  teams: TournamentTeam[]
  matches: TournamentMatch[]
  earnedPrize: number
  prizePaid: boolean
  vrsPaid?: boolean
  placement: string | null
}

const TEAM_NAMES = [
  'Northstar', 'Red Static', 'Morrow Five', 'Pixel Union', 'Zero Hour',
  'Nightshift', 'Kinetic', 'Blackbird', 'Vertex', 'Nocturne', 'Axiom',
  'Blue Shift', 'Riftborn', 'Monarch', 'Helix', 'Crimson Core',
] as const

const hashSeed = (input: string) => {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
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

const shuffled = <T,>(items: readonly T[], rng: () => number) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

export const tournamentStartsAt = (event: TournamentEvent, seasonStart: string) =>
  addGameDays(seasonStart, event.startDay, 10)

export const tournamentEndsAt = (event: TournamentEvent, seasonStart: string) =>
  addGameDays(seasonStart, event.startDay + event.durationDays, 23)

const baseRatingForEvent = (event: TournamentEvent) =>
  event.circuitTier === 1 ? 78 : event.circuitTier === 2 ? 69 : 59

const tournamentRosterFromWorld = (world: WorldState, teamId: string): TournamentRosterPlayer[] =>
  worldLineup(world, teamId).map((player) => ({
    playerKey: player.key,
    alias: player.alias,
    role: player.role,
    rating: player.currentRating,
    profileId: player.profileId,
    country: player.country,
  }))

const eligibleWorldTeams = (world: WorldState, event: TournamentEvent) => {
  const primary = world.teams.filter((team) => {
    if (team.rosterKeys.length < 5) return false
    if (event.circuitTier === 1) return team.vrsRank <= 30
    if (event.circuitTier === 2) return team.vrsRank >= 8 && team.vrsRank <= 85
    return team.vrsRank >= 25
  })
  if (primary.length >= 7) return primary
  return world.teams.filter((team) => team.rosterKeys.length >= 5)
}

const buildTeams = (
  event: TournamentEvent,
  seed: number,
  world?: WorldState,
  playerTeam?: TournamentPlayerTeamSeed,
): TournamentTeam[] => {
  const rng = mulberry32(hashSeed(event.id + ':' + seed))
  const base = baseRatingForEvent(event)
  const teams: TournamentTeam[] = [{
    id: PLAYER_TEAM_ID,
    worldTeamId: null,
    name: 'YOUR CLUB',
    rating: playerTeam?.rating ?? base,
    seed: 1,
    isPlayer: true,
    roster: playerTeam?.roster ?? [],
  }]

  if (world) {
    const pool = shuffled(eligibleWorldTeams(world, event), rng)
      .sort((a, b) => {
        const target = event.circuitTier === 1 ? 14 : event.circuitTier === 2 ? 45 : 95
        const da = Math.abs(a.vrsRank - target)
        const db = Math.abs(b.vrsRank - target)
        const jitterA = hashSeed(event.id + ':' + a.id + ':' + seed) % 17
        const jitterB = hashSeed(event.id + ':' + b.id + ':' + seed) % 17
        return da - db || jitterA - jitterB
      })
      .slice(0, 7)

    pool.forEach((team, index) => {
      teams.push({
        id: team.id,
        worldTeamId: team.id,
        name: team.name,
        rating: worldTeamRating(world, team),
        seed: index + 2,
        isPlayer: false,
        roster: tournamentRosterFromWorld(world, team.id),
      })
    })

    if (teams.length === 8) return teams
  }

  const names = shuffled(TEAM_NAMES, rng).slice(0, 7)
  names.forEach((name, index) => {
    teams.push({
      id: event.id + '-ai-' + (index + 1),
      worldTeamId: null,
      name,
      rating: Math.round(base - 5 + rng() * 11),
      seed: index + 2,
      isPlayer: false,
      roster: [],
    })
  })

  return teams.slice(0, 8)
}

export const refreshTournamentTeamsFromWorld = (
  source: TournamentRun,
  world: WorldState,
  clubPlayerKeys: ReadonlySet<string>,
): TournamentRun => ({
  ...source,
  teams: source.teams.map((team) => {
    if (team.isPlayer || !team.worldTeamId) return team
    const worldTeam = world.teams.find((candidate) => candidate.id === team.worldTeamId)
    if (!worldTeam) return team

    const liveRoster = tournamentRosterFromWorld(world, worldTeam.id)
      .filter((player) => !clubPlayerKeys.has(player.playerKey))
    const liveByKey = new Map(liveRoster.map((player) => [player.playerKey, player] as const))

    // A tournament lineup keeps its slot/order while a player still belongs to
    // the team. Transfers only replace the missing slot instead of shuffling the
    // full five every time Matchday refreshes from the living world.
    const preserved = team.roster
      .map((player) => liveByKey.get(player.playerKey) ?? null)
      .filter((player): player is TournamentRosterPlayer => Boolean(player))

    const used = new Set(preserved.map((player) => player.playerKey))
    const replacements = liveRoster.filter((player) => !used.has(player.playerKey))
    const roster = [...preserved, ...replacements].slice(0, 5)

    return {
      ...team,
      rating: worldTeamRating(world, worldTeam),
      roster,
    }
  }),
})

const direct = (teamId: string): TournamentMatchSource => ({ type: 'team', value: teamId })
const winner = (matchId: string): TournamentMatchSource => ({ type: 'winner', value: matchId })
const loser = (matchId: string): TournamentMatchSource => ({ type: 'loser', value: matchId })
const groupSeed = (group: 'A' | 'B', rank: 1 | 2): TournamentMatchSource => ({
  type: 'group_seed',
  value: group + rank,
  group,
  rank,
})

const makeMatch = (
  id: string,
  stage: TournamentStage,
  round: number,
  order: number,
  label: string,
  scheduledAt: string,
  sourceA: TournamentMatchSource,
  sourceB: TournamentMatchSource,
  group?: 'A' | 'B',
): TournamentMatch => ({
  id,
  stage,
  group,
  round,
  order,
  label,
  scheduledAt,
  sourceA,
  sourceB,
  teamAId: sourceA.type === 'team' ? sourceA.value : null,
  teamBId: sourceB.type === 'team' ? sourceB.value : null,
  status: 'scheduled',
  scoreA: null,
  scoreB: null,
  winnerId: null,
  loserId: null,
})

const groupPairings = (group: 'A' | 'B', ids: string[], startsAt: string) => {
  const rounds: Array<Array<[number, number]>> = [
    [[0, 3], [1, 2]],
    [[0, 2], [3, 1]],
    [[0, 1], [2, 3]],
  ]
  const matches: TournamentMatch[] = []
  rounds.forEach((roundPairs, roundIndex) => {
    roundPairs.forEach((pair, pairIndex) => {
      const hour = group === 'A'
        ? (pairIndex === 0 ? 12 : 18)
        : (pairIndex === 0 ? 15 : 21)
      matches.push(makeMatch(
        'g-' + group.toLowerCase() + '-' + (roundIndex + 1) + '-' + (pairIndex + 1),
        'group',
        roundIndex + 1,
        pairIndex + 1,
        'GROUP ' + group + ' · ROUND ' + (roundIndex + 1),
        addGameDays(startsAt, roundIndex, hour),
        direct(ids[pair[0]]),
        direct(ids[pair[1]]),
        group,
      ))
    })
  })
  return matches
}

const singleElimMatches = (teams: TournamentTeam[], startsAt: string) => {
  const ids = teams.map((team) => team.id)
  const qf = [
    makeMatch('qf-1', 'quarterfinal', 1, 1, 'QUARTERFINAL', addGameHours(startsAt, 2), direct(ids[0]), direct(ids[7])),
    makeMatch('qf-2', 'quarterfinal', 1, 2, 'QUARTERFINAL', addGameHours(startsAt, 5), direct(ids[3]), direct(ids[4])),
    makeMatch('qf-3', 'quarterfinal', 1, 3, 'QUARTERFINAL', addGameHours(startsAt, 8), direct(ids[1]), direct(ids[6])),
    makeMatch('qf-4', 'quarterfinal', 1, 4, 'QUARTERFINAL', addGameHours(startsAt, 11), direct(ids[2]), direct(ids[5])),
  ]
  return [
    ...qf,
    makeMatch('sf-1', 'semifinal', 2, 1, 'SEMIFINAL', addGameDays(startsAt, 1, 15), winner('qf-1'), winner('qf-2')),
    makeMatch('sf-2', 'semifinal', 2, 2, 'SEMIFINAL', addGameDays(startsAt, 1, 19), winner('qf-3'), winner('qf-4')),
    makeMatch('final', 'final', 3, 1, 'GRAND FINAL', addGameDays(startsAt, 2, 18), winner('sf-1'), winner('sf-2')),
  ]
}

const groupedMatches = (
  teams: TournamentTeam[],
  startsAt: string,
  structure: Exclude<TournamentStructure, 'single_elim'>,
) => {
  const groupA = [teams[0].id, teams[3].id, teams[4].id, teams[7].id]
  const groupB = [teams[1].id, teams[2].id, teams[5].id, teams[6].id]
  const groups = [
    ...groupPairings('A', groupA, startsAt),
    ...groupPairings('B', groupB, startsAt),
  ]

  if (structure === 'groups_single') {
    return [
      ...groups,
      makeMatch('sf-1', 'semifinal', 4, 1, 'SEMIFINAL', addGameDays(startsAt, 4, 15), groupSeed('A', 1), groupSeed('B', 2)),
      makeMatch('sf-2', 'semifinal', 4, 2, 'SEMIFINAL', addGameDays(startsAt, 4, 19), groupSeed('B', 1), groupSeed('A', 2)),
      makeMatch('final', 'final', 5, 1, 'GRAND FINAL', addGameDays(startsAt, 5, 18), winner('sf-1'), winner('sf-2')),
    ]
  }

  return [
    ...groups,
    makeMatch('ub-1', 'upper', 4, 1, 'UPPER SEMIFINAL', addGameDays(startsAt, 4, 14), groupSeed('A', 1), groupSeed('B', 2)),
    makeMatch('ub-2', 'upper', 4, 2, 'UPPER SEMIFINAL', addGameDays(startsAt, 4, 18), groupSeed('B', 1), groupSeed('A', 2)),
    makeMatch('lb-1', 'lower', 5, 1, 'LOWER ROUND 1', addGameDays(startsAt, 5, 13), loser('ub-1'), loser('ub-2')),
    makeMatch('ub-final', 'upper', 5, 2, 'UPPER FINAL', addGameDays(startsAt, 5, 18), winner('ub-1'), winner('ub-2')),
    makeMatch('lb-final', 'lower', 6, 1, 'LOWER FINAL', addGameDays(startsAt, 6, 16), winner('lb-1'), loser('ub-final')),
    makeMatch('final', 'final', 7, 1, 'GRAND FINAL', addGameDays(startsAt, 7, 19), winner('ub-final'), winner('lb-final')),
  ]
}

export const createTournamentRun = (
  event: TournamentEvent,
  seasonStart: string,
  registeredAt: string,
  seed: number,
  world?: WorldState,
  playerTeam?: TournamentPlayerTeamSeed,
): TournamentRun => {
  const startsAt = tournamentStartsAt(event, seasonStart)
  const teams = buildTeams(event, seed, world, playerTeam)
  const matches = event.structure === 'single_elim'
    ? singleElimMatches(teams, startsAt)
    : groupedMatches(teams, startsAt, event.structure)

  return {
    id: 'run-' + event.id + '-' + seed,
    eventId: event.id,
    structure: event.structure,
    status: 'registered',
    registeredAt,
    startsAt,
    endsAt: tournamentEndsAt(event, seasonStart),
    teams,
    matches,
    earnedPrize: 0,
    prizePaid: false,
    vrsPaid: false,
    placement: null,
  }
}

export const groupStandings = (run: TournamentRun, group: 'A' | 'B'): GroupStanding[] => {
  const matches = run.matches.filter((match) => match.stage === 'group' && match.group === group)
  const ids = new Set<string>()
  matches.forEach((match) => {
    if (match.teamAId) ids.add(match.teamAId)
    if (match.teamBId) ids.add(match.teamBId)
  })

  const table = new Map<string, GroupStanding>()
  ids.forEach((teamId) => table.set(teamId, { teamId, played: 0, wins: 0, losses: 0, mapDiff: 0 }))

  matches.filter((match) => match.status === 'complete' && match.winnerId).forEach((match) => {
    const a = table.get(match.teamAId!)
    const b = table.get(match.teamBId!)
    if (!a || !b) return
    const aScore = match.scoreA ?? 0
    const bScore = match.scoreB ?? 0
    a.played += 1
    b.played += 1
    a.mapDiff += aScore - bScore
    b.mapDiff += bScore - aScore
    if (match.winnerId === match.teamAId) {
      a.wins += 1
      b.losses += 1
    } else {
      b.wins += 1
      a.losses += 1
    }
  })

  return [...table.values()].sort((a, b) =>
    b.wins - a.wins ||
    b.mapDiff - a.mapDiff ||
    (run.teams.find((team) => team.id === a.teamId)?.seed ?? 99) - (run.teams.find((team) => team.id === b.teamId)?.seed ?? 99),
  )
}

const resolveSource = (run: TournamentRun, source: TournamentMatchSource): string | null => {
  if (source.type === 'team') return source.value
  if (source.type === 'winner' || source.type === 'loser') {
    const sourceMatch = run.matches.find((match) => match.id === source.value)
    if (!sourceMatch || sourceMatch.status !== 'complete') return null
    return source.type === 'winner' ? sourceMatch.winnerId : sourceMatch.loserId
  }
  if (source.type === 'group_seed' && source.group && source.rank) {
    const groupMatches = run.matches.filter((match) => match.stage === 'group' && match.group === source.group)
    if (!groupMatches.length || groupMatches.some((match) => match.status !== 'complete')) return null
    return groupStandings(run, source.group)[source.rank - 1]?.teamId ?? null
  }
  return null
}

const resolveSlots = (run: TournamentRun): TournamentRun => {
  const matches = run.matches.map((match) => {
    if (match.status === 'complete') return match
    const teamAId = resolveSource(run, match.sourceA)
    const teamBId = resolveSource(run, match.sourceB)
    return {
      ...match,
      teamAId,
      teamBId,
      status: teamAId && teamBId ? 'ready' as const : 'scheduled' as const,
    }
  })
  return { ...run, matches }
}

const simulateAiResult = (run: TournamentRun, match: TournamentMatch, seed: number) => {
  const a = run.teams.find((team) => team.id === match.teamAId)!
  const b = run.teams.find((team) => team.id === match.teamBId)!
  const rng = mulberry32(hashSeed(run.id + ':' + match.id + ':' + seed))
  const probability = 1 / (1 + Math.exp((b.rating - a.rating) / 8.5))
  const aWins = rng() < probability
  return {
    winnerId: aWins ? a.id : b.id,
    loserId: aWins ? b.id : a.id,
    scoreA: aWins ? 2 : Math.floor(rng() * 2),
    scoreB: aWins ? Math.floor(rng() * 2) : 2,
  }
}

const completeMatch = (
  run: TournamentRun,
  matchId: string,
  winnerId: string,
  loserId: string,
  scoreA: number,
  scoreB: number,
) => {
  const matches = run.matches.map((match) =>
    match.id === matchId
      ? {
          ...match,
          status: 'complete' as const,
          winnerId,
          loserId,
          scoreA,
          scoreB,
        }
      : match,
  )
  return resolveSlots({ ...run, matches })
}

const isPlayerGroupComplete = (run: TournamentRun) => {
  const playerMatches = run.matches.filter((match) => match.stage === 'group' && (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID))
  return playerMatches.length > 0 && playerMatches.every((match) => match.status === 'complete')
}

const hasFuturePlayerPath = (run: TournamentRun) =>
  run.matches.some((match) =>
    match.status !== 'complete' &&
    (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID),
  )

const updateStatus = (run: TournamentRun): TournamentRun => {
  const final = run.matches.find((match) => match.id === 'final')
  if (final?.status === 'complete') {
    if (final.winnerId === PLAYER_TEAM_ID) {
      return { ...run, status: 'champion', placement: 'CHAMPION' }
    }
    if (final.loserId === PLAYER_TEAM_ID) {
      return { ...run, status: 'eliminated', placement: 'RUNNER-UP' }
    }
    return { ...run, status: run.status === 'eliminated' ? 'eliminated' : 'complete' }
  }

  if (run.structure !== 'single_elim' && isPlayerGroupComplete(run)) {
    const playerGroup = run.matches.find((match) => match.stage === 'group' && (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID))?.group
    if (playerGroup) {
      const standing = groupStandings(run, playerGroup)
      const rank = standing.findIndex((row) => row.teamId === PLAYER_TEAM_ID) + 1
      const allGroupDone = run.matches.filter((match) => match.stage === 'group').every((match) => match.status === 'complete')
      if (allGroupDone && rank > 2) return { ...run, status: 'eliminated', placement: 'GROUP STAGE' }
    }
  }

  const playerLoss = [...run.matches]
    .reverse()
    .find((match) => match.status === 'complete' && match.loserId === PLAYER_TEAM_ID)

  if (playerLoss) {
    if (run.structure === 'single_elim') return { ...run, status: 'eliminated', placement: playerLoss.stage.toUpperCase() }
    if (run.structure === 'groups_single' && playerLoss.stage !== 'group') return { ...run, status: 'eliminated', placement: playerLoss.stage.toUpperCase() }
    if (run.structure === 'groups_double' && (playerLoss.stage === 'lower' || playerLoss.stage === 'final')) {
      return { ...run, status: 'eliminated', placement: playerLoss.stage === 'final' ? 'RUNNER-UP' : 'PLAYOFFS' }
    }
  }

  const anyGroupIncomplete = run.matches.some((match) => match.stage === 'group' && match.status !== 'complete')
  if (anyGroupIncomplete) return { ...run, status: 'group_stage' }

  if (hasFuturePlayerPath(run) || run.matches.some((match) => match.stage !== 'group' && match.status !== 'complete')) {
    return { ...run, status: 'playoffs' }
  }

  return run
}

export const advanceTournamentTo = (
  source: TournamentRun,
  now: string,
  seed: number,
): TournamentRun => {
  let run = resolveSlots(source)
  let changed = true

  while (changed) {
    changed = false
    const candidates = run.matches
      .filter((match) =>
        match.status === 'ready' &&
        match.teamAId !== PLAYER_TEAM_ID &&
        match.teamBId !== PLAYER_TEAM_ID &&
        compareGameTime(match.scheduledAt, now) <= 0,
      )
      .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))

    for (const match of candidates) {
      const result = simulateAiResult(run, match, seed)
      run = completeMatch(run, match.id, result.winnerId, result.loserId, result.scoreA, result.scoreB)
      changed = true
    }
  }

  return updateStatus(run)
}

export const nextPlayerMatch = (run: TournamentRun | null | undefined) => {
  if (!run) return null
  return run.matches
    .filter((match) =>
      match.status !== 'complete' &&
      (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID),
    )
    .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))[0] ?? null
}

export const nextTournamentActionTime = (run: TournamentRun) => {
  const playerMatch = nextPlayerMatch(run)
  if (playerMatch) return playerMatch.scheduledAt
  const unresolved = run.matches
    .filter((match) => match.status !== 'complete')
    .sort((a, b) => compareGameTime(a.scheduledAt, b.scheduledAt))[0]
  return unresolved?.scheduledAt ?? run.endsAt
}

export const resolvePlayerTournamentMatch = (
  source: TournamentRun,
  won: boolean,
  scoreA: number,
  scoreB: number,
): TournamentRun => {
  const match = nextPlayerMatch(source)
  if (!match || !match.teamAId || !match.teamBId) return source

  const playerIsA = match.teamAId === PLAYER_TEAM_ID
  const winnerId = won ? PLAYER_TEAM_ID : (playerIsA ? match.teamBId : match.teamAId)
  const loserId = won ? (playerIsA ? match.teamBId : match.teamAId) : PLAYER_TEAM_ID
  const normalizedA = playerIsA ? scoreA : scoreB
  const normalizedB = playerIsA ? scoreB : scoreA

  return updateStatus(completeMatch(source, match.id, winnerId, loserId, normalizedA, normalizedB))
}

export const opponentForPlayerMatch = (run: TournamentRun | null | undefined) => {
  const match = nextPlayerMatch(run)
  if (!match) return null
  const opponentId = match.teamAId === PLAYER_TEAM_ID ? match.teamBId : match.teamAId
  return run!.teams.find((team) => team.id === opponentId) ?? null
}

export const tournamentTeam = (run: TournamentRun, teamId: string | null | undefined) =>
  teamId ? run.teams.find((team) => team.id === teamId) ?? null : null

export const playerGroupRank = (run: TournamentRun) => {
  if (run.structure === 'single_elim') return null
  const group = run.matches.find((match) => match.stage === 'group' && (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID))?.group
  if (!group) return null
  const table = groupStandings(run, group)
  const rank = table.findIndex((row) => row.teamId === PLAYER_TEAM_ID)
  return rank >= 0 ? rank + 1 : null
}

export const tournamentPrizeForStatus = (eventId: string, run: TournamentRun) => {
  const event = tournamentForId(eventId)
  if (!event) return 0
  if (run.status === 'champion') return event.prize
  if (run.placement === 'RUNNER-UP') return Math.round(event.prize * .55)
  if (run.placement === 'PLAYOFFS' || run.placement === 'SEMIFINAL') return Math.round(event.prize * .28)
  if (run.placement === 'GROUP STAGE') return Math.round(event.prize * .1)
  return 0
}

export const tournamentIsFinished = (run: TournamentRun) =>
  run.status === 'champion' || run.status === 'eliminated' || run.status === 'complete'
