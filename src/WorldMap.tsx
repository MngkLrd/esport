import { useMemo, useRef, useState } from 'react'
import { geoCentroid, geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldMap from 'world-atlas/countries-110m.json'
import { canBookTournament, managerLevelProgress, weeklyPayroll, type GameState } from './game'
import { formatGameDateTime } from './calendar'
import { tournamentEndsAt, tournamentStartsAt } from './tournamentEngine'
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

const MAP_WIDTH = 1000
const MAP_HEIGHT = 520
const worldFeature = feature(
  worldMap as unknown as Parameters<typeof feature>[0],
  (worldMap as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects.countries,
) as unknown as { features: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> }> }

const projection = geoEqualEarth()
  .fitExtent([[20, 20], [MAP_WIDTH - 20, MAP_HEIGHT - 20]], worldFeature as never)
const worldPath = geoPath(projection)

const CIS_COUNTRY_IDS = new Set([
  '31', '51', '112', '268', '398', '417', '498', '643', '762', '795', '804', '860',
])

const featureRegion = (geo: { id?: string | number; type: 'Feature'; geometry: unknown }) => {
  const id = String(geo.id ?? '')
  if (CIS_COUNTRY_IDS.has(id)) return 'CIS' as const
  const [lon, lat] = geoCentroid(geo as never)
  if (lon < -25) return 'Americas' as const
  if (lon > 45) return 'Asia' as const
  if (lat >= 33 && lon >= -25 && lon <= 45) return 'Europe' as const
  return 'Other' as const
}

const REGION_VIEW: Record<Exclude<'All' | TournamentRegion, 'All'>, { center: [number, number]; zoom: number }> = {
  Europe: { center: [15, 52], zoom: 4.2 },
  Americas: { center: [-78, 15], zoom: 2.7 },
  Asia: { center: [95, 32], zoom: 2.7 },
  CIS: { center: [58, 51], zoom: 3.5 },
}


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
  const [zoom, setZoom] = useState(2)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

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
  const visibleCountries = useMemo(
    () => region === 'All'
      ? worldFeature.features
      : worldFeature.features.filter((geo) => featureRegion(geo as never) === region),
    [region],
  )
  const selected = tournamentForId(selectedId) ?? visible[0] ?? TOURNAMENTS[0]
  const active = tournamentForId(state.activeEventId)
  const booking = canBookTournament(state, selected.id)
  const booked = state.activeEventId === selected.id
  const eventCost = tournamentEntryCost(selected)
  const weeklyOps = payroll + eventCost
  const selectedStart = tournamentStartsAt(selected, state.seasonStart)
  const selectedEnd = tournamentEndsAt(selected, state.seasonStart)

  const focusRegion = (nextRegion: 'All' | TournamentRegion) => {
    setRegion(nextRegion)
    if (nextRegion === 'All') {
      setZoom(2)
      setPan({ x: 0, y: 0 })
      return
    }
    const view = REGION_VIEW[nextRegion]
    const point = projection(view.center) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2]
    const nextZoom = view.zoom
    setZoom(nextZoom)
    setPan({
      x: -nextZoom * (point[0] - MAP_WIDTH / 2),
      y: -nextZoom * (point[1] - MAP_HEIGHT / 2),
    })
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const nextZoom = Math.max(1.8, Math.min(6, zoom * (event.deltaY > 0 ? .88 : 1.14)))
    if (nextZoom === zoom) return

    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = (event.clientX - rect.left) / rect.width * MAP_WIDTH
    const pointerY = (event.clientY - rect.top) / rect.height * MAP_HEIGHT
    const worldX = MAP_WIDTH / 2 + (pointerX - MAP_WIDTH / 2 - pan.x) / zoom
    const worldY = MAP_HEIGHT / 2 + (pointerY - MAP_HEIGHT / 2 - pan.y) / zoom

    setPan({
      x: pointerX - MAP_WIDTH / 2 - nextZoom * (worldX - MAP_WIDTH / 2),
      y: pointerY - MAP_HEIGHT / 2 - nextZoom * (worldY - MAP_HEIGHT / 2),
    })
    setZoom(nextZoom)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = MAP_WIDTH / rect.width
    const scaleY = MAP_HEIGHT / rect.height
    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.x) * scaleX,
      y: dragRef.current.panY + (event.clientY - dragRef.current.y) * scaleY,
    })
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
  }

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
            <button key={item} className={region === item ? 'active' : ''} onClick={() => focusRegion(item)}>
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
          <svg
            viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT}
            className="world-geo-map"
            role="img"
            aria-label="Мировая карта турнирного circuit"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <g transform={'translate(' + pan.x + ' ' + pan.y + ') translate(' + MAP_WIDTH / 2 + ' ' + MAP_HEIGHT / 2 + ') scale(' + zoom + ') translate(' + (-MAP_WIDTH / 2) + ' ' + (-MAP_HEIGHT / 2) + ')'}>
              <g className="world-country-layer">
                {visibleCountries.map((geo, index) => (
                  <path
                    key={String((geo as { id?: string | number }).id ?? index)}
                    d={worldPath(geo as never) ?? ''}
                    className="world-country"
                  />
                ))}
              </g>

              {visible.map((event) => {
              const locked = !canBookTournament(state, event.id).ok && event.id !== state.activeEventId
              const isSelected = selected.id === event.id
              const isBooked = state.activeEventId === event.id
              const point = projection([event.longitude, event.latitude])
              if (!point) return null
              return (
                <g
                  key={event.id}
                  transform={'translate(' + point[0] + ' ' + point[1] + ')'}
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
                  onKeyDown={(eventKey) => {
                    if (eventKey.key === 'Enter' || eventKey.key === ' ') setSelectedId(event.id)
                  }}
                >
                  <circle r={isSelected ? 8 : 6} />
                  <circle className="world-marker-pulse" r={isSelected ? 14 : 11} />
                  <text textAnchor="middle" y={-13}>
                    {event.format === 'ONLINE' ? '● ' : ''}{event.circuitTier === 1 ? event.city : event.name}
                  </text>
                </g>
              )
            })}
            </g>
          </svg>

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
          <div className="world-event-date">{formatGameDateTime(selectedStart)} — {formatGameDateTime(selectedEnd)}</div>

          <div className="world-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>{selected.format === 'ONLINE' ? 'ENTRY FEE' : 'TRAVEL + OPS'}</span><b>{selected.format === 'ONLINE' ? 'FREE' : eventCost}</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
            <div><span>UNLOCK</span><b>LVL {selected.unlockLevel}</b></div>
          </div>

          <div className="world-budget-preview">
            <span>{selected.format === 'ONLINE' ? 'CLUB PAYROLL' : 'EVENT WEEK'}</span>
            <strong>{weeklyOps.toLocaleString('ru-RU')} CASH</strong>
            <small>{booked ? 'Ивент уже подтверждён' : selected.format === 'ONLINE' ? 'ENTRY FEE · 0 CASH' : 'payroll + travel + service'}</small>
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
