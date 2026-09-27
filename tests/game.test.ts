import { describe, expect, it } from 'vitest'
import {
  applyWelcomePack,
  canPlayMatch,
  createInitialState,
  migrateState,
  playMatch,
  startNextSeason,
} from '../src/game'
import { rollWelcomePack } from '../src/welcomePack'
import { executeGameCommand } from '../src/gameCommands'

describe('P0 career flow', () => {
  it('starts empty and creates one deterministic playable five from welcome cards', () => {
    const initial = createInitialState()
    expect(initial.roster).toHaveLength(0)
    expect(initial.startingFive).toHaveLength(0)
    expect(initial.welcomeComplete).toBe(false)

    const cardsA = rollWelcomePack(initial.saveId)
    const cardsB = rollWelcomePack(initial.saveId)
    expect(cardsA).toEqual(cardsB)
    expect(cardsA).toHaveLength(5)
    expect(new Set(cardsA.map((card) => card.alias.toLocaleLowerCase('en-US'))).size).toBe(5)
    expect(new Set(cardsA.map((card) => card.role)).size).toBe(5)

    const ready = applyWelcomePack(initial, cardsA)
    expect(ready.welcomeComplete).toBe(true)
    expect(ready.roster).toHaveLength(5)
    expect(ready.startingFive).toHaveLength(5)
    expect(ready.roster.every((player) => player.playerKey && player.acquiredCardId)).toBe(true)
    expect(ready.packs.inventory).toHaveLength(5)
    expect(canPlayMatch(ready, 'scrim').ok).toBe(true)
    expect(executeGameCommand(initial, { type: 'OPEN_WELCOME_PACK', cards: cardsA }).events[0].type).toBe('WelcomePackOpened')
  })

  it('keeps the welcome result tied to save identity', () => {
    const first = createInitialState()
    const second = { ...createInitialState(), saveId: 'different-save-id' }
    expect(rollWelcomePack(first.saveId).map((card) => card.alias)).not.toEqual(
      rollWelcomePack(second.saveId).map((card) => card.alias),
    )
  })

  it('advances a match deterministically and closes the season at its boundary', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const a = playMatch({ ...ready, seasonLength: 2 }, 'scrim', 'balanced')
    const b = playMatch({ ...ready, seasonLength: 2 }, 'scrim', 'balanced')
    expect(a).toEqual(b)
    expect(a.week).toBe(2)
    expect(a.history).toHaveLength(1)
    expect(a.roster.every((player) => player.contractWeeks < 12)).toBe(true)

    const final = playMatch({ ...a, seasonLength: 2 }, 'scrim', 'balanced')
    expect(final.seasonEnded).toBe(true)
    expect(final.seasonSummary?.season).toBe(1)
    expect(canPlayMatch(final, 'scrim').ok).toBe(false)
    const next = startNextSeason(final)
    expect(next.season).toBe(2)
    expect(next.week).toBe(1)
    expect(next.seasonEnded).toBe(false)
    expect(next.roster).toHaveLength(5)
  })

  it('migrates v5 careers without forcing the welcome flow', () => {
    const migrated = migrateState({ version: 5, saveId: 'legacy-career', roster: [], startingFive: [] })
    expect(migrated.version).toBe(7)
    expect(migrated.saveId).toBe('legacy-career')
    expect(migrated.welcomeComplete).toBe(true)
  })
})
