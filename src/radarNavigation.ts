import type { SimPlayerFrame, SimRound } from './matchSimulation'

export interface RadarNavigationGrid {
  cols: number
  rows: number
  cellSize: number
  walkable: Uint8Array
}

type Point = { x: number; y: number }

const CARDINAL_AND_DIAGONAL = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
] as const

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

const gridIndex = (grid: RadarNavigationGrid, col: number, row: number) =>
  row * grid.cols + col

const cellForPoint = (grid: RadarNavigationGrid, point: Point) => ({
  col: Math.max(0, Math.min(grid.cols - 1, Math.floor(point.x / grid.cellSize))),
  row: Math.max(0, Math.min(grid.rows - 1, Math.floor(point.y / grid.cellSize))),
})

const pointForCell = (grid: RadarNavigationGrid, index: number): Point => {
  const col = index % grid.cols
  const row = Math.floor(index / grid.cols)
  return {
    x: col * grid.cellSize + grid.cellSize / 2,
    y: row * grid.cellSize + grid.cellSize / 2,
  }
}

interface OpenNode {
  index: number
  f: number
}

const heapPush = (heap: OpenNode[], node: OpenNode) => {
  heap.push(node)
  let index = heap.length - 1
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (heap[parent].f <= node.f) break
    heap[index] = heap[parent]
    index = parent
  }
  heap[index] = node
}

const heapPop = (heap: OpenNode[]) => {
  if (!heap.length) return null
  const root = heap[0]
  const tail = heap.pop()!
  if (!heap.length) return root

  let index = 0
  while (true) {
    const left = index * 2 + 1
    const right = left + 1
    if (left >= heap.length) break

    let child = left
    if (right < heap.length && heap[right].f < heap[left].f) child = right
    if (heap[child].f >= tail.f) break

    heap[index] = heap[child]
    index = child
  }

  heap[index] = tail
  return root
}

const walkableAt = (grid: RadarNavigationGrid, col: number, row: number) =>
  col >= 0 &&
  row >= 0 &&
  col < grid.cols &&
  row < grid.rows &&
  grid.walkable[gridIndex(grid, col, row)] === 1

export const createRadarNavigationGrid = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  wallMask: Uint8Array | null,
  cellSize = 8,
): RadarNavigationGrid => {
  const cols = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  const walkable = new Uint8Array(cols * rows)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = col * cellSize
      const y0 = row * cellSize
      const x1 = Math.min(width, x0 + cellSize)
      const y1 = Math.min(height, y0 + cellSize)

      let samples = 0
      let visible = 0
      let dark = 0
      let wall = 0

      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          samples += 1
          const pixel = y * width + x
          const off = pixel * 4
          const alpha = pixels[off + 3]
          if (alpha >= 36) visible += 1

          const luma = (pixels[off] + pixels[off + 1] + pixels[off + 2]) / 3
          if (alpha < 36 || luma < 20) dark += 1
          if (wallMask?.[pixel]) wall += 1
        }
      }

      const visibleRatio = samples ? visible / samples : 0
      const darkRatio = samples ? dark / samples : 1
      const wallRatio = samples ? wall / samples : 0

      // Radar PNGs contain transparent/near-black space outside the actual map.
      // Thick dark wall bands are blocked as well, while thin decorative lines remain traversable.
      if (visibleRatio >= .28 && darkRatio < .74 && wallRatio < .62) {
        walkable[gridIndex({ cols, rows, cellSize, walkable }, col, row)] = 1
      }
    }
  }

  return { cols, rows, cellSize, walkable }
}

const nearestWalkableIndex = (
  grid: RadarNavigationGrid,
  point: Point,
  maxRadius = 18,
) => {
  const base = cellForPoint(grid, point)
  if (walkableAt(grid, base.col, base.row)) return gridIndex(grid, base.col, base.row)

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let row = base.row - radius; row <= base.row + radius; row += 1) {
      for (let col = base.col - radius; col <= base.col + radius; col += 1) {
        if (
          Math.max(Math.abs(col - base.col), Math.abs(row - base.row)) !== radius ||
          !walkableAt(grid, col, row)
        ) continue

        const index = gridIndex(grid, col, row)
        const candidate = pointForCell(grid, index)
        const candidateDistance = distance(candidate, point)
        if (candidateDistance < bestDistance) {
          best = index
          bestDistance = candidateDistance
        }
      }
    }

    if (best >= 0) return best
  }

  return -1
}

