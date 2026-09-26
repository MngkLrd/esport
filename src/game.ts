export type Role = 'IGL' | 'Entry' | 'Rifler' | 'AWP' | 'Support'
export type MatchMode = 'scrim' | 'showmatch' | 'cup'

export interface Player {
  id: string
  alias: string
  firstName: string
  age: number
  role: Role
  aim: number
  gameSense: number
  utility: number
  clutch: number
  leadership: number
  form: number
  morale: number
  fatigue: number
  potential: number
  salary: number
  contractWeeks: number
  traits: string[]
  bio: string
}

export interface MapResult {
  map: string
  us: number
  them: number
}

export interface MatchResult {
  id: string
  week: number
  mode: MatchMode
  opponent: string
  opponentRating: number
  won: boolean
  maps: MapResult[]
  reward: number
  fansDelta: number
  headline: string
  detail: string
  mvp: string
}

export interface NewsItem {
  id: string
  week: number
  kind: 'match' | 'media' | 'contract' | 'scout'
  title: string
  body: string
}

export interface GameState {
  version: 1
  seed: number
  week: number
  credits: number
  fans: number
  reputation: number
  wins: number
  losses: number
  streak: number
  seasonPoints: number
  staffEnergy: number
  roster: Player[]
  prospects: Player[]
  scoutCycle: number
  history: MatchResult[]
  news: NewsItem[]
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

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

const pick = <T,>(items: readonly T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)]

export const overall = (p: Player) =>
  Math.round(
    p.aim * 0.31 +
      p.gameSense * 0.24 +
      p.utility * 0.15 +
      p.clutch * 0.15 +
      p.leadership * 0.15,
  )

export const chemistry = (roster: Player[]) => {
  const active = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5)
  const roles = new Set(active.map((p) => p.role)).size
  const morale = active.reduce((sum, p) => sum + p.morale, 0) / active.length
  const leadership = active.reduce((sum, p) => sum + p.leadership, 0) / active.length
  return Math.round(clamp(44 + roles * 6 + morale * 0.18 + leadership * 0.12))
}

export const teamRating = (roster: Player[]) => {
  const active = [...roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5)
  const raw =
    active.reduce((sum, p) => {
      const condition = (p.form - 50) * 0.08 + (p.morale - 50) * 0.05 - p.fatigue * 0.06
      return sum + overall(p) + condition
    }, 0) / active.length
  return Math.round(clamp(raw * 0.88 + chemistry(active) * 0.12))
}

const initialRoster: Player[] = [
  {
    id: 'p-volt',
    alias: 'VOLT',
    firstName: 'Mika',
    age: 20,
    role: 'Entry',
    aim: 78,
    gameSense: 65,
    utility: 55,
    clutch: 63,
    leadership: 48,
    form: 68,
    morale: 74,
    fatigue: 12,
    potential: 90,
    salary: 240,
    contractWeeks: 8,
    traits: ['Fearless', 'Momentum'],
    bio: 'Explosive opener. Plays better when the team is on a streak.',
  },
  {
    id: 'p-orbit',
    alias: 'ORBIT',
    firstName: 'Noah',
    age: 23,
    role: 'IGL',
    aim: 62,
    gameSense: 82,
    utility: 79,
    clutch: 69,
    leadership: 88,
    form: 61,
    morale: 70,
    fatigue: 8,
    potential: 82,
    salary: 280,
    contractWeeks: 10,
    traits: ['Caller', 'Calm'],
    bio: 'Methodical in-game leader who stabilizes morale after bad maps.',
  },
  {
    id: 'p-kite',
    alias: 'KITE',
    firstName: 'Ilya',
    age: 19,
    role: 'AWP',
    aim: 82,
    gameSense: 70,
    utility: 44,
    clutch: 76,
    leadership: 41,
    form: 72,
    morale: 66,
    fatigue: 15,
    potential: 94,
    salary: 310,
    contractWeeks: 7,
    traits: ['Prodigy', 'High variance'],
    bio: 'High-ceiling sniper. Brilliant on confidence, volatile under pressure.',
  },
  {
    id: 'p-moss',
    alias: 'MOSS',
    firstName: 'Theo',
    age: 25,
    role: 'Support',
    aim: 58,
    gameSense: 76,
    utility: 86,
    clutch: 61,
    leadership: 73,
    form: 59,
    morale: 78,
    fatigue: 5,
    potential: 76,
    salary: 210,
    contractWeeks: 12,
    traits: ['Glue player', 'Utility nerd'],
    bio: 'Low-ego support who quietly raises the floor of every lineup.',
  },
  {
    id: 'p-rune',
    alias: 'RUNE',
    firstName: 'Emil',
    age: 22,
    role: 'Rifler',
    aim: 73,
    gameSense: 72,
    utility: 64,
    clutch: 74,
    leadership: 58,
    form: 64,
    morale: 69,
    fatigue: 10,
    potential: 85,
    salary: 250,
    contractWeeks: 9,
    traits: ['Closer', 'Flexible'],
    bio: 'Reliable rifler with strong late-round instincts.',
  },
]

