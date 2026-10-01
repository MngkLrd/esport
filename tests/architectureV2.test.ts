import { describe, expect, it } from 'vitest'
import {
  beginTransferCase,
  canonicalMatchHistory,
  createInitialState,
  defaultNegotiationTerms,
  migrateState,
  negotiateProspect,
  playMatch,
  scout,
} from '../src/game'
import { rollWelcomePack } from '../src/welcomePack'
import { applyWelcomePack } from '../src/game'
import {
  buildPlayerRatingV2,
  type RatingEvidence,
  type RatingSkillProfile,
} from '../src/ratingEngine'
import {
  createFinanceState,
  financeSummary,
  postFinanceEntry,
} from '../src/finance'
import {
  clubVrsFromEvents,
  eventsForPlayer,
  matchHistoryFromEvents,
  type ClubEvent,
} from '../src/clubEvents'
import {
  createWorldState,
  inspectWorldIntegrity,
  repairWorldIntegrity,
  PLAYER_CLUB_WORLD_ID,
} from '../src/world'

const skills: RatingSkillProfile = {
  aim: 80,
  gameSense: 76,
  utility: 67,
  clutch: 78,
  leadership: 58,
}

const evidence = (
  opponentRating: number,
  tier: RatingEvidence['tier'] = 2,
  environment: RatingEvidence['environment'] = 'ONLINE',
  count = 5,
): RatingEvidence[] =>
  Array.from({ length: count }, (_, index) => ({
    matchId: 'rating-' + opponentRating + '-' + index,
    at: '2026-10-' + String(index + 1).padStart(2, '0') + 'T19:00:00',
    performance: 82,
    opponentRating,
    tier,
    environment,
    rounds: 26,
    won: index % 2 === 0,
  }))