export const isNavigationSegmentClear = (
  grid: RadarNavigationGrid,
  from: Point,
  to: Point,
) => {
  const segmentLength = distance(from, to)
  const steps = Math.max(1, Math.ceil(segmentLength / Math.max(2, grid.cellSize * .45)))

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    }
    const cell = cellForPoint(grid, point)
    if (!walkableAt(grid, cell.col, cell.row)) return false
  }

  return true
}

const canUseDiagonal = (
  grid: RadarNavigationGrid,
  col: number,
  row: number,
  dx: number,
  dy: number,
) => {
  if (dx === 0 || dy === 0) return true
  return walkableAt(grid, col + dx, row) && walkableAt(grid, col, row + dy)
}

interface NavigationComponents {
  ids: Int32Array
  sizes: number[]
}

const buildNavigationComponents = (grid: RadarNavigationGrid): NavigationComponents => {
  const total = grid.cols * grid.rows
  const ids = new Int32Array(total)
  ids.fill(-1)
  const sizes: number[] = []

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const start = gridIndex(grid, col, row)
      if (!walkableAt(grid, col, row) || ids[start] >= 0) continue

      const componentId = sizes.length
      const queue: number[] = [start]
      ids[start] = componentId
      let cursor = 0
      let size = 0

      while (cursor < queue.length) {
        const current = queue[cursor]
        cursor += 1
        size += 1
        const currentCol = current % grid.cols
        const currentRow = Math.floor(current / grid.cols)

        for (const [dx, dy] of CARDINAL_AND_DIAGONAL) {
          const nextCol = currentCol + dx
          const nextRow = currentRow + dy
          if (
            !walkableAt(grid, nextCol, nextRow) ||
            !canUseDiagonal(grid, currentCol, currentRow, dx, dy)
          ) continue

          const next = gridIndex(grid, nextCol, nextRow)
          if (ids[next] >= 0) continue
          ids[next] = componentId
          queue.push(next)
        }
      }

      sizes.push(size)
    }
  }

  return { ids, sizes }
}

const nearestWalkableIndexInComponent = (
  grid: RadarNavigationGrid,
  point: Point,
  components: NavigationComponents,
  componentId: number,
) => {
  if (componentId < 0) return -1
  const base = cellForPoint(grid, point)
  const maxRadius = Math.max(grid.cols, grid.rows)

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let row = base.row - radius; row <= base.row + radius; row += 1) {
      for (let col = base.col - radius; col <= base.col + radius; col += 1) {
        if (
          col < 0 ||
          row < 0 ||
          col >= grid.cols ||
          row >= grid.rows ||
          Math.max(Math.abs(col - base.col), Math.abs(row - base.row)) !== radius
        ) continue

        const index = gridIndex(grid, col, row)
        if (components.ids[index] !== componentId) continue
        const candidate = pointForCell(grid, index)
        const candidateDistance = distance(candidate, point)
        if (candidateDistance < bestDistance) {
          best = index
          bestDistance = candidateDistance
        }
      }
    }

    if (best >= 0) return best
  }

  return -1
}

const safeStartIndex = (
  grid: RadarNavigationGrid,
  point: Point,
  components: NavigationComponents,
) => {
  const nearest = nearestWalkableIndex(grid, point)
  if (nearest < 0) return -1

  const componentId = components.ids[nearest]
  const minimumUsefulSize = Math.max(16, Math.floor(grid.cols * grid.rows * .002))
  if ((components.sizes[componentId] ?? 0) >= minimumUsefulSize) return nearest

  let best = nearest
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < components.ids.length; index += 1) {
    const candidateComponent = components.ids[index]
    if (candidateComponent < 0 || (components.sizes[candidateComponent] ?? 0) < minimumUsefulSize) continue
    const candidate = pointForCell(grid, index)
    const candidateDistance = distance(candidate, point)
    if (candidateDistance < bestDistance) {
      best = index
      bestDistance = candidateDistance
    }
  }
  return best
}

