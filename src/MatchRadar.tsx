import { useEffect, useMemo, useRef, useState } from 'react'
import type { MatchResult, Player } from './game'
import {
  radarAssetUrl,
  simulationFrameAt,
  type MatchPlayback,
  type SimEvent,
  type SimPlayerFrame,
  type SimRound,
  type SimSide,
} from './matchSimulation'
import { buildMatchPlayback } from './simulationClient'
import { constrainRoundToNavigation, createRadarNavigationGrid, type RadarNavigationGrid } from './radarNavigation'

const CANVAS_SIZE = 1024
const PLAYER_RADIUS = 9
const CT_COLOR = '#4ba7ff'
const T_COLOR = '#f2a04b'
const DEAD_COLOR = '#ff5b72'
const WALL_LUMA = 58

type RadarResource = { image: HTMLImageElement; wallMask: Uint8Array | null; navigationGrid: RadarNavigationGrid | null }
const radarResourceCache = new Map<string, RadarResource>()
const radarResourcePromises = new Map<string, Promise<RadarResource | null>>()
const playbackElapsedCache = new Map<string, number>()

const sideColor = (side: SimSide) => side === 'CT' ? CT_COLOR : T_COLOR
const STORY_CAUSE_LABELS: Record<NonNullable<SimRound['cause']>, string> = {
  AIM: 'DUEL EXECUTION',
  TACTICAL_EDGE: 'TACTICAL EDGE',
  ANTI_STRAT: 'ANTI-STRAT READ',
  CLUTCH: 'CLUTCH ROUND',
  PLAYER_ERROR: 'PLAYER ERROR',
  FATIGUE: 'FATIGUE DROP',
  COMMUNICATION: 'COMMS BREAKDOWN',
  MOMENTUM: 'MOMENTUM',
}


const extractRadarMasks = (img: HTMLImageElement) => {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { wallMask: null, navigationGrid: null }

  ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
  const wallMask = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE)

  for (let y = 1; y < CANVAS_SIZE - 1; y += 2) {
    for (let x = 1; x < CANVAS_SIZE - 1; x += 2) {
      const pixel = y * CANVAS_SIZE + x
      const off = pixel * 4
      const alpha = data[off + 3]
      if (alpha < 80) continue

      const luma = (data[off] + data[off + 1] + data[off + 2]) / 3
      if (luma < WALL_LUMA) {
        wallMask[pixel] = 1
        wallMask[pixel + 1] = 1
        wallMask[pixel + CANVAS_SIZE] = 1
        wallMask[pixel + CANVAS_SIZE + 1] = 1
      }
    }
  }

  return {
    wallMask,
    navigationGrid: createRadarNavigationGrid(data, CANVAS_SIZE, CANVAS_SIZE, wallMask),
  }
}

const loadRadarResource = (mapKey: string) => {
  const cached = radarResourceCache.get(mapKey)
  if (cached) return Promise.resolve<RadarResource | null>(cached)

  const pending = radarResourcePromises.get(mapKey)
  if (pending) return pending

  const promise = new Promise<RadarResource | null>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const masks = extractRadarMasks(image)
      const resource = { image, ...masks }
      radarResourceCache.set(mapKey, resource)
      radarResourcePromises.delete(mapKey)
      resolve(resource)
    }
    image.onerror = () => {
      radarResourcePromises.delete(mapKey)
      resolve(null)
    }
    image.src = radarAssetUrl(mapKey)
  })

  radarResourcePromises.set(mapKey, promise)
  return promise
}

const raycastCone = (
  x: number,
  y: number,
  yaw: number,
  mask: Uint8Array | null,
  radius = 145,
) => {
  const points: Array<[number, number]> = []
  const fov = Math.PI * .55
  const center = yaw * Math.PI / 180

  for (let ray = 0; ray <= 38; ray += 1) {
    const angle = center - fov / 2 + fov * ray / 38
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    let hit = radius

    if (mask) {
      for (let distance = 5; distance <= radius; distance += 5) {
        const sx = Math.round(x + cos * distance)
        const sy = Math.round(y + sin * distance)
        if (sx < 0 || sy < 0 || sx >= CANVAS_SIZE || sy >= CANVAS_SIZE) {
          hit = distance
          break
        }
        if (mask[sy * CANVAS_SIZE + sx]) {
          hit = distance
          break
        }
      }
    }

    points.push([x + cos * hit, y + sin * hit])
  }

  return points
}

