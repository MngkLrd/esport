import { useMemo, type CSSProperties } from 'react'
import { activeTournamentMatch, type GameState } from './game'
import { TOURNAMENTS, tournamentForId } from './events'
import {
  addGameDays,
  compareGameTime,
  formatGameDate,
  formatGameTime,
  gameDayKey,
  hoursBetween,
  humanTimeUntil,
  parseGameDate,
  startOfGameDay,
} from './calendar'
import { opponentForPlayerMatch, tournamentStartsAt } from './tournamentEngine'
import { TRAINING_SESSION_DEFS } from './trainingSystem'

export type TimeProgressionSpeed = 1 | 2 | 3
export type TimeProgressionStopKind = 'match' | 'decision' | 'contract' | 'injury' | 'transfer' | 'tournament' | 'message' | 'season'

export type TimeProgressionStop = {
  kind: TimeProgressionStopKind
  title: string
  detail: string
  action: 'Play' | 'Inbox' | 'Roster' | 'World' | 'HQ'
  actionLabel: string
}

export type TimeProgressionSession = {
  from: string
  target: string
  speed: TimeProgressionSpeed
  status: 'running' | 'stopped' | 'complete'
  label: string
  stop: TimeProgressionStop | null
}

type TimelineEventKind = 'training' | 'scrim' | 'recovery' | 'match' | 'tournament' | 'contract' | 'decision'

type TimelineEvent = {
  id: string
  at: string
  kind: TimelineEventKind
  label: string
  detail?: string
  important?: boolean
}

const SPEED_LABELS: Record<TimeProgressionSpeed, string> = {
  1: '▶',
  2: '▶▶',
  3: '▶▶▶',
}

const trainingEventsForDay = (state: GameState, day: string): TimelineEvent[] => {
  const key = gameDayKey(day)
  return state.training.sessions
    .filter((session) => gameDayKey(session.scheduledAt) === key)
    .map((session) => ({
      id: session.id,
      at: session.scheduledAt,
      kind: session.type === 'scrim' ? 'scrim' as const : session.type === 'recovery' ? 'recovery' as const : 'training' as const,
      label: TRAINING_SESSION_DEFS[session.type].short,
      detail: session.map ?? session.opponentName ?? session.focus.toUpperCase(),
      important: false,
    }))
    .sort((a, b) => compareGameTime(a.at, b.at))
}

const dayLabel = (value: string) => {
  const date = parseGameDate(value)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date).toUpperCase()
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase()
  return {
    weekday,
    date: String(date.getUTCDate()).padStart(2, '0'),
    month,
  }
}

const nextImportantEvent = (state: GameState) => {
  const match = activeTournamentMatch(state)
  if (match && compareGameTime(match.scheduledAt, state.now) >= 0) {
    const opponent = opponentForPlayerMatch(state.activeTournament)
    return {
      at: match.scheduledAt,
      kicker: 'NEXT OFFICIAL',
      title: opponent ? 'YOUR CLUB vs ' + opponent.name : match.label,
      meta: match.label,
    }
  }

  const activeEvent = tournamentForId(state.activeEventId)
  if (activeEvent) {
    const startsAt = tournamentStartsAt(activeEvent, state.seasonStart)
    if (compareGameTime(startsAt, state.now) >= 0) {
      return {
        at: startsAt,
        kicker: 'NEXT TOURNAMENT',
        title: activeEvent.name,
        meta: activeEvent.city + ' · TIER ' + activeEvent.circuitTier,
      }
    }
  }

  const upcoming = TOURNAMENTS
    .map((event) => ({ event, at: tournamentStartsAt(event, state.seasonStart) }))
    .filter((item) => compareGameTime(item.at, state.now) >= 0)
    .sort((a, b) => compareGameTime(a.at, b.at))[0]

  return upcoming ? {
    at: upcoming.at,
    kicker: 'UPCOMING CIRCUIT',
    title: upcoming.event.name,
    meta: upcoming.event.city + ' · TIER ' + upcoming.event.circuitTier,
  } : null
}

const timelineEventsForDay = (state: GameState, day: string): TimelineEvent[] => {
  const events = trainingEventsForDay(state, day)
  const key = gameDayKey(day)
  const match = activeTournamentMatch(state)

  if (match && gameDayKey(match.scheduledAt) === key) {
    const opponent = opponentForPlayerMatch(state.activeTournament)
    events.push({
      id: 'match-' + match.id,
      at: match.scheduledAt,
      kind: 'match',
      label: 'OFFICIAL MATCH',
      detail: opponent ? 'vs ' + opponent.name : match.label,
      important: true,
    })
  }

  const activeEvent = tournamentForId(state.activeEventId)
  if (activeEvent) {
    const startsAt = tournamentStartsAt(activeEvent, state.seasonStart)
    if (gameDayKey(startsAt) === key) {
      events.push({
        id: 'tournament-' + activeEvent.id,
        at: startsAt,
        kind: 'tournament',
        label: activeEvent.name.toUpperCase(),
        detail: activeEvent.city + ' · TIER ' + activeEvent.circuitTier,
        important: true,
      })
    }
  }

  if (state.pendingDecision && gameDayKey(state.now) === key) {
    events.push({
      id: 'decision-' + state.pendingDecision.id,
      at: state.now,
      kind: 'decision',
      label: 'DECISION REQUIRED',
      detail: state.pendingDecision.title,
      important: true,
    })
  }

  return events.sort((a, b) => compareGameTime(a.at, b.at))
}