export const createInitialState = (): GameState => ({
  version: 1,
  seed: 271828,
  week: 1,
  credits: 2200,
  fans: 340,
  reputation: 38,
  wins: 0,
  losses: 0,
  streak: 0,
  seasonPoints: 0,
  staffEnergy: 2,
  roster: initialRoster.map((p) => ({ ...p, traits: [...p.traits] })),
  prospects: [],
  scoutCycle: 0,
  history: [],
  news: [
    {
      id: 'welcome',
      week: 1,
      kind: 'media',
      title: 'A new project enters the circuit',
      body: 'You have eight weeks to turn a raw five-player roster into a credible contender. The simulation is deterministic; the story layer interprets what happened.',
    },
  ],
})

const opponentNames = [
  'Northstar',
  'Red Static',
  'Morrow Five',
  'Pixel Union',
  'Zero Hour',
  'Nightshift',
  'Kinetic',
  'Blackbird',
] as const

const mapPool = ['Foundry', 'Harbor', 'Citadel', 'Metro', 'Rift', 'Archive'] as const

const modeTuning: Record<MatchMode, { difficulty: number; baseReward: number; fans: number; label: string }> = {
  scrim: { difficulty: -5, baseReward: 180, fans: 25, label: 'Practice circuit' },
  showmatch: { difficulty: 1, baseReward: 320, fans: 70, label: 'Community showmatch' },
  cup: { difficulty: 7, baseReward: 650, fans: 150, label: 'Online cup' },
}

const generateOpponent = (state: GameState, mode: MatchMode, rng: () => number) => {
  const tune = modeTuning[mode]
  const rating = Math.round(clamp(54 + state.reputation * 0.42 + tune.difficulty + (rng() - 0.5) * 10, 48, 94))
  return { name: pick(opponentNames, rng), rating }
}

const mapScore = (won: boolean, rng: () => number): [number, number] => {
  const loser = Math.floor(5 + rng() * 7)
  return won ? [13, loser] : [loser, 13]
}

const narrative = (
  state: GameState,
  opponent: string,
  won: boolean,
  mvp: Player,
  mode: MatchMode,
  rng: () => number,
) => {
  const winHeads = [
    mvp.alias + ' bends the series around a fearless mid-round call',
    'The project finds an identity under pressure',
    'Discipline beats noise in a statement series',
  ]
  const lossHeads = [
    'Promising ideas collapse in the late rounds',
    'The roster leaves answers on the server',
    'Pressure exposes a gap between talent and structure',
  ]
  const winDetails = [
    'Analysts highlighted the team\'s spacing and composure. ' + mvp.alias + ' became the face of the result, but the staff credited preparation rather than heroics.',
    'The win over ' + opponent + ' lifts belief inside the room. The next decision is whether to protect momentum or spend it on harder opposition.',
    'The series created a small wave of attention. Fans are beginning to recognize a style rather than five individual players.',
  ]
  const lossDetails = [
    'The defeat to ' + opponent + ' was competitive, but fatigue and confidence became visible after the first map. The roster needs a response, not a panic move.',
    mvp.alias + ' produced enough individual value to keep the match close. The staff now has to decide whether the problem is preparation, roles or simply variance.',
    'The loss slows reputation growth. It also creates useful information: the current five can compete, but not yet control difficult series.',
  ]
  return {
    headline: pick(won ? winHeads : lossHeads, rng),
    detail: pick(won ? winDetails : lossDetails, rng) + ' Mode: ' + modeTuning[mode].label + '.',
  }
}

