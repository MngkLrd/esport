import { useMemo, useRef, useState } from 'react'
import { geoCentroid, geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldMap from 'world-atlas/countries-110m.json'
import { canBookTournament, managerLevelProgress, weeklyPayroll, type GameState } from './game'
import { compareGameTime, formatGameDateTime, humanTimeUntil } from './calendar'
import { nextPlayerMatch, tournamentEndsAt, tournamentStartsAt } from './tournamentEngine'
import { worldVrsStandings } from './world'
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

const STRUCTURE_LABELS = {
  single_elim: 'SINGLE ELIMINATION',
  groups_single: 'GROUPS → SINGLE ELIMINATION',
  groups_double: 'GROUPS → DOUBLE ELIMINATION',
} as const

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

type EventPoint = {
  event: (typeof TOURNAMENTS)[number]
  point: [number, number]
}

type EventCluster = {
  id: string
  point: [number, number]
  items: EventPoint[]
}

const clusterEventPoints = (items: EventPoint[], zoom: number): EventCluster[] => {
  const threshold = 34 / Math.max(1, zoom)
  const clusters: EventCluster[] = []

  for (const item of items) {
    const target = clusters.find((cluster) =>
      Math.hypot(cluster.point[0] - item.point[0], cluster.point[1] - item.point[1]) <= threshold,
    )

    if (!target) {
      clusters.push({
        id: item.event.id,
        point: item.point,
        items: [item],
      })
      continue
    }

    target.items.push(item)
    target.id = target.items.map((entry) => entry.event.id).join('+')
    target.point = [
      target.items.reduce((sum, entry) => sum + entry.point[0], 0) / target.items.length,
      target.items.reduce((sum, entry) => sum + entry.point[1], 0) / target.items.length,
    ]
  }

  return clusters
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
  const [viewMode, setViewMode] = useState<'map' | 'vrs'>('map')
  const [region, setRegion] = useState<'All' | TournamentRegion>('All')
  const [circuit, setCircuit] = useState<'All' | CircuitTier>('All')
  const [format, setFormat] = useState<'All' | EventFormat>('All')
  const [selectedId, setSelectedId] = useState(state.activeEventId ?? 'eu-open-1')
  const [zoom, setZoom] = useState(2)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const payroll = weeklyPayroll(state)
  const level = managerLevelProgress(state.managerXp).level
  const vrsStandings = useMemo(
    () => worldVrsStandings(state.world, state.clubVrsPoints, state.roster),
    [state.world, state.clubVrsPoints, state.roster],
  )
  const clubVrs = vrsStandings.find((row) => row.isPlayer)
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
  const eventPoints = useMemo(
    () => visible.flatMap((event) => {
      const point = projection([event.longitude, event.latitude])
      return point ? [{ event, point: point as [number, number] }] : []
    }),
    [visible],
  )
  const markerClusters = useMemo(
    () => clusterEventPoints(eventPoints, zoom),
    [eventPoints, zoom],
  )
  const selected = tournamentForId(selectedId) ?? visible[0] ?? TOURNAMENTS[0]
  const active = tournamentForId(state.activeEventId)
  const booking = canBookTournament(state, selected.id)
  const booked = state.activeEventId === selected.id
  const eventCost = tournamentEntryCost(selected)
  const weeklyOps = payroll + eventCost
  const selectedStart = tournamentStartsAt(selected, state.seasonStart)
  const selectedEnd = tournamentEndsAt(selected, state.seasonStart)
  const selectedRun = state.activeTournament?.eventId === selected.id ? state.activeTournament : null
  const selectedNextMatch = nextPlayerMatch(selectedRun)
  const registrationClosed = compareGameTime(state.now, selectedStart) >= 0 && !booked
  const selectedStatus = booked
    ? (selectedRun?.status.replaceAll('_', ' ').toUpperCase() ?? 'REGISTERED')
    : registrationClosed
      ? 'REGISTRATION CLOSED'
      : booking.ok
        ? 'REGISTRATION OPEN'
        : 'LOCKED'

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

  const focusMapPoint = (point: [number, number], targetZoom: number) => {
    const nextZoom = Math.max(1.8, Math.min(6, targetZoom))
    setZoom(nextZoom)
    setPan({
      x: -nextZoom * (point[0] - MAP_WIDTH / 2),
      y: -nextZoom * (point[1] - MAP_HEIGHT / 2),
    })
  }

  const openCluster = (cluster: EventCluster) => {
    if (cluster.items.length === 1) {
      setSelectedId(cluster.items[0].event.id)
      return
    }
    focusMapPoint(cluster.point, Math.min(6, Math.max(zoom * 1.65, 3.2)))
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
    <section className={'screen fifa-world-screen world-view-' + viewMode}>
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

      <div className="world-view-switch" role="tablist" aria-label="Circuit view">
        <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>WORLD MAP</button>
        <button className={viewMode === 'vrs' ? 'active' : ''} onClick={() => setViewMode('vrs')}>VRS RANKING</button>
        <span>{clubVrs ? '#' + clubVrs.rank + ' · ' + clubVrs.points.toLocaleString('ru-RU') + ' VRS' : state.clubVrsPoints + ' VRS'}</span>
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

              {markerClusters.map((cluster) => {
                const clusterSelected = cluster.items.some((item) => item.event.id === selected.id)
                const inverseScale = 1 / zoom

                if (cluster.items.length > 1) {
                  return (
                    <g
                      key={cluster.id}
                      transform={'translate(' + cluster.point[0] + ' ' + cluster.point[1] + ')'}
                      className={'world-cluster' + (clusterSelected ? ' selected' : '')}
                      onClick={(eventClick) => {
                        eventClick.stopPropagation()
                        openCluster(cluster)
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={cluster.items.length + ' tournaments'}
                      onKeyDown={(eventKey) => {
                        if (eventKey.key === 'Enter' || eventKey.key === ' ') openCluster(cluster)
                      }}
                    >
                      <g transform={'scale(' + inverseScale + ')'}>
                        <circle className="world-cluster-ring" r="15" />
                        <circle className="world-cluster-core" r="10" />
                        <text textAnchor="middle" y="3">{cluster.items.length}</text>
                        <title>{cluster.items.map((item) => item.event.name).join(' · ')}</title>
                      </g>
                    </g>
                  )
                }

                const event = cluster.items[0].event
                const locked = !canBookTournament(state, event.id).ok && event.id !== state.activeEventId
                const isSelected = selected.id === event.id
                const isBooked = state.activeEventId === event.id

                return (
                  <g
                    key={event.id}
                    transform={'translate(' + cluster.point[0] + ' ' + cluster.point[1] + ')'}
                    className={
                      'world-marker ' +
                      'tier-' + event.circuitTier +
                      (event.format === 'ONLINE' ? ' online' : ' lan') +
                      (isSelected ? ' selected' : '') +
                      (isBooked ? ' booked' : '') +
                      (locked ? ' locked' : '')
                    }
                    onClick={(eventClick) => {
                      eventClick.stopPropagation()
                      setSelectedId(event.id)
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={event.name}
                    onKeyDown={(eventKey) => {
                      if (eventKey.key === 'Enter' || eventKey.key === ' ') setSelectedId(event.id)
                    }}
                  >
                    <g className="world-marker-ui" transform={'scale(' + inverseScale + ')'}>
                      <circle className="world-marker-hit" r="14" />
                      <circle className="world-marker-dot" r={isSelected ? 6 : 4.5} />
                      {isSelected && <circle className="world-marker-pulse" r="11" />}
                      <text textAnchor="middle" y="-12">{event.name}</text>
                      <title>{event.name} · T{event.circuitTier} · {event.format}</title>
                    </g>
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
          <div className="world-event-panel-head">
            <div>
              <div className="world-event-tier">TIER {selected.circuitTier} · {selected.format}</div>
              <span>{selected.region.toUpperCase()} · {selected.city.toUpperCase()}</span>
            </div>
            <b className={'world-event-status' + (booked ? ' booked' : '')}>{selectedStatus}</b>
          </div>

          <h2>{selected.name}</h2>
          <p>{STRUCTURE_LABELS[selected.structure]}</p>
          <div className="world-event-date">{formatGameDateTime(selectedStart)} — {formatGameDateTime(selectedEnd)}</div>

          <div className="world-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>ENTRY</span><b>{selected.format === 'ONLINE' ? 'FREE' : eventCost + ' CR.'}</b></div>
            <div><span>DURATION</span><b>{selected.durationDays} DAYS</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
          </div>

          <div className="world-event-details">
            <div><span>FORMAT</span><b>{selected.label}</b></div>
            <div><span>MANAGER ACCESS</span><b>LVL {selected.unlockLevel}+</b></div>
            {selectedNextMatch && (
              <div className="highlight">
                <span>NEXT CLUB MATCH</span>
                <b>{formatGameDateTime(selectedNextMatch.scheduledAt)} · {humanTimeUntil(state.now, selectedNextMatch.scheduledAt)}</b>
              </div>
            )}
          </div>

          <div className="world-budget-preview">
            <span>{selected.format === 'ONLINE' ? 'REGISTRATION COST' : 'EVENT COMMITMENT'}</span>
            <strong>{selected.format === 'ONLINE' ? '0 CASH' : eventCost.toLocaleString('ru-RU') + ' CASH'}</strong>
            <small>{selected.format === 'ONLINE' ? 'ONLINE ENTRY IS FREE' : 'travel + event operations · payroll stays weekly'}</small>
          </div>

          {booked ? (
            <button className="fifa-primary-cta" onClick={onPrepareMatch}>
              OPEN TOURNAMENT <span>→</span>
            </button>
          ) : (
            <button className="fifa-primary-cta" disabled={!booking.ok} onClick={() => onBook(selected.id)}>
              {booking.ok ? 'COMMIT TO EVENT' : booking.reason.toUpperCase()} <span>→</span>
            </button>
          )}
        </aside>
      </div>

      <section className="world-vrs-panel" aria-label="VRS ranking">
        <div className="vrs-table-head">
          <span>#</span>
          <span>TEAM</span>
          <span>LINEUP</span>
          <span>VRS</span>
        </div>
        <div className="vrs-table-scroll">
          {vrsStandings.map((row) => (
            <article key={row.teamId} className={'vrs-row' + (row.isPlayer ? ' is-player' : '')}>
              <b className="vrs-rank">{String(row.rank).padStart(2, '0')}</b>
              <div className="vrs-team">
                <strong>{row.name}</strong>
                <small>{row.isPlayer ? 'YOUR CLUB' : 'GLOBAL RANKING'}</small>
              </div>
              <div className="vrs-lineup">
                {row.roster.length ? row.roster.map((alias) => <span key={alias}>{alias}</span>) : <span>—</span>}
              </div>
              <b className="vrs-points">{row.points.toLocaleString('ru-RU')}</b>
            </article>
          ))}
        </div>
        {clubVrs && (
          <div className="vrs-club-pin">
            <span>YOUR CLUB</span>
            <strong>#{clubVrs.rank}</strong>
            <b>{clubVrs.points.toLocaleString('ru-RU')} VRS</b>
            <small>{state.history[0]?.vrsDelta ? 'LAST MATCH +' + state.history[0].vrsDelta : 'PLAY OFFICIAL MATCHES TO CLIMB'}</small>
          </div>
        )}
      </section>
    </section>
  )
}
