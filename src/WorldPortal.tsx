import { useEffect, useMemo, useRef, useState } from 'react'
import { newsBelongsInInbox, type GameState, type NewsItem } from './game'
import {
  filterNewsFeed,
  projectWorldNews,
  selectEditorialStories,
  type NewsCategory,
  type NewsStory,
} from './newsProjection'
import { snapshotWorldEcology } from './worldEcologyAnalytics'

export type WorldPortalTarget = 'World' | 'Roster' | 'Scout' | 'Profile'

interface WorldPortalProps {
  state: GameState
  onResolveDecision: (choice: 'a' | 'b') => void
  onNavigate: (target: WorldPortalTarget) => void
  onReset: () => void
}

type PortalView = 'inbox' | 'feed' | 'news'
type FeedFilter = NewsCategory | 'all'
type InboxFilter = 'all' | 'new' | 'tasks' | 'unread'

const FEED_PAGE_SIZE = 24

const FEED_FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: 'all', label: 'ВСЕ' },
  { id: 'competition', label: 'ТУРНИРЫ' },
  { id: 'market', label: 'РЫНОК' },
  { id: 'ecosystem', label: 'СЦЕНА' },
]

const INBOX_FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'ВСЕ' },
  { id: 'new', label: 'НОВЫЕ' },
  { id: 'tasks', label: 'ЗАДАЧИ' },
  { id: 'unread', label: 'НЕПРОЧИТАННЫЕ' },
]

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  competition: 'ТУРНИРЫ',
  market: 'РЫНОК',
  ecosystem: 'СЦЕНА',
}

const CATEGORY_GLYPH: Record<NewsCategory, string> = {
  competition: '◆',
  market: '↗',
  ecosystem: '◎',
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value.endsWith('Z') ? value : value + 'Z'))
    .toUpperCase()

const newsTarget = (item: NewsItem): WorldPortalTarget | null =>
  item.kind === 'contract' || item.kind === 'lineup'
    ? 'Roster'
    : item.kind === 'scout'
      ? 'Scout'
      : item.kind === 'finance'
        ? 'Profile'
        : item.kind === 'match' || item.kind === 'media'
          ? 'World'
          : null

const storyTarget = (story: NewsStory): WorldPortalTarget =>
  story.category === 'market' ? 'Scout' : 'World'

const usePersistentSet = (key: string) => {
  const [values, setValues] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = window.localStorage.getItem(key)
      return new Set(stored ? JSON.parse(stored) as string[] : [])
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify([...values]))
    } catch {
      // News preferences are non-critical. A blocked storage API must not break the game.
    }
  }, [key, values])

  const toggle = (value: string) => setValues((current) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })

  const add = (value: string) => setValues((current) => {
    if (current.has(value)) return current
    const next = new Set(current)
    next.add(value)
    return next
  })

  return { values, toggle, add }
}

function StoryArt({ story, hero = false }: { story: NewsStory; hero?: boolean }) {
  return (
    <div
      className={'newsroom-art art-' + story.category + ' art-v' + story.image.variant + (hero ? ' is-hero' : '')}
      aria-label={story.image.alt || undefined}
      aria-hidden={story.image.alt ? undefined : true}
    >
      <div className="newsroom-art-grid" />
      {story.image.src ? (
        <img
          src={story.image.src}
          alt={story.image.alt}
          loading={hero ? 'eager' : 'lazy'}
          decoding="async"
          className={'newsroom-art-image image-' + story.image.kind}
        />
      ) : (
        <span className="newsroom-art-glyph">{CATEGORY_GLYPH[story.category]}</span>
      )}
      <div className="newsroom-art-caption">
        <span>{CATEGORY_LABEL[story.category]}</span>
        <b>{story.importance}</b>
      </div>
    </div>
  )
}