export const playMatch = (state: GameState, mode: MatchMode): GameState => {
  const rng = mulberry32(hashSeed([state.seed, state.week, state.history.length, mode].join(':')))
  const opponent = generateOpponent(state, mode, rng)
  const ourRating = teamRating(state.roster)
  const probability = 1 / (1 + Math.exp((opponent.rating - ourRating) / 7.5))
  const maps: MapResult[] = []
  let ourMaps = 0
  let theirMaps = 0

  while (ourMaps < 2 && theirMaps < 2) {
    const map = pick(mapPool.filter((name) => !maps.some((m) => m.map === name)), rng)
    const wonMap = rng() < probability
    const [us, them] = mapScore(wonMap, rng)
    maps.push({ map, us, them })
    if (wonMap) ourMaps += 1
    else theirMaps += 1
  }

  const won = ourMaps > theirMaps
  const active = [...state.roster].sort((a, b) => overall(b) - overall(a)).slice(0, 5)
  const mvp = [...active].sort(
    (a, b) => overall(b) + b.form * rng() * 0.08 - (overall(a) + a.form * rng() * 0.08),
  )[0]
  const tune = modeTuning[mode]
  const reward = Math.round(tune.baseReward * (won ? 1 : 0.35))
  const fansDelta = Math.round(tune.fans * (won ? 1 : 0.3))
  const story = narrative(state, opponent.name, won, mvp, mode, rng)

  const roster = state.roster.map((player) => {
    const played = active.some((p) => p.id === player.id)
    const formDelta = played ? (won ? 3 : -2) + Math.round((rng() - 0.5) * 3) : -1
    const moraleDelta = played ? (won ? 5 : -4) : 0
    return {
      ...player,
      form: clamp(player.form + formDelta),
      morale: clamp(player.morale + moraleDelta),
      fatigue: clamp(player.fatigue + (played ? 8 : -5)),
      contractWeeks: Math.max(0, player.contractWeeks - 1),
    }
  })

  const result: MatchResult = {
    id: 'm-' + state.week + '-' + state.history.length,
    week: state.week,
    mode,
    opponent: opponent.name,
    opponentRating: opponent.rating,
    won,
    maps,
    reward,
    fansDelta,
    headline: story.headline,
    detail: story.detail,
    mvp: mvp.alias,
  }

  const expiring = roster.filter((p) => p.contractWeeks <= 2)
  const contractNews: NewsItem[] = expiring.length
    ? [
        {
          id: 'contracts-' + state.week,
          week: state.week + 1,
          kind: 'contract',
          title: 'Contract pressure is building',
          body: expiring.map((p) => p.alias).join(', ') + ' will need a decision soon. Letting contracts hit zero hurts morale and roster stability.',
        },
      ]
    : []

  return {
    ...state,
    week: state.week + 1,
    credits: state.credits + reward,
    fans: state.fans + fansDelta,
    reputation: clamp(state.reputation + (won ? (mode === 'cup' ? 5 : 3) : -1)),
    wins: state.wins + (won ? 1 : 0),
    losses: state.losses + (won ? 0 : 1),
    streak: won ? Math.max(1, state.streak + 1) : Math.min(-1, state.streak - 1),
    seasonPoints: state.seasonPoints + (won ? (mode === 'cup' ? 5 : mode === 'showmatch' ? 3 : 1) : 0),
    staffEnergy: 2,
    roster,
    history: [result, ...state.history].slice(0, 20),
    news: [
      {
        id: 'news-' + result.id,
        week: state.week,
        kind: 'match',
        title: story.headline,
        body: story.detail,
      },
      ...contractNews,
      ...state.news,
    ].slice(0, 30),
  }
}

export const trainPlayer = (state: GameState, playerId: string): GameState => {
  if (state.staffEnergy < 1 || state.credits < 100) return state
  return {
    ...state,
    credits: state.credits - 100,
    staffEnergy: state.staffEnergy - 1,
    roster: state.roster.map((player) => {
      if (player.id !== playerId) return player
      const skills = [
        ['aim', player.aim],
        ['gameSense', player.gameSense],
        ['utility', player.utility],
        ['clutch', player.clutch],
      ] as const
      const weakest = [...skills].sort((a, b) => a[1] - b[1])[0][0]
      return {
        ...player,
        [weakest]: clamp(player[weakest] + 1),
        form: clamp(player.form + 2),
        morale: clamp(player.morale + 2),
        fatigue: clamp(player.fatigue + 6),
      }
    }),
  }
}

export const restPlayer = (state: GameState, playerId: string): GameState => {
  if (state.staffEnergy < 1) return state
  return {
    ...state,
    staffEnergy: state.staffEnergy - 1,
    roster: state.roster.map((player) =>
      player.id === playerId
        ? { ...player, fatigue: clamp(player.fatigue - 18), morale: clamp(player.morale + 1) }
        : player,
    ),
  }
}

