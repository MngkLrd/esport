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
  deriveMapNarrativeTags,
  evaluateNegotiation,
  lineupFitScore,
  migrateState,
  negotiateProspect,
  playMatch,
  resolveClubDecision,
  scout,
  startNextSeason,
  type MatchRoundCause,
  type MatchRoundStory,
} from '../src/game'
import { rollWelcomePack } from '../src/welcomePack'
import { rarityForPlayer, rollPack } from '../src/packs'
import { REAL_PLAYERS } from '../src/players'
import { executeGameCommand } from '../src/gameCommands'
import { generateMatchPlayback, simulationFrameAt, type SimRound } from '../src/matchSimulation'
import { constrainRoundToNavigation, isNavigationSegmentClear, type RadarNavigationGrid } from '../src/radarNavigation'
import { addGameHours, hoursBetween } from '../src/calendar'
import { PLAYER_CLUB_WORLD_ID, createWorldState } from '../src/world'
import { tournamentForId } from '../src/events'
import {
  advanceTournamentTo,
  createTournamentRun,
  nextPlayerMatch,
  opponentForPlayerMatch,
  resolvePlayerTournamentMatch,
  tournamentIsFinished,
  tournamentStartsAt,
} from '../src/tournamentEngine'
import { currentCareerObjectives, onboardingStep } from '../src/progression'

