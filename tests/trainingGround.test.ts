import { describe, expect, it } from 'vitest'
import {
  advanceCareerTo,
  createInitialState,
  trainPlayer,
  type Player,
} from '../src/game'
import {
  autoPlanTrainingWeek,
  nextPlannedTrainingSession,
  processTrainingSessionsThrough,
  trainingMatchModifier,
  trainingSlotTime,
  upsertTrainingSession,
} from '../src/trainingSystem'

const makePlayer = (id: string, fatigue = 20): Player => ({
  id,
  alias: id,
  firstName: id,
  realName: id,
  country: 'FI',
  team: 'Test',
  age: 23,
  role: id.endsWith('1') ? 'AWP' : id.endsWith('2') ? 'IGL' : id.endsWith('3') ? 'Entry' : id.endsWith('4') ? 'Support' : 'Rifler',
  aim: 72,
  gameSense: 72,
  utility: 72,
  clutch: 72,
  leadership: 72,
  form: 65,
  morale: 70,
  fatigue,
  potential: 88,
  salary: 100,
  contractWeeks: 40,
  traits: [],
  bio: '',
})

const baseState = (fatigue = 20) => {
  const state = createInitialState()
  const roster = [1, 2, 3, 4, 5].map((index) => makePlayer('p' + index, fatigue))
  return {
    ...state,
    welcomeComplete: true,
    roster,
    startingFive: roster.map((player) => player.id),
    staffEnergy: 3,
    credits: 3200,
  }
}

