import type { GameState } from './game'
import { playerPhoto } from './playerVisuals'
import { teamVisualLogo } from './visualIdentity'
import type { WorldHistoryEvent, WorldHistoryKind } from './worldEcology'

export type NewsCategory = 'competition' | 'market' | 'ecosystem'
export type NewsImageKind = 'player' | 'team' | 'procedural'

export interface NewsStoryImage {
  kind: NewsImageKind
  src: string | null
  alt: string
  variant: number
}

export interface NewsStory {
  id: string
  eventIds: string[]
  at: string
  kind: WorldHistoryKind
  category: NewsCategory
  importance: number
  editorialScore: number
  title: string
  detail: string
  causes: string[]
  actorIds: string[]
  image: NewsStoryImage
}

export interface EditorialSelection {
  hero: NewsStory | null
  stories: NewsStory[]
}

const COMPETITION_KINDS = new Set<WorldHistoryKind>(['tournament-created', 'tournament-completed'])
const MARKET_KINDS = new Set<WorldHistoryKind>(['transfer-offer', 'transfer-completed', 'contract-expired'])

const asDate = (value: string) => new Date(value.endsWith('Z') ? value : value + 'Z')

const hash = (value: string) => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export const categoryForWorldEvent = (kind: WorldHistoryKind): NewsCategory =>
  COMPETITION_KINDS.has(kind) ? 'competition' : MARKET_KINDS.has(kind) ? 'market' : 'ecosystem'

const familyForEvent = (event: WorldHistoryEvent) => {
  if (event.kind === 'transfer-offer' || event.kind === 'transfer-completed') return 'transfer'
  if (event.kind === 'tournament-created' || event.kind === 'tournament-completed') return 'tournament'
  if (event.kind === 'team-founded' || event.kind === 'team-dissolved') return 'team-life'
  if (event.kind === 'operator-founded' || event.kind === 'operator-dissolved') return 'operator-life'
  return event.kind
}

const storyKey = (event: WorldHistoryEvent) =>
  familyForEvent(event) + ':' + [...event.actorIds].sort().slice(0, 3).join(':')

const recencyScore = (event: WorldHistoryEvent, now: string) => {
  const hours = Math.max(0, (asDate(now).getTime() - asDate(event.at).getTime()) / 3_600_000)
  return 30 * Math.exp(-hours / 120)
}

const kindBonus = (kind: WorldHistoryKind) => {
  switch (kind) {
    case 'tournament-completed': return 24
    case 'transfer-completed': return 16
    case 'team-founded':
    case 'operator-founded': return 12
    case 'team-dissolved':
    case 'operator-dissolved': return 14
    case 'player-retired': return 9
    case 'economic-shock': return 10
    default: return 0
  }
}

export const editorialScoreForEvent = (event: WorldHistoryEvent, now: string) =>
  Math.round((event.importance * 1.35 + kindBonus(event.kind) + recencyScore(event, now)) * 10) / 10

const imageForEvent = (state: Pick<GameState, 'world'>, event: WorldHistoryEvent): NewsStoryImage => {
  for (const actorId of event.actorIds) {
    const player = state.world.players[actorId]
    if (!player) continue
    const src = playerPhoto(player.alias)
    if (src) {
      return {
        kind: 'player',
        src,
        alt: player.alias + ' player portrait',
        variant: hash(event.id) % 8,
      }
    }
  }

  for (const actorId of event.actorIds) {
    const team = state.world.teams.find((candidate) => candidate.id === actorId)
    if (!team) continue
    const src = teamVisualLogo(team.name)?.logoUrl ?? null
    if (src) {
      return {
        kind: 'team',
        src,
        alt: team.name + ' team logo',
        variant: hash(event.id) % 8,
      }
    }
  }

  return {
    kind: 'procedural',
    src: null,
    alt: '',
    variant: hash(event.id + ':' + event.kind) % 8,
  }
}

const mergeEvents = (
  state: Pick<GameState, 'world' | 'now'>,
  events: WorldHistoryEvent[],
): NewsStory[] => {
  const ordered = [...events].sort((a, b) => b.at.localeCompare(a.at) || b.importance - a.importance)
  const stories: NewsStory[] = []
  const latestByKey = new Map<string, NewsStory>()

  for (const event of ordered) {
    const key = storyKey(event)
    const existing = latestByKey.get(key)
    const withinWindow = existing &&
      Math.abs(asDate(existing.at).getTime() - asDate(event.at).getTime()) <= 48 * 3_600_000

    if (existing && withinWindow) {
      existing.eventIds.push(event.id)
      existing.importance = Math.max(existing.importance, event.importance)
      existing.editorialScore = Math.max(existing.editorialScore, editorialScoreForEvent(event, state.now))
      existing.causes = [...new Set([...existing.causes, ...event.causes])].slice(0, 4)
      existing.actorIds = [...new Set([...existing.actorIds, ...event.actorIds])]
      continue
    }

    const story: NewsStory = {
      id: event.id,
      eventIds: [event.id],
      at: event.at,
      kind: event.kind,
      category: categoryForWorldEvent(event.kind),
      importance: event.importance,
      editorialScore: editorialScoreForEvent(event, state.now),
      title: event.title,
      detail: event.detail,
      causes: event.causes.slice(0, 4),
      actorIds: [...event.actorIds],
      image: imageForEvent(state, event),
    }
    stories.push(story)
    latestByKey.set(key, story)
  }

  return stories
}

export const projectWorldNews = (
  state: Pick<GameState, 'world' | 'now'>,
  events: WorldHistoryEvent[],
) => mergeEvents(state, events)

export const selectEditorialStories = (
  stories: NewsStory[],
  limit = 9,
): EditorialSelection => {
  if (!stories.length) return { hero: null, stories: [] }

  const ranked = [...stories].sort((a, b) =>
    b.editorialScore - a.editorialScore ||
    b.at.localeCompare(a.at) ||
    a.id.localeCompare(b.id),
  )
  const hero = ranked[0]
  const selected: NewsStory[] = []
  const categoryCounts: Record<NewsCategory, number> = { competition: 0, market: 0, ecosystem: 0 }
  const actorExposure = new Map<string, number>()

  for (const story of ranked.slice(1)) {
    if (selected.length >= limit - 1) break
    const repeatedActor = story.actorIds.some((actorId) => (actorExposure.get(actorId) ?? 0) >= 2)
    if (categoryCounts[story.category] >= 3 || repeatedActor) continue
    selected.push(story)
    categoryCounts[story.category] += 1
    story.actorIds.forEach((actorId) => actorExposure.set(actorId, (actorExposure.get(actorId) ?? 0) + 1))
  }

  if (selected.length < limit - 1) {
    for (const story of ranked.slice(1)) {
      if (selected.length >= limit - 1) break
      if (!selected.some((candidate) => candidate.id === story.id)) selected.push(story)
    }
  }

  return { hero, stories: selected }
}

export const filterNewsFeed = (
  stories: NewsStory[],
  category: NewsCategory | 'all',
  followedActorIds: ReadonlySet<string>,
  followedOnly: boolean,
) =>
  stories.filter((story) =>
    (category === 'all' || story.category === category) &&
    (!followedOnly || story.actorIds.some((actorId) => followedActorIds.has(actorId))),
  )

export const newsStoryTouchesActors = (story: NewsStory, actorIds: ReadonlySet<string>) =>
  story.actorIds.some((actorId) => actorIds.has(actorId))