describe('P0 career flow', () => {
  it('keeps game time deterministic across DST boundaries', () => {
    expect(hoursBetween('2026-10-24T09:00:00', '2026-10-26T09:00:00')).toBe(48)
  })

  it('seeds one persistent owner for every real player in the competitive world', () => {
    const world = createWorldState()
    expect(world.teams.length).toBeGreaterThan(30)
    expect(world.teams.some((team) => team.name === 'Spirit')).toBe(true)
    expect(world.teams.some((team) => team.name === 'Vitality')).toBe(true)

    const rosterKeys = world.teams.flatMap((team) => team.rosterKeys)
    expect(new Set(rosterKeys).size).toBe(rosterKeys.length)
    expect(world.teams.every((team) => team.rosterKeys.length === 5)).toBe(true)
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
    expect(cardsA.every((card) => {
      const identity = REAL_PLAYERS.find((player) => player.alias.toLocaleLowerCase('en-US') === card.alias.toLocaleLowerCase('en-US'))
      return Boolean(identity) && card.rarity === rarityForPlayer(identity!)
    })).toBe(true)

    const ready = applyWelcomePack(initial, cardsA)
    expect(ready.welcomeComplete).toBe(true)
    expect(ready.roster).toHaveLength(5)
    expect(ready.startingFive).toHaveLength(5)
    expect(Object.values(ready.lineupSlots).filter(Boolean)).toHaveLength(5)
    expect(ready.roster.every((player) => player.playerKey && player.acquiredCardId)).toBe(true)
    expect(ready.roster.map((player) => player.cardRarity)).toEqual(cardsA.map((card) => card.rarity))
    expect(ready.roster.every((player) => {
      const key = player.playerKey!
      return ready.world.players[key]?.teamId === PLAYER_CLUB_WORLD_ID
    })).toBe(true)
    expect(ready.world.teams.every((team) =>
      ready.roster.every((player) => !player.playerKey || !team.rosterKeys.includes(player.playerKey)),
    )).toBe(true)
    expect(ready.packs.inventory).toHaveLength(5)
    expect(canPlayMatch(ready, 'practice').ok).toBe(true)
    expect(executeGameCommand(initial, { type: 'OPEN_WELCOME_PACK', cards: cardsA }).events[0].type).toBe('WelcomePackOpened')
  })

  it('guides a new career through the first complete playable loop', () => {
    const initial = { ...createInitialState(), saveId: 'rookie-flow-test' }
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))

    expect(onboardingStep(ready)?.target).toBe('World')
    expect(currentCareerObjectives(ready, 3).map((objective) => objective.id)).toEqual([
      'book-event',
      'first-practice',
      'first-official',
    ])

    const booked = bookTournament(ready, 'nordic-online')
    expect(onboardingStep(booked)?.target).toBe('Training')

    const practiced = playMatch(booked, 'practice', 'balanced')
    expect(onboardingStep(practiced)?.target).toBe('Calendar')

    const atMatch = advanceToNextTournamentMatch(practiced)
    expect(onboardingStep(atMatch)?.target).toBe('Play')

    const official = playMatch(atMatch, 'scrim', 'balanced')
    expect(official.history.some((match) => match.mode !== 'practice')).toBe(true)
    expect(onboardingStep(official)).toBeNull()
  })

  it('routes tactical movement around blocked radar geometry', () => {
    const cols = 16
    const rows = 16
    const walkable = new Uint8Array(cols * rows)
    walkable.fill(1)

    // Vertical wall with one legal opening near the bottom.
    for (let row = 0; row < 13; row += 1) {
      walkable[row * cols + 8] = 0
    }

    const grid: RadarNavigationGrid = { cols, rows, cellSize: 8, walkable }
    const round: SimRound = {
      id: 'navigation-test',
      map: 'Test',
      mapKey: 'test',
      homeSide: 'T',
      scenario: 'default',
      scenarioLabel: 'DEFAULT',
      site: 'A',
      duration: 900,
      events: [],
      winner: 'HOME',
      frames: Array.from({ length: 10 }, (_, index) => ({
        time: index * 100,
        players: [{
          id: 'p1',
          name: 'P1',
          side: 'T' as const,
          x: 20 + index * 10,
          y: 28,
          yaw: 0,
          hp: 100,
          alive: true,
          weapon: 'AK-47',
          hasBomb: false,
        }],
      })),
    }

    const constrained = constrainRoundToNavigation(round, grid)
    const points = constrained.frames.map((frame) => ({
      x: frame.players[0].x,
      y: frame.players[0].y,
    }))

    for (let index = 1; index < points.length; index += 1) {
      expect(isNavigationSegmentClear(grid, points[index - 1], points[index])).toBe(true)
      expect(Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y,
      )).toBeLessThanOrEqual(15.01)
    }

    expect(points.some((point) => point.y > 28)).toBe(true)
  })

  it('keeps players moving when a raw route points into a disconnected radar island', () => {
    const cols = 20
    const rows = 12
    const walkable = new Uint8Array(cols * rows)

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (col <= 7 || col >= 12) walkable[row * cols + col] = 1
      }
    }

    const grid: RadarNavigationGrid = { cols, rows, cellSize: 8, walkable }
    const round: SimRound = {
      id: 'disconnected-navigation-test',
      map: 'Test',
      mapKey: 'test',
      homeSide: 'T',
      scenario: 'default',
      scenarioLabel: 'DEFAULT',
      site: 'A',
      duration: 500,
      events: [],
      winner: 'HOME',
      frames: Array.from({ length: 6 }, (_, index) => ({
        time: index * 100,
        players: [{
          id: 'p1',
          name: 'P1',
          side: 'T' as const,
          x: index === 0 ? 20 : 140,
          y: 44,
          yaw: 0,
          hp: 100,
          alive: true,
          weapon: 'AK-47',
          hasBomb: false,
        }],
      })),
    }

    const constrained = constrainRoundToNavigation(round, grid)
    const points = constrained.frames.map((frame) => frame.players[0])

    expect(new Set(points.map((point) => point.x + ':' + point.y)).size).toBeGreaterThan(1)
    expect(points.at(-1)!.x).toBeGreaterThan(points[0].x)
    expect(points.every((point) => point.x < 64)).toBe(true)
    for (let index = 1; index < points.length; index += 1) {
      expect(isNavigationSegmentClear(grid, points[index - 1], points[index])).toBe(true)
    }
  })

  it('re-times combat to legal line-of-sight frames after navigation', () => {
    const cols = 16
    const rows = 16
    const walkable = new Uint8Array(cols * rows)
    walkable.fill(1)
    for (let row = 0; row < 13; row += 1) walkable[row * cols + 8] = 0
    const grid: RadarNavigationGrid = { cols, rows, cellSize: 8, walkable }

    const round: SimRound = {
      id: 'combat-los-test',
      map: 'Test',
      mapKey: 'test',
      homeSide: 'T',
      scenario: 'default',
      scenarioLabel: 'DEFAULT',
      site: 'A',
      duration: 900,
      winner: 'HOME',
      events: [
        { id: 'shot-0', time: 160, type: 'shot', actorId: 'a', targetId: 'b', actorName: 'A', targetName: 'B', side: 'T', weapon: 'AK-47' },
        { id: 'damage-0', time: 270, type: 'damage', actorId: 'a', targetId: 'b', actorName: 'A', targetName: 'B', side: 'T', weapon: 'AK-47', damage: 55 },
        { id: 'kill-0', time: 400, type: 'kill', actorId: 'a', targetId: 'b', actorName: 'A', targetName: 'B', side: 'T', weapon: 'AK-47' },
      ],
      frames: Array.from({ length: 10 }, (_, index) => ({
        time: index * 100,
        players: [
          { id: 'a', name: 'A', side: 'T' as const, x: 20 + index * 5, y: 28 + index * 5, yaw: 0, hp: 100, alive: true, weapon: 'AK-47', hasBomb: false },
          { id: 'b', name: 'B', side: 'CT' as const, x: 108, y: 28 + index * 5, yaw: 180, hp: index >= 4 ? 0 : 100, alive: index < 4, weapon: 'M4A1-S', hasBomb: false },
        ],
      })),
    }

    const constrained = constrainRoundToNavigation(round, grid)
    const combatEvents = constrained.events.filter((event) => event.type === 'kill')
    for (const kill of combatEvents) {
      const frame = constrained.frames.reduce((best, current) =>
        Math.abs(current.time - kill.time) < Math.abs(best.time - kill.time) ? current : best,
      )
      const actor = frame.players.find((player) => player.id === kill.actorId)!
      const target = frame.players.find((player) => player.id === kill.targetId)!
      expect(isNavigationSegmentClear(grid, actor, target)).toBe(true)
    }
    expect(combatEvents).toHaveLength(0)
  })

  it('derives map score from a causal round history and persists the explanation', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const result = playMatch(ready, 'practice', 'structured').history[0]

    expect(result.story).toBeTruthy()
    expect(result.story?.maps).toHaveLength(result.maps.length)
    expect(result.story?.summary.length).toBeGreaterThan(20)

    result.maps.forEach((map) => {
      expect(map.story).toBeTruthy()
      expect(map.story?.rounds.length).toBe(map.us + map.them)
      const finalRound = map.story?.rounds.at(-1)
      expect(finalRound?.scoreUs).toBe(map.us)
      expect(finalRound?.scoreThem).toBe(map.them)
      expect(map.story?.turningPoint).toContain('R')
      expect(map.story?.explanation.length).toBeGreaterThan(20)
    })
  })

  it('recognizes the full match-story vocabulary from round facts', () => {
    const factors = {
      tactics: 72,
      preparation: 72,
      fatigue: 45,
      communication: 72,
      clutch: 72,
      individual: 72,
    }
    const makeRounds = (sequence: Array<{ winner: 'US' | 'THEM'; cause?: MatchRoundCause; clutch?: boolean; keyPlayer?: string }>) => {
      let us = 0
      let them = 0
      return sequence.map((entry, index): MatchRoundStory => {
        if (entry.winner === 'US') us += 1
        else them += 1
        return {
          round: index + 1,
          winner: entry.winner,
          scoreUs: us,
          scoreThem: them,
          cause: entry.cause ?? 'AIM',
          clutch: entry.clutch,
          keyPlayer: entry.keyPlayer,
          note: 'test',
        }
      })
    }

    const comeback = makeRounds([
      ...Array.from({ length: 5 }, () => ({ winner: 'THEM' as const })),
      ...Array.from({ length: 13 }, (_, index) => ({
        winner: 'US' as const,
        cause: index < 3 ? 'ANTI_STRAT' as const : index < 6 ? 'TACTICAL_EDGE' as const : 'AIM' as const,
        clutch: index < 4,
      })),
    ])
    const collapse = makeRounds([
      ...Array.from({ length: 5 }, () => ({ winner: 'US' as const })),
      ...Array.from({ length: 3 }, () => ({ winner: 'THEM' as const, cause: 'PLAYER_ERROR' as const, keyPlayer: 'fragile' })),
      ...Array.from({ length: 3 }, () => ({ winner: 'THEM' as const, cause: 'FATIGUE' as const })),
      ...Array.from({ length: 3 }, () => ({ winner: 'THEM' as const, cause: 'COMMUNICATION' as const })),
      ...Array.from({ length: 4 }, () => ({ winner: 'THEM' as const, cause: 'TACTICAL_EDGE' as const })),
    ])

    const comebackTags = deriveMapNarrativeTags(comeback, factors)
    expect(comebackTags).toEqual(expect.arrayContaining([
      'COMEBACK',
      'CLUTCH_HEAVY',
      'TACTICAL_OUTPLAY',
      'ANTI_STRAT_SUCCESS',
    ]))

    const collapseTags = deriveMapNarrativeTags(collapse, { ...factors, preparation: 30 })
    expect(collapseTags).toEqual(expect.arrayContaining([
      'CHOKE',
      'TACTICAL_OUTPLAY',
      'WEAK_MAP',
      'PLAYER_COLLAPSE',
      'FATIGUE',
      'COMMUNICATION_BREAKDOWN',
    ]))

    const stomp = makeRounds([
      ...Array.from({ length: 13 }, () => ({ winner: 'US' as const })),
      ...Array.from({ length: 2 }, () => ({ winner: 'THEM' as const })),
    ])
    expect(deriveMapNarrativeTags(stomp, factors)).toContain('STOMP')
  })

  it('builds deterministic frame-based tactical playback for every map', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const next = playMatch(ready, 'practice', 'structured')
    const result = next.history[0]
    const playbackA = generateMatchPlayback(result, ready.roster, 'structured')
    const playbackB = generateMatchPlayback(result, ready.roster, 'structured')

    expect(playbackA).toEqual(playbackB)
    expect(playbackA.rounds).toHaveLength(result.maps.reduce((sum, map) => sum + map.us + map.them, 0))
    expect(playbackA.rounds.every((round) => round.frames.length > 80)).toBe(true)
    expect(playbackA.rounds.every((round) => Boolean(round.cause))).toBe(true)
    expect(playbackA.rounds.every((round) => round.events.some((event) => event.type === 'kill'))).toBe(true)
    expect(playbackA.rounds.every((round) => round.events.some((event) => event.type === 'utility'))).toBe(true)

    const frame = simulationFrameAt(playbackA.rounds[0], 4500)
    expect(frame?.players).toHaveLength(10)
    expect(frame?.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.y))).toBe(true)
  })

  it('makes tactical playback reflect whether a map was close or dominant', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const played = playMatch(ready, 'practice', 'balanced')
    const base = played.history[0]
    const map = base.maps[0]

    const dominant = {
      ...base,
      id: 'score-margin-visual-test',
      won: true,
      maps: [{ ...map, us: 13, them: 2 }],
    }
    const close = {
      ...dominant,
      maps: [{ ...map, us: 13, them: 11 }],
    }

    const dominantRound = generateMatchPlayback(dominant, ready.roster, 'balanced').rounds[0]
    const closeRound = generateMatchPlayback(close, ready.roster, 'balanced').rounds[0]
    const homeDeaths = (round: SimRound) => round.events.filter((event) =>
      event.type === 'kill' && event.targetId != null && !event.targetId.startsWith('away-'),
    ).length

    expect(homeDeaths(dominantRound)).toBeLessThan(homeDeaths(closeRound))
    expect(homeDeaths(dominantRound)).toBe(0)
    expect(homeDeaths(closeRound)).toBe(3)
  })

  it('makes lineup rating gaps materially change map win chance', () => {
    const seeded = { ...createInitialState(), saveId: 'rating-gap-regression' }
    const ready = {
      ...applyWelcomePack(seeded, rollWelcomePack(seeded.saveId)),
      reputation: 80,
    }
    const tuneRoster = (delta: number) => ready.roster.map((player) => ({
      ...player,
      aim: Math.max(0, Math.min(100, player.aim + delta)),
      gameSense: Math.max(0, Math.min(100, player.gameSense + delta)),
      utility: Math.max(0, Math.min(100, player.utility + delta)),
      clutch: Math.max(0, Math.min(100, player.clutch + delta)),
      leadership: Math.max(0, Math.min(100, player.leadership + delta)),
    }))

    const strong = playMatch({ ...ready, roster: tuneRoster(15) }, 'practice', 'balanced').history[0]
    const weak = playMatch({ ...ready, roster: tuneRoster(-15) }, 'practice', 'balanced').history[0]

    expect(strong.opponent).toBe(weak.opponent)
    expect(strong.maps[0].map).toBe(weak.maps[0].map)
    expect(strong.maps[0].winChance).toBeGreaterThan(weak.maps[0].winChance)
    expect(strong.maps[0].winChance - weak.maps[0].winChance).toBeGreaterThanOrEqual(15)
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
    expect(canPlayMatch(final, 'practice').ok).toBe(false)
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
    expect(booked.activeTournament?.teams.filter((team) => !team.isPlayer).every((team) =>
      Boolean(team.worldTeamId) && team.roster.length === 5,
    )).toBe(true)
    expect(booked.credits).toBe(levelTwo.credits - 420)

    const atMatch = advanceToNextTournamentMatch(booked)
    expect(atMatch.now).not.toBe(booked.now)
    expect(canPlayMatch(atMatch, 'showmatch').ok).toBe(true)
    const bracketOpponent = opponentForPlayerMatch(atMatch.activeTournament)

    const played = playMatch(atMatch, 'showmatch', 'balanced')
    expect(played.activeEventId).toBe('helsinki')
    expect(played.activeTournament).toBeTruthy()
    expect(played.history[0].mode).toBe('showmatch')
    expect(played.history[0].tournamentId).toBe('helsinki')
    expect(played.history[0].opponent).toBe(bracketOpponent?.name)
    expect(played.history[0].opponentRoster?.map((player) => player.alias)).toEqual(
      bracketOpponent?.roster.map((player) => player.alias),
    )
    expect(played.history[0].opponentRoster).toHaveLength(5)
    expect(played.clubVrsPoints).toBeGreaterThanOrEqual(ready.clubVrsPoints)
    expect(played.history[0].vrsDelta).toBeGreaterThanOrEqual(0)
  })

  it('uses manager progression to unlock deeper scouting', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const levelThree = { ...ready, managerXp: 1000 }
    const report = scout(levelThree, { role: 'Any', maxSalary: 170, ageProfile: 'any' })
    expect(report.prospects).toHaveLength(6)
    expect(canBookTournament(levelThree, 'lisbon').ok).toBe(true)
    expect(canBookTournament(ready, 'lisbon').ok).toBe(false)
    expect(canBookTournament(ready, 'eu-open-1').ok).toBe(false)
    expect(canBookTournament(ready, 'nordic-online').ok).toBe(true)
  })

  it('keeps pracc non-ranked and non-paid while nudging lineup continuity', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const played = playMatch(ready, 'practice', 'balanced')

    expect(played.credits).toBe(ready.credits)
    expect(played.clubVrsPoints).toBe(ready.clubVrsPoints)
    expect(played.wins).toBe(ready.wins)
    expect(played.losses).toBe(ready.losses)
    expect(played.packTokens).toBe(ready.packTokens)
    expect(played.lineupContinuity).toBe(Math.min(100, ready.lineupContinuity + 1))
    expect(played.history[0].reward).toBe(0)
    expect(played.history[0].vrsDelta).toBe(0)
    expect(played.pendingDecision).toBeNull()
  })

  it('forces one weekly club decision after an official non-tournament match', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const played = playMatch(ready, 'showmatch', 'balanced')
    expect(played.pendingDecision).toBeTruthy()
    expect(canPlayMatch(played, 'practice').ok).toBe(false)
    expect(canBookTournament(played, 'helsinki').ok).toBe(false)

    const resolved = resolveClubDecision(played, 'a')
    expect(resolved.pendingDecision).toBeNull()
    expect(canPlayMatch(resolved, 'practice').ok).toBe(true)
  })

  it('keeps registration open until exactly 72 hours before tournament start', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const event = tournamentForId('nordic-online')!
    const start = tournamentStartsAt(event, ready.seasonStart)
    const atCutoff = { ...ready, now: addGameHours(start, -72) }
    const afterCutoff = { ...ready, now: addGameHours(start, -71) }

    expect(canBookTournament(atCutoff, event.id).ok).toBe(true)
    expect(canBookTournament(afterCutoff, event.id).ok).toBe(false)
  })

  it('keeps online tournaments free and separates practice from the official T3 fixture', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const booked = bookTournament(ready, 'nordic-online')
    expect(booked.credits).toBe(ready.credits)
    expect(booked.activeTournament?.startsAt).toContain('2026-10-10')
    expect(canPlayMatch(booked, 'practice').ok).toBe(true)
    expect(canPlayMatch(booked, 'scrim').ok).toBe(false)

    const atMatch = advanceToNextTournamentMatch(booked)
    expect(canPlayMatch(atMatch, 'practice').ok).toBe(false)
    expect(canPlayMatch(atMatch, 'scrim').ok).toBe(true)
    const official = playMatch(atMatch, 'scrim', 'balanced')
    expect(official.history[0].tournamentId).toBe('nordic-online')
    expect(official.history[0].vrsDelta).toBeGreaterThanOrEqual(0)
    expect(atMatch.activeTournament?.matches.some((match) => match.status === 'ready' && [match.teamAId, match.teamBId].includes('club'))).toBe(true)
  })

  it('does not let manual calendar advance skip a mandatory club fixture', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const booked = bookTournament(ready, 'nordic-online')
    const farFuture = advanceCareerTo(booked, '2026-10-20T09:00:00')
    const fixture = nextPlayerMatch(farFuture.activeTournament)
    expect(fixture).toBeTruthy()
    expect(farFuture.now).toBe(fixture?.scheduledAt)
  })

  it('freezes the career clock once a scheduled club fixture is due', () => {
    const initial = createInitialState()
    const ready = applyWelcomePack(initial, rollWelcomePack(initial.saveId))
    const booked = bookTournament(ready, 'nordic-online')
    const atMatch = advanceToNextTournamentMatch(booked)
    const attemptedSkip = advanceCareerTo(atMatch, '2026-10-10T09:00:00')
    expect(attemptedSkip.now).toBe(atMatch.now)
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
    expect(signed.world.players[prospect.playerKey!]?.teamId).toBe(PLAYER_CLUB_WORLD_ID)
    expect(signed.world.teams.every((team) => !team.rosterKeys.includes(prospect.playerKey!))).toBe(true)
  })

  it('advances AI-team form and roster world state with career time', () => {
    const initial = createInitialState()
    const sample = Object.values(initial.world.players).find((player) => player.teamId && player.teamId !== PLAYER_CLUB_WORLD_ID)!
    const advanced = advanceCareerTo(initial, '2026-10-19T09:00:00')
    expect(advanced.world.weeksSimulated).toBeGreaterThanOrEqual(3)
    expect(advanced.world.players[sample.key]).toBeTruthy()
    expect(advanced.world.teams.some((team) => team.vrsPoints !== initial.world.teams.find((base) => base.id === team.id)?.vrsPoints)).toBe(true)
    expect(
      advanced.world.players[sample.key].form !== sample.form ||
      advanced.world.players[sample.key].currentRating !== sample.currentRating ||
      advanced.world.transferHistory.length > 0,
    ).toBe(true)
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
    expect(migrated.version).toBe(12)
    expect(migrated.activeEventId).toBe('eu-open-1')
    expect(migrated.activeTournament?.eventId).toBe('eu-open-1')
    expect(migrated.activeTournament?.matches.length).toBe(7)
    expect(migrated.seasonLength).toBe(16)
  })

  it('migrates v8 saves into split club cash and pack-token economy', () => {
    const legacy = createInitialState()
    const raw = { ...legacy, version: 8, packTokens: undefined, managerXp: undefined }
    const migrated = migrateState(raw)
    expect(migrated.version).toBe(12)
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
    expect(migrated.version).toBe(12)
    expect(migrated.saveId).toBe('legacy-career')
    expect(migrated.welcomeComplete).toBe(true)
  })
})
