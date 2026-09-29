import { cardStatsForAlias } from './cardStats'
import { REAL_PLAYERS, type RealPlayerRole, type RealPlayerSeed } from './players'
import { VRS_RANKED_ROSTERS, VRS_SNAPSHOT_DATE } from './vrs'

export const WORLD_VERSION = 1
export const PLAYER_CLUB_WORLD_ID = 'club'

export interface WorldPlayer {
  key: string
  alias: string
  realName: string | null
  country: string | null
  age: number | null
  role: RealPlayerRole | null
  profileId: number | null
  teamId: string | null
  baseRating: number
  currentRating: number
  form: number
  morale: number
  fatigue: number
  contractWeeks: number
}

export interface WorldTeam {
  id: string
  name: string
  vrsRank: number
  vrsPoints: number
  rosterKeys: string[]
  rating: number
  form: number
}

export interface WorldTransfer {
  id: string
  date: string
  playerKey: string
  alias: string
  fromTeamId: string | null
  toTeamId: string | null
  kind: 'club-signing' | 'club-release' | 'ai-transfer' | 'ai-free-agent'
}

export interface WorldState {
  version: 1
  snapshotDate: string
  weeksSimulated: number
  players: Record<string, WorldPlayer>
  teams: WorldTeam[]
  freeAgentKeys: string[]
  transferHistory: WorldTransfer[]
}

export interface VrsStanding {
  rank: number
  teamId: string
  name: string
  points: number
  isPlayer: boolean
  roster: string[]
}

const normalizeAlias = (value: string) => value.toLocaleLowerCase('en-US')

const slug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US') || 'team'

const profileIdFor = (player: RealPlayerSeed) => {
  const match = player.profileUrl?.match(/\/player\/(\d+)/)
  return match ? Number(match[1]) : null
}

export const worldPlayerKeyForIdentity = (player: RealPlayerSeed) => {
  const profileId = profileIdFor(player)
  return profileId ? 'hltv:' + profileId : 'alias:' + normalizeAlias(player.alias)
}

const identityByAlias = new Map(
  REAL_PLAYERS.map((player) => [normalizeAlias(player.alias), player] as const),
)

export const refreshWorldIdentityMetadata = (source: WorldState): WorldState => ({
  ...source,
  players: Object.fromEntries(
    Object.entries(source.players).map(([key, player]) => {
      const identity = identityByAlias.get(normalizeAlias(player.alias))
      if (!identity) return [key, player]
      return [key, {
        ...player,
        realName: player.realName ?? identity.realName,
        country: player.country ?? identity.country,
        age: player.age ?? identity.age,
        role: player.role ?? identity.role,
        profileId: player.profileId ?? profileIdFor(identity),
      }]
    }),
  ),
})

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

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

const ratingForIdentity = (identity: RealPlayerSeed, teamRank: number) => {
  const hltv = cardStatsForAlias(identity.alias, identity.role)
  if (hltv) return hltv.ovr
  if (identity.rating != null) return clamp(Math.round(59 + (identity.rating - .8) * 63), 55, 97)
  if (teamRank <= 10) return 85
  if (teamRank <= 30) return 79
  if (teamRank <= 75) return 72
  return 66
}

const createWorldPlayer = (
  identity: RealPlayerSeed,
  teamId: string | null,
  teamRank: number,
): WorldPlayer => {
  const key = worldPlayerKeyForIdentity(identity)
  const rng = mulberry32(hashSeed('world-player:' + key))
  const baseRating = ratingForIdentity(identity, teamRank)
  return {
    key,
    alias: identity.alias,
    realName: identity.realName,
    country: identity.country,
    age: identity.age,
    role: identity.role,
    profileId: profileIdFor(identity),
    teamId,
    baseRating,
    currentRating: baseRating,
    form: Math.round(48 + rng() * 30),
    morale: Math.round(55 + rng() * 28),
    fatigue: Math.round(rng() * 14),
    contractWeeks: Math.round(8 + rng() * 28),
  }
}

