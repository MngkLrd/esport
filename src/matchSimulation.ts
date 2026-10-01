import type { MatchResult, MatchRoundStory, Player, TacticalPlan } from './game'

export type SimSide = 'CT' | 'T'
export type SimUtility = 'smoke' | 'flash' | 'molotov'
export type SimEventType = 'shot' | 'damage' | 'kill' | 'utility' | 'plant' | 'defuse'

export interface SimPlayerFrame {
  id: string
  name: string
  side: SimSide
  x: number
  y: number
  yaw: number
  hp: number
  alive: boolean
  weapon: string
  hasBomb: boolean
}

export interface SimFrame {
  time: number
  players: SimPlayerFrame[]
}

export interface SimEvent {
  id: string
  time: number
  type: SimEventType
  actorId: string
  targetId?: string
  actorName: string
  targetName?: string
  side: SimSide
  weapon?: string
  damage?: number
  headshot?: boolean
  utility?: SimUtility
  x?: number
  y?: number
  site?: 'A' | 'B'
}

export interface SimRound {
  id: string
  map: string
  mapKey: string
  homeSide: SimSide
  scenario: string
  scenarioLabel: string
  site: 'A' | 'B'
  duration: number
  frames: SimFrame[]
  events: SimEvent[]
  winner: 'HOME' | 'AWAY'
  scoreUs?: number
  scoreThem?: number
  cause?: MatchRoundStory['cause']
  keyPlayer?: string
  keyPlayerSide?: MatchRoundStory['keyPlayerSide']
}

export interface MatchPlayback {
  rounds: SimRound[]
  totalDuration: number
}

type Point = [number, number]

interface MapProfile {
  key: string
  label: string
  tSpawn: Point
  ctSpawn: Point
  a: Point
  b: Point
  mid: Point
  aEntry: Point
  bEntry: Point
  ctA: Point
  ctB: Point
  ctMid: Point
}

const profile = (
  key: string,
  label: string,
  tSpawn: Point,
  ctSpawn: Point,
  a: Point,
  b: Point,
  midBias: Point = [0, 0],
): MapProfile => {
  const mid: Point = [
    (tSpawn[0] + ctSpawn[0]) / 2 + midBias[0],
    (tSpawn[1] + ctSpawn[1]) / 2 + midBias[1],
  ]
  const mix = (from: Point, to: Point, t: number): Point => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
  ]
  return {
    key,
    label,
    tSpawn,
    ctSpawn,
    a,
    b,
    mid,
    aEntry: mix(mid, a, .62),
    bEntry: mix(mid, b, .62),
    ctA: mix(ctSpawn, a, .68),
    ctB: mix(ctSpawn, b, .68),
    ctMid: mix(ctSpawn, mid, .58),
  }
}

// Spawn/site anchors are projected directly into the 1024×1024 radar texture.
// CS2 overview metadata provides spawn/site coordinates where available; Anubis
// bomb-site anchors are calibrated against the extracted tactical radar.
const radarPoint = (x: number, y: number): Point => [x * 1024, y * 1024]

const MAPS: Record<string, MapProfile> = {
  'Dust II': profile(
    'de_dust2', 'Dust II',
    radarPoint(.39, .91), radarPoint(.62, .21),
    radarPoint(.80, .16), radarPoint(.21, .12),
    [-18, 18],
  ),
  Mirage: profile(
    'de_mirage', 'Mirage',
    radarPoint(.87, .36), radarPoint(.28, .70),
    radarPoint(.54, .76), radarPoint(.23, .28),
    [12, -8],
  ),
  Inferno: profile(
    'de_inferno', 'Inferno',
    radarPoint(.10, .67), radarPoint(.90, .35),
    radarPoint(.81, .69), radarPoint(.49, .22),
    [-20, 10],
  ),
  Nuke: profile(
    'de_nuke', 'Nuke',
    radarPoint(.19, .54), radarPoint(.82, .45),
    radarPoint(.58, .48), radarPoint(.58, .58),
    [0, 8],
  ),
  Ancient: profile(
    'de_ancient', 'Ancient',
    radarPoint(.485, .87), radarPoint(.51, .17),
    radarPoint(.31, .25), radarPoint(.80, .40),
    [0, 0],
  ),
  Anubis: profile(
    'de_anubis', 'Anubis',
    radarPoint(.58, .93), radarPoint(.61, .22),
    radarPoint(.32, .49), radarPoint(.76, .26),
    [-12, 0],
  ),
}