const eventPosition = (event: SimEvent, players: SimPlayerFrame[]) => {
  if (event.x != null && event.y != null) return [event.x, event.y] as const
  const actor = players.find((player) => player.id === event.actorId)
  return actor ? [actor.x, actor.y] as const : [512, 512] as const
}

const drawUtility = (
  ctx: CanvasRenderingContext2D,
  events: SimEvent[],
  players: SimPlayerFrame[],
  time: number,
) => {
  for (const event of events) {
    if (event.type !== 'utility' || event.time > time) continue
    const age = time - event.time
    const [x, y] = eventPosition(event, players)

    if (event.utility === 'smoke' && age < 4200) {
      const t = Math.min(1, age / 650)
      const radius = 18 + 42 * t
      const alpha = age > 3300 ? Math.max(0, 1 - (age - 3300) / 900) : .72
      const gradient = ctx.createRadialGradient(x, y, 4, x, y, radius)
      gradient.addColorStop(0, 'rgba(184,194,208,' + (alpha * .9) + ')')
      gradient.addColorStop(.6, 'rgba(118,129,146,' + (alpha * .65) + ')')
      gradient.addColorStop(1, 'rgba(83,92,108,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    if (event.utility === 'molotov' && age < 3000) {
      const fade = age > 2300 ? Math.max(0, 1 - (age - 2300) / 700) : 1
      ctx.save()
      ctx.globalAlpha = .75 * fade
      ctx.fillStyle = '#ff6b32'
      for (let index = 0; index < 7; index += 1) {
        const angle = index * Math.PI * 2 / 7
        const radius = 18 + (index % 3) * 10
        ctx.beginPath()
        ctx.arc(x + Math.cos(angle) * radius * .8, y + Math.sin(angle) * radius * .55, 15 + index % 3 * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    if (event.utility === 'flash' && age < 700) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - age / 700)
      ctx.strokeStyle = '#fff6bd'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, 20 + age * .09, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
}

const drawBombState = (
  ctx: CanvasRenderingContext2D,
  round: SimRound,
  players: SimPlayerFrame[],
  time: number,
) => {
  const plant = round.events.find((event) => event.type === 'plant')
  if (!plant || plant.time > time) return

  const laterDefuse = round.events.find((event) => event.type === 'defuse' && event.time <= time)
  if (laterDefuse) return

  const [x, y] = eventPosition(plant, players)
  const pulse = 1 + Math.sin(time / 110) * .16
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(pulse, pulse)
  ctx.fillStyle = '#ff536d'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.fillRect(-8, -8, 16, 16)
  ctx.strokeRect(-8, -8, 16, 16)
  ctx.fillStyle = '#fff'
  ctx.font = '900 11px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('C4', 0, 4)
  ctx.restore()
}

const shotPathIsClear = (
  from: SimPlayerFrame,
  to: SimPlayerFrame,
  wallMask: Uint8Array | null,
) => {
  if (!wallMask) return true
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / 2))
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const x = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.round(from.x + (to.x - from.x) * t)))
    const y = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.round(from.y + (to.y - from.y) * t)))
    if (wallMask[y * CANVAS_SIZE + x]) return false
  }
  return true
}

