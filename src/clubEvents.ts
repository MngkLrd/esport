export type ClubEventKind =
  | 'match'
  | 'tournament'
  | 'transfer'
  | 'contract'
  | 'finance'
  | 'scouting'
  | 'lineup'
  | 'media'
  | 'vrs'
  | 'training'

export interface ClubEvent {
  id: string
  at: string
  week: number
  kind: ClubEventKind
  title: string
  detail: string
  importance: number
  actorIds: string[]
  teamIds: string[]
  sourceId?: string | null
  financeEntryIds?: string[]
  data?: Record<string, unknown>
}

export const appendClubEvent = (
  source: ClubEvent[],
  event: ClubEvent,
  limit = 600,
) => {
  if (source.some((candidate) => candidate.id === event.id)) return source
  return [event, ...source].slice(0, limit)
}

export const eventsForPlayer = (events: ClubEvent[], playerId: string) =>
  events.filter((event) => event.actorIds.includes(playerId))

export const eventsForTeam = (events: ClubEvent[], teamId: string) =>
  events.filter((event) => event.teamIds.includes(teamId))

export const eventsByKind = (events: ClubEvent[], kind: ClubEventKind) =>
  events.filter((event) => event.kind === kind)

export const careerTimeline = (events: ClubEvent[], limit = 80) =>
  [...events]
    .sort((a, b) => b.at.localeCompare(a.at) || b.importance - a.importance)
    .slice(0, limit)

export const matchHistoryEvents = (events: ClubEvent[]) =>
  eventsByKind(events, 'match')

export const matchHistoryFromEvents = <T,>(events: ClubEvent[]): T[] =>
  careerTimeline(events, 600)
    .filter((event) => event.kind === 'match' && event.data?.matchSnapshot)
    .map((event) => event.data?.matchSnapshot as T)

export const vrsDeltaFromEvents = (events: ClubEvent[]) =>
  events.reduce((sum, event) => {
    const value = event.data?.vrsDelta
    return sum + (typeof value === 'number' ? value : 0)
  }, 0)

export const clubVrsFromEvents = (events: ClubEvent[], openingPoints = 720) =>
  Math.max(0, Math.round(openingPoints + vrsDeltaFromEvents(events)))

export const normalizeClubEvents = (raw: unknown): ClubEvent[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is ClubEvent =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof (entry as ClubEvent).id === 'string' &&
        typeof (entry as ClubEvent).at === 'string' &&
        typeof (entry as ClubEvent).kind === 'string',
      ),
    )
    .slice(0, 600)
}

export const eventNewsKind = (event: ClubEvent) => {
  if (event.kind === 'transfer' || event.kind === 'contract') return 'contract' as const
  if (event.kind === 'finance') return 'finance' as const
  if (event.kind === 'scouting') return 'scout' as const
  if (event.kind === 'lineup') return 'lineup' as const
  if (event.kind === 'match' || event.kind === 'tournament' || event.kind === 'vrs') return 'match' as const
  return 'media' as const
}

export const projectEventToNews = (event: ClubEvent) => {
  const requestedId = event.data?.newsId
  const requestedScope = event.data?.newsScope
  const requestedAttention = event.data?.newsAttention
  const scope: 'club' | 'world' | undefined =
    requestedScope === 'club' || requestedScope === 'world' ? requestedScope : undefined
  const attention: 'info' | 'action' | undefined =
    requestedAttention === 'info' || requestedAttention === 'action' ? requestedAttention : undefined

  return {
    id: typeof requestedId === 'string' ? requestedId : 'event-news-' + event.id,
    week: event.week,
    kind: eventNewsKind(event),
    title: event.title,
    body: event.detail,
    ...(scope ? { scope } : {}),
    ...(attention ? { attention } : {}),
  }
}