const FALLBACK_MAPS = Object.values(MAPS)

const SCENARIOS: Record<TacticalPlan, string[]> = {
  aggressive: ['fast-a', 'b-rush', 'mid-crush'],
  balanced: ['default', 'a-split', 'b-split', 'mid-control'],
  structured: ['default', 'late-a', 'late-b', 'mid-control'],
}

const SCENARIO_LABELS: Record<string, string> = {
  'fast-a': 'FAST A EXECUTE',
  'b-rush': 'B RUSH',
  'mid-crush': 'MID CRUSH',
  'default': 'DEFAULT',
  'a-split': 'A SPLIT',
  'b-split': 'B SPLIT',
  'mid-control': 'MID CONTROL',
  'late-a': 'LATE A EXECUTE',
  'late-b': 'LATE B EXECUTE',
}

const hashSeed = (input: string) => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const pointLerp = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
const offset = (point: Point, dx: number, dy: number): Point => [point[0] + dx, point[1] + dy]

const mapProfileFor = (name: string, index: number) =>
  MAPS[name] ?? FALLBACK_MAPS[index % FALLBACK_MAPS.length]

const siteForScenario = (scenario: string): 'A' | 'B' =>
  scenario.includes('b') ? 'B' : scenario === 'default' ? 'A' : scenario.includes('a') ? 'A' : 'A'

const buildTRoutes = (map: MapProfile, scenario: string): Point[][] => {
  const site = siteForScenario(scenario)
  const primary = site === 'A' ? map.a : map.b
  const entry = site === 'A' ? map.aEntry : map.bEntry
  const other = site === 'A' ? map.b : map.a
  const otherEntry = site === 'A' ? map.bEntry : map.aEntry
  const fast = scenario === 'fast-a' || scenario === 'b-rush' || scenario === 'mid-crush'
  const late = scenario.startsWith('late-')
  const spread = fast ? 18 : 28

  if (scenario === 'mid-control' || scenario === 'mid-crush') {
    return [
      [offset(map.tSpawn, -30, 20), offset(map.mid, -75, 80), offset(map.mid, -15, 20), offset(primary, -55, 45), primary],
      [offset(map.tSpawn, 0, 25), offset(map.mid, -30, 95), map.mid, offset(primary, -20, 35), offset(primary, 20, 10)],
      [offset(map.tSpawn, 30, 10), offset(map.mid, 35, 95), offset(map.mid, 45, 20), entry, offset(primary, 35, -15)],
      [offset(map.tSpawn, -55, 40), offset(otherEntry, -45, 85), otherEntry, offset(other, -20, 20), other],
      [offset(map.tSpawn, 55, 35), offset(entry, 40, 120), entry, offset(primary, 25, 30), offset(primary, -15, -10)],
    ]
  }

  return [
    [offset(map.tSpawn, -spread, 18), offset(entry, -80, late ? 165 : 110), offset(entry, -30, 45), entry, offset(primary, -22, 15), primary],
    [offset(map.tSpawn, 0, 28), offset(entry, -30, late ? 185 : 125), offset(entry, 15, 55), entry, offset(primary, 22, 18), offset(primary, 15, -10)],
    [offset(map.tSpawn, spread, 15), offset(map.mid, 10, 120), offset(map.mid, 30, 40), offset(entry, 45, 20), offset(primary, 38, -20)],
    [offset(map.tSpawn, -50, 40), offset(otherEntry, -25, 130), otherEntry, offset(other, -20, 35), other],
    [offset(map.tSpawn, 55, 35), offset(map.mid, 60, 125), offset(map.mid, 55, 35), offset(primary, 55, 45), offset(primary, -5, 20)],
  ]
}