const drawShotLines = (
  ctx: CanvasRenderingContext2D,
  events: SimEvent[],
  players: SimPlayerFrame[],
  time: number,
  wallMask: Uint8Array | null,
) => {
  const active = events.filter((event) =>
    (event.type === 'shot' || event.type === 'damage' || event.type === 'kill') &&
    time >= event.time &&
    time - event.time < (event.type === 'kill' ? 420 : 180),
  )

  for (const event of active) {
    const actor = players.find((player) => player.id === event.actorId)
    const target = players.find((player) => player.id === event.targetId)
    if (!actor || !target || !shotPathIsClear(actor, target, wallMask)) continue

    ctx.save()
    ctx.globalAlpha = event.type === 'kill' ? .9 : .5
    ctx.strokeStyle = event.type === 'kill' ? DEAD_COLOR : sideColor(event.side)
    ctx.lineWidth = event.type === 'kill' ? 2.5 : 1.25
    if (event.type === 'kill') ctx.setLineDash([8, 5])
    ctx.beginPath()
    ctx.moveTo(actor.x, actor.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
    ctx.restore()
  }
}

const drawPlayer = (
  ctx: CanvasRenderingContext2D,
  player: SimPlayerFrame,
  wallMask: Uint8Array | null,
  selected: boolean,
) => {
  const color = sideColor(player.side)

  if (player.alive) {
    const points = raycastCone(player.x, player.y, player.yaw, wallMask)
    const gradient = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, 145)
    const rgba = player.side === 'CT' ? '75,167,255' : '242,160,75'
    gradient.addColorStop(0, 'rgba(' + rgba + ',.15)')
    gradient.addColorStop(.45, 'rgba(' + rgba + ',.07)')
    gradient.addColorStop(1, 'rgba(' + rgba + ',0)')

    ctx.save()
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(player.x, player.y)
    for (const point of points) ctx.lineTo(point[0], point[1])
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = player.alive ? 1 : .3

  if (selected && player.alive) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(player.x, player.y, PLAYER_RADIUS + 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = color
  ctx.strokeStyle = '#06101b'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(player.x, player.y, 3.4, 0, Math.PI * 2)
  ctx.fill()

  if (player.hasBomb) {
    ctx.fillStyle = '#ff536d'
    ctx.fillRect(player.x + 8, player.y - 14, 7, 7)
  }

  if (!player.alive) {
    ctx.strokeStyle = DEAD_COLOR
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(player.x - 7, player.y - 7)
    ctx.lineTo(player.x + 7, player.y + 7)
    ctx.moveTo(player.x + 7, player.y - 7)
    ctx.lineTo(player.x - 7, player.y + 7)
    ctx.stroke()
  }

  ctx.font = '800 11px Arial'
  ctx.textAlign = 'center'
  ctx.lineWidth = 4
  ctx.strokeStyle = '#090a0b'
  ctx.strokeText(player.name, player.x, player.y - 17)
  ctx.fillStyle = '#eee9df'
  ctx.fillText(player.name, player.x, player.y - 17)

  if (player.alive && player.hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,.65)'
    ctx.fillRect(player.x - 18, player.y + 15, 36, 4)
    ctx.fillStyle = player.hp > 45 ? '#62e8bd' : '#ff6579'
    ctx.fillRect(player.x - 18, player.y + 15, 36 * player.hp / 100, 4)
  }

  ctx.restore()
}

const drawCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  wallMask: Uint8Array | null,
  round: SimRound,
  time: number,
  selectedId: string | null,
) => {
  const ctx = canvas.getContext('2d')
  const frame = simulationFrameAt(round, time)
  if (!ctx || !frame) return

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.fillStyle = '#0d0f10'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  if (image) {
    ctx.save()
    ctx.globalAlpha = .82
    ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.restore()
    ctx.fillStyle = 'rgba(8,9,10,.14)'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  } else {
    ctx.strokeStyle = 'rgba(143,132,114,.14)'
    ctx.lineWidth = 1
    for (let grid = 0; grid <= CANVAS_SIZE; grid += 64) {
      ctx.beginPath()
      ctx.moveTo(grid, 0)
      ctx.lineTo(grid, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, grid)
      ctx.lineTo(CANVAS_SIZE, grid)
      ctx.stroke()
    }
  }

  drawUtility(ctx, round.events, frame.players, time)
  drawBombState(ctx, round, frame.players, time)
  drawShotLines(ctx, round.events, frame.players, time, wallMask)

  const ordered = [...frame.players].sort((a, b) => Number(a.alive) - Number(b.alive))
  ordered.forEach((player) => drawPlayer(ctx, player, wallMask, selectedId === player.id))
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
  const [playback, setPlayback] = useState<MatchPlayback | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const wallMaskRef = useRef<Uint8Array | null>(null)
  const elapsedRef = useRef(0)
  const lastFrameRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(1)
  const [paused, setPaused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(starters[0]?.id ?? null)
  const [imageReady, setImageReady] = useState(false)
  const [navigationRound, setNavigationRound] = useState<SimRound | null>(null)
  const simulationKey = useMemo(
    () => result.id + ':' + result.tactic + ':' + starters.map((player) => player.id).join(','),
    [result.id, result.tactic, starters],
  )

  useEffect(() => {
    let cancelled = false
    const resumeAt = playbackElapsedCache.get(simulationKey) ?? 0
    setPlayback(null)
    elapsedRef.current = resumeAt
    lastFrameRef.current = null
    finishedRef.current = false
    setElapsed(resumeAt)

    void buildMatchPlayback(result, starters, result.tactic).then((next) => {
      if (!cancelled) {
        elapsedRef.current = Math.min(elapsedRef.current, next.totalDuration)
        setElapsed(elapsedRef.current)
        setPlayback(next)
      }
    })

    return () => {
      cancelled = true
      playbackElapsedCache.set(simulationKey, elapsedRef.current)
    }
  }, [simulationKey])

  useEffect(() => {
    const resyncFrameClock = () => {
      lastFrameRef.current = performance.now()
    }

    document.addEventListener('visibilitychange', resyncFrameClock)
    window.addEventListener('blur', resyncFrameClock)
    window.addEventListener('focus', resyncFrameClock)
    return () => {
      document.removeEventListener('visibilitychange', resyncFrameClock)
      window.removeEventListener('blur', resyncFrameClock)
      window.removeEventListener('focus', resyncFrameClock)
    }
  }, [])

  const rounds = playback?.rounds ?? []
  const roundOffsets = useMemo(() => {
    let cursor = 0
    return rounds.map((round) => {
      const start = cursor
      cursor += round.duration
      return { start, end: cursor }
    })
  }, [rounds])

  const locatedRoundIndex = rounds.length
    ? roundOffsets.findIndex((offset) => elapsed < offset.end)
    : -1
  const currentRoundIndex = rounds.length
    ? (locatedRoundIndex >= 0 ? locatedRoundIndex : rounds.length - 1)
    : 0
  const round = rounds[currentRoundIndex]
  const activeRound = navigationRound?.id === round?.id ? navigationRound : null
  const roundOffset = roundOffsets[currentRoundIndex]?.start ?? 0
  const localTime = Math.max(0, elapsed - roundOffset)
  const frame = activeRound ? simulationFrameAt(activeRound, localTime) : null
  const totalDuration = playback?.totalDuration ?? 0
  const seriesProgress = totalDuration ? Math.min(1, elapsed / totalDuration) : 0
  const roundProgress = activeRound ? Math.min(1, localTime / activeRound.duration) : 0
  const timer = Math.max(0, 115 - Math.floor(roundProgress * 115))
  const finalPhase = Boolean(playback && totalDuration > 0 && elapsed >= totalDuration)

  useEffect(() => {
    if (!round) return
    let cancelled = false
    setImageReady(false)
    setNavigationRound(null)
    imageRef.current = null
    wallMaskRef.current = null

    void loadRadarResource(round.mapKey).then((resource) => {
      if (cancelled) return
      imageRef.current = resource?.image ?? null
      wallMaskRef.current = resource?.wallMask ?? null
      setNavigationRound(
        resource?.navigationGrid
          ? constrainRoundToNavigation(round, resource.navigationGrid)
          : round,
      )
      setImageReady(true)
    })

    const nextRound = rounds[currentRoundIndex + 1]
    if (nextRound) void loadRadarResource(nextRound.mapKey)

    return () => {
      cancelled = true
    }
  }, [currentRoundIndex, rounds, round])

  useEffect(() => {
    if (!playback || playback.totalDuration <= 0) return
    let raf = 0
    let lastHudUpdate = 0

    const tick = (now: number) => {
      if (lastFrameRef.current == null) lastFrameRef.current = now

      if (document.hidden) {
        lastFrameRef.current = now
        raf = requestAnimationFrame(tick)
        return
      }

      const delta = Math.min(80, now - lastFrameRef.current)
      lastFrameRef.current = now

      if (!paused && !finishedRef.current && navigationRound?.id === round?.id) {
        elapsedRef.current = Math.min(playback.totalDuration, elapsedRef.current + delta * speed)
        if (now - lastHudUpdate > 45 || elapsedRef.current >= playback.totalDuration) {
          playbackElapsedCache.set(simulationKey, elapsedRef.current)
          setElapsed(elapsedRef.current)
          lastHudUpdate = now
        }
      }

      if (elapsedRef.current >= playback.totalDuration && !finishedRef.current) {
        finishedRef.current = true
        playbackElapsedCache.delete(simulationKey)
        setElapsed(playback.totalDuration)
        window.setTimeout(onComplete, 1100)
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [navigationRound, onComplete, paused, playback, round?.id, simulationKey, speed])

  useEffect(() => {
    if (!canvasRef.current || !activeRound) return
    drawCanvas(canvasRef.current, imageRef.current, wallMaskRef.current, activeRound, localTime, selectedId)
  }, [activeRound, elapsed, imageReady, localTime, selectedId])

  const recentKills = activeRound
    ? activeRound.events.filter((event) => event.type === 'kill' && event.time <= localTime && localTime - event.time < 3500).slice(-4)
    : []
  const recentUtility = activeRound
    ? activeRound.events.filter((event) => event.type === 'utility' && event.time <= localTime && localTime - event.time < 1800).slice(-1)[0]
    : null
  const plant = activeRound?.events.find((event) => event.type === 'plant' && event.time <= localTime)
  const defuse = activeRound?.events.find((event) => event.type === 'defuse' && event.time <= localTime)
  const selected = frame?.players.find((player) => player.id === selectedId) ?? null
  const homePlayers = frame?.players.filter((player) => !player.id.startsWith('away-')) ?? []
  const awayPlayers = frame?.players.filter((player) => player.id.startsWith('away-')) ?? []

  const activeMapIndex = activeRound
    ? Math.max(0, result.maps.findIndex((map) => map.map === activeRound.map))
    : 0
  const completedMaps = result.maps.slice(0, activeMapIndex)
  const showCurrentScore = roundProgress > .92
  const scoreMaps = showCurrentScore ? result.maps.slice(0, activeMapIndex + 1) : completedMaps
  const ourMaps = scoreMaps.filter((map) => map.us > map.them).length
  const theirMaps = scoreMaps.filter((map) => map.them > map.us).length

  return (
    <div className="match-radar-overlay" role="dialog" aria-modal="true" aria-label="Симуляция матча">
      <div className="match-radar-shell match-radar-shell-canvas">
        <header className="match-radar-header">
          <div>
            <span>{playback ? 'LIVE TACTICAL SIM · ROUND ' + (currentRoundIndex + 1) + '/' + rounds.length : 'PREPARING MATCH SIMULATION'}</span>
            <strong>{activeRound?.map ?? 'TACTICAL MAP'} · {activeRound?.scenarioLabel}</strong>
          </div>
          <div className="match-radar-score">
            <b>{activeRound?.scoreUs ?? ourMaps}</b>
            <span>{activeRound?.scoreUs != null ? 'ROUND SCORE' : 'BO3'}</span>
            <b>{activeRound?.scoreThem ?? theirMaps}</b>
          </div>
          <div className="match-radar-clock">
            <span>{plant && !defuse ? 'BOMB PLANTED · ' + round.site : 'ROUND CLOCK'}</span>
            <b>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b>
          </div>
        </header>

        <div className="match-radar-main match-radar-main-canvas">
          <div className="match-radar-map match-radar-canvas-wrap">
            {!playback && <div className="match-radar-loading"><span>SIMULATION ENGINE</span><strong>BUILDING ROUND DATA…</strong><i /></div>}
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="match-radar-canvas"
              onClick={(event) => {
                if (!frame) return
                const rect = event.currentTarget.getBoundingClientRect()
                const x = (event.clientX - rect.left) / rect.width * CANVAS_SIZE
                const y = (event.clientY - rect.top) / rect.height * CANVAS_SIZE
                let best: SimPlayerFrame | null = null
                let bestDistance = 35
                for (const player of frame.players) {
                  const distance = Math.hypot(player.x - x, player.y - y)
                  if (distance < bestDistance) {
                    best = player
                    bestDistance = distance
                  }
                }
                if (best) setSelectedId(best.id)
              }}
            />

            <div className="match-radar-feed">
              {recentKills.map((event) => (
                <div key={event.id}>
                  <b className={event.side === round?.homeSide ? 'our' : 'their'}>{event.actorName}</b>
                  <span>{event.headshot ? '◆ HS' : '◆'}</span>
                  <strong>{event.targetName}</strong>
                </div>
              ))}
            </div>

            <div className="match-radar-context">
              <span>{activeRound?.homeSide === 'CT' ? 'HOME CT' : 'HOME T'}</span>
              <b>{activeRound?.cause ? STORY_CAUSE_LABELS[activeRound.cause] : activeRound?.scenarioLabel}</b>
              <small>{activeRound?.keyPlayer ? activeRound.keyPlayer + ' · ' : ''}{recentUtility ? recentUtility.utility?.toUpperCase() + ' DEPLOYED' : plant && !defuse ? 'POST-PLANT ' + round.site : activeRound?.scenarioLabel ?? 'LIVE POSITIONING'}</small>
            </div>

            {finalPhase && (
              <div className={'match-radar-result ' + (result.won ? 'win' : 'loss')}>
                <span>SERIES COMPLETE</span>
                <strong>{result.won ? 'VICTORY' : 'DEFEAT'}</strong>
                <small>{result.maps.map((map) => map.map + ' ' + map.us + ':' + map.them).join(' · ')}</small>
              </div>
            )}
          </div>

          <aside className="match-radar-roster match-radar-roster-v2">
            <div className="radar-side-heading home">
              <span>YOUR FIVE · {activeRound?.homeSide}</span>
              <b>{homePlayers.filter((player) => player.alive).length}/5</b>
            </div>
            {homePlayers.map((player) => (
              <button
                key={player.id}
                className={(player.alive ? '' : 'dead ') + (selectedId === player.id ? 'selected' : '')}
                onClick={() => setSelectedId(player.id)}
              >
                <i />
                <span><b>{player.name}</b><small>{player.weapon}</small></span>
                <strong>{player.alive ? player.hp : 'DEAD'}</strong>
              </button>
            ))}

            <div className="radar-side-heading away">
              <span>{result.opponent.toUpperCase()} · {activeRound?.homeSide === 'CT' ? 'T' : 'CT'}</span>
              <b>{awayPlayers.filter((player) => player.alive).length}/5</b>
            </div>
            {awayPlayers.map((player) => (
              <button
                key={player.id}
                className={(player.alive ? '' : 'dead ') + (selectedId === player.id ? 'selected' : '')}
                onClick={() => setSelectedId(player.id)}
              >
                <i />
                <span><b>{player.name}</b><small>{player.weapon}</small></span>
                <strong>{player.alive ? player.hp : 'DEAD'}</strong>
              </button>
            ))}

            {selected && (
              <div className="radar-selected-player">
                <span>FOCUS</span>
                <b>{selected.name}</b>
                <small>{selected.weapon} · {selected.alive ? selected.hp + ' HP' : 'ELIMINATED'}</small>
              </div>
            )}

            <div className="radar-playback-controls">
              <button onClick={() => setPaused((value) => !value)}>{paused ? 'RESUME' : 'PAUSE'}</button>
              <button onClick={() => setSpeed((value) => value === 1 ? 2 : value === 2 ? 4 : value === 4 ? 8 : 1)}>{speed}X</button>
              <button onClick={() => {
                playbackElapsedCache.delete(simulationKey)
                onSkip()
              }}>SKIP <b>→</b></button>
            </div>
          </aside>
        </div>

        <footer className="match-radar-progress">
          <i style={{ width: Math.min(100, seriesProgress * 100) + '%' }} />
        </footer>
      </div>
    </div>
  )
}
