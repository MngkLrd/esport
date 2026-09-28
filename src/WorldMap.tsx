import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import worldMap from 'world-atlas/countries-110m.json'
import { canBookTournament, managerLevelProgress, weeklyPayroll, type GameState } from './game'
import {
  TOURNAMENTS,
  tournamentEntryCost,
  tournamentForId,
  type CircuitTier,
  type EventFormat,
  type TournamentRegion,
} from './events'

const REGIONS: Array<'All' | TournamentRegion> = ['All', 'Europe', 'Americas', 'Asia', 'CIS']
const CIRCUITS: Array<'All' | CircuitTier> = ['All', 1, 2, 3]
const FORMATS: Array<'All' | EventFormat> = ['All', 'LAN', 'ONLINE']

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
  const [circuit, setCircuit] = useState<'All' | CircuitTier>('All')
  const [format, setFormat] = useState<'All' | EventFormat>('All')
  const [selectedId, setSelectedId] = useState(state.activeEventId ?? 'eu-open-1')

  const payroll = weeklyPayroll(state)
  const level = managerLevelProgress(state.managerXp).level
  const visible = useMemo(
    () => TOURNAMENTS.filter((event) =>
      (region === 'All' || event.region === region) &&
      (circuit === 'All' || event.circuitTier === circuit) &&
      (format === 'All' || event.format === format),
    ),
    [region, circuit, format],
  )
  const selected = tournamentForId(selectedId) ?? visible[0] ?? TOURNAMENTS[0]
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
          <h1>{active ? 'NEXT EVENT' : 'WORLD CIRCUIT'}</h1>
        </div>
        <div className="fifa-screen-rank">
          <small>AVAILABLE</small>
          <b>{TOURNAMENTS.filter((event) => canBookTournament(state, event.id).ok || event.id === state.activeEventId).length}</b>
        </div>
      </div>

      <div className="world-filter-strip">
        <div>
          <span>REGION</span>
          {REGIONS.map((item) => (
            <button key={item} className={region === item ? 'active' : ''} onClick={() => setRegion(item)}>
              {item === 'All' ? 'ALL' : item.toUpperCase()}
            </button>
          ))}
        </div>
        <div>
          <span>CIRCUIT</span>
          {CIRCUITS.map((item) => (
            <button key={item} className={circuit === item ? 'active' : ''} onClick={() => setCircuit(item)}>
              {item === 'All' ? 'ALL' : 'T' + item}
            </button>
          ))}
        </div>
        <div>
          <span>FORMAT</span>
          {FORMATS.map((item) => (
            <button key={item} className={format === item ? 'active' : ''} onClick={() => setFormat(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="world-map-layout world-map-layout-v2">
        <div className="world-map-stage world-map-stage-v2">
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 150 }}
            width={1000}
            height={520}
            className="world-geo-map"
          >
            <ZoomableGroup center={[8, 18]} zoom={1}>
              <Geographies geography={worldMap}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#22294b"
                      stroke="#4a5279"
                      strokeWidth={0.45}
                      style={{
                        default: { outline: 'none' },
                        hover: { fill: '#2c3562', outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  ))
                }
              </Geographies>

              {visible.map((event) => {
                const locked = !canBookTournament(state, event.id).ok && event.id !== state.activeEventId
                const isSelected = selected.id === event.id
                const isBooked = state.activeEventId === event.id
                return (
                  <Marker key={event.id} coordinates={[event.longitude, event.latitude]}>
                    <g
                      className={
                        'world-marker ' +
                        'tier-' + event.circuitTier +
                        (event.format === 'ONLINE' ? ' online' : ' lan') +
                        (isSelected ? ' selected' : '') +
                        (isBooked ? ' booked' : '') +
                        (locked ? ' locked' : '')
                      }
                      onClick={() => setSelectedId(event.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={event.name}
                    >
                      <circle r={isSelected ? 8 : 6} />
                      <circle className="world-marker-pulse" r={isSelected ? 14 : 11} />
                      <text textAnchor="middle" y={-13}>
                        {event.format === 'ONLINE' ? '● ' : ''}{event.circuitTier === 1 ? event.city : event.name}
                      </text>
                    </g>
                  </Marker>
                )
              })}
            </ZoomableGroup>
          </ComposableMap>

          <div className="world-map-legend">
            <span><i className="tier1" /> T1 LAN</span>
            <span><i className="tier2" /> T2</span>
            <span><i className="tier3" /> T3</span>
            <span><i className="online" /> ONLINE</span>
          </div>

          {visible.length === 0 && (
            <div className="world-map-empty">Нет ивентов под текущий фильтр.</div>
          )}
        </div>

        <aside className="world-event-panel world-event-panel-v2">
          <div className="world-event-tier">TIER {selected.circuitTier} · {selected.format}</div>
          <span>{selected.region.toUpperCase()} · {selected.city.toUpperCase()}</span>
          <h2>{selected.name}</h2>
          <p>{selected.label}</p>

          <div className="world-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>{selected.format === 'ONLINE' ? 'ENTRY / OPS' : 'TRAVEL + OPS'}</span><b>{eventCost}</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
            <div><span>UNLOCK</span><b>LVL {selected.unlockLevel}</b></div>
          </div>

          <div className="world-budget-preview">
            <span>EVENT WEEK</span>
            <strong>{weeklyOps.toLocaleString('ru-RU')} CASH</strong>
            <small>{booked ? 'Ивент уже подтверждён' : selected.format === 'ONLINE' ? 'payroll + event ops' : 'payroll + travel + service'}</small>
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