const effectivePlayerRating = (player: WorldPlayer) =>
  player.currentRating + (player.form - 50) * .05 + (player.morale - 50) * .025 - player.fatigue * .035

export const worldTeamRating = (world: WorldState, team: WorldTeam) => {
  const lineup = team.rosterKeys
    .map((key) => world.players[key])
    .filter((player): player is WorldPlayer => Boolean(player))
    .sort((a, b) => effectivePlayerRating(b) - effectivePlayerRating(a))
    .slice(0, 5)
  if (!lineup.length) return 45
  return Math.round(clamp(lineup.reduce((sum, player) => sum + effectivePlayerRating(player), 0) / lineup.length, 45, 99))
}

const syncTeamRatings = (world: WorldState): WorldState => {
  const shell = { ...world, teams: world.teams.map((team) => ({ ...team })) }
  shell.teams = shell.teams.map((team) => ({
    ...team,
    rating: worldTeamRating(shell, team),
    form: Math.round(
      team.rosterKeys
        .map((key) => shell.players[key]?.form ?? 50)
        .reduce((sum, value) => sum + value, 0) / Math.max(1, team.rosterKeys.length),
    ),
  }))
  return shell
}

export const createWorldState = (): WorldState => {
  const players: Record<string, WorldPlayer> = {}
  const teams: WorldTeam[] = []
  const assigned = new Set<string>()

  for (const roster of VRS_RANKED_ROSTERS) {
    const teamId = 'vrs-' + slug(roster.name) + '-' + roster.rank
    const rosterKeys: string[] = []

    for (const alias of roster.roster) {
      const identity = identityByAlias.get(normalizeAlias(alias))
      if (!identity) continue
      const key = worldPlayerKeyForIdentity(identity)
      if (assigned.has(key)) continue

      assigned.add(key)
      rosterKeys.push(key)
      players[key] = createWorldPlayer(identity, teamId, roster.rank)
    }

    // A player may appear in several VRS roster snapshots. Fill the later team
    // from a same-team identity when one exists, but never duplicate ownership.
    if (rosterKeys.length < 5) {
      for (const identity of REAL_PLAYERS) {
        if (identity.team !== roster.name) continue
        const key = worldPlayerKeyForIdentity(identity)
        if (assigned.has(key)) continue
        assigned.add(key)
        rosterKeys.push(key)
        players[key] = createWorldPlayer(identity, teamId, roster.rank)
        if (rosterKeys.length >= 5) break
      }
    }

    if (rosterKeys.length >= 5) {
      teams.push({
        id: teamId,
        name: roster.name,
        vrsRank: roster.rank,
        vrsPoints: roster.points,
        rosterKeys: rosterKeys.slice(0, 5),
        rating: 0,
        form: 50,
      })
      continue
    }

    // Teams that cannot produce a unique five are excluded from the competitive
    // world and their players become free agents instead of being duplicated.
    for (const key of rosterKeys) {
      if (players[key]) players[key] = { ...players[key], teamId: null }
    }
  }

  for (const identity of REAL_PLAYERS) {
    const key = worldPlayerKeyForIdentity(identity)
    if (players[key]) continue
    players[key] = createWorldPlayer(identity, null, identity.vrsRank ?? 401)
  }

  const world: WorldState = {
    version: WORLD_VERSION,
    snapshotDate: VRS_SNAPSHOT_DATE,
    weeksSimulated: 0,
    players,
    teams,
    freeAgentKeys: Object.values(players).filter((player) => !player.teamId).map((player) => player.key),
    transferHistory: [],
  }

  return syncTeamRatings(world)
}

export const worldTeamById = (world: WorldState, teamId: string | null | undefined) =>
  teamId ? world.teams.find((team) => team.id === teamId) ?? null : null

export const worldTeamForPlayer = (world: WorldState, playerKey: string | null | undefined) => {
  if (!playerKey) return null
  const player = world.players[playerKey]
  return player?.teamId ? worldTeamById(world, player.teamId) : null
}

