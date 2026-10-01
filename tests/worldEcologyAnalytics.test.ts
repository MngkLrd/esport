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

describe('world ecology observability', () => {
  it('captures roster locks for autonomous competitions', () => {
    const world = advanceWorldEcology(createWorldState(), START, addDays(START, 160), 271828)
    const completed = Object.values(world.ecology!.competitions).filter((competition) => competition.status === 'complete')

    expect(completed.length).toBeGreaterThan(0)
    for (const competition of completed.slice(0, 6)) {
      expect(Object.keys(competition.rosterSnapshots)).toHaveLength(8)
      for (const teamId of competition.participantTeamIds) {
        expect(competition.rosterSnapshots[teamId]).toHaveLength(5)
      }
      expect(competition.matches).toHaveLength(7)
    }
  })

  it('produces measurable ecology health and keeps core invariants intact', () => {
    const world = advanceWorldEcology(createWorldState(), START, addDays(START, 365 * 2), 777331)
    const snapshot = snapshotWorldEcology(world, addDays(START, 365 * 2))
    const violations = validateWorldEcology(world)

    expect(snapshot.activeTeams).toBeGreaterThan(10)
    expect(snapshot.activePlayers).toBeGreaterThan(snapshot.activeTeams * 5)
    expect(snapshot.activeOperators).toBeGreaterThan(0)
    expect(snapshot.completedEvents).toBeGreaterThan(5)
    expect(snapshot.sponsorLiquidity).toBeGreaterThanOrEqual(0)
    expect(snapshot.sponsorLiquidity).toBeLessThanOrEqual(100)
    expect(snapshot.clubCashGini).toBeGreaterThanOrEqual(0)
    expect(snapshot.clubCashGini).toBeLessThanOrEqual(1)
    expect(snapshot.vrsTopFiveShare).toBeGreaterThan(0)
    expect(snapshot.regions).toHaveLength(4)
    expect(violations).toEqual([])
  }, 30_000)
})