const buildCTRoutes = (map: MapProfile, site: 'A' | 'B'): Point[][] => {
  const rotate = site === 'A' ? map.ctA : map.ctB
  return [
    [offset(map.ctSpawn, 20, -12), offset(map.ctA, 15, -35), map.ctA, offset(rotate, -25, 15), offset(rotate, 10, 15)],
    [offset(map.ctSpawn, -20, -15), offset(map.ctB, -15, -35), map.ctB, offset(rotate, 25, 20), offset(rotate, -15, 10)],
    [offset(map.ctSpawn, 0, 20), offset(map.ctMid, 15, -35), map.ctMid, pointLerp(map.ctMid, rotate, .58), rotate],
    [offset(map.ctSpawn, 45, 15), offset(map.ctA, 55, -5), offset(map.ctA, 45, 10), pointLerp(map.ctA, rotate, .72), offset(rotate, 35, -15)],
    [offset(map.ctSpawn, -45, 20), offset(map.ctB, -55, -5), offset(map.ctB, -45, 10), pointLerp(map.ctB, rotate, .72), offset(rotate, -35, -15)],
  ]
}

const positionOnPath = (path: Point[], progress: number, delay: number) => {
  const adjusted = clamp01((progress - delay) / Math.max(.05, 1 - delay))
  const eased = adjusted < .5
    ? 2 * adjusted * adjusted
    : 1 - Math.pow(-2 * adjusted + 2, 2) / 2
  const scaled = eased * (path.length - 1)
  const index = Math.min(path.length - 2, Math.max(0, Math.floor(scaled)))
  const local = scaled - index
  const a = path[index]
  const b = path[index + 1]
  const point = pointLerp(a, b, local)
  return {
    x: point[0],
    y: point[1],
    yaw: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI,
  }
}

const weaponForRole = (role: Player['role'] | null | undefined, side: SimSide, index: number) => {
  if (role === 'AWP') return 'AWP'
  if (index === 0 && side === 'T') return 'AK-47'
  return side === 'CT' ? (index % 2 === 0 ? 'M4A1-S' : 'M4A4') : 'AK-47'
}

const weaponFor = (player: Player | null, side: SimSide, index: number) =>
  weaponForRole(player?.role, side, index)

const awayNames = (result: MatchResult) => {
  const live = result.opponentRoster?.slice(0, 5).map((player) => player.alias) ?? []
  if (live.length >= 5) return live
  const stem = result.opponent.replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() || 'RIVAL'
  return [...live, ...Array.from({ length: 5 - live.length }, (_, index) => stem + '-' + (live.length + index + 1))]
}

const performanceBias = (result: MatchResult, starters: Player[]) =>
  [...starters].sort((a, b) => {
    const pa = result.performances.find((entry) => entry.alias === a.alias)?.rating ?? 50
    const pb = result.performances.find((entry) => entry.alias === b.alias)?.rating ?? 50
    return pb - pa
  })

export const homeSideForRound = (mapIndex: number, roundIndex: number): SimSide => {
  const openingSide: SimSide = mapIndex % 2 === 0 ? 'CT' : 'T'
  const oppositeSide: SimSide = openingSide === 'CT' ? 'T' : 'CT'
  if (roundIndex < 12) return openingSide
  if (roundIndex < 24) return oppositeSide

  // MR12 overtime swaps every three rounds, not every 12.
  const overtimeHalf = Math.floor((roundIndex - 24) / 3)
  return overtimeHalf % 2 === 0 ? openingSide : oppositeSide
}