export const worldPlayerByAlias = (world: WorldState, alias: string) =>
  Object.values(world.players).find((player) => normalizeAlias(player.alias) === normalizeAlias(alias)) ?? null

export const awardWorldTeamVrs = (world: WorldState, teamId: string | null | undefined, delta: number): WorldState => {
  if (!teamId || delta === 0) return world
  return {
    ...world,
    teams: world.teams.map((team) =>
      team.id === teamId
        ? { ...team, vrsPoints: Math.max(0, Math.round(team.vrsPoints + delta)) }
        : team,
    ),
  }
}

export const worldVrsStandings = (
  world: WorldState,
  clubPoints: number,
  clubRoster: ReadonlyArray<{ alias: string }>,
): VrsStanding[] => {
  const rows = [
    ...world.teams.map((team) => ({
      teamId: team.id,
      name: team.name,
      points: Math.max(0, Math.round(team.vrsPoints)),
      isPlayer: false,
      roster: worldLineup(world, team.id).map((player) => player.alias),
    })),
    {
      teamId: PLAYER_CLUB_WORLD_ID,
      name: 'YOUR CLUB',
      points: Math.max(0, Math.round(clubPoints)),
      isPlayer: true,
      roster: clubRoster.slice(0, 5).map((player) => player.alias),
    },
  ]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'en-US'))

  return rows.map((row, index) => ({ ...row, rank: index + 1 }))
}

export const worldLineup = (world: WorldState, teamId: string) => {
  const team = worldTeamById(world, teamId)
  if (!team) return []
  return team.rosterKeys
    .map((key) => world.players[key])
    .filter((player): player is WorldPlayer => Boolean(player))
    .sort((a, b) => effectivePlayerRating(b) - effectivePlayerRating(a))
    .slice(0, 5)
}

const removeFromAllTeams = (world: WorldState, playerKey: string) => ({
  ...world,
  teams: world.teams.map((team) =>
    team.rosterKeys.includes(playerKey)
      ? { ...team, rosterKeys: team.rosterKeys.filter((key) => key !== playerKey) }
      : team,
  ),
})

const uniqueFreeAgents = (world: WorldState) => [
  ...new Set(
    Object.values(world.players)
      .filter((player) => !player.teamId)
      .map((player) => player.key),
  ),
]

const refillTeam = (world: WorldState, teamId: string, seed: number): WorldState => {
  const team = worldTeamById(world, teamId)
  if (!team || team.rosterKeys.length >= 5) return world

  const rng = mulberry32(seed)
  const needed = 5 - team.rosterKeys.length
  const free = uniqueFreeAgents(world)
    .map((key) => world.players[key])
    .filter((player): player is WorldPlayer => Boolean(player) && player.teamId == null)
    .sort((a, b) => {
      const jitterA = (hashSeed(a.key + ':' + seed) % 100) / 100
      const jitterB = (hashSeed(b.key + ':' + seed) % 100) / 100
      return (effectivePlayerRating(b) + jitterB * 4) - (effectivePlayerRating(a) + jitterA * 4)
    })

  const candidates = free.slice(0, Math.max(needed, 18))
  const chosen: WorldPlayer[] = []
  while (chosen.length < needed && candidates.length) {
    const index = Math.floor(rng() * candidates.length)
    chosen.push(candidates.splice(index, 1)[0])
  }
  if (!chosen.length) return world

  const players = { ...world.players }
  for (const player of chosen) players[player.key] = { ...player, teamId, morale: clamp(player.morale + 4) }

  const teams = world.teams.map((candidate) =>
    candidate.id === teamId
      ? { ...candidate, rosterKeys: [...candidate.rosterKeys, ...chosen.map((player) => player.key)].slice(0, 5) }
      : candidate,
  )

  return syncTeamRatings({
    ...world,
    players,
    teams,
    freeAgentKeys: uniqueFreeAgents({ ...world, players, teams }),
  })
}

