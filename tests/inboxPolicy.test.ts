import { describe, expect, it } from 'vitest'
import {
  advanceCareerTo,
  createInitialState,
  newsBelongsInInbox,
  newsRequiresAction,
  worldEventTouchesPlayerClub,
  type NewsItem,
} from '../src/game'
import { addGameHours } from '../src/calendar'
import { PLAYER_CLUB_WORLD_ID } from '../src/world'
import type { WorldHistoryEvent } from '../src/worldEcology'

const worldEvent = (
  id: string,
  actorIds: string[],
  at = '2026-01-05T10:00:00',
): WorldHistoryEvent => ({
  id,
  at,
  kind: 'transfer-completed',
  importance: 60,
  actorIds,
  title: id,
  detail: id + ' detail',
  causes: ['test'],
})

describe('club inbox policy', () => {
  it('keeps ordinary club news in Inbox but hides legacy ecology spam', () => {
    const clubNews: NewsItem = {
      id: 'lineup-1',
      week: 1,
      kind: 'lineup',
      title: 'Lineup changed',
      body: 'Club event',
    }
    const oldEcologyNews: NewsItem = {
      id: 'ecology-history-1',
      week: 1,
      kind: 'media',
      title: 'AI world event',
      body: 'Background event',
    }

    expect(newsBelongsInInbox(clubNews)).toBe(true)
    expect(newsBelongsInInbox(oldEcologyNews)).toBe(false)
  })

  it('only explicit club action items can block progression through Inbox', () => {
    const worldAction: NewsItem = {
      id: 'world-action',
      week: 1,
      kind: 'contract',
      title: 'AI offer',
      body: 'Background AI action',
      scope: 'world',
      attention: 'action',
    }
    const clubInfo: NewsItem = {
      id: 'club-info',
      week: 1,
      kind: 'media',
      title: 'Club info',
      body: 'No decision required',
      scope: 'club',
      attention: 'info',
    }
    const clubAction: NewsItem = {
      id: 'club-action',
      week: 1,
      kind: 'contract',
      title: 'Contract decision',
      body: 'Decision required',
      scope: 'club',
      attention: 'action',
    }

    expect(newsRequiresAction(worldAction)).toBe(false)
    expect(newsRequiresAction(clubInfo)).toBe(false)
    expect(newsRequiresAction(clubAction)).toBe(true)
  })

  it('classifies world history by direct involvement of YOUR CLUB or one of its players', () => {
    const state = createInitialState()
    state.roster = [{
      id: 'local-player',
      playerKey: 'hltv:123',
      alias: 'tester',
      firstName: 'Test',
      realName: 'Test Player',
      country: 'FI',
      team: 'YOUR CLUB',
      age: 21,
      role: 'Rifler',
      aim: 70,
      gameSense: 70,
      utility: 70,
      clutch: 70,
      leadership: 70,
      form: 60,
      morale: 60,
      fatigue: 0,
      potential: 80,
      salary: 80,
      contractWeeks: 20,
      traits: [],
      bio: '',
    }]

    expect(worldEventTouchesPlayerClub(state, worldEvent('club', [PLAYER_CLUB_WORLD_ID]))).toBe(true)
    expect(worldEventTouchesPlayerClub(state, worldEvent('player', ['hltv:123']))).toBe(true)
    expect(worldEventTouchesPlayerClub(state, worldEvent('ai', ['team-ai', 'hltv:999']))).toBe(false)
  })

  it('does not duplicate unrelated AI history into club news during time advance', () => {
    const state = createInitialState()
    const ecology = state.world.ecology
    expect(ecology).toBeDefined()

    const target = addGameHours(state.now, 2)
    const clubEvent = worldEvent('club-related', [PLAYER_CLUB_WORLD_ID], addGameHours(state.now, 1))
    const aiEvent = worldEvent('ai-background', ['team-ai-1', 'team-ai-2'], addGameHours(state.now, 1))

    state.world = {
      ...state.world,
      ecology: {
        ...ecology!,
        history: [clubEvent, aiEvent, ...ecology!.history],
      },
    }

    const advanced = advanceCareerTo(state, target)

    expect(advanced.news.some((item) => item.id === 'ecology-' + clubEvent.id)).toBe(true)
    expect(advanced.news.some((item) => item.id === 'ecology-' + aiEvent.id)).toBe(false)

    const clubInboxItem = advanced.news.find((item) => item.id === 'ecology-' + clubEvent.id)
    expect(clubInboxItem?.scope).toBe('club')
    expect(clubInboxItem?.attention).toBe('info')
  })
})