export function TimeProgressionOverlay({
  state,
  session,
  onSpeedChange,
  onStopAction,
}: {
  state: GameState
  session: TimeProgressionSession
  onSpeedChange: (speed: TimeProgressionSpeed) => void
  onStopAction: () => void
}) {
  const important = nextImportantEvent(state)
  const elapsedHours = hoursBetween(session.from, state.now)
  const elapsedDays = Math.max(0, Math.floor(elapsedHours / 24))
  const totalHours = Math.max(1, hoursBetween(session.from, session.target))
  const progress = Math.max(0, Math.min(100, Math.round(elapsedHours / totalHours * 100)))

  const timeline = useMemo(() => {
    const start = addGameDays(startOfGameDay(session.from), -4, 0)
    const span = Math.max(15, Math.ceil(hoursBetween(session.from, session.target) / 24) + 9)
    return Array.from({ length: Math.min(24, span) }, (_, index) => addGameDays(start, index, 0))
  }, [session.from, session.target])

  const timelineStart = timeline[0] ?? startOfGameDay(session.from)
  const position = Math.max(0, hoursBetween(timelineStart, state.now) / 24)
  const trackStyle = { transform: 'translateX(calc(50% - ' + (position * 174 + 84) + 'px))' } as CSSProperties

  return (
    <div className={'time-progression-overlay status-' + session.status + ' speed-' + session.speed} role="dialog" aria-modal="true" aria-label="Промотка игрового времени">
      <section className="time-progression-shell">
        <header className="time-progression-head">
          <div className="time-progression-brand">
            <span>{session.label}</span>
            <strong>TIME PROGRESSION</strong>
          </div>

          <div className="time-progression-upcoming">
            <span>{important?.kicker ?? 'CLUB SCHEDULE'}</span>
            <strong>{important?.title ?? 'NO REQUIRED EVENT'}</strong>
            <small>{important ? important.meta + ' · ' + humanTimeUntil(state.now, important.at) : 'Продолжаем симуляцию мира'}</small>
          </div>

          <div className="time-progression-speed" aria-label="Скорость промотки">
            {([1, 2, 3] as TimeProgressionSpeed[]).map((speed) => (
              <button
                key={speed}
                type="button"
                className={session.speed === speed ? 'active' : ''}
                disabled={session.status !== 'running'}
                onClick={() => onSpeedChange(speed)}
                aria-label={speed === 1 ? 'Обычная скорость' : speed === 2 ? 'Быстрая скорость' : 'Максимальная скорость'}
              >
                {SPEED_LABELS[speed]}
              </button>
            ))}
          </div>
        </header>

        <div className="time-progression-now-copy">
          <span>SIMULATING</span>
          <strong>{formatGameDate(state.now)}</strong>
          <b>{formatGameTime(state.now)}</b>
          <small>{elapsedDays > 0 ? 'ПРОШЛО ДНЕЙ · ' + elapsedDays : 'ТЕКУЩИЙ ДЕНЬ'}</small>
        </div>

        <div className="time-progression-viewport">
          <div className="time-progression-now-marker" aria-hidden="true">
            <span>NOW</span>
            <i />
          </div>

          <div className="time-progression-track" style={trackStyle}>
            {timeline.map((day) => {
              const label = dayLabel(day)
              const events = timelineEventsForDay(state, day)
              const past = compareGameTime(addGameDays(day, 1, 0), state.now) <= 0
              const current = gameDayKey(day) === gameDayKey(state.now)
              return (
                <article key={day} className={'time-progression-day' + (past ? ' is-past' : '') + (current ? ' is-current' : '')}>
                  <header>
                    <span>{label.weekday}</span>
                    <b>{label.date}</b>
                    <small>{label.month}</small>
                  </header>
                  <div className="time-progression-events">
                    {events.map((event) => (
                      <div key={event.id} className={'time-progression-event event-' + event.kind + (event.important ? ' important' : '')}>
                        <time>{formatGameTime(event.at)}</time>
                        <span>
                          <b>{event.label}</b>
                          {event.detail && <small>{event.detail}</small>}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <footer className="time-progression-footer">
          <span>{formatGameDate(session.from)}</span>
          <i><em style={{ width: progress + '%' }} /></i>
          <span>{session.status === 'running' ? 'PROCESSING WORLD' : session.status === 'complete' ? 'UP TO DATE' : 'PAUSED'}</span>
          <span>{formatGameDate(session.target)}</span>
        </footer>

        {session.status === 'stopped' && session.stop && (
          <div className={'time-progression-stop stop-' + session.stop.kind}>
            <div>
              <span>ACTION REQUIRED · PROMOTKA STOPPED</span>
              <strong>{session.stop.title}</strong>
              <small>{session.stop.detail}</small>
            </div>
            <button type="button" onClick={onStopAction}>{session.stop.actionLabel} <b>→</b></button>
          </div>
        )}

        {session.status === 'complete' && (
          <div className="time-progression-complete">
            <span>✓</span>
            <b>TIME PROGRESSION COMPLETE</b>
          </div>
        )}
      </section>
    </div>
  )
}
