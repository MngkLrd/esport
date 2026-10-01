import { describe, expect, it } from 'vitest'
import { createWorldState } from '../src/world'
import { advanceWorldEcology } from '../src/worldEcology'
import { snapshotWorldEcology, validateWorldEcology } from '../src/worldEcologyAnalytics'

const START = '2026-09-07T09:00:00'

const addDays = (value: string, days: number) => {
  const date = new Date(value + 'Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 19)
}

const soak = (years: number, seed: number) => {
  let world = createWorldState()
  let now = START
  const yearly = []
  for (let year = 1; year <= years; year += 1) {
    const target = addDays(now, 365)
    world = advanceWorldEcology(world, now, target, seed)
    now = target
    yearly.push(snapshotWorldEcology(world, now))
    const violations = validateWorldEcology(world)
    if (violations.length) {
      throw new Error('Ecology invariant failure at year ' + year + ': ' + JSON.stringify(violations))
    }
  }
  return { world, yearly }
}

describe('long-run world ecology soak', () => {
  it('survives twenty years across multiple seeds without collapse or explosion', () => {
    for (const seed of [271828, 424242, 987654]) {
      const { world, yearly } = soak(20, seed)
      const first = yearly[0]
      const last = yearly.at(-1)!
      const ecology = world.ecology!

      expect(last.activeTeams).toBeGreaterThanOrEqual(Math.floor(first.activeTeams * .55))
      expect(last.activeTeams).toBeLessThanOrEqual(ecology.carryingCapacityTeams + 8)
      expect(last.activePlayers).toBeGreaterThan(last.activeTeams * 5)
      expect(last.activeOperators).toBeGreaterThan(0)
      expect(last.completedEvents).toBeGreaterThan(first.completedEvents)
      expect(last.sponsorLiquidity).toBeGreaterThanOrEqual(20)
      expect(last.sponsorLiquidity).toBeLessThanOrEqual(100)
      expect(last.vrsTopFiveShare).toBeLessThan(.75)
      expect(last.clubCashGini).toBeLessThan(.92)
    }
  }, 180_000)

  it('keeps reproducing the ecosystem over a one-hundred-year horizon', () => {
    const { world, yearly } = soak(100, 1357911)
    const last = yearly.at(-1)!
    const ecology = world.ecology!

    expect(ecology.metrics.generatedPlayers).toBeGreaterThan(0)
    expect(ecology.metrics.retiredPlayers).toBeGreaterThan(0)
    expect(last.activeTeams).toBeGreaterThan(8)
    expect(last.activePlayers).toBeGreaterThan(last.activeTeams * 5)
    expect(last.activeOperators).toBeGreaterThan(0)
    expect(last.completedEvents).toBeGreaterThan(100)
    expect(last.generatedPlayers).toBeGreaterThan(0)
  }, 600_000)
})