export const claimWorldPlayersForClub = (
  source: WorldState,
  playerKeys: readonly string[],
  date: string,
  seed = 0,
): WorldState => {
  let world = source
  const history = [...world.transferHistory]

  playerKeys.forEach((rawKey, index) => {
    const fallback = rawKey.startsWith('alias:')
      ? worldPlayerByAlias(world, rawKey.slice('alias:'.length))
      : null
    const player = world.players[rawKey] ?? fallback
    if (!player || player.teamId === PLAYER_CLUB_WORLD_ID) return

    const fromTeamId = player.teamId
    world = removeFromAllTeams(world, player.key)
    world = {
      ...world,
      players: {
        ...world.players,
        [player.key]: {
          ...player,
          teamId: PLAYER_CLUB_WORLD_ID,
          morale: clamp(player.morale + 5),
          fatigue: Math.max(0, player.fatigue - 2),
        },
      },
    }

    history.unshift({
      id: 'club-sign-' + player.key + '-' + date,
      date,
      playerKey: player.key,
      alias: player.alias,
      fromTeamId,
      toTeamId: PLAYER_CLUB_WORLD_ID,
      kind: 'club-signing',
    })

    if (fromTeamId) world = refillTeam(world, fromTeamId, seed + index + hashSeed(player.key))
  })

  return syncTeamRatings({
    ...world,
    freeAgentKeys: uniqueFreeAgents(world),
    transferHistory: history.slice(0, 120),
  })
}

export const releaseWorldPlayerFromClub = (
  source: WorldState,
  playerKey: string | undefined,
  alias: string,
  date: string,
): WorldState => {
  const player = (playerKey ? source.players[playerKey] : null) ?? worldPlayerByAlias(source, alias)
  if (!player || player.teamId !== PLAYER_CLUB_WORLD_ID) return source

  const players = {
    ...source.players,
    [player.key]: { ...player, teamId: null, morale: clamp(player.morale - 4), fatigue: Math.max(0, player.fatigue - 4) },
  }
  const world = {
    ...source,
    players,
    freeAgentKeys: [...new Set([...source.freeAgentKeys, player.key])],
    transferHistory: [{
      id: 'club-release-' + player.key + '-' + date,
      date,
      playerKey: player.key,
      alias: player.alias,
      fromTeamId: PLAYER_CLUB_WORLD_ID,
      toTeamId: null,
      kind: 'club-release' as const,
    }, ...source.transferHistory].slice(0, 120),
  }
  return syncTeamRatings(world)
}