const findPath = (
  grid: RadarNavigationGrid,
  from: Point,
  to: Point,
  cache: Map<string, number[]>,
) => {
  const start = nearestWalkableIndex(grid, from)
  const goal = nearestWalkableIndex(grid, to)
  if (start < 0 || goal < 0) return [] as Point[]
  if (start === goal) return [pointForCell(grid, goal)]

  const key = start + ':' + goal
  const cached = cache.get(key)
  if (cached) return cached.map((index) => pointForCell(grid, index))

  const total = grid.cols * grid.rows
  const g = new Float32Array(total)
  g.fill(Number.POSITIVE_INFINITY)
  const cameFrom = new Int32Array(total)
  cameFrom.fill(-1)
  const closed = new Uint8Array(total)
  const open: OpenNode[] = []

  const goalPoint = pointForCell(grid, goal)
  g[start] = 0
  heapPush(open, { index: start, f: distance(pointForCell(grid, start), goalPoint) })

  let expansions = 0
  while (open.length && expansions < total) {
    const currentNode = heapPop(open)
    if (!currentNode) break
    const current = currentNode.index
    expansions += 1
    if (closed[current]) continue
    if (current === goal) {
      const path: number[] = []
      let cursor = goal
      while (cursor >= 0) {
        path.push(cursor)
        if (cursor === start) break
        cursor = cameFrom[cursor]
      }
      path.reverse()
      cache.set(key, path)
      return path.map((index) => pointForCell(grid, index))
    }

    closed[current] = 1
    const col = current % grid.cols
    const row = Math.floor(current / grid.cols)

    for (const [dx, dy] of CARDINAL_AND_DIAGONAL) {
      const nextCol = col + dx
      const nextRow = row + dy
      if (
        !walkableAt(grid, nextCol, nextRow) ||
        !canUseDiagonal(grid, col, row, dx, dy)
      ) continue

      const next = gridIndex(grid, nextCol, nextRow)
      if (closed[next]) continue

      const stepCost = dx && dy ? Math.SQRT2 : 1
      const tentative = g[current] + stepCost
      if (tentative >= g[next]) continue

      cameFrom[next] = current
      g[next] = tentative
      const heuristic = distance(pointForCell(grid, next), goalPoint) / grid.cellSize
      heapPush(open, { index: next, f: tentative + heuristic })
    }
  }

  return [] as Point[]
}

const moveToward = (from: Point, to: Point, maxDistance: number): Point => {
  const total = distance(from, to)
  if (total <= maxDistance || total === 0) return to
  const t = maxDistance / total
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  }
}

const advanceAlongPath = (
  from: Point,
  path: Point[],
  maxDistance: number,
) => {
  let current = from
  let remaining = maxDistance

  for (const point of path) {
    const segment = distance(current, point)
    if (segment <= .5) continue
    if (segment > remaining) return moveToward(current, point, remaining)
    current = point
    remaining -= segment
    if (remaining <= .5) break
  }

  return current
}

const constrainTarget = (
  grid: RadarNavigationGrid,
  previous: Point,
  target: Point,
  maxDistance: number,
  cache: Map<string, number[]>,
  components: NavigationComponents,
) => {
  const previousIndex = nearestWalkableIndex(grid, previous, 3)
  if (previousIndex < 0) return previous
  const previousComponent = components.ids[previousIndex]
  if (previousComponent < 0) return previous

  let targetIndex = nearestWalkableIndex(grid, target)
  if (targetIndex < 0 || components.ids[targetIndex] !== previousComponent) {
    targetIndex = nearestWalkableIndexInComponent(grid, target, components, previousComponent)
  }
  if (targetIndex < 0) return previous

  const safeTarget = pointForCell(grid, targetIndex)
  if (isNavigationSegmentClear(grid, previous, safeTarget)) {
    const candidate = moveToward(previous, safeTarget, maxDistance)
    return isNavigationSegmentClear(grid, previous, candidate) ? candidate : previous
  }

  const path = findPath(grid, previous, safeTarget, cache)
  if (!path.length) return previous
  const candidate = advanceAlongPath(previous, path, maxDistance)
  return isNavigationSegmentClear(grid, previous, candidate) ? candidate : previous
}

