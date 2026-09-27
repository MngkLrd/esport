import { describe, expect, it } from 'vitest'
import {
  applyWelcomePack,
  assignLineupSlot,
  canPlayMatch,
  clearLineupSlot,
  createInitialState,
  defaultNegotiationTerms,
  evaluateNegotiation,
  lineupFitScore,
  migrateState,
  negotiateProspect,
  playMatch,
  scout,
  startNextSeason,
} from '../src/game'
import { rollWelcomePack } from '../src/welcomePack'
import { rollPack } from '../src/packs'
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
    expect(Object.values(ready.lineupSlots).filter(Boolean)).toHaveLength(5)
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


  it('persists role slots and swaps cards without duplicating the active five', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const entryId = ready.lineupSlots.Entry
    const awpId = ready.lineupSlots.AWP
    expect(entryId).toBeTruthy()
    expect(awpId).toBeTruthy()

    const swapped = assignLineupSlot(ready, 'AWP', entryId!)
    expect(swapped.lineupSlots.AWP).toBe(entryId)
    expect(swapped.lineupSlots.Entry).toBe(awpId)
    expect(new Set(swapped.startingFive).size).toBe(5)

    const cleared = clearLineupSlot(swapped, 'Support')
    expect(cleared.lineupSlots.Support).toBeNull()
    expect(cleared.startingFive).toHaveLength(4)

    const migrated = migrateState(JSON.parse(JSON.stringify(swapped)))
    expect(migrated.lineupSlots).toEqual(swapped.lineupSlots)
  })

  it('ranks exact-role players above obvious off-role alternatives for slot picking', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const awp = ready.roster.find((player) => player.role === 'AWP')!
    const support = ready.roster.find((player) => player.role === 'Support')!
    expect(lineupFitScore(awp, 'AWP')).toBeGreaterThan(lineupFitScore(support, 'AWP'))
  })

  it('targets scouting to a requested role and persists the brief', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const brief = { role: 'AWP' as const, maxSalary: 170, ageProfile: 'any' as const }
    const report = scout(ready, brief)

    expect(report.credits).toBe(ready.credits - 300)
    expect(report.scoutBrief).toEqual(brief)
    expect(report.prospects).toHaveLength(5)
    expect(report.prospects.every((player) => player.role === 'AWP')).toBe(true)
  })

  it('requires a credible offer and applies negotiated terms when a prospect signs', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const report = scout(ready, { role: 'Rifler', maxSalary: 180, ageProfile: 'any' })
    const prospect = report.prospects[0]
    expect(prospect).toBeTruthy()

    const weak = { ...defaultNegotiationTerms(prospect), fee: 50, salary: 40, contractWeeks: 6 as const, squadRole: 'rotation' as const }
    const weakEvaluation = evaluateNegotiation(report, prospect, weak)
    expect(weakEvaluation.accepted).toBe(false)
    expect(negotiateProspect(report, prospect.id, weak).state).toEqual(report)

    const base = defaultNegotiationTerms(prospect)
    const strong = { ...base, fee: Math.round(base.fee * 1.2), salary: Math.round(base.salary * 1.15), contractWeeks: 16, squadRole: 'starter' as const }
    const strongEvaluation = evaluateNegotiation(report, prospect, strong)
    expect(strongEvaluation.accepted).toBe(true)

    const signed = negotiateProspect(report, prospect.id, strong).state
    const rosterPlayer = signed.roster.find((player) => player.id === prospect.id)
    expect(rosterPlayer?.salary).toBe(strong.salary)
    expect(rosterPlayer?.contractWeeks).toBe(strong.contractWeeks)
    expect(signed.prospects.some((player) => player.id === prospect.id)).toBe(false)
    expect(signed.startingFive).toContain(prospect.id)
    expect(signed.startingFive).toHaveLength(5)
    expect(signed.credits).toBe(report.credits - strong.fee)
  })

  it('migrates v8 saves into split club cash and pack-token economy', () => {
    const legacy = createInitialState()
    const raw = { ...legacy, version: 8, packTokens: undefined, managerXp: undefined }
    const migrated = migrateState(raw)
    expect(migrated.version).toBe(9)
    expect(migrated.credits).toBe(legacy.credits)
    expect(migrated.packTokens).toBe(2600)
    expect(migrated.managerXp).toBe(0)
  })

  it('charges only pack tokens when a pack is opened', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const roll = rollPack('academy', ready.packs.serial, ready.saveId)
    const result = executeGameCommand(ready, { type: 'OPEN_PACK', roll }).state
    expect(result.credits).toBe(ready.credits)
    expect(result.packTokens).toBe(ready.packTokens - roll.pack.price)
    expect(result.packs.inventory).toHaveLength(ready.packs.inventory.length + 1)
    expect(result.managerXp).toBe(ready.managerXp + 12)
  })

  it('migrates v5 careers without forcing the welcome flow', () => {
    const migrated = migrateState({ version: 5, saveId: 'legacy-career', roster: [], startingFive: [] })
    expect(migrated.version).toBe(9)
    expect(migrated.saveId).toBe('legacy-career')
    expect(migrated.welcomeComplete).toBe(true)
  })
})
