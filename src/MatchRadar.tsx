import { useEffect, useMemo, useRef, useState } from 'react'
import type { MatchResult, Player } from './game'

type Point = [number, number]
type Side = 'HOME' | 'AWAY'

interface RadarUnit {
  id: string
  name: string
  side: Side
  path: Point[]
}

const HOME_PATHS: Point[][] = [
  [[170, 590], [230, 520], [315, 455], [410, 420], [500, 350], [590, 300]],
  [[210, 615], [270, 545], [360, 500], [445, 455], [530, 430], [650, 420]],
  [[135, 545], [195, 470], [245, 390], [335, 345], [440, 320], [525, 260]],
  [[250, 570], [325, 525], [390, 470], [470, 400], [560, 345], [695, 300]],
  [[185, 520], [290, 480], [380, 420], [455, 350], [520, 285], [620, 235]],
]

const AWAY_PATHS: Point[][] = [
  [[850, 115], [790, 175], [720, 245], [620, 285], [540, 350], [460, 405]],
  [[810, 90], [750, 165], [660, 205], [590, 265], [520, 320], [410, 350]],
  [[880, 155], [815, 230], [730, 300], [650, 350], [590, 410], [520, 455]],
  [[760, 125], [700, 200], [645, 275], [575, 335], [500, 390], [390, 430]],
  [[835, 205], [780, 275], [700, 350], [625, 400], [545, 445], [455, 490]],
]

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const positionOnPath = (path: Point[], progress: number) => {
  const scaled = clamp01(progress) * (path.length - 1)
  const index = Math.min(path.length - 2, Math.floor(scaled))
  const t = scaled - index
  const a = path[index]
  const b = path[index + 1]
  return {
    x: a[0] + (b[0] - a[0]) * t,
    y: a[1] + (b[1] - a[1]) * t,
    angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI,
  }
}

