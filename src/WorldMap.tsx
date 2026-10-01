import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldMap from 'world-atlas/countries-110m.json'
import { canBookTournament, managerLevelProgress, newsBelongsInInbox, weeklyPayroll, type GameState } from './game'
import { addGameHours, compareGameTime, formatGameDateTime, humanTimeUntil } from './calendar'
import { nextPlayerMatch, tournamentEndsAt, tournamentStartsAt } from './tournamentEngine'
import { worldVrsStandings } from './world'
import { TeamBadge } from './TeamBadge'
import { TeamProfile } from './TeamProfile'
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
const DEFAULT_MAP_VIEW = { center: [29, 50] as [number, number], zoom: 3.25 }
const worldFeature = feature(
  worldMap as unknown as Parameters<typeof feature>[0],
  (worldMap as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects.countries,
) as unknown as { features: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> }> }

const projection = geoEqualEarth()
  .fitExtent([[20, 20], [MAP_WIDTH - 20, MAP_HEIGHT - 20]], worldFeature as never)
const worldPath = geoPath(projection)
const defaultMapPoint = projection(DEFAULT_MAP_VIEW.center) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2]
const DEFAULT_MAP_PAN = {
  x: -DEFAULT_MAP_VIEW.zoom * (defaultMapPoint[0] - MAP_WIDTH / 2),
  y: -DEFAULT_MAP_VIEW.zoom * (defaultMapPoint[1] - MAP_HEIGHT / 2),
}

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
  focusEventId,
  onOpenInbox,
}: {
  state: GameState
  onBook: (eventId: string) => void
  onPrepareMatch: () => void
  focusEventId?: string | null
  onOpenInbox?: () => void
}) {
  const [viewMode, setViewMode] = useState<'hub' | 'map' | 'vrs'>('hub')
  const [region, setRegion] = useState<'All' | TournamentRegion>('All')
  const [circuit, setCircuit] = useState<'All' | CircuitTier>('All')
  const [format, setFormat] = useState<'All' | EventFormat>('All')
  const [selectedId, setSelectedId] = useState(state.activeEventId ?? 'eu-open-1')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_MAP_VIEW.zoom)
  const [pan, setPan] = useState(DEFAULT_MAP_PAN)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    if (!focusEventId) return
    const event = tournamentForId(focusEventId)
    if (!event) return
    const endsAt = tournamentEndsAt(event, state.seasonStart)
    if (compareGameTime(endsAt, state.now) >= 0) setSelectedId(event.id)
  }, [focusEventId, state.now, state.seasonStart])

  const payroll = weeklyPayroll(state)
  const level = managerLevelProgress(state.managerXp).level
  const vrsStandings = useMemo(
    () => worldVrsStandings(state.world, state.clubVrsPoints, state.roster),
    [state.world, state.clubVrsPoints, state.roster],
  )
  const clubVrs = vrsStandings.find((row) => row.isPlayer)
  const visible = useMemo(
    () => TOURNAMENTS.filter((event) =>
      compareGameTime(tournamentEndsAt(event, state.seasonStart), state.now) >= 0 &&
      (region === 'All' || event.region === region) &&
      (circuit === 'All' || event.circuitTier === circuit) &&
      (format === 'All' || event.format === format),
    ),
    [region, circuit, format, state.now, state.seasonStart],
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
  const selected = visible.find((event) => event.id === selectedId) ?? visible[0] ?? TOURNAMENTS[0]
  const active = tournamentForId(state.activeEventId)
  const booking = canBookTournament(state, selected.id)
  const booked = state.activeEventId === selected.id
  const eventCost = tournamentEntryCost(selected)
  const weeklyOps = payroll + eventCost
  const selectedStart = tournamentStartsAt(selected, state.seasonStart)
  const selectedEnd = tournamentEndsAt(selected, state.seasonStart)
  const selectedRun = state.activeTournament?.eventId === selected.id ? state.activeTournament : null
  const selectedNextMatch = nextPlayerMatch(selectedRun)
  const registrationClosesAt = addGameHours(selectedStart, -72)
  const registrationClosed = compareGameTime(state.now, registrationClosesAt) > 0 && !booked
  const eventStarted = compareGameTime(state.now, selectedStart) >= 0
  const selectedStatus = booked
    ? (selectedRun?.status.replaceAll('_', ' ').toUpperCase() ?? 'REGISTERED')
    : eventStarted
      ? 'ONGOING'
      : registrationClosed
        ? 'REGISTRATION CLOSED'
        : booking.ok
          ? 'REGISTRATION OPEN'
          : 'LOCKED'

  const hubNews = state.news.filter(newsBelongsInInbox).slice(0, 7)
  const hubEvents = [...TOURNAMENTS]
    .filter((event) => compareGameTime(tournamentEndsAt(event, state.seasonStart), state.now) >= 0)
    .sort((a, b) => compareGameTime(tournamentStartsAt(a, state.seasonStart), tournamentStartsAt(b, state.seasonStart)))
    .slice(0, 8)
  const featuredEvent = active
    ?? hubEvents.find((event) => canBookTournament(state, event.id).ok)
    ?? hubEvents[0]
    ?? TOURNAMENTS[0]
  const featuredStart = tournamentStartsAt(featuredEvent, state.seasonStart)
  const featuredEnd = tournamentEndsAt(featuredEvent, state.seasonStart)
  const featuredGate = canBookTournament(state, featuredEvent.id)
  const featuredBooked = state.activeEventId === featuredEvent.id
  const featuredRun = featuredBooked ? state.activeTournament : null
  const featuredMatch = nextPlayerMatch(featuredRun)

  const focusRegion = (nextRegion: 'All' | TournamentRegion) => {
    setRegion(nextRegion)
    if (nextRegion === 'All') {
      setZoom(DEFAULT_MAP_VIEW.zoom)
      setPan(DEFAULT_MAP_PAN)
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
    // Do not turn a tournament click into a map drag. Pointer capture on the
    // root SVG was stealing the click from marker/cluster children.
    const target = event.target as Element | null
    if (target?.closest('.world-marker, .world-cluster')) return

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
    <section className={'sim-screen sim-world sim-world-' + viewMode}>
      <div className="sim-screen-head sim-world-head">
        <div>
          <span>GLOBAL CIRCUIT · MANAGER LVL {level}</span>
          <h1>{viewMode === 'hub' ? 'CIRCUIT HUB' : active ? 'NEXT EVENT' : 'WORLD CIRCUIT'}</h1>
        </div>
        <div className="sim-head-stat">
          <small>AVAILABLE</small>
          <b>{TOURNAMENTS.filter((event) => canBookTournament(state, event.id).ok || event.id === state.activeEventId).length}</b>
        </div>
      </div>

      <div className="sim-world-toolbar">
        <div className="sim-segmented sim-world-tabs" role="tablist" aria-label="Circuit view">
          <button className={viewMode === 'hub' ? 'active' : ''} onClick={() => setViewMode('hub')}>OVERVIEW</button>
          <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>SELECT EVENT</button>
          <button className={viewMode === 'vrs' ? 'active' : ''} onClick={() => setViewMode('vrs')}>VRS RANKING</button>
          <span>{clubVrs ? '#' + clubVrs.rank + ' · ' + clubVrs.points.toLocaleString('ru-RU') + ' VRS' : state.clubVrsPoints + ' VRS'}</span>
        </div>

        <div className="sim-world-filters">
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
      </div>

      {viewMode === 'hub' && (
        <section className="world-hub" aria-label="Circuit overview">
          <aside className="world-hub-panel world-hub-inbox">
            <header className="world-hub-panel-head">
              <div><span>CLUB INBOX</span><b>{hubNews.length}</b></div>
              {onOpenInbox && <button type="button" onClick={onOpenInbox}>ALL →</button>}
            </header>
            <div className="world-hub-message-list">
              {hubNews.map((item, index) => (
                <article key={item.id} className={item.attention === 'action' ? 'is-action' : ''}>
                  <span className="world-hub-message-dot">{item.attention === 'action' ? '!' : '•'}</span>
                  <div>
                    <small>W{item.week} · {item.kind.toUpperCase()}</small>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                </article>
              ))}
              {hubNews.length === 0 && <div className="world-hub-empty">Новых клубных сообщений нет.</div>}
            </div>
          </aside>

          <main className="world-hub-center">
            <article className="world-hub-feature">
              <div className="world-hub-feature-copy">
                <span>{featuredBooked ? 'ACTIVE EVENT' : 'NEXT OPPORTUNITY'} · T{featuredEvent.circuitTier} · {featuredEvent.format}</span>
                <h2>{featuredEvent.name}</h2>
                <p>{featuredEvent.city} · {featuredEvent.region} · {formatGameDateTime(featuredStart)} — {formatGameDateTime(featuredEnd)}</p>
                <div className="world-hub-feature-meta">
                  <div><small>PRIZE</small><b>{featuredEvent.prize.toLocaleString('ru-RU')}</b></div>
                  <div><small>ENTRY</small><b>{featuredEvent.format === 'ONLINE' ? 'FREE' : tournamentEntryCost(featuredEvent) + ' CR.'}</b></div>
                  <div><small>START</small><b>{humanTimeUntil(state.now, featuredStart)}</b></div>
                </div>
              </div>
              <div className="world-hub-feature-side">
                <span>{featuredBooked ? 'REGISTERED' : featuredGate.ok ? 'REGISTRATION OPEN' : 'ACCESS CHECK'}</span>
                <TeamBadge name="YOUR CLUB" size="lg" />
                <strong>{featuredBooked ? featuredRun?.status.replaceAll('_', ' ').toUpperCase() ?? 'ACTIVE' : 'YOUR CLUB'}</strong>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(featuredEvent.id)
                      setViewMode('map')
                    }}
                  >
                    {featuredBooked ? 'EVENT DETAILS' : 'SELECT EVENT'} <span>→</span>
                  </button>
                  {featuredBooked && <button className="primary" type="button" onClick={onPrepareMatch}>OPEN TOURNAMENT →</button>}
                </div>
              </div>
            </article>

            <div className="world-hub-midgrid">
              <section className="world-hub-panel world-hub-campaign">
                <header className="world-hub-panel-head"><div><span>CURRENT CAMPAIGN</span><b>{active ? 'LIVE' : 'OPEN'}</b></div></header>
                {active ? (
                  <div className="world-hub-campaign-body">
                    <div>
                      <small>EVENT</small>
                      <strong>{active.name}</strong>
                      <span>{active.city} · T{active.circuitTier}</span>
                    </div>
                    <div>
                      <small>NEXT CLUB MATCH</small>
                      <strong>{featuredMatch ? formatGameDateTime(featuredMatch.scheduledAt) : 'BRACKET PENDING'}</strong>
                      <span>{featuredMatch ? humanTimeUntil(state.now, featuredMatch.scheduledAt) : 'Ожидаем сетку'}</span>
                    </div>
                  </div>
                ) : (
                  <button className="world-hub-empty-cta" type="button" onClick={() => setViewMode('map')}>
                    <span>NO ACTIVE EVENT</span>
                    <strong>Выбрать следующий турнир</strong>
                    <b>→</b>
                  </button>
                )}
              </section>

              <section className="world-hub-panel world-hub-club">
                <header className="world-hub-panel-head"><div><span>CLUB SNAPSHOT</span><b>LIVE</b></div></header>
                <div className="world-hub-club-stats">
                  <div><small>VRS</small><strong>{clubVrs ? '#' + clubVrs.rank : '—'}</strong><span>{clubVrs?.points.toLocaleString('ru-RU') ?? state.clubVrsPoints} PTS</span></div>
                  <div><small>RECORD</small><strong>{state.wins}-{state.losses}</strong><span>SEASON {state.season}</span></div>
                  <div><small>CASH</small><strong>{state.credits.toLocaleString('ru-RU')}</strong><span>PAYROLL {payroll}</span></div>
                </div>
              </section>
            </div>

            <section className="world-hub-panel world-hub-calendar">
              <header className="world-hub-panel-head">
                <div><span>EVENT CALENDAR</span><b>{hubEvents.length} UPCOMING</b></div>
                <button type="button" onClick={() => setViewMode('map')}>SELECT EVENT →</button>
              </header>
              <div className="world-hub-calendar-strip">
                {hubEvents.slice(0, 6).map((event) => {
                  const start = tournamentStartsAt(event, state.seasonStart)
                  const isActive = event.id === state.activeEventId
                  return (
                    <button key={event.id} type="button" className={isActive ? 'is-active' : ''} onClick={() => { setSelectedId(event.id); setViewMode('map') }}>
                      <span>{formatGameDateTime(start).split(' · ')[0]}</span>
                      <strong>{event.name}</strong>
                      <small>T{event.circuitTier} · {event.format} · {event.city}</small>
                    </button>
                  )
                })}
              </div>
            </section>
          </main>

          <aside className="world-hub-side">
            <section className="world-hub-panel world-hub-schedule">
              <header className="world-hub-panel-head"><div><span>EVENT SCHEDULE</span><b>NEXT</b></div></header>
              <div>
                {hubEvents.slice(0, 6).map((event) => {
                  const start = tournamentStartsAt(event, state.seasonStart)
                  return (
                    <button key={event.id} type="button" onClick={() => { setSelectedId(event.id); setViewMode('map') }}>
                      <span>T{event.circuitTier}</span>
                      <div><strong>{event.name}</strong><small>{formatGameDateTime(start)} · {event.format}</small></div>
                      <b>→</b>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="world-hub-panel world-hub-ranking">
              <header className="world-hub-panel-head">
                <div><span>VRS STANDINGS</span><b>TOP 8</b></div>
                <button type="button" onClick={() => setViewMode('vrs')}>FULL →</button>
              </header>
              <div>
                {vrsStandings.slice(0, 8).map((row) => (
                  <button key={row.teamId} type="button" className={row.isPlayer ? 'is-player' : ''} onClick={() => setSelectedTeamId(row.teamId)}>
                    <span>{row.rank}</span>
                    <TeamBadge name={row.name} size="sm" />
                    <strong>{row.name}</strong>
                    <b>{row.points.toLocaleString('ru-RU')}</b>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </section>
      )}

      <div className="sim-event-carousel" aria-label="Tournament selector">
        {visible.map((event) => {
          const start = tournamentStartsAt(event, state.seasonStart)
          const gate = canBookTournament(state, event.id)
          const isActive = state.activeEventId === event.id
          const ongoing = compareGameTime(state.now, start) >= 0
          const status = isActive ? 'REGISTERED' : ongoing ? 'ONGOING' : gate.ok ? 'OPEN' : 'CLOSED'
          return (
            <button
              key={event.id}
              className={(selected.id === event.id ? 'selected ' : '') + (isActive ? 'active' : '')}
              onClick={() => setSelectedId(event.id)}
            >
              <span>T{event.circuitTier} · {event.format}</span>
              <b>{event.name}</b>
              <em>{formatGameDateTime(start)} · {event.city}</em>
              <small>{status}</small>
            </button>
          )
        })}
      </div>

      <div className="sim-world-body">
        <div className="sim-world-map">
          <svg
            viewBox={'0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT}
            className="world-geo-map sim-world-geo"
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
                      onPointerDown={(eventPointer) => eventPointer.stopPropagation()}
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
                    onPointerDown={(eventPointer) => eventPointer.stopPropagation()}
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

          <div className="sim-map-legend">
            <span><i className="tier1" /> T1 LAN</span>
            <span><i className="tier2" /> T2</span>
            <span><i className="tier3" /> T3</span>
            <span><i className="online" /> ONLINE</span>
          </div>

          {visible.length === 0 && (
            <div className="sim-map-empty">Нет ивентов под текущий фильтр.</div>
          )}
        </div>

        <aside className="sim-event-dossier">
          <div className="sim-event-dossier-head">
            <div>
              <div className="sim-event-tier">TIER {selected.circuitTier} · {selected.format}</div>
              <span>{selected.region.toUpperCase()} · {selected.city.toUpperCase()}</span>
            </div>
            <b className={'sim-event-status' + (booked ? ' booked' : '')}>{selectedStatus}</b>
          </div>

          <h2>{selected.name}</h2>
          <p>{STRUCTURE_LABELS[selected.structure]}</p>
          <div className="sim-event-date">{formatGameDateTime(selectedStart)} — {formatGameDateTime(selectedEnd)}</div>
          <div className="sim-registration-deadline">REGISTRATION CLOSES · {formatGameDateTime(registrationClosesAt)}</div>

          <div className="sim-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>ENTRY</span><b>{selected.format === 'ONLINE' ? 'FREE' : eventCost + ' CR.'}</b></div>
            <div><span>DURATION</span><b>{selected.durationDays} DAYS</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
          </div>

          <div className="sim-event-details">
            <div><span>FORMAT</span><b>{selected.label}</b></div>
            <div><span>MANAGER ACCESS</span><b>LVL {selected.unlockLevel}+</b></div>
            {selectedNextMatch && (
              <div className="highlight">
                <span>NEXT CLUB MATCH</span>
                <b>{formatGameDateTime(selectedNextMatch.scheduledAt)} · {humanTimeUntil(state.now, selectedNextMatch.scheduledAt)}</b>
              </div>
            )}
          </div>

          <div className="sim-event-timeline">
            <div className={compareGameTime(state.now, registrationClosesAt) > 0 ? 'done' : 'current'}>
              <i />
              <span>REGISTRATION CLOSES</span>
              <b>{formatGameDateTime(registrationClosesAt)}</b>
            </div>
            <div className={compareGameTime(state.now, selectedStart) >= 0 ? 'done' : compareGameTime(state.now, registrationClosesAt) > 0 ? 'current' : ''}>
              <i />
              <span>EVENT START</span>
              <b>{formatGameDateTime(selectedStart)}</b>
            </div>
            <div className={eventStarted ? 'current' : ''}>
              <i />
              <span>EVENT END</span>
              <b>{formatGameDateTime(selectedEnd)}</b>
            </div>
          </div>

          <div className="sim-event-cost">
            <span>{selected.format === 'ONLINE' ? 'REGISTRATION COST' : 'EVENT COMMITMENT'}</span>
            <strong>{selected.format === 'ONLINE' ? '0 CASH' : eventCost.toLocaleString('ru-RU') + ' CASH'}</strong>
            <small>{selected.format === 'ONLINE' ? 'ONLINE ENTRY IS FREE' : 'travel + event operations · payroll stays weekly'}</small>
          </div>

          {booked ? (
            <button className="sim-primary-action" onClick={onPrepareMatch}>
              OPEN TOURNAMENT <span>→</span>
            </button>
          ) : (
            <button className="sim-primary-action" disabled={!booking.ok} onClick={() => onBook(selected.id)}>
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
            <button key={row.teamId} type="button" className={'vrs-row' + (row.isPlayer ? ' is-player' : '')} onClick={() => setSelectedTeamId(row.teamId)}>
              <b className="vrs-rank">{String(row.rank).padStart(2, '0')}</b>
              <div className="vrs-team">
                <TeamBadge name={row.name} size="sm" />
                <span><strong>{row.name}</strong><small>{row.isPlayer ? 'YOUR CLUB' : 'GLOBAL RANKING'}</small></span>
              </div>
              <div className="vrs-lineup">
                {row.roster.length ? row.roster.map((alias) => <span key={alias}>{alias}</span>) : <span>—</span>}
              </div>
              <b className="vrs-points">{row.points.toLocaleString('ru-RU')}</b>
            </button>
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
      {selectedTeamId && (
        <TeamProfile state={state} teamId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
      )}
    </section>
  )
}
