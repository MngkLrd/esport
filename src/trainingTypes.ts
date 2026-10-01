export const TRAINING_MAPS = ['Dust II', 'Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis'] as const
export type TrainingMap = typeof TRAINING_MAPS[number]

export type TrainingSessionType =
  | 'team'
  | 'scrim'
  | 'map'
  | 'anti-strat'
  | 'utility'
  | 'mechanics'
  | 'recovery'
  | 'match-prep'

export type TrainingIntensity = 'light' | 'normal' | 'high'
export type TrainingFocus = 'general' | 'ct' | 't' | 'pistols' | 'retakes' | 'late-round'
export type TrainingDevelopmentFocus = 'balanced' | 'mechanics' | 'game-sense' | 'utility' | 'leadership'

export interface TrainingSession {
  id: string
  scheduledAt: string
  type: TrainingSessionType
  intensity: TrainingIntensity
  focus: TrainingFocus
  map: TrainingMap | null
  opponentTeamId: string | null
  opponentName: string | null
  status: 'planned' | 'completed'
  reportId: string | null
}

export interface TrainingReportMetric {
  label: string
  value: number
  delta: number
}

export interface TrainingReport {
  id: string
  sessionId: string
  createdAt: string
  type: TrainingSessionType
  headline: string
  detail: string
  opponentName: string | null
  map: TrainingMap | null
  score: string | null
  metrics: TrainingReportMetric[]
  notes: string[]
}

export interface PlayerDevelopmentState {
  focus: TrainingDevelopmentFocus
  progress: number
}

export interface TrainingState {
  version: 1
  readiness: number
  tacticalCohesion: number
  sharpness: number
  mapPreparation: Record<TrainingMap, number>
  opponentKnowledge: Record<string, number>
  sessions: TrainingSession[]
  reports: TrainingReport[]
  development: Record<string, PlayerDevelopmentState>
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)))

export const createTrainingState = (): TrainingState => ({
  version: 1,
  readiness: 56,
  tacticalCohesion: 50,
  sharpness: 55,
  mapPreparation: {
    'Dust II': 54,
    Mirage: 58,
    Inferno: 55,
    Nuke: 49,
    Ancient: 54,
    Anubis: 50,
  },
  opponentKnowledge: {},
  sessions: [],
  reports: [],
  development: {},
})

const validSessionType = (value: unknown): value is TrainingSessionType =>
  value === 'team' || value === 'scrim' || value === 'map' || value === 'anti-strat' ||
  value === 'utility' || value === 'mechanics' || value === 'recovery' || value === 'match-prep'

const validIntensity = (value: unknown): value is TrainingIntensity =>
  value === 'light' || value === 'normal' || value === 'high'

const validFocus = (value: unknown): value is TrainingFocus =>
  value === 'general' || value === 'ct' || value === 't' || value === 'pistols' ||
  value === 'retakes' || value === 'late-round'

const validMap = (value: unknown): value is TrainingMap =>
  typeof value === 'string' && TRAINING_MAPS.includes(value as TrainingMap)

export const normalizeTrainingState = (raw: unknown): TrainingState => {
  const base = createTrainingState()
  if (!raw || typeof raw !== 'object') return base
  const source = raw as Partial<TrainingState>

  const sessions = Array.isArray(source.sessions)
    ? source.sessions
        .filter((item): item is TrainingSession => Boolean(
          item && typeof item === 'object' &&
          typeof (item as TrainingSession).id === 'string' &&
          typeof (item as TrainingSession).scheduledAt === 'string' &&
          validSessionType((item as TrainingSession).type),
        ))
        .map((session) => ({
          id: session.id,
          scheduledAt: session.scheduledAt,
          type: session.type,
          intensity: validIntensity(session.intensity) ? session.intensity : 'normal',
          focus: validFocus(session.focus) ? session.focus : 'general',
          map: validMap(session.map) ? session.map : null,
          opponentTeamId: typeof session.opponentTeamId === 'string' ? session.opponentTeamId : null,
          opponentName: typeof session.opponentName === 'string' ? session.opponentName : null,
          status: session.status === 'completed' ? 'completed' as const : 'planned' as const,
          reportId: typeof session.reportId === 'string' ? session.reportId : null,
        }))
        .slice(-80)
    : []

  const reports = Array.isArray(source.reports)
    ? source.reports.filter((item): item is TrainingReport => Boolean(
        item && typeof item === 'object' &&
        typeof (item as TrainingReport).id === 'string' &&
        typeof (item as TrainingReport).sessionId === 'string',
      )).slice(0, 40)
    : []

  const mapPreparation = { ...base.mapPreparation }
  if (source.mapPreparation && typeof source.mapPreparation === 'object') {
    for (const map of TRAINING_MAPS) {
      const value = source.mapPreparation[map]
      if (typeof value === 'number') mapPreparation[map] = clamp(value)
    }
  }

  const opponentKnowledge: Record<string, number> = {}
  if (source.opponentKnowledge && typeof source.opponentKnowledge === 'object') {
    for (const [teamId, value] of Object.entries(source.opponentKnowledge)) {
      if (typeof value === 'number') opponentKnowledge[teamId] = clamp(value)
    }
  }

  const development: Record<string, PlayerDevelopmentState> = {}
  if (source.development && typeof source.development === 'object') {
    for (const [playerId, value] of Object.entries(source.development)) {
      if (!value || typeof value !== 'object') continue
      const focus = (value as PlayerDevelopmentState).focus
      development[playerId] = {
        focus: focus === 'mechanics' || focus === 'game-sense' || focus === 'utility' || focus === 'leadership' ? focus : 'balanced',
        progress: Math.max(0, Math.round(Number((value as PlayerDevelopmentState).progress) || 0)),
      }
    }
  }

  return {
    version: 1,
    readiness: typeof source.readiness === 'number' ? clamp(source.readiness) : base.readiness,
    tacticalCohesion: typeof source.tacticalCohesion === 'number' ? clamp(source.tacticalCohesion) : base.tacticalCohesion,
    sharpness: typeof source.sharpness === 'number' ? clamp(source.sharpness) : base.sharpness,
    mapPreparation,
    opponentKnowledge,
    sessions,
    reports,
    development,
  }
}
