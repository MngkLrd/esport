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

export function SeasonCalendar({
  state,
  onAdvance,
  onAdvanceToMatch,
  onOpenMatch,
  onOpenWorld,
}: {
  state: GameState
  onAdvance: (target: string) => void
  onAdvanceToMatch: () => void
  onOpenMatch: () => void
  onOpenWorld: () => void
}) {
  const days = Array.from({ length: 28 }, (_, index) => addGameDays(state.now, index, 9))
  const nextClubMatch = nextPlayerMatch(state.activeTournament)
  const fixtureDue = Boolean(nextClubMatch && compareGameTime(nextClubMatch.scheduledAt, state.now) <= 0)
  const timeBlocked = Boolean(state.pendingDecision || fixtureDue)

  const upcoming = TOURNAMENTS
    .map((event) => ({
      event,
      start: tournamentStartsAt(event, state.seasonStart),
      end: tournamentEndsAt(event, state.seasonStart),
    }))
    .filter((item) => item.end >= state.now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 10)

  return (
    <section className="screen season-calendar-screen">
      <div className="fifa-screen-header">
        <div>
          <span>CAREER CLOCK · SEASON {state.season}</span>
          <h1>CALENDAR</h1>
        </div>
        <div className="calendar-now">
          <small>{formatGameDate(state.now)}</small>
          <b>{formatGameTime(state.now)}</b>
        </div>
      </div>

      <div className="calendar-controls">
        <button disabled={timeBlocked} onClick={() => onAdvance(addGameHours(state.now, 6))}>+6 HOURS</button>
        <button disabled={timeBlocked} onClick={() => onAdvance(addGameDays(state.now, 1, 9))}>NEXT DAY</button>
        {state.pendingDecision && <span className="calendar-blocked">DECISION REQUIRED · INBOX</span>}
        {state.activeTournament && (
          fixtureDue
            ? <button className="primary" onClick={onOpenMatch}>GO TO MATCHDAY <span>→</span></button>
            : <button className="primary" onClick={onAdvanceToMatch}>
                {nextClubMatch ? 'ADVANCE TO MATCH' : 'ADVANCE BRACKET'} <span>→</span>
              </button>
        )}
      </div>

      <div className="calendar-strip">
        {days.map((day) => {
          const label = dayLabel(day)
          const dayKey = gameDayKey(day)
          const events = TOURNAMENTS.filter((event) => {
            const start = tournamentStartsAt(event, state.seasonStart)
            const end = tournamentEndsAt(event, state.seasonStart)
            return gameDayKey(start) <= dayKey && gameDayKey(end) >= dayKey
          })
          const current = gameDayKey(day) === gameDayKey(state.now)
          const clubMatchToday = nextClubMatch && gameDayKey(nextClubMatch.scheduledAt) === dayKey
          return (
            <article key={dayKey} className={current ? 'is-today' : ''}>
              <header>
                <span>{label.dow}</span>
                <b>{label.day}</b>
                <small>{label.month}</small>
              </header>
              <div>
                {clubMatchToday && (
                  <span className="calendar-event club-match">
                    YOUR MATCH · {formatGameTime(nextClubMatch.scheduledAt)}
                  </span>
                )}
                {events.map((event) => (
                  <span
                    key={event.id}
                    className={'calendar-event t' + event.circuitTier + ' ' + event.format.toLowerCase() + (state.activeEventId === event.id ? ' active' : '')}
                    title={event.name}
                  >
                    {event.name}
                  </span>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      <div className="calendar-upcoming">
        <div className="calendar-upcoming-title">
          <span>UPCOMING CIRCUIT</span>
          <button onClick={onOpenWorld}>WORLD MAP <b>→</b></button>
        </div>
        {upcoming.map(({ event, start, end }) => {
          const gate = canBookTournament(state, event.id)
          const active = state.activeEventId === event.id
          return (
            <article key={event.id} className={active ? 'active' : ''}>
              <div className={'calendar-tier tier-' + event.circuitTier}>T{event.circuitTier}</div>
              <div className="calendar-event-copy">
                <span>{event.format} · {event.region.toUpperCase()}</span>
                <strong>{event.name}</strong>
                <small>{formatGameDateTime(start)} — {formatGameDate(end)}</small>
              </div>
              <div className="calendar-event-state">
                <b>{active ? 'REGISTERED' : gate.ok ? 'OPEN' : 'LOCKED'}</b>
                <small>{event.format === 'ONLINE' ? 'FREE ENTRY' : event.travel + event.service + ' CASH'}</small>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