const buildCombatEvents = (
  result: MatchResult,
  starters: Player[],
  homeSide: SimSide,
  roundWinner: 'HOME' | 'AWAY',
  site: 'A' | 'B',
  scoreMargin: number,
  rng: () => number,
  storyRound?: MatchRoundStory,
): SimEvent[] => {
  const rankedHome = performanceBias(result, starters)
  const homeIds = starters.slice(0, 5).map((player) => player.id)
  const rankedHomeIds = rankedHome.map((player) => player.id)
  const homeNames = new Map(starters.map((player) => [player.id, player.alias]))
  const rivalNames = awayNames(result)
  const awayIds = rivalNames.map((_, index) => 'away-' + index)
  let winningIds = roundWinner === 'HOME' ? [...rankedHomeIds] : [...awayIds]
  let losingIds = roundWinner === 'HOME' ? [...awayIds] : [...rankedHomeIds].reverse()
  const homeIdForAlias = (alias?: string) => alias
    ? starters.find((player) => player.alias === alias)?.id
    : undefined
  const awayIdForAlias = (alias?: string) => {
    if (!alias) return undefined
    const index = rivalNames.findIndex((name) => name === alias)
    return index >= 0 ? 'away-' + index : undefined
  }
  const causalPlayerId = storyRound?.keyPlayerSide === 'US'
    ? homeIdForAlias(storyRound.keyPlayer)
    : storyRound?.keyPlayerSide === 'THEM'
      ? awayIdForAlias(storyRound.keyPlayer)
      : undefined
  const moveFirst = (ids: string[], id?: string) => {
    if (!id || !ids.includes(id)) return ids
    return [id, ...ids.filter((candidate) => candidate !== id)]
  }
  if (storyRound?.cause === 'PLAYER_ERROR') {
    losingIds = moveFirst(losingIds, causalPlayerId)
  }
  if (storyRound?.cause === 'CLUTCH') {
    winningIds = moveFirst(winningIds, causalPlayerId)
  }
  const playerName = (id: string) =>
    homeNames.get(id) ?? rivalNames[Number(id.replace('away-', ''))] ?? result.opponent
  const sideForId = (id: string): SimSide => {
    const belongsHome = !id.startsWith('away-')
    return belongsHome ? homeSide : homeSide === 'CT' ? 'T' : 'CT'
  }

  const events: SimEvent[] = []
  const normalizedMargin = Math.max(0, Math.min(12, scoreMargin))
  // Causal rounds must look like their cause, not only carry a label.
  const winnerCasualties = storyRound?.cause === 'CLUTCH' ? 3
    : storyRound?.cause === 'ANTI_STRAT' || storyRound?.cause === 'TACTICAL_EDGE' ? 1
      : storyRound?.cause === 'FATIGUE' || storyRound?.cause === 'COMMUNICATION' ? 1
        : normalizedMargin >= 8 ? 0
          : normalizedMargin >= 5 ? 1
            : normalizedMargin >= 3 ? 2 : 3
  const causalContactShift = storyRound?.cause === 'ANTI_STRAT' ? -520
    : storyRound?.cause === 'TACTICAL_EDGE' ? -320
      : storyRound?.cause === 'COMMUNICATION' ? -220
        : storyRound?.cause === 'FATIGUE' ? 180
          : storyRound?.cause === 'CLUTCH' ? 380
            : 0
  const contactBase = 3400 + causalContactShift + Math.floor(rng() * 360) + Math.max(0, 4 - normalizedMargin) * 110
  const duelStep = normalizedMargin >= 8 ? 500 : normalizedMargin >= 5 ? 610 : 720
  let duelIndex = 0
  let time = contactBase

  const addDuel = (killerId: string, victimId: string, at: number) => {
    const side = sideForId(killerId)
    const weapon = side === 'CT'
      ? (duelIndex % 4 === 2 ? 'AWP' : 'M4A1-S')
      : (duelIndex % 4 === 2 ? 'AWP' : 'AK-47')
    const headshot = rng() > .58

    events.push({
      id: 'shot-' + duelIndex,
      time: Math.max(0, at - 240),
      type: 'shot',
      actorId: killerId,
      targetId: victimId,
      actorName: playerName(killerId),
      targetName: playerName(victimId),
      side,
      weapon,
    })
    events.push({
      id: 'damage-' + duelIndex,
      time: Math.max(0, at - 130),
      type: 'damage',
      actorId: killerId,
      targetId: victimId,
      actorName: playerName(killerId),
      targetName: playerName(victimId),
      side,
      weapon,
      damage: 44 + Math.floor(rng() * 33),
    })
    events.push({
      id: 'kill-' + duelIndex,
      time: at,
      type: 'kill',
      actorId: killerId,
      targetId: victimId,
      actorName: playerName(killerId),
      targetName: playerName(victimId),
      side,
      weapon,
      headshot,
    })
    duelIndex += 1
  }

  let losingIndex = 0
  if (losingIds[losingIndex] && winningIds[0]) {
    addDuel(winningIds[0], losingIds[losingIndex], time)
    losingIndex += 1
  }

  for (
    let casualty = 0;
    casualty < winnerCasualties && losingIndex < losingIds.length;
    casualty += 1
  ) {
    const trader = losingIds[losingIndex]
    const winnerVictim = winningIds[winningIds.length - 1 - casualty]
    if (trader && winnerVictim) {
      time += Math.round(duelStep * .72)
      addDuel(trader, winnerVictim, time)
    }

    const tradeBack = winningIds[Math.min(casualty + 1, winningIds.length - 1)]
    if (tradeBack && trader) {
      time += Math.round(duelStep * .68)
      addDuel(tradeBack, trader, time)
      losingIndex += 1
    }
  }

  while (losingIndex < losingIds.length) {
    time += duelStep
    const killer = storyRound?.cause === 'CLUTCH' && causalPlayerId && winningIds.includes(causalPlayerId)
      ? causalPlayerId
      : winningIds[Math.min(losingIndex, winningIds.length - 1)] ?? winningIds[0]
    const victim = losingIds[losingIndex]
    if (killer && victim) addDuel(killer, victim, time)
    losingIndex += 1
  }

  const tSide = homeSide === 'T' ? 'HOME' : 'AWAY'
  const tIds = tSide === 'HOME' ? homeIds : awayIds
  const ctIds = tSide === 'HOME' ? awayIds : homeIds
  const tWins = roundWinner === tSide
  const plantTime = 6500
  const deadBefore = (id: string, at: number) =>
    events.some((event) => event.type === 'kill' && event.targetId === id && event.time < at)
  const bombActor = tIds.find((id) => !deadBefore(id, plantTime))
  const ctStillAlive = ctIds.some((id) => !deadBefore(id, plantTime))
  const shouldPlant = Boolean(
    bombActor &&
    ctStillAlive &&
    (tWins ? normalizedMargin < 8 || rng() > .42 : rng() > .52),
  )

  if (shouldPlant && bombActor) {
    events.push({
      id: 'plant',
      time: plantTime,
      type: 'plant',
      actorId: bombActor,
      actorName: playerName(bombActor),
      side: 'T',
      site,
    })
    if (!tWins) {
      const defuser = ctIds.find((id) => !deadBefore(id, 8350))
      if (defuser) {
        events.push({
          id: 'defuse',
          time: 8350,
          type: 'defuse',
          actorId: defuser,
          actorName: playerName(defuser),
          side: 'CT',
          site,
        })
      }
    }
  }

  return events.sort((a, b) => a.time - b.time)
}