describe('manager architecture v2', () => {
  it('rates the same performance higher when it is proven against stronger opposition', () => {
    const weak = buildPlayerRatingV2(skills, 'Rifler', evidence(62))
    const strong = buildPlayerRatingV2(skills, 'Rifler', evidence(88))

    expect(strong.adjustedPerformance).toBeGreaterThan(weak.adjustedPerformance)
    expect(strong.rating).toBeGreaterThan(weak.rating)
    expect(strong.confidence).toBe(weak.confidence)
    expect(strong.sampleSize).toBe(weak.sampleSize)
  })

  it('tracks sample confidence stability LAN context and proven tier', () => {
    const small = buildPlayerRatingV2(skills, 'Rifler', evidence(82, 1, 'LAN', 1))
    const proven = buildPlayerRatingV2(skills, 'Rifler', evidence(82, 1, 'LAN', 4))

    expect(proven.confidence).toBeGreaterThan(small.confidence)
    expect(proven.provenTier).toBe('T1')
    expect(proven.sampleSize).toBe(104)
    expect(proven.stability).toBeGreaterThanOrEqual(20)
    expect(proven.roleAdjustment).toBeTypeOf('number')
  })

  it('keeps every monetary movement in a signed general ledger', () => {
    let finance = createFinanceState(1000)
    finance = postFinanceEntry(finance, {
      id: 'salary-1',
      at: '2026-10-01T09:00:00',
      week: 1,
      amount: -1200,
      account: 'salary',
      direction: 'expense',
      title: 'Payroll',
      description: 'Weekly payroll',
      sourceType: 'payroll',
    })
    finance = postFinanceEntry(finance, {
      id: 'sponsor-1',
      at: '2026-10-01T10:00:00',
      week: 1,
      amount: 450,
      account: 'sponsor',
      direction: 'income',
      title: 'Sponsor',
      description: 'Activation',
      sourceType: 'sponsor',
    })

    const summary = financeSummary(finance)
    expect(finance.cash).toBe(250)
    expect(summary.salary).toBe(-1200)
    expect(summary.sponsor).toBe(450)
    expect(summary.net).toBe(-750)
  })

  it('preserves a real cash deficit instead of silently deleting liabilities', () => {
    const finance = postFinanceEntry(createFinanceState(300), {
      id: 'salary-deficit',
      at: '2026-10-01T09:00:00',
      week: 1,
      amount: -900,
      account: 'salary',
      direction: 'expense',
      title: 'Payroll',
      description: 'Cash shortfall',
      sourceType: 'payroll',
    })
    expect(finance.cash).toBe(-600)
  })

  it('projects match history player timelines and VRS from one event stream', () => {
    const matchSnapshot = { id: 'm-1', opponent: 'Test' }
    const events: ClubEvent[] = [
      {
        id: 'match-1',
        at: '2026-10-01T19:00:00',
        week: 1,
        kind: 'match',
        title: 'Win',
        detail: '13:8',
        importance: 60,
        actorIds: ['p1'],
        teamIds: [PLAYER_CLUB_WORLD_ID],
        data: { matchSnapshot, vrsDelta: 12 },
      },
      {
        id: 'transfer-1',
        at: '2026-09-30T19:00:00',
        week: 1,
        kind: 'transfer',
        title: 'Signed',
        detail: 'Player joined',
        importance: 80,
        actorIds: ['p1'],
        teamIds: [PLAYER_CLUB_WORLD_ID],
      },
    ]

    expect(matchHistoryFromEvents<typeof matchSnapshot>(events)).toEqual([matchSnapshot])
    expect(eventsForPlayer(events, 'p1')).toHaveLength(2)
    expect(clubVrsFromEvents(events, 720)).toBe(732)
  })

  it('repairs duplicate team membership from canonical player ownership', () => {
    const world = createWorldState()
    const first = world.teams[0]
    const second = world.teams[1]
    const playerKey = first.rosterKeys[0]

    const corrupted = {
      ...world,
      teams: world.teams.map((team) =>
        team.id === second.id
          ? { ...team, rosterKeys: [...team.rosterKeys, playerKey] }
          : { ...team, rosterKeys: [...team.rosterKeys] },
      ),
      freeAgentKeys: [...world.freeAgentKeys, playerKey],
    }

    expect(inspectWorldIntegrity(corrupted).ok).toBe(false)
    const repaired = repairWorldIntegrity(corrupted)
    const report = inspectWorldIntegrity(repaired)

    expect(report.ok).toBe(true)
    expect(repaired.players[playerKey].teamId).toBe(first.id)
    expect(repaired.teams.find((team) => team.id === second.id)?.rosterKeys).not.toContain(playerKey)
    expect(repaired.freeAgentKeys).not.toContain(playerKey)
  })

  it('synchronizes club contracts and ownership into world state from one canonical roster', () => {
    const world = createWorldState()
    const player = Object.values(world.players).find((candidate) => candidate.teamId !== PLAYER_CLUB_WORLD_ID)!
    const repaired = repairWorldIntegrity(world, [{
      playerKey: player.key,
      alias: player.alias,
      contractWeeks: 17,
      salary: 333,
      rating: 91,
    }])

    expect(repaired.players[player.key].teamId).toBe(PLAYER_CLUB_WORLD_ID)
    expect(repaired.players[player.key].contractWeeks).toBe(17)
    expect(repaired.players[player.key].salary).toBe(333)
    expect(repaired.players[player.key].currentRating).toBe(91)
    expect(repaired.teams.every((team) => !team.rosterKeys.includes(player.key))).toBe(true)
  })

  it('records a complete transfer lifecycle and settles both sides of the transfer', () => {
    const initial = { ...createInitialState(), saveId: 'transfer-lifecycle-v2' }
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const scouted = scout(ready)
    const prospect = scouted.prospects.find((candidate) => candidate.team !== 'Free agent') ?? scouted.prospects[0]
    expect(prospect).toBeDefined()

    const opened = beginTransferCase(scouted, prospect.id)
    const sourceTeamId = opened.world.players[prospect.playerKey!]?.teamId
    const sellerCashBefore = sourceTeamId && sourceTeamId !== PLAYER_CLUB_WORLD_ID
      ? opened.world.teams.find((team) => team.id === sourceTeamId)?.cash ?? 0
      : null
    const base = defaultNegotiationTerms(prospect)
    const terms = {
      ...base,
      fee: Math.round(base.fee * 1.3),
      salary: Math.round(base.salary * 1.3),
      contractWeeks: 16,
      squadRole: 'starter' as const,
    }
    const result = negotiateProspect(opened, prospect.id, terms)

    expect(result.evaluation.accepted).toBe(true)
    const lifecycle = result.state.transferCases[0]
    expect(lifecycle.transitions.map((transition) => transition.status)).toEqual([
      'listed',
      'interest',
      'offer',
      'negotiation',
      'accepted',
      'completed',
    ])
    expect(result.state.roster.some((player) => player.playerKey === prospect.playerKey)).toBe(true)
    expect(result.state.world.players[prospect.playerKey!].teamId).toBe(PLAYER_CLUB_WORLD_ID)
    expect(result.state.finance.ledger.some((entry) => entry.account === 'transfer' && entry.sourceId === lifecycle.id)).toBe(true)
    expect(result.state.clubEvents.some((event) => event.sourceId === lifecycle.id && event.kind === 'transfer')).toBe(true)

    if (sourceTeamId && sourceTeamId !== PLAYER_CLUB_WORLD_ID) {
      const sellerCashAfter = result.state.world.teams.find((team) => team.id === sourceTeamId)?.cash ?? 0
      expect(sellerCashAfter).toBe(sellerCashBefore! + terms.fee)
    }
    expect(inspectWorldIntegrity(result.state.world).ok).toBe(true)
  })

  it('keeps rejected transfer offers in lifecycle history instead of discarding them in UI state', () => {
    const initial = { ...createInitialState(), saveId: 'transfer-rejection-v2' }
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const scouted = scout(ready)
    const prospect = scouted.prospects[0]
    const opened = beginTransferCase(scouted, prospect.id)
    const base = defaultNegotiationTerms(prospect)
    const result = negotiateProspect(opened, prospect.id, {
      ...base,
      fee: 1,
      salary: 1,
      contractWeeks: 6,
      squadRole: 'rotation',
    })

    expect(result.evaluation.accepted).toBe(false)
    expect(result.state.transferCases[0].status).toBe('rejected')
    expect(result.state.transferCases[0].transitions.map((transition) => transition.status)).toEqual([
      'listed',
      'interest',
      'offer',
      'negotiation',
      'rejected',
    ])
  })

  it('migrates existing saves into v13 finance event and transfer domains', () => {
    const legacy = createInitialState() as unknown as Record<string, unknown>
    legacy.version = 12
    delete legacy.finance
    delete legacy.clubEvents
    delete legacy.transferCases

    const migrated = migrateState(JSON.parse(JSON.stringify(legacy)))
    expect(migrated.version).toBe(13)
    expect(migrated.finance.version).toBe(1)
    expect(migrated.finance.cash).toBe(migrated.credits)
    expect(migrated.clubEvents).toEqual([])
    expect(migrated.transferCases).toEqual([])
  })

  it('feeds actual matches into rating evidence and canonical match history', () => {
    const initial = { ...createInitialState(), saveId: 'rating-match-v2' }
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const next = playMatch(ready, 'practice', 'balanced')

    expect(next.roster.filter((player) => next.startingFive.includes(player.id)).every((player) =>
      Boolean(player.ratingV2 && player.ratingV2.evidence.length === 1),
    )).toBe(true)
    expect(next.clubEvents.some((event) => event.kind === 'match' && event.data?.matchSnapshot)).toBe(true)
    expect(canonicalMatchHistory(next)[0].id).toBe(next.history[0].id)
  })
})
