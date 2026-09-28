import { describe, expect, it } from 'vitest'
import {
  advanceCareerTo,
  advanceToNextTournamentMatch,
  applyWelcomePack,
  assignLineupSlot,
  bookTournament,
  canBookTournament,
  canPlayMatch,
  clearLineupSlot,
  createInitialState,
  defaultNegotiationTerms,
  evaluateNegotiation,
  lineupFitScore,
  migrateState,
  negotiateProspect,
  playMatch,
  resolveClubDecision,
  scout,
  startNextSeason,
} from '../src/game'
import { rollWelcomePack } from '../src/welcomePack'
import { rollPack } from '../src/packs'
import { executeGameCommand } from '../src/gameCommands'
import { generateMatchPlayback, simulationFrameAt } from '../src/matchSimulation'
import { hoursBetween } from '../src/calendar'
import { tournamentForId } from '../src/events'
import {
  advanceTournamentTo,
  createTournamentRun,
  nextPlayerMatch,
  resolvePlayerTournamentMatch,
  tournamentIsFinished,
} from '../src/tournamentEngine'

describe('P0 career flow', () => {
  it('keeps game time deterministic across DST boundaries', () => {
    expect(hoursBetween('2026-10-24T09:00:00', '2026-10-26T09:00:00')).toBe(48)
  })

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

  it('builds deterministic frame-based tactical playback for every map', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const next = playMatch(ready, 'scrim', 'structured')
    const result = next.history[0]
    const playbackA = generateMatchPlayback(result, ready.roster, 'structured')
    const playbackB = generateMatchPlayback(result, ready.roster, 'structured')

    expect(playbackA).toEqual(playbackB)
    expect(playbackA.rounds).toHaveLength(result.maps.length)
    expect(playbackA.rounds.every((round) => round.frames.length > 80)).toBe(true)
    expect(playbackA.rounds.every((round) => round.events.some((event) => event.type === 'kill'))).toBe(true)
    expect(playbackA.rounds.every((round) => round.events.some((event) => event.type === 'utility'))).toBe(true)

    const frame = simulationFrameAt(playbackA.rounds[0], 4500)
    expect(frame?.players).toHaveLength(10)
    expect(frame?.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.y))).toBe(true)
  })

  it('keeps the welcome result tied to save identity', () => {
    const first = createInitialState()
    const second = { ...createInitialState(), saveId: 'different-save-id' }
    expect(rollWelcomePack(first.saveId).map((card) => card.alias)).not.toEqual(
      rollWelcomePack(second.saveId).map((card) => card.alias),
    )
  })

  it('separates match time from the career clock and closes a season by date', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const a = playMatch({ ...ready, seasonLength: 2 }, 'scrim', 'balanced')
    const b = playMatch({ ...ready, seasonLength: 2 }, 'scrim', 'balanced')
    expect(a).toEqual(b)
    expect(a.week).toBe(1)
    expect(a.history).toHaveLength(1)
    expect(a.now).not.toBe(ready.now)
    expect(a.roster.map((player) => player.contractWeeks)).toEqual(ready.roster.map((player) => player.contractWeeks))

    const continued = resolveClubDecision(a, 'a')
    const final = advanceCareerTo(continued, '2026-10-20T09:00:00')
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

  it('turns a world-map booking into a multi-match tournament run', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const levelTwo = { ...ready, managerXp: 500 }
    expect(canBookTournament(levelTwo, 'helsinki').ok).toBe(true)

    const booked = bookTournament(levelTwo, 'helsinki')
    expect(booked.activeEventId).toBe('helsinki')
    expect(booked.activeTournament?.matches.length).toBeGreaterThan(10)
    expect(booked.credits).toBe(levelTwo.credits - 420)

    const atMatch = advanceToNextTournamentMatch(booked)
    expect(atMatch.now).not.toBe(booked.now)
    expect(canPlayMatch(atMatch, 'showmatch').ok).toBe(true)

    const played = playMatch(atMatch, 'showmatch', 'balanced')
    expect(played.activeEventId).toBe('helsinki')
    expect(played.activeTournament).toBeTruthy()
    expect(played.history[0].mode).toBe('showmatch')
    expect(played.history[0].tournamentId).toBe('helsinki')
  })

  it('uses manager progression to unlock deeper scouting', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const levelThree = { ...ready, managerXp: 1000 }
    const report = scout(levelThree, { role: 'Any', maxSalary: 170, ageProfile: 'any' })
    expect(report.prospects).toHaveLength(6)
    expect(canBookTournament(levelThree, 'lisbon').ok).toBe(true)
    expect(canBookTournament(ready, 'lisbon').ok).toBe(false)
    expect(canBookTournament(ready, 'eu-open-1').ok).toBe(true)
  })

  it('forces one weekly club decision before the next event loop', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const played = playMatch(ready, 'scrim', 'balanced')
    expect(played.pendingDecision).toBeTruthy()
    expect(canPlayMatch(played, 'scrim').ok).toBe(false)
    expect(canBookTournament(played, 'helsinki').ok).toBe(false)

    const resolved = resolveClubDecision(played, 'a')
    expect(resolved.pendingDecision).toBeNull()
    expect(canPlayMatch(resolved, 'scrim').ok).toBe(true)
  })

  it('keeps online tournaments free and scheduled in real calendar time', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const booked = bookTournament(ready, 'eu-open-1')
    expect(booked.credits).toBe(ready.credits)
    expect(booked.activeTournament?.startsAt).toContain('2026-09-30')
    expect(canPlayMatch(booked, 'scrim').ok).toBe(false)

    const atMatch = advanceToNextTournamentMatch(booked)
    expect(canPlayMatch(atMatch, 'scrim').ok).toBe(true)
    expect(atMatch.activeTournament?.matches.some((match) => match.status === 'ready' && [match.teamAId, match.teamBId].includes('club'))).toBe(true)
  })

  it('charges payroll when calendar weeks pass instead of after every match', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const payroll = ready.roster.reduce((sum, player) => sum + player.salary, 0)
    const advanced = advanceCareerTo(ready, '2026-10-05T09:00:00')
    expect(advanced.credits).toBe(Math.max(0, ready.credits - payroll))
    expect(advanced.roster.every((player, index) => player.contractWeeks === Math.max(0, ready.roster[index].contractWeeks - 1))).toBe(true)
  })

  it('can progress a grouped double-elimination event through the full bracket', () => {
    const event = tournamentForId('helsinki')!
    let run = createTournamentRun(event, '2026-09-28T09:00:00', '2026-09-28T09:00:00', 404)
    let playerMatches = 0

    for (let guard = 0; guard < 16 && !tournamentIsFinished(run); guard += 1) {
      run = advanceTournamentTo(run, run.endsAt, 404)
      const match = nextPlayerMatch(run)
      if (!match) break
      playerMatches += 1
      run = resolvePlayerTournamentMatch(run, true, 2, 0)
    }

    run = advanceTournamentTo(run, run.endsAt, 404)
    expect(playerMatches).toBeGreaterThanOrEqual(5)
    expect(run.status).toBe('champion')
    expect(run.placement).toBe('CHAMPION')
    expect(run.matches.filter((match) => match.status === 'complete').length).toBe(run.matches.length)
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

  it('migrates a legacy selected event into a full tournament run', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const legacy = {
      ...ready,
      version: 9,
      activeEventId: 'eu-open-1',
      activeTournament: undefined,
      tournamentHistory: undefined,
      seasonStart: undefined,
      now: undefined,
    }
    const migrated = migrateState(legacy)
    expect(migrated.version).toBe(10)
    expect(migrated.activeEventId).toBe('eu-open-1')
    expect(migrated.activeTournament?.eventId).toBe('eu-open-1')
    expect(migrated.activeTournament?.matches.length).toBe(7)
  })

  it('migrates v8 saves into split club cash and pack-token economy', () => {
    const legacy = createInitialState()
    const raw = { ...legacy, version: 8, packTokens: undefined, managerXp: undefined }
    const migrated = migrateState(raw)
    expect(migrated.version).toBe(10)
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
    expect(migrated.version).toBe(10)
    expect(migrated.saveId).toBe('legacy-career')
    expect(migrated.welcomeComplete).toBe(true)
  })
})