const aliases = ['NOVA', 'ECHO', 'SABLE', 'HEX', 'VEX', 'FROST', 'LUX', 'TRACE', 'EMBER', 'AXIS'] as const
const names = ['Alex', 'Milan', 'Leo', 'Dani', 'Niko', 'Sam', 'Robin', 'Kai', 'Max', 'Ari'] as const
const roles: Role[] = ['IGL', 'Entry', 'Rifler', 'AWP', 'Support']
const traits = ['Raw aim', 'Student of the game', 'Big-stage nerve', 'Workhorse', 'Creative caller', 'Late-round instinct'] as const

const makeProspect = (state: GameState, index: number, rng: () => number): Player => {
  const base = Math.round(55 + state.reputation * 0.22 + rng() * 13)
  const role = pick(roles, rng)
  const alias = pick(aliases, rng) + Math.floor(rng() * 90 + 10)
  return {
    id: 'prospect-' + state.scoutCycle + '-' + index + '-' + alias,
    alias,
    firstName: pick(names, rng),
    age: Math.floor(18 + rng() * 8),
    role,
    aim: clamp(base + Math.round((rng() - 0.5) * 14)),
    gameSense: clamp(base + Math.round((rng() - 0.5) * 14)),
    utility: clamp(base + Math.round((rng() - 0.5) * 14)),
    clutch: clamp(base + Math.round((rng() - 0.5) * 14)),
    leadership: clamp(base + Math.round((rng() - 0.5) * 14)),
    form: Math.round(48 + rng() * 25),
    morale: Math.round(55 + rng() * 30),
    fatigue: Math.round(rng() * 12),
    potential: clamp(base + 15 + Math.round(rng() * 15)),
    salary: Math.round(140 + base * 2.1),
    contractWeeks: 8,
    traits: [pick(traits, rng), pick(traits, rng)],
    bio: 'Scouting model flags a ' + role + ' profile with uncertain ceiling. The numbers are known; the personality story is generated from those numbers.',
  }
}

export const scout = (state: GameState): GameState => {
  if (state.credits < 300) return state
  const rng = mulberry32(hashSeed([state.seed, 'scout', state.scoutCycle, state.week].join(':')))
  const prospects = [0, 1, 2].map((index) => makeProspect(state, index, rng))
  return {
    ...state,
    credits: state.credits - 300,
    scoutCycle: state.scoutCycle + 1,
    prospects,
    news: [
      {
        id: 'scout-' + state.scoutCycle,
        week: state.week,
        kind: 'scout',
        title: 'Scouting report delivered',
        body: 'Three generated prospects are available. Their ratings are deterministic; their presentation is narrative.',
      },
      ...state.news,
    ],
  }
}

export const signProspect = (state: GameState, playerId: string): GameState => {
  if (state.roster.length >= 7) return state
  const prospect = state.prospects.find((p) => p.id === playerId)
  if (!prospect) return state
  const fee = prospect.salary * 3
  if (state.credits < fee) return state
  return {
    ...state,
    credits: state.credits - fee,
    roster: [...state.roster, { ...prospect, contractWeeks: 10, morale: clamp(prospect.morale + 5) }],
    prospects: state.prospects.filter((p) => p.id !== playerId),
    news: [
      {
        id: 'sign-' + playerId,
        week: state.week,
        kind: 'contract',
        title: prospect.alias + ' joins the project',
        body: 'The signing adds depth and creates competition for roles. Fee: ' + fee + ' credits.',
      },
      ...state.news,
    ],
  }
}

export const renewContract = (state: GameState, playerId: string): GameState => {
  const player = state.roster.find((p) => p.id === playerId)
  if (!player) return state
  const cost = player.salary * 2
  if (state.credits < cost) return state
  return {
    ...state,
    credits: state.credits - cost,
    roster: state.roster.map((p) =>
      p.id === playerId ? { ...p, contractWeeks: p.contractWeeks + 6, morale: clamp(p.morale + 3) } : p,
    ),
  }
}

export const modeInfo: Record<MatchMode, { name: string; description: string; risk: string }> = {
  scrim: {
    name: 'Practice Mix',
    description: 'Lower pressure. Build form and earn a small operating reward.',
    risk: 'Low',
  },
  showmatch: {
    name: 'Community Showmatch',
    description: 'Public match with better fan growth and balanced opposition.',
    risk: 'Medium',
  },
  cup: {
    name: 'Online Cup',
    description: 'Hard opposition, strong rewards and the fastest reputation path.',
    risk: 'High',
  },
}