function WorldContext({ state }: { state: GameState }) {
  const ecology = state.world.ecology
  const snapshot = useMemo(() => snapshotWorldEcology(state.world, state.now), [state.world, state.now])
  const upcoming = useMemo(
    () => Object.values(ecology?.competitions ?? {})
      .filter((competition) => competition.status === 'announced' || competition.status === 'running')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 5),
    [ecology?.competitions],
  )
  const standings = useMemo(
    () => state.world.teams
      .filter((team) => team.active !== false)
      .sort((a, b) => a.vrsRank - b.vrsRank)
      .slice(0, 7),
    [state.world.teams],
  )

  return (
    <aside className="newsroom-context">
      <section>
        <div className="newsroom-section-title"><span>БЛИЖАЙШИЕ СОБЫТИЯ</span><b>{upcoming.length}</b></div>
        <div className="newsroom-events">
          {upcoming.map((competition) => (
            <article key={competition.id}>
              <span>T{competition.tier} · {competition.region} · {competition.format}</span>
              <strong>{competition.name}</strong>
              <small>{formatDate(competition.startsAt)} · {competition.status.toUpperCase()}</small>
            </article>
          ))}
          {upcoming.length === 0 && <div className="newsroom-empty compact">Нет объявленных турниров.</div>}
        </div>
      </section>

      <section>
        <div className="newsroom-section-title"><span>VRS</span><b>TOP 7</b></div>
        <div className="newsroom-standings">
          {standings.map((team) => (
            <div key={team.id}>
              <b>{team.vrsRank}</b>
              <span>{team.name}</span>
              <strong>{Math.round(team.vrsPoints)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="newsroom-pulse">
        <div className="newsroom-section-title"><span>ПУЛЬС МИРА</span><b>LIVE</b></div>
        <div><span>КОМАНДЫ</span><b>{snapshot.activeTeams}</b></div>
        <div><span>ИГРОКИ</span><b>{snapshot.activePlayers}</b></div>
        <div><span>ОПЕРАТОРЫ</span><b>{snapshot.activeOperators}</b></div>
        <div><span>ТРАНСФЕРЫ 365Д</span><b>{snapshot.transfersLast365Days}</b></div>
      </section>
    </aside>
  )
}

export function WorldPortal({ state, onResolveDecision, onNavigate, onReset }: WorldPortalProps) {
  const [view, setView] = useState<PortalView>('news')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all')
  const [followedOnly, setFollowedOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const clubRead = usePersistentSet('esport-news:club-read:' + state.saveId)
  const storyRead = usePersistentSet('esport-news:story-read:' + state.saveId)
  const followed = usePersistentSet('esport-news:followed:' + state.saveId)

  const clubNews = useMemo(() => state.news.filter(newsBelongsInInbox), [state.news])
  const worldEvents = useMemo(
    () => [...(state.world.ecology?.history ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.importance - a.importance),
    [state.world.ecology?.history],
  )
  const stories = useMemo(
    () => projectWorldNews(state, worldEvents),
    [state, worldEvents],
  )
  const editorial = useMemo(() => selectEditorialStories(stories, 9), [stories])
  const feed = useMemo(
    () => filterNewsFeed(stories, feedFilter, followed.values, followedOnly),
    [stories, feedFilter, followed.values, followedOnly],
  )
  const visibleFeed = useMemo(() => feed.slice(0, visibleCount), [feed, visibleCount])

  const unreadClubCount = useMemo(
    () => clubNews.filter((item) => !clubRead.values.has(item.id)).length,
    [clubNews, clubRead.values],
  )
  const unreadStoryCount = useMemo(
    () => stories.filter((story) => !storyRead.values.has(story.id)).length,
    [stories, storyRead.values],
  )

  const filteredInbox = useMemo(() => clubNews.filter((item, index) => {
    if (inboxFilter === 'tasks') return item.attention === 'action'
    if (inboxFilter === 'unread') return !clubRead.values.has(item.id)
    if (inboxFilter === 'new') return !clubRead.values.has(item.id) && (item.week >= state.week - 1 || index < 5)
    return true
  }), [clubNews, inboxFilter, clubRead.values, state.week])

  const subscriptionCandidates = useMemo(() => {
    const candidates: Array<{ id: string; label: string; meta: string }> = []
    state.world.teams
      .filter((team) => team.active !== false)
      .sort((a, b) => a.vrsRank - b.vrsRank)
      .slice(0, 9)
      .forEach((team) => candidates.push({ id: team.id, label: team.name, meta: 'TEAM · #' + team.vrsRank }))

    const recentPlayers = new Set<string>()
    for (const event of worldEvents) {
      for (const actorId of event.actorIds) {
        const player = state.world.players[actorId]
        if (!player || recentPlayers.has(actorId)) continue
        recentPlayers.add(actorId)
        candidates.push({ id: actorId, label: player.alias, meta: 'PLAYER · ' + (player.role ?? 'PRO') })
        if (recentPlayers.size >= 4) break
      }
      if (recentPlayers.size >= 4) break
    }

    Object.values(state.world.ecology?.operators ?? {})
      .filter((operator) => operator.active)
      .slice(0, 4)
      .forEach((operator) => candidates.push({ id: operator.id, label: operator.name, meta: 'OPERATOR · ' + operator.region }))

    return candidates
  }, [state.world, worldEvents])

  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE)
  }, [feedFilter, followedOnly])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || visibleCount >= feed.length || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(feed.length, current + FEED_PAGE_SIZE))
      }
    }, { rootMargin: '500px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [feed.length, visibleCount])

  const openClubItem = (item: NewsItem) => {
    clubRead.add(item.id)
    const target = newsTarget(item)
    if (target) onNavigate(target)
  }

  const openStory = (story: NewsStory) => {
    storyRead.add(story.id)
    onNavigate(storyTarget(story))
  }

  return (
    <section className="newsroom">
      <header className="newsroom-head">
        <div className="newsroom-brand">
          <span>WORLD MEDIA · {formatDate(state.now)}</span>
          <h1>НОВОСТИ</h1>
        </div>
        <nav className="newsroom-tabs" aria-label="Разделы новостей">
          <button className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>
            ВХОДЯЩИЕ {unreadClubCount > 0 && <b>{unreadClubCount}</b>}
          </button>
          <button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')}>
            НОВОСТНАЯ ЛЕНТА {unreadStoryCount > 0 && <b>{Math.min(99, unreadStoryCount)}</b>}
          </button>
          <button className={view === 'news' ? 'active' : ''} onClick={() => setView('news')}>
            НОВОСТИ
          </button>
        </nav>
      </header>

      {view === 'inbox' && (
        <div className="newsroom-inbox-layout">
          <main className="newsroom-inbox">
            <div className="newsroom-toolbar">
              <div><span>ВХОДЯЩИЕ</span><b>{filteredInbox.length} СООБЩЕНИЙ</b></div>
              <nav aria-label="Фильтры входящих">
                {INBOX_FILTERS.map((entry) => (
                  <button key={entry.id} className={inboxFilter === entry.id ? 'active' : ''} onClick={() => setInboxFilter(entry.id)}>
                    {entry.label}
                  </button>
                ))}
              </nav>
            </div>

            {state.pendingDecision && (
              <article className={'sim-decision-card decision-' + state.pendingDecision.kind + ' newsroom-decision'}>
                <span>ТРЕБУЕТСЯ РЕШЕНИЕ</span>
                <h2>{state.pendingDecision.title}</h2>
                <p>{state.pendingDecision.body}</p>
                <div>
                  <button onClick={() => onResolveDecision('a')}>{state.pendingDecision.optionA}</button>
                  <button onClick={() => onResolveDecision('b')}>{state.pendingDecision.optionB}</button>
                </div>
              </article>
            )}

            <div className="newsroom-inbox-list">
              {filteredInbox.map((item) => {
                const unread = !clubRead.values.has(item.id)
                const target = newsTarget(item)
                return (
                  <article key={item.id} className={unread ? 'is-unread' : ''}>
                    <div className="newsroom-inbox-icon">{item.attention === 'action' ? '!' : '•'}</div>
                    <div>
                      <span>W{item.week} · {item.kind.toUpperCase()} {item.attention === 'action' ? '· TASK' : ''}</span>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                    <div className="newsroom-inbox-actions">
                      {unread && <button onClick={() => clubRead.add(item.id)}>ПРОЧИТАНО</button>}
                      {target && <button className="primary" onClick={() => openClubItem(item)}>ОТКРЫТЬ →</button>}
                    </div>
                  </article>
                )
              })}
              {filteredInbox.length === 0 && <div className="newsroom-empty">В этой категории нет сообщений.</div>}
            </div>
          </main>
          <aside className="newsroom-inbox-side">
            <section>
              <div className="newsroom-section-title"><span>ФОКУС МЕНЕДЖЕРА</span><b>{state.pendingDecision ? 'ACTION' : 'CLEAR'}</b></div>
              <div className="newsroom-focus">
                <strong>{state.pendingDecision ? state.pendingDecision.title : 'Критических решений нет'}</strong>
                <p>{state.pendingDecision ? 'Ответ требуется до дальнейшей промотки времени.' : 'Можно продолжать календарь. Новые задачи появятся здесь автоматически.'}</p>
              </div>
            </section>
            <button className="newsroom-reset" onClick={onReset}>RESET SAVE</button>
          </aside>
        </div>
      )}

      {view === 'news' && (
        <div className="newsroom-news-layout">
          <main className="newsroom-editorial">
            {editorial.hero ? (
              <article className="newsroom-hero">
                <StoryArt story={editorial.hero} hero />
                <div className="newsroom-hero-copy">
                  <div className="newsroom-story-meta">
                    <span>ГЛАВНАЯ НОВОСТЬ · {CATEGORY_LABEL[editorial.hero.category]}</span>
                    <b>{formatDate(editorial.hero.at)}</b>
                  </div>
                  <h2>{editorial.hero.title}</h2>
                  <p>{editorial.hero.detail}</p>
                  <div className="newsroom-hero-footer">
                    <small>{editorial.hero.causes.slice(0, 2).join(' · ')}</small>
                    <button onClick={() => openStory(editorial.hero!)}>ОТКРЫТЬ КОНТЕКСТ →</button>
                  </div>
                </div>
              </article>
            ) : <div className="newsroom-empty">Мир ещё не создал достаточно событий для выпуска.</div>}

            <div className="newsroom-editorial-head">
              <div><span>КАРТИНА ДНЯ</span><b>ОТОБРАНО РЕДАКЦИЕЙ</b></div>
              <span>{stories.length} СОБЫТИЙ В АРХИВЕ</span>
            </div>

            <div className="newsroom-story-grid">
              {editorial.stories.map((story, index) => (
                <article key={story.id} className={'newsroom-story-card ' + (index < 2 ? 'featured' : '')}>
                  <StoryArt story={story} />
                  <div>
                    <div className="newsroom-story-meta">
                      <span>{CATEGORY_LABEL[story.category]}</span>
                      <b>{formatDate(story.at)}</b>
                    </div>
                    <h3>{story.title}</h3>
                    <p>{story.detail}</p>
                    <button onClick={() => openStory(story)}>К КОНТЕКСТУ →</button>
                  </div>
                </article>
              ))}
            </div>
          </main>
          <WorldContext state={state} />
        </div>
      )}

      {view === 'feed' && (
        <div className="newsroom-feed-layout">
          <main className="newsroom-feed-panel">
            <div className="newsroom-toolbar newsroom-feed-toolbar">
              <div><span>НОВОСТНАЯ ЛЕНТА</span><b>{feed.length} СОБЫТИЙ</b></div>
              <nav aria-label="Фильтры новостной ленты">
                {FEED_FILTERS.map((entry) => (
                  <button key={entry.id} className={feedFilter === entry.id ? 'active' : ''} onClick={() => setFeedFilter(entry.id)}>
                    {entry.label}
                  </button>
                ))}
                <button className={followedOnly ? 'active' : ''} onClick={() => setFollowedOnly((value) => !value)}>ПОДПИСКИ</button>
              </nav>
            </div>

            <div className="newsroom-feed">
              {visibleFeed.map((story, index) => {
                const unread = !storyRead.values.has(story.id)
                const showArt = story.importance >= 45 || index % 5 === 0
                return (
                  <article key={story.id} className={unread ? 'is-unread' : ''}>
                    {showArt && <StoryArt story={story} />}
                    <div className="newsroom-feed-copy">
                      <div className="newsroom-story-meta">
                        <span>{CATEGORY_LABEL[story.category]} · {formatDate(story.at)}</span>
                        <b>{story.eventIds.length > 1 ? story.eventIds.length + ' UPDATES' : 'IMP ' + story.importance}</b>
                      </div>
                      <h3>{story.title}</h3>
                      <p>{story.detail}</p>
                      <div className="newsroom-feed-actions">
                        <small>{story.causes.slice(0, 2).join(' · ')}</small>
                        <button onClick={() => openStory(story)}>К КОНТЕКСТУ →</button>
                      </div>
                    </div>
                  </article>
                )
              })}
              {feed.length === 0 && <div className="newsroom-empty">По выбранным фильтрам событий нет.</div>}
              {visibleCount < feed.length && (
                <div ref={loadMoreRef} className="newsroom-load-more" aria-live="polite">
                  <span>ПОДГРУЗКА ЛЕНТЫ</span>
                  <b>{visibleFeed.length} / {feed.length}</b>
                </div>
              )}
            </div>
          </main>

          <aside className="newsroom-subscriptions">
            <section>
              <div className="newsroom-section-title"><span>ПОДПИСКИ</span><b>{followed.values.size}</b></div>
              <p className="newsroom-subscriptions-copy">Подписки не меняют мир. Они только настраивают вашу персональную ленту.</p>
              <div className="newsroom-follow-list">
                {subscriptionCandidates.map((candidate) => {
                  const active = followed.values.has(candidate.id)
                  return (
                    <button key={candidate.id} className={active ? 'active' : ''} onClick={() => followed.toggle(candidate.id)}>
                      <span><b>{candidate.label}</b><small>{candidate.meta}</small></span>
                      <strong>{active ? '✓' : '+'}</strong>
                    </button>
                  )
                })}
              </div>
            </section>
            <section className="newsroom-feed-stats">
              <div className="newsroom-section-title"><span>ЛЕНТА</span><b>LIVE</b></div>
              <div><span>НЕПРОЧИТАНО</span><b>{unreadStoryCount}</b></div>
              <div><span>ПОКАЗАНО</span><b>{visibleFeed.length}</b></div>
              <div><span>СГРУППИРОВАНО</span><b>{Math.max(0, worldEvents.length - stories.length)}</b></div>
            </section>
          </aside>
        </div>
      )}
    </section>
  )
}
