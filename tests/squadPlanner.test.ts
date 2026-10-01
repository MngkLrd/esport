import { describe, expect, it } from 'vitest'
import { LINEUP_SLOTS, type LineupSlot, type Player } from '../src/game'
import {
  buildAutoPlannerAll,
  buildAutoPlannerRole,
  plannerCandidateSecured,
  type PlannerAutoCandidate,
  type PlannerAutoContext,
} from '../src/squadPlannerAuto'

const player = (
  id: string,
  role: LineupSlot,
  power: number,
  contractWeeks = 52,
): Player => ({
  id,
  alias: id,
  firstName: id,
  realName: id,
  country: 'FI',
  team: 'Test',
  age: 24,
  role,
  aim: power,
  gameSense: power,
  utility: power,
  clutch: power,
  leadership: role === 'IGL' ? Math.min(99, power + 6) : power,
  form: 80,
  morale: 80,
  fatigue: 10,
  potential: Math.min(99, power + 5),
  salary: 100,
  contractWeeks,
  traits: [],
  bio: '',
})

const candidate = (
  id: string,
  role: LineupSlot,
  power: number,
  contractWeeks = 52,
  source: PlannerAutoCandidate['source'] = 'club',
): PlannerAutoCandidate => ({
  key: source + ':' + id,
  player: player(id, role, power, contractWeeks),
  source,
})

const now: PlannerAutoContext = { horizon: 0, seasonLength: 16, week: 4 }
const nextSeason: PlannerAutoContext = { horizon: 1, seasonLength: 16, week: 4 }

describe('squad planner auto selection', () => {
  it('assigns a unique primary to every role when enough players exist', () => {
    const candidates = LINEUP_SLOTS.flatMap((role, roleIndex) => [
      candidate(role + '-1', role, 88 - roleIndex),
      candidate(role + '-2', role, 80 - roleIndex),
      candidate(role + '-3', role, 74 - roleIndex),
    ])

    const plan = buildAutoPlannerAll(candidates, now)
    const primaries = LINEUP_SLOTS.map((role) => plan[role][0])

    expect(primaries.every(Boolean)).toBe(true)
    expect(new Set(primaries).size).toBe(LINEUP_SLOTS.length)
    expect(LINEUP_SLOTS.every((role) => plan[role].length === 3)).toBe(true)
  })

  it('prefers the exact specialist for a role over a similarly rated off-role player', () => {
    const candidates = [
      candidate('awp-specialist', 'AWP', 82),
      candidate('rifle-star', 'Rifler', 84),
      candidate('support', 'Support', 72),
    ]

    const plan = buildAutoPlannerRole(candidates, 'AWP', now)

    expect(plan[0]).toBe('club:awp-specialist')
  })

  it('does not reuse a reserved primary during local auto selection', () => {
    const candidates = [
      candidate('first-awp', 'AWP', 90),
      candidate('second-awp', 'AWP', 84),
      candidate('third-awp', 'AWP', 78),
    ]

    const plan = buildAutoPlannerRole(candidates, 'AWP', now, new Set(['club:first-awp']))

    expect(plan[0]).toBe('club:second-awp')
    expect(plan).not.toContain('club:first-awp')
  })

  it('penalizes a club player whose contract does not reach the selected horizon', () => {
    const expiring = candidate('expiring-awp', 'AWP', 94, 2)
    const secured = candidate('secured-awp', 'AWP', 82, 52)

    expect(plannerCandidateSecured(expiring, nextSeason)).toBe(false)
    expect(plannerCandidateSecured(secured, nextSeason)).toBe(true)

    const plan = buildAutoPlannerRole([expiring, secured], 'AWP', nextSeason)

    expect(plan[0]).toBe('club:secured-awp')
  })

  it('fills scarce plans without duplicating a player inside the same role', () => {
    const candidates = [
      candidate('one', 'Rifler', 82),
      candidate('two', 'Support', 80),
    ]

    const plan = buildAutoPlannerRole(candidates, 'Entry', now)

    expect(plan).toHaveLength(2)
    expect(new Set(plan).size).toBe(plan.length)
  })
})
