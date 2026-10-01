import { describe, expect, it } from 'vitest'
import { addGameHours } from '../src/calendar'
import { createInitialState } from '../src/game'
import {
  categoryForWorldEvent,
  filterNewsFeed,
  projectWorldNews,
  selectEditorialStories,
} from '../src/newsProjection'
import type { WorldHistoryEvent, WorldHistoryKind } from '../src/worldEcology'

const event = (
  id: string,
  kind: WorldHistoryKind,
  at: string,
  importance: number,
  actorIds: string[] = [],
): WorldHistoryEvent => ({
  id,
  kind,
  at,
  importance,
  actorIds,
  title: id + ' headline',
  detail: id + ' detail',
  causes: ['simulation'],
})

describe('world news projections', () => {
  it('classifies world history into stable editorial categories', () => {
    expect(categoryForWorldEvent('tournament-completed')).toBe('competition')
    expect(categoryForWorldEvent('transfer-completed')).toBe('market')
    expect(categoryForWorldEvent('operator-founded')).toBe('ecosystem')
  })

  it('coalesces related market updates without mutating the world ledger', () => {
    const state = createInitialState()
    const playerKey = Object.keys(state.world.players)[0]
    const teamId = state.world.teams[0].id
    const offer = event('offer', 'transfer-offer', addGameHours(state.now, 1), 22, [teamId, playerKey])
    const completed = event('done', 'transfer-completed', addGameHours(state.now, 4), 62, [teamId, playerKey])
    const source = [offer, completed]

    const stories = projectWorldNews({ ...state, now: addGameHours(state.now, 5) }, source)

    expect(source).toHaveLength(2)
    expect(stories).toHaveLength(1)
    expect(stories[0].id).toBe('done')
    expect(stories[0].eventIds).toEqual(expect.arrayContaining(['offer', 'done']))
    expect(stories[0].importance).toBe(62)
  })

  it('uses importance and event semantics to choose a hero while keeping a balanced secondary slate', () => {
    const state = createInitialState()
    const now = addGameHours(state.now, 12)
    const events = [
      event('major-final', 'tournament-completed', addGameHours(state.now, 8), 92, ['operator-a', 'team-a']),
      event('transfer', 'transfer-completed', addGameHours(state.now, 9), 68, ['team-b', 'player-b']),
      event('new-team', 'team-founded', addGameHours(state.now, 10), 55, ['team-c']),
      event('minor-event', 'tournament-created', addGameHours(state.now, 11), 25, ['operator-d']),
    ]

    const stories = projectWorldNews({ ...state, now }, events)
    const editorial = selectEditorialStories(stories, 4)

    expect(editorial.hero?.id).toBe('major-final')
    expect(new Set(editorial.stories.map((story) => story.category))).toEqual(
      new Set(['market', 'ecosystem', 'competition']),
    )
  })

  it('filters the chronological feed by category and subscriptions', () => {
    const state = createInitialState()
    const stories = projectWorldNews(state, [
      event('market-a', 'transfer-completed', state.now, 60, ['team-followed', 'player-a']),
      event('market-b', 'transfer-completed', state.now, 58, ['team-other', 'player-b']),
      event('event-a', 'tournament-created', state.now, 45, ['operator-a']),
    ])

    const followed = new Set(['team-followed'])
    expect(filterNewsFeed(stories, 'market', followed, false).map((story) => story.id).sort()).toEqual(['market-a', 'market-b'])
    expect(filterNewsFeed(stories, 'all', followed, true).map((story) => story.id)).toEqual(['market-a'])
  })

  it('assigns deterministic procedural artwork when no identity image exists', () => {
    const state = createInitialState()
    const source = [event('synthetic-story', 'economic-shock', state.now, 50, ['unknown-actor'])]
    const first = projectWorldNews(state, source)[0]
    const second = projectWorldNews(state, source)[0]

    expect(first.image.kind).toBe('procedural')
    expect(first.image.src).toBeNull()
    expect(first.image.variant).toBe(second.image.variant)
  })
})
