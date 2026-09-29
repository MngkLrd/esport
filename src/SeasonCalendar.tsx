import { useMemo, useState } from 'react'
import { addGameDays, addGameHours, compareGameTime, formatGameDate, formatGameDateTime, formatGameTime, gameDayKey, parseGameDate } from './calendar'
import { TOURNAMENTS } from './events'
import { canBookTournament, type GameState } from './game'
import { nextPlayerMatch, tournamentEndsAt, tournamentStartsAt } from './tournamentEngine'

const dayLabel = (value: string) => {
  const date = parseGameDate(value)
  return {
    dow: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(date).toUpperCase(),
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase(),
  }
}

const monthStartFor = (value: string, offset: number) => {
  const date = parseGameDate(value)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + offset)
  date.setUTCHours(9, 0, 0, 0)
  return date.toISOString().slice(0, 19)
}

const monthTitle = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(parseGameDate(value))
    .toUpperCase()

export function SeasonCalendar({
  state,
  displayNow,
  timeAnimating = false,
  onAdvance,
  onAdvanceToMatch,
  onOpenMatch,
  onOpenWorld,
  onBook,
}: {
  state: GameState
  displayNow?: string
  timeAnimating?: boolean
  onAdvance: (target: string) => void
  onAdvanceToMatch: () => void
  onOpenMatch: () => void
  onOpenWorld: (eventId?: string) => void
  onBook: (eventId: string) => void
}) {
  const [monthOffset, setMonthOffset] = useState(0)
  const renderNow = displayNow ?? state.now
  const nextClubMatch = nextPlayerMatch(state.activeTournament)
  const fixtureDue = Boolean(nextClubMatch && compareGameTime(nextClubMatch.scheduledAt, state.now) <= 0)
  const timeBlocked = Boolean(state.pendingDecision || fixtureDue || timeAnimating)

  const eventRows = useMemo(
    () => TOURNAMENTS.map((event) => ({
      event,
      start: tournamentStartsAt(event, state.seasonStart),
      end: tournamentEndsAt(event, state.seasonStart),
    })),
    [state.seasonStart],
  )

  const activeRows = eventRows
    .filter((item) => compareGameTime(item.end, state.now) >= 0)
    .sort((a, b) => a.start.localeCompare(b.start))
  const ongoing = activeRows.filter((item) =>
    compareGameTime(state.now, item.start) >= 0 && compareGameTime(state.now, item.end) <= 0,
  )
  const upcoming = activeRows.filter((item) => compareGameTime(state.now, item.start) < 0)

  const monthStart = monthStartFor(state.now, monthOffset)
  const monthDate = parseGameDate(monthStart)
  const year = monthDate.getUTCFullYear()
  const month = monthDate.getUTCMonth()
  const mondayOffset = (monthDate.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => addGameDays(monthStart, index, 9))
  const calendarCells: Array<string | null> = [
    ...Array.from({ length: mondayOffset }, () => null),
    ...monthDays,
  ]
  const weekRows = Math.max(4, Math.ceil(calendarCells.length / 7))

  const statusFor = (eventId: string, start: string, end: string) => {
    if (state.activeEventId === eventId) return 'REGISTERED'
    if (compareGameTime(state.now, end) > 0) return 'FINISHED'
    if (compareGameTime(state.now, start) >= 0) return 'ONGOING'
    if (compareGameTime(state.now, addGameHours(start, -72)) > 0) return 'REG CLOSED'
    return canBookTournament(state, eventId).ok ? 'REG OPEN' : 'LOCKED'
  }

  const renderEventGroup = (label: string, rows: typeof activeRows) => {
    if (!rows.length) return null
    return (
      <section className="sim-event-group">
        <header>
          <span>{label}</span>
          <b>{rows.length}</b>
        </header>
        {rows.map(({ event, start, end }) => {
          const gate = canBookTournament(state, event.id)
          const active = state.activeEventId === event.id
          const status = statusFor(event.id, start, end)
          const canRegister = !active && gate.ok && compareGameTime(state.now, addGameHours(start, -72)) <= 0
          return (
            <article key={event.id} className={'sim-event-row tier-' + event.circuitTier + (active ? ' active' : '')}>
              <div className="sim-event-badge">T{event.circuitTier}</div>
              <div className="sim-event-main">
                <small>{formatGameDate(start)} — {formatGameDate(end)}</small>
                <strong>{event.name}</strong>
                <span>{event.format} · {event.city} · {event.prize.toLocaleString('ru-RU')} кр.</span>
                <i>REG CLOSES {formatGameDateTime(addGameHours(start, -72))}</i>
              </div>
              <div className="sim-event-actions">
                <b>{status}</b>
                <button onClick={() => onOpenWorld(event.id)}>DETAILS</button>
                {canRegister && <button className="register" onClick={() => onBook(event.id)}>REGISTER</button>}
              </div>
            </article>
          )
        })}
      </section>
    )
  }

  return (
    <section className="sim-screen sim-calendar">
      <div className="sim-screen-head sim-calendar-head">
        <div>
          <span>TOURNAMENTS CALENDAR · SEASON {state.season}</span>
          <h1>CALENDAR</h1>
        </div>
        <div className="sim-head-stat sim-calendar-now">
          <small>{formatGameDate(renderNow)}</small>
          <b>{formatGameTime(renderNow)}</b>
        </div>
      </div>

      <div className="sim-calendar-controls">
        <button disabled={timeBlocked} onClick={() => onAdvance(addGameHours(state.now, 6))}>+6 HOURS</button>
        <button className="next-day" disabled={timeBlocked} onClick={() => onAdvance(addGameDays(state.now, 1, 9))}>NEXT DAY <span>→</span></button>
        <button disabled={timeBlocked} onClick={() => onAdvance(addGameDays(state.now, 3, 9))}>+3 DAYS</button>
        <button disabled={timeBlocked} onClick={() => onAdvance(addGameDays(state.now, 7, 9))}>+7 DAYS</button>
        {state.pendingDecision && <span className="sim-calendar-blocked">DECISION REQUIRED · INBOX</span>}
        {state.activeTournament && (
          fixtureDue
            ? <button className="primary" onClick={onOpenMatch}>CURRENT MATCH <span>→</span></button>
            : <button className="primary" onClick={onAdvanceToMatch}>
                {nextClubMatch ? 'ADVANCE TO MATCH' : 'ADVANCE BRACKET'} <span>→</span>
              </button>
        )}
      </div>

      <div className="sim-calendar-body">
        <section className="sim-month">
          <div className="sim-month-head">
            <button onClick={() => setMonthOffset((value) => value - 1)} aria-label="Previous month">‹</button>
            <b>{monthTitle(monthStart)}</b>
            <button onClick={() => setMonthOffset((value) => value + 1)} aria-label="Next month">›</button>
          </div>
          <div className="sim-weekdays">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="sim-month-grid" style={{ gridTemplateRows: 'repeat(' + weekRows + ', minmax(0, 1fr))' }}>
            {calendarCells.map((day, index) => {
              if (!day) return <div key={'blank-' + index} className="sim-calendar-empty" aria-hidden="true" />

              const label = dayLabel(day)
              const dayKey = gameDayKey(day)
              const current = dayKey === gameDayKey(renderNow)
              const clubMatchToday = nextClubMatch && gameDayKey(nextClubMatch.scheduledAt) === dayKey
              const starts = eventRows.filter((item) => gameDayKey(item.start) === dayKey)
              const closes = eventRows.filter((item) => gameDayKey(addGameHours(item.start, -72)) === dayKey)
              const live = eventRows.find((item) =>
                gameDayKey(item.start) < dayKey &&
                gameDayKey(item.end) >= dayKey &&
                compareGameTime(item.end, state.now) >= 0,
              )
              const markers = [
                ...starts.map((item) => ({ item, label: 'START' })),
                ...closes.map((item) => ({ item, label: 'REG' })),
              ].slice(0, clubMatchToday ? 1 : 2)

              if (!markers.length && live) markers.push({ item: live, label: 'LIVE' })

              return (
                <article key={dayKey} className={current ? 'sim-day is-today' : 'sim-day'}>
                  <header>
                    <span>{label.dow}</span>
                    <b>{label.day}</b>
                    <small>{label.month}</small>
                  </header>
                  <div className="sim-day-events">
                    {clubMatchToday && (
                      <button className="sim-day-event club-match" onClick={onOpenMatch}>
                        MATCH · {formatGameTime(nextClubMatch.scheduledAt)}
                      </button>
                    )}
                    {markers.map(({ item, label: marker }) => (
                      <button
                        key={item.event.id + '-' + marker}
                        className={'sim-day-event t' + item.event.circuitTier + ' ' + marker.toLowerCase()}
                        onClick={() => onOpenWorld(item.event.id)}
                        title={item.event.name}
                      >
                        <b>{marker}</b><span>{item.event.name}</span>
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="sim-schedule">
          <div className="sim-schedule-head">
            <span>CIRCUIT</span>
            <button onClick={() => onOpenWorld()}>WORLD MAP <b>→</b></button>
          </div>
          <div className="sim-schedule-scroll">
            {renderEventGroup('ONGOING', ongoing)}
            {renderEventGroup('UPCOMING', upcoming)}
          </div>
        </aside>
      </div>
    </section>
  )
}