const eventHpAt = (id: string, time: number, events: SimEvent[]) => {
  let hp = 100
  let alive = true
  for (const event of events) {
    if (event.time > time) break
    if (event.type === 'damage' && event.targetId === id) hp = Math.max(1, hp - (event.damage ?? 0))
    if (event.type === 'kill' && event.targetId === id) {
      hp = 0
      alive = false
    }
  }
  return { hp, alive }
}

const makeRound = (
  result: MatchResult,
  mapName: string,
  mapIndex: number,
  roundIndex: number,
  storyRound: MatchRoundStory | undefined,
  starters: Player[],
  tactic: TacticalPlan,
): SimRound => {
  const seed = hashSeed(result.id + ':' + mapName + ':' + mapIndex + ':' + roundIndex + ':' + tactic)
  const rng = mulberry32(seed)
  const map = mapProfileFor(mapName, mapIndex)
  const scenarioPool = storyRound?.cause === 'ANTI_STRAT' || storyRound?.cause === 'TACTICAL_EDGE'
    ? SCENARIOS.structured
    : SCENARIOS[tactic]
  const scenario = scenarioPool[Math.floor(rng() * scenarioPool.length)]
  const site = siteForScenario(scenario)
  const homeSide = homeSideForRound(mapIndex, roundIndex)
  const mapResult = result.maps[mapIndex] ?? result.maps[0]
  const winner: 'HOME' | 'AWAY' = storyRound
    ? (storyRound.winner === 'US' ? 'HOME' : 'AWAY')
    : mapResult.us > mapResult.them ? 'HOME' : 'AWAY'
  const tRoutes = buildTRoutes(map, scenario)
  const ctRoutes = buildCTRoutes(map, site)
  const homeRoutes = homeSide === 'T' ? tRoutes : ctRoutes
  const awayRoutes = homeSide === 'T' ? ctRoutes : tRoutes
  const duration = 9200
  const scoreMargin = storyRound?.cause === 'CLUTCH'
    ? 0
    : storyRound?.cause === 'ANTI_STRAT' || storyRound?.cause === 'TACTICAL_EDGE'
      ? 5
      : storyRound?.cause === 'PLAYER_ERROR'
        ? 3
        : Math.abs(mapResult.us - mapResult.them)
  const events = buildCombatEvents(result, starters, homeSide, winner, site, scoreMargin, rng, storyRound)
  const away = awayNames(result)
  const bombHome = homeSide === 'T'

  const utility: SimEvent[] = [
    {
      id: 'smoke-entry',
      time: 2450,
      type: 'utility',
      actorId: bombHome ? starters[3]?.id ?? starters[0]?.id : 'away-3',
      actorName: bombHome ? starters[3]?.alias ?? starters[0]?.alias ?? 'HOME' : away[3],
      side: 'T',
      utility: 'smoke',
      x: (site === 'A' ? map.aEntry : map.bEntry)[0],
      y: (site === 'A' ? map.aEntry : map.bEntry)[1],
    },
    {
      id: 'flash-site',
      time: 3020,
      type: 'utility',
      actorId: bombHome ? starters[2]?.id ?? starters[0]?.id : 'away-2',
      actorName: bombHome ? starters[2]?.alias ?? starters[0]?.alias ?? 'HOME' : away[2],
      side: 'T',
      utility: 'flash',
      x: (site === 'A' ? map.a : map.b)[0] + 25,
      y: (site === 'A' ? map.a : map.b)[1] + 18,
    },
    {
      id: 'molly-site',
      time: 3500,
      type: 'utility',
      actorId: bombHome ? starters[1]?.id ?? starters[0]?.id : 'away-1',
      actorName: bombHome ? starters[1]?.alias ?? starters[0]?.alias ?? 'HOME' : away[1],
      side: 'T',
      utility: 'molotov',
      x: (site === 'A' ? map.a : map.b)[0] - 28,
      y: (site === 'A' ? map.a : map.b)[1] - 14,
    },
  ]
  const allEvents = [...utility, ...events].sort((a, b) => a.time - b.time)
  const plantEvent = allEvents.find((event) => event.type === 'plant')
  const bombCarrierId = plantEvent?.actorId ?? (bombHome ? starters[0]?.id : 'away-0')

  const frames: SimFrame[] = []
  const frameStep = 100
  for (let time = 0; time <= duration; time += frameStep) {
    const progress = time / duration
    const players: SimPlayerFrame[] = []

    starters.slice(0, 5).forEach((player, index) => {
      const side = homeSide
      const path = homeRoutes[index]
      const status = eventHpAt(player.id, time, allEvents)
      const deathTime = allEvents.find((event) => event.type === 'kill' && event.targetId === player.id)?.time
      const moveProgress = deathTime ? Math.min(progress, deathTime / duration) : progress
      const pos = positionOnPath(path, moveProgress, .03 * index)
      players.push({
        id: player.id,
        name: player.alias,
        side,
        x: pos.x,
        y: pos.y,
        yaw: pos.yaw,
        hp: status.hp,
        alive: status.alive,
        weapon: weaponFor(player, side, index),
        hasBomb: bombHome && player.id === bombCarrierId && !allEvents.some((event) => event.type === 'plant' && event.time <= time),
      })
    })

    away.forEach((name, index) => {
      const id = 'away-' + index
      const side: SimSide = homeSide === 'CT' ? 'T' : 'CT'
      const path = awayRoutes[index]
      const status = eventHpAt(id, time, allEvents)
      const deathTime = allEvents.find((event) => event.type === 'kill' && event.targetId === id)?.time
      const moveProgress = deathTime ? Math.min(progress, deathTime / duration) : progress
      const pos = positionOnPath(path, moveProgress, .025 * index)
      players.push({
        id,
        name,
        side,
        x: pos.x,
        y: pos.y,
        yaw: pos.yaw,
        hp: status.hp,
        alive: status.alive,
        weapon: weaponForRole(result.opponentRoster?.[index]?.role, side, index),
        hasBomb: !bombHome && id === bombCarrierId && !allEvents.some((event) => event.type === 'plant' && event.time <= time),
      })
    })

    frames.push({ time, players })
  }

  return {
    id: result.id + '-sim-' + mapIndex + '-' + roundIndex,
    map: map.label,
    mapKey: map.key,
    homeSide,
    scenario,
    scenarioLabel: SCENARIO_LABELS[scenario] ?? scenario.toUpperCase(),
    site,
    duration,
    frames,
    events: allEvents,
    winner,
    scoreUs: storyRound?.scoreUs,
    scoreThem: storyRound?.scoreThem,
    cause: storyRound?.cause,
    keyPlayer: storyRound?.keyPlayer,
    keyPlayerSide: storyRound?.keyPlayerSide,
  }
}

