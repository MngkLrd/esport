import { useMemo, useState } from 'react'
import { canBookTournament, managerLevelProgress, weeklyPayroll, type GameState } from './game'
import { TOURNAMENTS, tournamentEntryCost, tournamentForId, type TournamentRegion } from './events'

const REGIONS: Array<'All' | TournamentRegion> = ['All', 'Europe', 'Americas', 'Asia', 'CIS']

export function WorldMap({
  state,
  onBook,
  onPrepareMatch,
}: {
  state: GameState
  onBook: (eventId: string) => void
  onPrepareMatch: () => void
}) {
  const [region, setRegion] = useState<'All' | TournamentRegion>('All')
  const [selectedId, setSelectedId] = useState(state.activeEventId ?? 'helsinki')
  const payroll = weeklyPayroll(state)
  const level = managerLevelProgress(state.managerXp).level
  const visible = useMemo(() => TOURNAMENTS.filter((event) => region === 'All' || event.region === region), [region])
  const selected = tournamentForId(selectedId) ?? TOURNAMENTS[0]
  const active = tournamentForId(state.activeEventId)
  const booking = canBookTournament(state, selected.id)
  const booked = state.activeEventId === selected.id
  const eventCost = tournamentEntryCost(selected)
  const weeklyOps = payroll + eventCost

  return (
    <section className="screen fifa-world-screen">
      <div className="fifa-screen-header">
        <div>
          <span>GLOBAL CIRCUIT · MANAGER LVL {level}</span>
          <h1>{active ? 'NEXT EVENT' : 'SELECT EVENT'}</h1>
        </div>
        <div className="fifa-screen-rank">
          <small>CLUB REP</small>
          <b>{state.reputation}</b>
        </div>
      </div>

      <div className="world-map-layout">
        <aside className="world-region-list">
          <span className="world-section-label">REGION</span>
          {REGIONS.map((item) => (
            <button
              key={item}
              className={region === item ? 'active' : ''}
              onClick={() => setRegion(item)}
            >
              <i />
              <span>{item === 'All' ? 'ALL REGIONS' : item.toUpperCase()}</span>
              <b>{item === 'All' ? TOURNAMENTS.length : TOURNAMENTS.filter((event) => event.region === item).length}</b>
            </button>
          ))}
          <div className="world-upkeep">
            <span>WEEKLY PAYROLL</span>
            <strong>{payroll.toLocaleString('ru-RU')}</strong>
            <small>cash {state.credits.toLocaleString('ru-RU')}</small>
          </div>
        </aside>

        <div className="world-map-stage">
          <svg viewBox="0 0 1000 520" role="img" aria-label="Карта мира с турнирами">
            <defs>
              <linearGradient id="mapGlow" x1="0" x2="1">
                <stop offset="0%" stopColor="#7161d9" stopOpacity=".42" />
                <stop offset="100%" stopColor="#3e3a8a" stopOpacity=".16" />
              </linearGradient>
            </defs>
            <path className="world-land" d="M90 108l110-46 95 14 67 46-15 54-58 25-26 41-90-8-68-51-25-44z" />
            <path className="world-land" d="M282 243l65 12 38 55-8 95-47 77-36-18-17-92-27-65z" />
            <path className="world-land" d="M443 86l105-30 102 23 64-14 88 32 95 68-12 55-75 5-53-30-46 26-49-10-31 36-80-14-27-54-77-14-28-34z" />
            <path className="world-land" d="M548 236l63 12 49 42 17 96-43 75-62-21-43-96 5-70z" />
            <path className="world-land" d="M822 352l76-18 54 39-22 54-79 10-47-42z" />
            <path className="world-grid-line" d="M0 130h1000M0 260h1000M0 390h1000M250 0v520M500 0v520M750 0v520" />
          </svg>

          {visible.map((event) => {
            const locked = level < event.unlockLevel
            return (
              <button
                key={event.id}
                className={'world-pin tier-' + event.tier.toLowerCase() + (selected.id === event.id ? ' active' : '') + (locked ? ' locked' : '') + (state.activeEventId === event.id ? ' booked' : '')}
                style={{ left: event.x + '%', top: event.y + '%' }}
                onClick={() => setSelectedId(event.id)}
                aria-label={event.name + (locked ? ', locked' : '')}
              >
                <i />
                <span>{locked ? 'LVL ' + event.unlockLevel : event.city}</span>
              </button>
            )
          })}

          <div className="world-map-caption">
            <span>{active ? active.name.toUpperCase() + ' BOOKED' : 'GLOBAL EVENT NETWORK'}</span>
            <small>{visible.filter((event) => level >= event.unlockLevel).length} available events</small>
          </div>
        </div>

        <aside className="world-event-panel">
          <div className="world-event-tier">{selected.tier}-TIER</div>
          <span>{selected.region.toUpperCase()} · {selected.city.toUpperCase()}</span>
          <h2>{selected.name}</h2>
          <p>{selected.label}</p>

          <div className="world-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>ENTRY COST</span><b>{eventCost}</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
            <div><span>UNLOCK</span><b>LVL {selected.unlockLevel}</b></div>
          </div>

          <div className="world-budget-preview">
            <span>EVENT WEEK</span>
            <strong>{weeklyOps.toLocaleString('ru-RU')} CASH</strong>
            <small>{booked ? 'Поездка уже оплачена' : 'payroll + travel + service'}</small>
          </div>

          {booked ? (
            <button className="fifa-primary-cta" onClick={onPrepareMatch}>
              ENTER EVENT <span>→</span>
            </button>
          ) : (
            <button className="fifa-primary-cta" disabled={!booking.ok} onClick={() => onBook(selected.id)}>
              {booking.ok ? 'COMMIT TO EVENT' : booking.reason.toUpperCase()} <span>→</span>
            </button>
          )}
        </aside>
      </div>
    </section>
  )
}
