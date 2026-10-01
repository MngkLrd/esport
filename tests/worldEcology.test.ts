import { describe, expect, it } from 'vitest'
import { createWorldState } from '../src/world'
import { advanceWorldEcology, type WorldEcologyState } from '../src/worldEcology'

const START = '2026-09-07T09:00:00'

const addDays = (value: string, days: number) => {
  const date = new Date(value + 'Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 19)
}

const simulateInChunks = (days: number, seed = 271828) => {
  let world = createWorldState()
  let now = START
  for (let elapsed = 0; elapsed < days; elapsed += 180) {
    const target = addDays(now, Math.min(180, days - elapsed))
    world = advanceWorldEcology(world, now, target, seed)
    now = target
  }
  return world
}

describe('autonomous world ecology', () => {
  it('advances tournaments, markets and history without any user club action', () => {
    const world = advanceWorldEcology(createWorldState(), START, addDays(START, 120), 271828)
    const ecology = world.ecology!

    expect(ecology).toBeDefined()
    expect(ecology.metrics.activeOperators).toBeGreaterThanOrEqual(2)
    expect(ecology.metrics.completedCompetitions).toBeGreaterThan(0)
    expect(ecology.history.some((event) => event.kind === 'tournament-created')).toBe(true)
    expect(ecology.history.some((event) => event.kind === 'tournament-completed')).toBe(true)
    const completed = Object.values(ecology.competitions).find((competition) => competition.status === 'complete')
    expect(completed?.matches).toHaveLength(7)
    expect(completed?.matches.at(-1)?.round).toBe('final')
    expect(ecology.history.every((event) => event.causes.length > 0)).toBe(true)
    expect(ecology.scheduled.length).toBeGreaterThan(0)
  })

  it('is deterministic for the same seed and external input horizon', () => {
    const a = advanceWorldEcology(createWorldState(), START, addDays(START, 180), 424242)
    const b = advanceWorldEcology(createWorldState(), START, addDays(START, 180), 424242)

    expect(a.ecology!.history.slice(0, 80)).toEqual(b.ecology!.history.slice(0, 80))
    expect(a.ecology!.offers).toEqual(b.ecology!.offers)
    expect(a.teams.map((team) => [team.id, team.vrsPoints, team.rosterKeys])).toEqual(
      b.teams.map((team) => [team.id, team.vrsPoints, team.rosterKeys]),
    )
  })

  it('creates organizations from ecosystem opportunity rather than a spawn timer', () => {
    const world = createWorldState()
    const ecology = world.ecology! as WorldEcologyState

    // Create a genuine market gap: organizations disappear while the player pool,
    // audience and sponsor capital remain. Population review decides whether entry
    // is viable from those conditions.
    for (const team of world.teams.slice(0, 12)) {
      team.active = false
      for (const key of team.rosterKeys) {
        if (world.players[key]?.teamId === team.id) world.players[key].teamId = null
      }
      team.rosterKeys = []
    }
    ecology.carryingCapacityTeams = world.teams.length
    ecology.metrics.sponsorLiquidity = 88
    for (const operator of Object.values(ecology.operators).slice(1)) operator.active = false

    const advanced = advanceWorldEcology(world, START, addDays(START, 75), 818181)
    const events = advanced.ecology!.history

    expect(events.some((event) => event.kind === 'team-founded')).toBe(true)
    expect(events.some((event) => event.kind === 'operator-founded')).toBe(true)
  })

  it('survives a five-year unattended soak without population or competition collapse', () => {
    const initial = createWorldState()
    const initialTeams = initial.teams.length
    const world = simulateInChunks(365 * 5, 987654)
    const ecology = world.ecology!
    const activeTeams = world.teams.filter((team) => team.active !== false)
    const activePlayers = Object.values(world.players).filter((player) => !player.retiredAt)
    const rosteredKeys = new Set(activeTeams.flatMap((team) => team.rosterKeys))

    expect(activeTeams.length).toBeGreaterThanOrEqual(Math.floor(initialTeams * .65))
    expect(activePlayers.length).toBeGreaterThan(activeTeams.length * 5)
    expect(ecology.metrics.completedCompetitions).toBeGreaterThan(20)
    expect(ecology.metrics.retiredPlayers).toBeGreaterThan(0)
    expect(ecology.metrics.generatedPlayers).toBeGreaterThan(0)
    expect(ecology.metrics.activeOperators).toBeGreaterThanOrEqual(2)
    expect(ecology.metrics.sponsorLiquidity).toBeGreaterThanOrEqual(25)
    expect(ecology.metrics.sponsorLiquidity).toBeLessThanOrEqual(95)

    for (const key of rosteredKeys) {
      expect(world.players[key]).toBeDefined()
      expect(world.players[key].retiredAt).toBeFalsy()
    }
  }, 90_000)
})