describe('training ground', () => {
  it('auto plan creates real future sessions and reacts to high fatigue', () => {
    const state = baseState(58)
    const planned = autoPlanTrainingWeek(state)
    const sessions = planned.training.sessions.filter((session) => session.status === 'planned')

    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions.some((session) => session.type === 'recovery')).toBe(true)
    expect(sessions.every((session) => session.scheduledAt > state.now)).toBe(true)
  })

  it('processes a session into temporary preparation without boosting permanent card stats', () => {
    const state = baseState()
    const scheduledAt = trainingSlotTime(state, 1, 'am')
    const scheduled = upsertTrainingSession(state, {
      scheduledAt,
      type: 'team',
      intensity: 'normal',
      focus: 'general',
      map: null,
      opponentTeamId: null,
      opponentName: null,
    })

    const before = scheduled.roster.map((player) => ({
      id: player.id,
      aim: player.aim,
      gameSense: player.gameSense,
      utility: player.utility,
      clutch: player.clutch,
      leadership: player.leadership,
    }))

    const processed = processTrainingSessionsThrough(scheduled, scheduledAt)

    expect(processed.training.readiness).toBeGreaterThan(scheduled.training.readiness)
    expect(processed.training.tacticalCohesion).toBeGreaterThan(scheduled.training.tacticalCohesion)
    expect(processed.training.sessions.find((session) => session.scheduledAt === scheduledAt)?.status).toBe('completed')
    expect(processed.roster.map((player) => ({
      id: player.id,
      aim: player.aim,
      gameSense: player.gameSense,
      utility: player.utility,
      clutch: player.clutch,
      leadership: player.leadership,
    }))).toEqual(before)
  })

  it('scrim produces a staff report but no VRS or cash reward', () => {
    const state = baseState()
    const scheduledAt = trainingSlotTime(state, 1, 'pm')
    const opponent = state.world.teams.find((team) => team.rosterKeys.length >= 5)
    const scheduled = upsertTrainingSession(state, {
      scheduledAt,
      type: 'scrim',
      intensity: 'normal',
      focus: 'ct',
      map: 'Nuke',
      opponentTeamId: opponent?.id ?? null,
      opponentName: opponent?.name ?? 'Partner',
    })

    const processed = processTrainingSessionsThrough(scheduled, scheduledAt)

    expect(processed.training.reports).toHaveLength(1)
    expect(processed.training.reports[0].type).toBe('scrim')
    expect(processed.training.reports[0].metrics.length).toBeGreaterThanOrEqual(4)
    expect(processed.credits).toBe(state.credits)
    expect(processed.clubVrsPoints).toBe(state.clubVrsPoints)
  })

  it('returns the earliest planned session for time progression', () => {
    let state = baseState()
    const later = trainingSlotTime(state, 2, 'pm')
    const earlier = trainingSlotTime(state, 1, 'am')

    state = upsertTrainingSession(state, {
      scheduledAt: later,
      type: 'map',
      intensity: 'normal',
      focus: 'retakes',
      map: 'Nuke',
      opponentTeamId: null,
      opponentName: null,
    })
    state = upsertTrainingSession(state, {
      scheduledAt: earlier,
      type: 'recovery',
      intensity: 'light',
      focus: 'general',
      map: null,
      opponentTeamId: null,
      opponentName: null,
    })

    expect(nextPlannedTrainingSession(state, state.now)?.scheduledAt).toBe(earlier)
  })

  it('caps match preparation impact so training cannot replace roster quality', () => {
    const state = baseState()
    const maxed = {
      ...state,
      training: {
        ...state.training,
        readiness: 100,
        tacticalCohesion: 100,
        sharpness: 100,
        mapPreparation: { ...state.training.mapPreparation, Nuke: 100 },
        opponentKnowledge: { enemy: 100 },
      },
    }

    expect(trainingMatchModifier(maxed, 'Nuke', 'enemy')).toBeLessThanOrEqual(3.2)
  })

  it('individual training accumulates development instead of granting +1 every click', () => {
    const state = baseState()
    const before = state.roster[0]
    const trained = trainPlayer(state, before.id)
    const after = trained.roster[0]

    expect(after.aim).toBe(before.aim)
    expect(after.gameSense).toBe(before.gameSense)
    expect(after.utility).toBe(before.utility)
    expect(after.clutch).toBe(before.clutch)
    expect(after.leadership).toBe(before.leadership)
    expect(trained.training.development[before.id]?.progress).toBeGreaterThan(0)
  })


  it('mechanics session feeds slow development without farming an instant stat point', () => {
    const state = baseState()
    const before = state.roster[0]
    const scheduledAt = trainingSlotTime(state, 1, 'am')
    const scheduled = upsertTrainingSession(state, {
      scheduledAt,
      type: 'mechanics',
      intensity: 'normal',
      focus: 'general',
      map: null,
      opponentTeamId: null,
      opponentName: null,
    })

    const processed = processTrainingSessionsThrough(scheduled, scheduledAt)
    const after = processed.roster[0]

    expect(processed.training.development[before.id]?.progress).toBeGreaterThan(0)
    expect(after.aim).toBe(before.aim)
    expect(after.gameSense).toBe(before.gameSense)
    expect(after.utility).toBe(before.utility)
    expect(after.clutch).toBe(before.clutch)
    expect(after.leadership).toBe(before.leadership)
  })

  it('temporary preparation decays over an idle week', () => {
    const state = baseState()
    const prepared = {
      ...state,
      training: {
        ...state.training,
        readiness: 80,
        tacticalCohesion: 76,
        sharpness: 78,
        mapPreparation: { ...state.training.mapPreparation, Nuke: 82 },
        opponentKnowledge: { enemy: 70 },
      },
    }
    const target = new Date(prepared.now + 'Z')
    target.setUTCDate(target.getUTCDate() + 7)
    const iso = target.toISOString().slice(0, 19)

    const advanced = advanceCareerTo(prepared, iso)

    expect(advanced.training.readiness).toBeLessThan(prepared.training.readiness)
    expect(advanced.training.tacticalCohesion).toBeLessThan(prepared.training.tacticalCohesion)
    expect(advanced.training.sharpness).toBeLessThan(prepared.training.sharpness)
    expect(advanced.training.mapPreparation.Nuke).toBeLessThan(prepared.training.mapPreparation.Nuke)
    expect(advanced.training.opponentKnowledge.enemy).toBeLessThan(prepared.training.opponentKnowledge.enemy)
  })
})
