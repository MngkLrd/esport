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

const routineForDay = (day: string): TimelineEvent[] => {
  const date = parseGameDate(day)
  const weekday = date.getUTCDay()
  const key = gameDayKey(day)
  const at = (hour: number) => key + 'T' + String(hour).padStart(2, '0') + ':00:00'

  if (weekday === 0) return [
    { id: key + '-recovery', at: at(10), kind: 'recovery', label: 'RECOVERY', detail: 'Восстановление состава' },
  ]
  if (weekday === 1) return [
    { id: key + '-review', at: at(10), kind: 'training', label: 'TEAM REVIEW', detail: 'Разбор предыдущей недели' },
    { id: key + '-aim', at: at(15), kind: 'training', label: 'AIM TRAINING', detail: 'Индивидуальная работа' },
  ]
  if (weekday === 2) return [
    { id: key + '-tactics', at: at(11), kind: 'training', label: 'TACTICAL', detail: 'Командная структура' },
    { id: key + '-scrim', at: at(18), kind: 'scrim', label: 'SCRIM', detail: 'Тренировочная серия' },
  ]
  if (weekday === 3) return [
    { id: key + '-recovery', at: at(9), kind: 'recovery', label: 'RECOVERY', detail: 'Лёгкий день' },
    { id: key + '-utility', at: at(15), kind: 'training', label: 'UTILITY LAB', detail: 'Гранаты и сетапы' },
  ]
  if (weekday === 4) return [
    { id: key + '-team', at: at(12), kind: 'training', label: 'TEAM TRAINING', detail: 'Полная сессия' },
    { id: key + '-scrim', at: at(19), kind: 'scrim', label: 'SCRIM', detail: 'BO3 practice' },
  ]
  if (weekday === 5) return [
    { id: key + '-prep', at: at(13), kind: 'training', label: 'MATCH PREP', detail: 'Подготовка к серии' },
  ]
  return [
    { id: key + '-recovery', at: at(10), kind: 'recovery', label: 'RECOVERY', detail: 'Сброс усталости' },
    { id: key + '-review', at: at(17), kind: 'training', label: 'DEMO REVIEW', detail: 'Подготовка штаба' },
  ]
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
  const events = routineForDay(day)
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
  const trackStyle = { '--tp-position': position } as CSSProperties

  return (
    <div className={'time-progression-overlay status-' + session.status} role="dialog" aria-modal="true" aria-label="Промотка игрового времени">
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