const yawBetween = (from: Point, to: Point, fallback: number) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.hypot(dx, dy) < .5) return fallback
  return Math.atan2(dy, dx) * 180 / Math.PI
}

export const constrainRoundToNavigation = (
  round: SimRound,
  grid: RadarNavigationGrid,
): SimRound => {
  if (!round.frames.length) return round

  const previousByPlayer = new Map<string, Point>()
  const yawByPlayer = new Map<string, number>()
  const pathCache = new Map<string, number[]>()
  const components = buildNavigationComponents(grid)

  const frames = round.frames.map((frame, frameIndex) => {
    const previousFrameTime = frameIndex > 0 ? round.frames[frameIndex - 1].time : frame.time
    const frameDelta = Math.max(100, frame.time - previousFrameTime)
    // ~150 px/s on a 1024 radar: fast enough to look natural but too small to tunnel through walls.
    const maxDistance = 15 * frameDelta / 100

    const players = frame.players.map((player): SimPlayerFrame => {
      const raw = { x: player.x, y: player.y }
      const existing = previousByPlayer.get(player.id)

      if (!existing) {
        const startIndex = safeStartIndex(grid, raw, components)
        const start = startIndex >= 0 ? pointForCell(grid, startIndex) : raw
        previousByPlayer.set(player.id, start)
        yawByPlayer.set(player.id, player.yaw)
        return { ...player, x: start.x, y: start.y }
      }

      const next = constrainTarget(grid, existing, raw, maxDistance, pathCache, components)
      const yaw = yawBetween(existing, next, yawByPlayer.get(player.id) ?? player.yaw)
      previousByPlayer.set(player.id, next)
      yawByPlayer.set(player.id, yaw)
      return { ...player, x: next.x, y: next.y, yaw }
    })

    return { ...frame, players }
  })

  // Combat is generated before real radar navigation is applied. Re-time each
  // duel to a frame where both players have actual line of sight, then rebuild
  // HP/alive state from those corrected events.
  const clearCombatTimeByPair = new Map<string, number>()
  const blockedCombatPairs = new Set<string>()
  const causalPairRemap = new Map<string, {
    actorId: string
    targetId: string
    actorName: string
    targetName: string
    side: SimPlayerFrame['side']
    time: number
  }>()
  const usedCausalCounterparts = new Set<string>()
  const pairKey = (actorId?: string, targetId?: string) => actorId && targetId ? actorId + '>' + targetId : ''
  const firstFramePlayers = frames[0]?.players ?? []
  const causalPlayer = round.keyPlayer
    ? firstFramePlayers.find((player) => player.name === round.keyPlayer)
    : undefined
  const causalAsActor = round.cause === 'CLUTCH'
  const causalAsTarget = round.cause === 'PLAYER_ERROR' || round.cause === 'FATIGUE'

  for (const event of round.events) {
    if (event.type !== 'kill' || !event.actorId || !event.targetId) continue
    const nearbyFrames = frames
      .filter((frame) => Math.abs(frame.time - event.time) <= 1200)
      .sort((a, b) => Math.abs(a.time - event.time) - Math.abs(b.time - event.time))
    const clearFrame = nearbyFrames.find((frame) => {
      const actor = frame.players.find((player) => player.id === event.actorId)
      const target = frame.players.find((player) => player.id === event.targetId)
      return Boolean(
        actor &&
        target &&
        actor.alive &&
        target.alive &&
        isNavigationSegmentClear(
          grid,
          { x: actor.x, y: actor.y },
          { x: target.x, y: target.y },
        )
      )
    })
    const key = pairKey(event.actorId, event.targetId)
    if (clearFrame) {
      clearCombatTimeByPair.set(key, clearFrame.time)
      continue
    }

    const isCriticalPair = Boolean(
      causalPlayer &&
      ((causalAsActor && event.actorId === causalPlayer.id) ||
       (causalAsTarget && event.targetId === causalPlayer.id)),
    )
    if (!isCriticalPair || !causalPlayer) {
      blockedCombatPairs.add(key)
      continue
    }

    let fallback: { frame: SimRound['frames'][number]; counterpart: SimPlayerFrame } | null = null
    for (const frame of nearbyFrames) {
      const critical = frame.players.find((player) => player.id === causalPlayer.id)
      if (!critical?.alive) continue
      const candidates = frame.players.filter((player) =>
        player.id !== critical.id &&
        player.side !== critical.side &&
        player.alive &&
        !usedCausalCounterparts.has(player.id) &&
        isNavigationSegmentClear(
          grid,
          { x: critical.x, y: critical.y },
          { x: player.x, y: player.y },
        ),
      )
      const counterpart = candidates[0]
      if (counterpart) {
        fallback = { frame, counterpart }
        break
      }
    }

    if (!fallback) {
      blockedCombatPairs.add(key)
      continue
    }

    usedCausalCounterparts.add(fallback.counterpart.id)
    const remap = causalAsActor
      ? {
          actorId: causalPlayer.id,
          targetId: fallback.counterpart.id,
          actorName: causalPlayer.name,
          targetName: fallback.counterpart.name,
          side: causalPlayer.side,
          time: fallback.frame.time,
        }
      : {
          actorId: fallback.counterpart.id,
          targetId: causalPlayer.id,
          actorName: fallback.counterpart.name,
          targetName: causalPlayer.name,
          side: fallback.counterpart.side,
          time: fallback.frame.time,
        }
    causalPairRemap.set(key, remap)
    clearCombatTimeByPair.set(key, remap.time)
  }

  const navigatedEvents = round.events
    .filter((event) => {
      if (event.type !== 'shot' && event.type !== 'damage' && event.type !== 'kill') return true
      const key = pairKey(event.actorId, event.targetId)
      return !blockedCombatPairs.has(key) || causalPairRemap.has(key)
    })
    .map((event) => {
      if ((event.type === 'shot' || event.type === 'damage' || event.type === 'kill') && event.actorId && event.targetId) {
        const key = pairKey(event.actorId, event.targetId)
        const remap = causalPairRemap.get(key)
        const clearKillTime = clearCombatTimeByPair.get(key)
        if (clearKillTime != null) {
          const offset = event.type === 'shot' ? -240 : event.type === 'damage' ? -130 : 0
          return {
            ...event,
            ...(remap ? {
              actorId: remap.actorId,
              targetId: remap.targetId,
              actorName: remap.actorName,
              targetName: remap.targetName,
              side: remap.side,
            } : {}),
            time: Math.max(0, clearKillTime + offset),
          }
        }
      }
      return event
    })
    .sort((a, b) => a.time - b.time)

  const reconciledFrames = frames.map((frame) => ({
    ...frame,
    players: frame.players.map((player) => {
      let hp = 100
      let alive = true
      for (const event of navigatedEvents) {
        if (event.time > frame.time) break
        if (event.targetId !== player.id) continue
        if (event.type === 'damage') hp = Math.max(1, hp - (event.damage ?? 0))
        if (event.type === 'kill') {
          hp = 0
          alive = false
          break
        }
      }
      return { ...player, hp, alive, hasBomb: alive ? player.hasBomb : false }
    }),
  }))

  const projectEvent = (x: number | undefined, y: number | undefined) => {
    if (x == null || y == null) return null
    const index = nearestWalkableIndex(grid, { x, y })
    if (index < 0) return { x, y }
    return pointForCell(grid, index)
  }

  const events = navigatedEvents.map((event) => {
    const projected = projectEvent(event.x, event.y)
    return projected ? { ...event, x: projected.x, y: projected.y } : event
  })

  return { ...round, frames: reconciledFrames, events }
}
