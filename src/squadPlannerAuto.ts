import {
  LINEUP_SLOTS,
  lineupFitScore,
  overall,
  type LineupSlot,
  type Player,
} from './game'

export type PlannerAutoHorizon = 0 | 1 | 2
export type PlannerAutoSource = 'club' | 'collection' | 'target'

export type PlannerAutoCandidate = {
  key: string
  player: Player
  source: PlannerAutoSource
}

export type PlannerAutoContext = {
  horizon: PlannerAutoHorizon
  seasonLength: number
  week: number
}

const weeksAhead = ({ horizon, seasonLength, week }: PlannerAutoContext) =>
  horizon === 0
    ? 0
    : Math.max(1, seasonLength - week + 1) + (horizon - 1) * seasonLength

export const projectedPlannerOverall = (player: Player, horizon: PlannerAutoHorizon) => {
  const current = overall(player)
  if (horizon === 0) return current

  const age = player.age ?? 25
  const growthRoom = Math.max(0, player.potential - current)
  const youthGrowth = age <= 22
    ? Math.min(growthRoom, 3 * horizon)
    : age <= 25
      ? Math.min(growthRoom, 2 * horizon)
      : age <= 28
        ? Math.min(growthRoom, horizon)
        : 0
  const decline = age >= 31
    ? Math.max(1, age - 29) * horizon
    : age >= 29
      ? horizon
      : 0

  return Math.max(45, Math.min(99, current + youthGrowth - decline))
}

export const plannerCandidateSecured = (candidate: PlannerAutoCandidate, context: PlannerAutoContext) =>
  candidate.source !== 'club' || candidate.player.contractWeeks > weeksAhead(context)

export const plannerAutoScore = (
  candidate: PlannerAutoCandidate,
  role: LineupSlot,
  context: PlannerAutoContext,
) => {
  const fit = lineupFitScore(candidate.player, role)
  const projected = projectedPlannerOverall(candidate.player, context.horizon)
  const exactRole = candidate.player.role === role ? 14 : 0
  const potential = context.horizon > 0 ? Math.max(0, candidate.player.potential - projected) * 0.2 : 0
  const source = candidate.source === 'club' ? 4 : candidate.source === 'collection' ? 2 : 1
  const secured = plannerCandidateSecured(candidate, context) ? 0 : -80

  return fit * 1.5 + projected * 0.45 + exactRole + potential + source + secured
}

const rankedForRole = (
  candidates: PlannerAutoCandidate[],
  role: LineupSlot,
  context: PlannerAutoContext,
) => [...candidates].sort((a, b) =>
  plannerAutoScore(b, role, context) - plannerAutoScore(a, role, context) ||
  projectedPlannerOverall(b.player, context.horizon) - projectedPlannerOverall(a.player, context.horizon) ||
  a.player.alias.localeCompare(b.player.alias, 'en-US'),
)

const uniquePrimaryAssignment = (
  candidates: PlannerAutoCandidate[],
  context: PlannerAutoContext,
): Record<LineupSlot, PlannerAutoCandidate | null> => {
  const topByRole = new Map<LineupSlot, PlannerAutoCandidate[]>()
  for (const role of LINEUP_SLOTS) {
    topByRole.set(role, rankedForRole(candidates, role, context).slice(0, 8))
  }

  let bestScore = Number.NEGATIVE_INFINITY
  let best: Record<LineupSlot, PlannerAutoCandidate | null> | null = null
  const current = {} as Record<LineupSlot, PlannerAutoCandidate | null>
  const used = new Set<string>()

  const search = (index: number, score: number) => {
    if (index >= LINEUP_SLOTS.length) {
      if (score > bestScore) {
        bestScore = score
        best = { ...current }
      }
      return
    }

    const role = LINEUP_SLOTS[index]
    const options = topByRole.get(role) ?? []

    for (const candidate of options) {
      if (used.has(candidate.key)) continue
      used.add(candidate.key)
      current[role] = candidate
      search(index + 1, score + plannerAutoScore(candidate, role, context))
      used.delete(candidate.key)
    }

    current[role] = null
    search(index + 1, score - 140)
  }

  search(0, 0)

  return best ?? Object.fromEntries(LINEUP_SLOTS.map((role) => [role, null])) as Record<LineupSlot, PlannerAutoCandidate | null>
}

export const buildAutoPlannerAll = (
  candidates: PlannerAutoCandidate[],
  context: PlannerAutoContext,
): Record<LineupSlot, string[]> => {
  const primaries = uniquePrimaryAssignment(candidates, context)
  const primaryKeys = new Set(
    LINEUP_SLOTS
      .map((role) => primaries[role]?.key)
      .filter((key): key is string => Boolean(key)),
  )
  const usedDepth = new Set(primaryKeys)
  const result = {} as Record<LineupSlot, string[]>

  for (const role of LINEUP_SLOTS) {
    const primary = primaries[role]
    const depth = primary ? [primary.key] : []
    const ranked = rankedForRole(candidates, role, context)

    for (const candidate of ranked) {
      if (depth.length >= 3) break
      if (candidate.key === primary?.key) continue
      if (usedDepth.has(candidate.key)) continue
      depth.push(candidate.key)
      usedDepth.add(candidate.key)
    }

    if (depth.length < 3) {
      for (const candidate of ranked) {
        if (depth.length >= 3) break
        if (depth.includes(candidate.key) || primaryKeys.has(candidate.key)) continue
        depth.push(candidate.key)
      }
    }

    result[role] = depth
  }

  return result
}

export const buildAutoPlannerRole = (
  candidates: PlannerAutoCandidate[],
  role: LineupSlot,
  context: PlannerAutoContext,
  reservedPrimaryKeys: ReadonlySet<string> = new Set(),
) => {
  const ranked = rankedForRole(candidates, role, context)
  const primary = ranked.find((candidate) => !reservedPrimaryKeys.has(candidate.key)) ?? ranked[0]
  if (!primary) return []

  const depth = [primary.key]
  for (const candidate of ranked) {
    if (depth.length >= 3) break
    if (candidate.key === primary.key) continue
    depth.push(candidate.key)
  }
  return depth
}