export const generateMatchPlayback = (
  result: MatchResult,
  starters: Player[],
  tactic: TacticalPlan,
): MatchPlayback => {
  const rounds = result.maps.flatMap((map, mapIndex) => {
    const storyRounds = map.story?.rounds
    const finalStoryRound = storyRounds?.at(-1)
    const storyMatchesScore = Boolean(
      finalStoryRound &&
      finalStoryRound.scoreUs === map.us &&
      finalStoryRound.scoreThem === map.them,
    )
    if (!storyRounds?.length || !storyMatchesScore) {
      return [makeRound(result, map.map, mapIndex, 0, undefined, starters, tactic)]
    }
    return storyRounds.map((storyRound, roundIndex) =>
      makeRound(result, map.map, mapIndex, roundIndex, storyRound, starters, tactic),
    )
  })
  return {
    rounds,
    totalDuration: rounds.reduce((sum, round) => sum + round.duration, 0),
  }
}

export const simulationFrameAt = (round: SimRound, time: number) => {
  if (!round.frames.length) return null
  const clamped = Math.max(0, Math.min(round.duration, time))
  const rawIndex = clamped / 100
  const index = Math.min(round.frames.length - 1, Math.floor(rawIndex))
  const nextIndex = Math.min(round.frames.length - 1, index + 1)
  const a = round.frames[index]
  const b = round.frames[nextIndex]
  if (index === nextIndex) return a
  const t = rawIndex - index

  return {
    time: clamped,
    players: a.players.map((player, playerIndex) => {
      const next = b.players[playerIndex] ?? player
      return {
        ...player,
        x: lerp(player.x, next.x, t),
        y: lerp(player.y, next.y, t),
        yaw: lerp(player.yaw, next.yaw, t),
        hp: Math.round(lerp(player.hp, next.hp, t)),
        alive: player.alive && next.alive,
      }
    }),
  }
}

export const radarAssetUrl = (mapKey: string) =>
  '/esport/maps/' + mapKey + '_radar_v2.png'