const simulateAiTransfer = (source: WorldState, seed: number, date: string): WorldState => {
  const rng = mulberry32(seed)
  if (rng() > .48 || source.teams.length < 8) return source

  const buyerPool = source.teams.filter((team) => team.rosterKeys.length >= 5)
  if (!buyerPool.length) return source
  const buyer = buyerPool[Math.floor(rng() * Math.min(40, buyerPool.length))]
  const sellerPool = source.teams.filter((team) =>
    team.id !== buyer.id &&
    team.rosterKeys.length >= 5 &&
    team.vrsRank > Math.max(1, buyer.vrsRank - 8),
  )
  if (!sellerPool.length) return source
  const seller = sellerPool[Math.floor(rng() * sellerPool.length)]

  const sellerPlayers = worldLineup(source, seller.id)
    .filter((player) => player.teamId === seller.id)
    .sort((a, b) => effectivePlayerRating(b) - effectivePlayerRating(a))
  const candidate = sellerPlayers[Math.min(sellerPlayers.length - 1, Math.floor(rng() * Math.min(3, sellerPlayers.length)))]
  if (!candidate) return source

  const buyerPlayers = worldLineup(source, buyer.id)
    .sort((a, b) => effectivePlayerRating(a) - effectivePlayerRating(b))
  const released = buyerPlayers[0]
  if (!released || released.key === candidate.key) return source

  const players = { ...source.players }
  players[candidate.key] = { ...candidate, teamId: buyer.id, morale: clamp(candidate.morale + 5), contractWeeks: 16 + Math.floor(rng() * 18) }
  players[released.key] = { ...released, teamId: null, morale: clamp(released.morale - 5) }

  const teams = source.teams.map((team) => {
    if (team.id === seller.id) return { ...team, rosterKeys: team.rosterKeys.filter((key) => key !== candidate.key) }
    if (team.id === buyer.id) {
      return {
        ...team,
        rosterKeys: [...team.rosterKeys.filter((key) => key !== released.key), candidate.key].slice(0, 5),
      }
    }
    return team
  })

  const transfer: WorldTransfer = {
    id: 'ai-transfer-' + candidate.key + '-' + date,
    date,
    playerKey: candidate.key,
    alias: candidate.alias,
    fromTeamId: seller.id,
    toTeamId: buyer.id,
    kind: 'ai-transfer',
  }
  const freeAgentMove: WorldTransfer = {
    id: 'ai-release-' + released.key + '-' + date,
    date,
    playerKey: released.key,
    alias: released.alias,
    fromTeamId: buyer.id,
    toTeamId: null,
    kind: 'ai-free-agent',
  }

  let world: WorldState = {
    ...source,
    players,
    teams,
    freeAgentKeys: uniqueFreeAgents({ ...source, players, teams }),
    transferHistory: [transfer, freeAgentMove, ...source.transferHistory].slice(0, 120),
  }

  world = refillTeam(world, seller.id, seed ^ 0x7f4a7c15)
  return syncTeamRatings(world)
}

export const advanceWorldWeeks = (
  source: WorldState,
  weeks: number,
  seed: number,
  date: string,
): WorldState => {
  let world = source

  for (let step = 0; step < weeks; step += 1) {
    const weekSeed = seed + (world.weeksSimulated + 1) * 7919
    const players: Record<string, WorldPlayer> = {}
    for (const player of Object.values(world.players)) {
      const rng = mulberry32(hashSeed(player.key + ':' + weekSeed))
      const isClub = player.teamId === PLAYER_CLUB_WORLD_ID
      players[player.key] = {
        ...player,
        form: clamp(player.form + Math.round((rng() - .48) * 9)),
        morale: clamp(player.morale + Math.round((rng() - .5) * 6)),
        fatigue: isClub ? player.fatigue : clamp(player.fatigue + Math.round((rng() - .53) * 12)),
        currentRating: clamp(
          player.baseRating + Math.round((player.form - 55) * .06) + Math.round((rng() - .5) * 2),
          45,
          99,
        ),
        contractWeeks: isClub ? player.contractWeeks : Math.max(1, player.contractWeeks - 1),
      }
    }

    const teams = world.teams.map((team) => {
      const rng = mulberry32(hashSeed('vrs:' + team.id + ':' + weekSeed))
      const formSignal = (team.form - 50) * .06
      const resultSwing = (rng() - .47) * 14
      return {
        ...team,
        vrsPoints: Math.max(250, Math.round(team.vrsPoints + formSignal + resultSwing)),
      }
    })

    world = syncTeamRatings({
      ...world,
      players,
      teams,
      weeksSimulated: world.weeksSimulated + 1,
    })
    world = simulateAiTransfer(world, weekSeed, date)
  }

  return world
}

export const reconcileWorldWithClubRoster = (
  source: WorldState,
  roster: ReadonlyArray<{ playerKey?: string; alias: string }>,
  date: string,
  seed: number,
) => {
  const keys = roster.map((player) => {
    if (player.playerKey && source.players[player.playerKey]) return player.playerKey
    return worldPlayerByAlias(source, player.alias)?.key ?? player.playerKey ?? 'alias:' + normalizeAlias(player.alias)
  })
  return claimWorldPlayersForClub(source, keys, date, seed)
}