export function MatchRadar({
  result,
  starters,
  onComplete,
  onSkip,
}: {
  result: MatchResult
  starters: Player[]
  onComplete: () => void
  onSkip: () => void
}) {
  const duration = 10500
  const [elapsed, setElapsed] = useState(0)
  const finished = useRef(false)

  useEffect(() => {
    const started = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const next = Math.min(duration, now - started)
      setElapsed(next)
      if (next >= duration) {
        if (!finished.current) {
          finished.current = true
          window.setTimeout(onComplete, 650)
        }
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onComplete])

  const progress = elapsed / duration
  const combatProgress = Math.min(1, progress / .84)
  const map = result.maps[Math.min(result.maps.length - 1, Math.floor(progress * result.maps.length))] ?? result.maps[0]
  const ourMaps = result.maps.filter((item) => item.us > item.them).length
  const theirMaps = result.maps.filter((item) => item.them > item.us).length
  const timer = Math.max(0, 115 - Math.floor(combatProgress * 115))

  const units = useMemo<RadarUnit[]>(() => {
    const home = starters.slice(0, 5).map((player, index) => ({
      id: player.id,
      name: player.alias,
      side: 'HOME' as const,
      path: HOME_PATHS[index],
    }))
    const away = Array.from({ length: 5 }, (_, index) => ({
      id: 'away-' + index,
      name: result.opponent.slice(0, 7) + (index + 1),
      side: 'AWAY' as const,
      path: AWAY_PATHS[index],
    }))
    return [...home, ...away]
  }, [result.opponent, starters])

  const killThresholds = result.won
    ? [
        { at: .46, victim: 'away-1', killer: starters[0]?.alias ?? 'HOME' },
        { at: .58, victim: 'away-3', killer: starters[2]?.alias ?? 'HOME' },
        { at: .70, victim: starters[4]?.id, killer: result.opponent },
        { at: .79, victim: 'away-0', killer: starters[1]?.alias ?? 'HOME' },
      ]
    : [
        { at: .45, victim: starters[1]?.id, killer: result.opponent },
        { at: .57, victim: 'away-2', killer: starters[0]?.alias ?? 'HOME' },
        { at: .68, victim: starters[3]?.id, killer: result.opponent },
        { at: .78, victim: starters[0]?.id, killer: result.opponent },
      ]

  const dead = new Set(killThresholds.filter((event) => combatProgress >= event.at).map((event) => event.victim))
  const visibleFeed = killThresholds.filter((event) => combatProgress >= event.at).slice(-3)
  const finalPhase = progress > .88

  return (
    <div className="match-radar-overlay" role="dialog" aria-modal="true" aria-label="Симуляция матча">
      <div className="match-radar-shell">
        <header className="match-radar-header">
          <div>
            <span>LIVE MATCH SIMULATION</span>
            <strong>{map?.map ?? 'TACTICAL MAP'}</strong>
          </div>
          <div className="match-radar-score">
            <b>{ourMaps}</b><span>BO3</span><b>{theirMaps}</b>
          </div>
          <div className="match-radar-clock">
            <span>ROUND</span>
            <b>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b>
          </div>
        </header>

        <div className="match-radar-main">
          <div className="match-radar-map">
            <svg viewBox="0 0 1000 700" aria-label="Тактический радар">
              <rect className="radar-floor" x="30" y="30" width="940" height="640" rx="20" />
              <path className="radar-zone" d="M85 500L175 405L250 420L330 350L410 370L470 300L545 315L610 250L700 270L760 205L905 205L925 90L765 65L690 120L590 100L505 165L415 145L350 230L270 205L210 285L115 275Z" />
              <path className="radar-wall" d="M160 520L285 520L285 445L390 445L390 365L500 365L500 285L625 285L625 220L745 220L745 145L865 145" />
              <path className="radar-wall" d="M135 335L260 335L260 270L385 270M545 520L545 430L650 430L650 350L795 350L795 285L900 285" />
              <path className="radar-wall thin" d="M350 600L350 505M690 205L690 115M465 300L390 230M610 430L720 500" />
              <circle className="radar-site site-a" cx="760" cy="190" r="52" />
              <circle className="radar-site site-b" cx="250" cy="500" r="52" />
              <text className="radar-site-label" x="760" y="198" textAnchor="middle">A</text>
              <text className="radar-site-label" x="250" y="508" textAnchor="middle">B</text>

              {units.map((unit, index) => {
                const pos = positionOnPath(unit.path, combatProgress)
                const isDead = dead.has(unit.id)
                const sideClass = unit.side === 'HOME' ? 'home' : 'away'
                return (
                  <g
                    key={unit.id}
                    className={'radar-player ' + sideClass + (isDead ? ' dead' : '')}
                    transform={'translate(' + pos.x + ' ' + pos.y + ')'}
                  >
                    {!isDead && (
                      <polygon
                        className="radar-vision"
                        points="7,0 50,-17 50,17"
                        transform={'rotate(' + pos.angle + ')'}
                      />
                    )}
                    <circle r="14" />
                    <circle className="radar-player-core" r="7" />
                    <text x="0" y="-21" textAnchor="middle">{unit.name}</text>
                    {isDead && <path className="radar-death-x" d="M-8 -8L8 8M8 -8L-8 8" />}
                  </g>
                )
              })}

              {combatProgress > .54 && combatProgress < .61 && (
                <line className="radar-shot home" x1="455" y1="350" x2="650" y2="300" />
              )}
              {combatProgress > .66 && combatProgress < .73 && (
                <line className="radar-shot away" x1="590" y1="410" x2="440" y2="420" />
              )}
            </svg>

            <div className="match-radar-feed">
              {visibleFeed.map((event, index) => (
                <div key={event.at + '-' + index}>
                  <b>{event.killer}</b><span>◆</span><strong>{units.find((unit) => unit.id === event.victim)?.name ?? event.victim}</strong>
                </div>
              ))}
            </div>

            {finalPhase && (
              <div className={'match-radar-result ' + (result.won ? 'win' : 'loss')}>
                <span>SERIES COMPLETE</span>
                <strong>{result.won ? 'VICTORY' : 'DEFEAT'}</strong>
                <small>{result.maps.map((item) => item.us + ':' + item.them).join(' · ')}</small>
              </div>
            )}
          </div>

          <aside className="match-radar-roster">
            <span>YOUR FIVE</span>
            {starters.slice(0, 5).map((player) => (
              <div key={player.id} className={dead.has(player.id) ? 'dead' : ''}>
                <i />
                <b>{player.alias}</b>
                <small>{player.role}</small>
              </div>
            ))}
            <button onClick={onSkip}>SKIP SIM <b>→</b></button>
          </aside>
        </div>

        <footer className="match-radar-progress">
          <i style={{ width: Math.min(100, progress * 100) + '%' }} />
        </footer>
      </div>
    </div>
  )
}
