import { useMemo, useState } from 'react'
import { weeklyPayroll, type GameState } from './game'

type Region = 'Europe' | 'Americas' | 'Asia' | 'CIS'

type Tournament = {
  id: string
  name: string
  city: string
  region: Region
  tier: 'S' | 'A' | 'B'
  x: number
  y: number
  prize: number
  travel: number
  service: number
  fatigue: number
  label: string
}

const TOURNAMENTS: readonly Tournament[] = [
  { id: 'helsinki', name: 'Nordic Masters', city: 'Helsinki', region: 'Europe', tier: 'A', x: 56, y: 25, prize: 3200, travel: 180, service: 240, fatigue: 6, label: 'LAN · 8 TEAMS' },
  { id: 'cologne', name: 'Rhine Arena', city: 'Cologne', region: 'Europe', tier: 'S', x: 49, y: 31, prize: 6200, travel: 260, service: 360, fatigue: 9, label: 'LAN · 16 TEAMS' },
  { id: 'katowice', name: 'Steel Cup', city: 'Katowice', region: 'Europe', tier: 'S', x: 53, y: 33, prize: 7000, travel: 250, service: 380, fatigue: 10, label: 'LAN · 16 TEAMS' },
  { id: 'dallas', name: 'Lone Star Clash', city: 'Dallas', region: 'Americas', tier: 'A', x: 25, y: 43, prize: 4100, travel: 760, service: 510, fatigue: 15, label: 'LAN · 12 TEAMS' },
  { id: 'sao-paulo', name: 'São Paulo Open', city: 'São Paulo', region: 'Americas', tier: 'A', x: 34, y: 70, prize: 3800, travel: 880, service: 460, fatigue: 16, label: 'LAN · 12 TEAMS' },
  { id: 'chengdu', name: 'Chengdu Masters', city: 'Chengdu', region: 'Asia', tier: 'S', x: 78, y: 44, prize: 6800, travel: 980, service: 590, fatigue: 18, label: 'LAN · 16 TEAMS' },
  { id: 'almaty', name: 'Steppe Invitational', city: 'Almaty', region: 'CIS', tier: 'B', x: 66, y: 36, prize: 2200, travel: 430, service: 280, fatigue: 8, label: 'LAN · 8 TEAMS' },
] as const

const REGIONS: Array<'All' | Region> = ['All', 'Europe', 'Americas', 'Asia', 'CIS']

export function WorldMap({
  state,
  onPrepareMatch,
}: {
  state: GameState
  onPrepareMatch: () => void
}) {
  const [region, setRegion] = useState<'All' | Region>('All')
  const [selectedId, setSelectedId] = useState('cologne')
  const payroll = weeklyPayroll(state)
  const visible = useMemo(() => TOURNAMENTS.filter((event) => region === 'All' || event.region === region), [region])
  const selected = TOURNAMENTS.find((event) => event.id === selectedId) ?? TOURNAMENTS[0]
  const weeklyOps = payroll + selected.travel + selected.service

  return (
    <section className="screen fifa-world-screen">
      <div className="fifa-screen-header">
        <div>
          <span>COMPETE &gt; WORLD MAP</span>
          <h1>SELECT TOURNAMENT</h1>
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
            <span>WEEKLY OPERATIONS</span>
            <strong>{weeklyOps.toLocaleString('ru-RU')}</strong>
            <small>payroll + travel + service</small>
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

          {visible.map((event) => (
            <button
              key={event.id}
              className={'world-pin tier-' + event.tier.toLowerCase() + (selected.id === event.id ? ' active' : '')}
              style={{ left: event.x + '%', top: event.y + '%' }}
              onClick={() => setSelectedId(event.id)}
              aria-label={event.name}
            >
              <i />
              <span>{event.city}</span>
            </button>
          ))}

          <div className="world-map-caption">
            <span>GLOBAL EVENT NETWORK</span>
            <small>{visible.length} active tournaments</small>
          </div>
        </div>

        <aside className="world-event-panel">
          <div className="world-event-tier">{selected.tier}-TIER</div>
          <span>{selected.region.toUpperCase()} · {selected.city.toUpperCase()}</span>
          <h2>{selected.name}</h2>
          <p>{selected.label}</p>

          <div className="world-event-stats">
            <div><span>PRIZE POOL</span><b>{selected.prize.toLocaleString('ru-RU')}</b></div>
            <div><span>TRAVEL</span><b>{selected.travel}</b></div>
            <div><span>SERVICE</span><b>{selected.service}</b></div>
            <div><span>FATIGUE</span><b>+{selected.fatigue}</b></div>
          </div>

          <div className="world-budget-preview">
            <span>EVENT WEEK COST</span>
            <strong>{weeklyOps.toLocaleString('ru-RU')} CASH</strong>
            <small>В кассе: {state.credits.toLocaleString('ru-RU')}</small>
          </div>

          <button className="fifa-primary-cta" onClick={onPrepareMatch}>
            PREPARE EVENT <span>→</span>
          </button>
        </aside>
      </div>
    </section>
  )
}
