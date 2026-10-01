import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type DragEvent, type SetStateAction } from 'react'
import {
  LINEUP_SLOTS,
  assignLineupSlot,
  chemistry,
  clearLineupSlot,
  lineupFitScore,
  overall,
  playerFromPackCard,
  releasePlayer,
  renewContract,
  restPlayer,
  teamRating,
  trainPlayer,
  type GameState,
  type LineupSlot,
  type Player,
} from './game'
import { cardTier, countryFlag } from './playerVisuals'
import { PlayerPortrait } from './PlayerPortrait'
import { PlayerIdentity } from './PlayerIdentity'
import type { PackCard } from './packState'
import { CollectiblePlayerCard, tierForPackRarity } from './CollectiblePlayerCard'
import { buildAutoPlannerAll, buildAutoPlannerRole } from './squadPlannerAuto'
import { SquadWorkspace } from './SquadWorkspace'

const ROLE_LABELS: Record<LineupSlot, string> = {
  Entry: 'ENTRY',
  AWP: 'AWP',
  Rifler: 'RIFLER',
  Support: 'SUPPORT',
  IGL: 'IGL',
}

const ROLE_LABELS_RU: Record<LineupSlot, string> = {
  Entry: 'ЭНТРИ',
  AWP: 'AWP',
  Rifler: 'РИФЛЕР',
  Support: 'САППОРТ',
  IGL: 'IGL',
}

type PlannerHorizon = 0 | 1 | 2
type PlannerSource = 'club' | 'collection' | 'target'
type PlannerCandidate = {
  key: string
  player: Player
  source: PlannerSource
}

const plannerSourceLabel: Record<PlannerSource, string> = {
  club: 'КЛУБ',
  collection: 'КОЛЛЕКЦИЯ',
  target: 'ЦЕЛЬ',
}

function SquadPlanner({
  state,
  setState,
  saveSignal,
  onOpenPlayer,
  onOpenScout,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
  saveSignal: { revision: number; status: 'saved' | 'error' }
  onOpenPlayer: (player: Player) => void
  onOpenScout: () => void
}) {
  const [horizon, setHorizon] = useState<PlannerHorizon>(0)
  const [selectedRole, setSelectedRole] = useState<LineupSlot>('AWP')
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null)
  const [candidateLimit, setCandidateLimit] = useState(5)
  const [placementSlot, setPlacementSlot] = useState<{ role: LineupSlot; index: number } | null>(null)
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'risk' | 'watch' | 'contract' | 'conflict'>('all')
  const [draggingSlot, setDraggingSlot] = useState<{ role: LineupSlot; index: number } | null>(null)
  const [inspectedKey, setInspectedKey] = useState<string | null>(null)
  const [undoPlanner, setUndoPlanner] = useState<GameState['squadPlanner'] | null>(null)
  const [undoNotice, setUndoNotice] = useState<string | null>(null)
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'error'>('saved')
  const [copyPrompt, setCopyPrompt] = useState(false)
  const planner = state.squadPlanner ?? { version: 1 as const, orders: {}, excluded: {} }
  const orders = planner.orders
  const excluded = planner.excluded

  useEffect(() => {
    setCandidateLimit(5)
    setSelectedCandidateKey(null)
    setPlacementSlot(null)
    setInspectedKey(null)
    setCopyPrompt(false)
  }, [selectedRole, horizon])

  useEffect(() => {
    setSaveIndicator(saveSignal.status)
  }, [saveSignal.revision, saveSignal.status])

  useEffect(() => {
    if (!copyPrompt) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCopyPrompt(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copyPrompt])

  useEffect(() => {
    if (!undoNotice) return
    const timeout = window.setTimeout(() => setUndoNotice(null), 6500)
    return () => window.clearTimeout(timeout)
  }, [undoNotice])

  const candidates = useMemo<PlannerCandidate[]>(() => {
    const rows: PlannerCandidate[] = []
    const seen = new Set<string>()

    for (const player of state.roster) {
      const alias = player.alias.toLocaleLowerCase('en-US')
      seen.add(alias)
      rows.push({ key: 'club:' + player.id, player, source: 'club' })
    }

    for (const player of state.prospects) {
      const alias = player.alias.toLocaleLowerCase('en-US')
      if (seen.has(alias)) continue
      seen.add(alias)
      rows.push({ key: 'target:' + player.id, player, source: 'target' })
    }

    const bestOwnedByAlias = new Map<string, PackCard>()
    for (const card of state.packs.inventory) {
      const alias = card.alias.toLocaleLowerCase('en-US')
      if (seen.has(alias)) continue
      const previous = bestOwnedByAlias.get(alias)
      if (!previous || card.power > previous.power) bestOwnedByAlias.set(alias, card)
    }

    let previewIndex = 4000
    for (const card of bestOwnedByAlias.values()) {
      const player = playerFromPackCard(card, previewIndex++)
      rows.push({ key: 'collection:' + card.id, player, source: 'collection' })
    }

    return rows
  }, [state.roster, state.prospects, state.packs.inventory])

  const weeksAheadFor = (value: PlannerHorizon) => value === 0
    ? 0
    : Math.max(1, state.seasonLength - state.week + 1) + (value - 1) * state.seasonLength

  const projectedOverallAt = (player: Player, value: PlannerHorizon) => {
    const current = overall(player)
    if (value === 0) return current
    const age = player.age ?? 25
    const growthRoom = Math.max(0, player.potential - current)
    const youthGrowth = age <= 22 ? Math.min(growthRoom, 3 * value) : age <= 25 ? Math.min(growthRoom, 2 * value) : age <= 28 ? Math.min(growthRoom, value) : 0
    const decline = age >= 31 ? Math.max(1, age - 29) * value : age >= 29 ? value : 0
    return Math.max(45, Math.min(99, current + youthGrowth - decline))
  }

  const projectedOverall = (player: Player) => projectedOverallAt(player, horizon)
  const projectionDelta = (player: Player) => projectedOverall(player) - overall(player)

  const orderKeyFor = (value: PlannerHorizon, role: LineupSlot) => value + ':' + role
  const orderKey = (role: LineupSlot) => orderKeyFor(horizon, role)

  const isSecuredAt = (entry: PlannerCandidate, value: PlannerHorizon) =>
    entry.source !== 'club' || entry.player.contractWeeks > weeksAheadFor(value)

  const isSecuredAtHorizon = (entry: PlannerCandidate) => isSecuredAt(entry, horizon)

  const contractRiskAt = (entry: PlannerCandidate, value: PlannerHorizon) =>
    entry.source === 'club' && entry.player.contractWeeks <= weeksAheadFor(value) + 2

  const contractRiskAtHorizon = (entry: PlannerCandidate) => contractRiskAt(entry, horizon)

  const plannerScoreAt = (entry: PlannerCandidate, role: LineupSlot, value: PlannerHorizon) => {
    const projection = projectedOverallAt(entry.player, value) - overall(entry.player)
    const sourceBonus = entry.source === 'club' ? 2 : entry.source === 'target' ? 1 : 0
    return lineupFitScore(entry.player, role) + projection + sourceBonus
  }

  const sortedForRoleAt = (role: LineupSlot, value: PlannerHorizon) => {
    const excludedKeys = new Set(excluded[orderKeyFor(value, role)] ?? [])
    return [...candidates]
      .filter((entry) => !excludedKeys.has(entry.key))
      .sort((a, b) =>
        Number(isSecuredAt(b, value)) - Number(isSecuredAt(a, value)) ||
        plannerScoreAt(b, role, value) - plannerScoreAt(a, role, value) ||
        projectedOverallAt(b.player, value) - projectedOverallAt(a.player, value) ||
        a.player.alias.localeCompare(b.player.alias, 'en-US'),
      )
  }

  const actualStarterForRoleAt = (role: LineupSlot, value: PlannerHorizon) => {
    if (value !== 0) return null
    const id = state.lineupSlots?.[role]
    if (!id) return null
    return candidates.find((entry) => entry.source === 'club' && entry.player.id === id) ?? null
  }

  const depthForRoleAt = (role: LineupSlot, value: PlannerHorizon) => {
    const sorted = sortedForRoleAt(role, value)
    const saved = orders[orderKeyFor(value, role)]
    if (saved) {
      const byKey = new Map(sorted.map((entry) => [entry.key, entry]))
      return saved.map((key) => byKey.get(key)).filter((entry): entry is PlannerCandidate => Boolean(entry)).slice(0, 3)
    }

    const starter = actualStarterForRoleAt(role, value)
    if (!starter) return sorted.slice(0, 3)
    return [starter, ...sorted.filter((entry) => entry.key !== starter.key)].slice(0, 3)
  }

  const sortedForRole = (role: LineupSlot) => sortedForRoleAt(role, horizon)
  const depthForRole = (role: LineupSlot) => depthForRoleAt(role, horizon)

  const updatePlanner = (
    updater: (current: NonNullable<GameState['squadPlanner']>) => NonNullable<GameState['squadPlanner']>,
    label: string,
  ) => {
    setUndoPlanner(planner)
    setUndoNotice(label)
    setSaveIndicator('saving')
    setState((current) => ({
      ...current,
      squadPlanner: updater(current.squadPlanner ?? { version: 1, orders: {}, excluded: {} }),
    }))
  }

  const undoLastPlannerChange = () => {
    if (!undoPlanner) return
    const currentPlanner = state.squadPlanner ?? { version: 1 as const, orders: {}, excluded: {} }
    setState((current) => ({ ...current, squadPlanner: undoPlanner }))
    setUndoPlanner(currentPlanner)
    setUndoNotice('Изменение отменено')
    setSaveIndicator('saving')
  }

  const setDepth = (role: LineupSlot, entries: PlannerCandidate[], label = 'План роли обновлён') => {
    const key = orderKey(role)
    const keys = entries.map((entry) => entry.key).slice(0, 3)
    updatePlanner((current) => ({
      ...current,
      orders: { ...current.orders, [key]: keys },
      excluded: {
        ...current.excluded,
        [key]: (current.excluded[key] ?? []).filter((item) => !keys.includes(item)),
      },
    }), label)
  }

  const removeDepth = (role: LineupSlot, keyToRemove: string) => {
    const key = orderKey(role)
    const removed = depthForRole(role).find((entry) => entry.key === keyToRemove)
    const nextDepth = depthForRole(role).filter((entry) => entry.key !== keyToRemove)
    updatePlanner((current) => ({
      ...current,
      orders: { ...current.orders, [key]: nextDepth.map((entry) => entry.key) },
      excluded: {
        ...current.excluded,
        [key]: Array.from(new Set([...(current.excluded[key] ?? []), keyToRemove])),
      },
    }), (removed?.player.alias ?? 'Игрок') + ' исключён из плана ' + ROLE_LABELS[role])
  }

  const placeCandidateAt = (entry: PlannerCandidate, role = selectedRole, index?: number) => {
    const depth = depthForRole(role)
    const targetIndex = index ?? (depth.length < 3 ? depth.length : -1)
    if (targetIndex < 0 || targetIndex > 2) return
    const next = depth.filter((item) => item.key !== entry.key)
    if (targetIndex >= next.length) next.push(entry)
    else next.splice(targetIndex, 1, entry)
    setDepth(role, next.slice(0, 3), entry.player.alias + ' назначен ' + ROLE_LABELS[role] + ' #' + (targetIndex + 1))
    setSelectedRole(role)
    setPlacementSlot(null)
    setSelectedCandidateKey(null)
  }

  const assignExistingTo = (entry: PlannerCandidate, sourceRole: LineupSlot, sourceIndex: number, targetRole: LineupSlot, targetIndex: number) => {
    if (sourceRole === targetRole) {
      const sourceDepth = depthForRole(sourceRole)
      const next = [...sourceDepth]
      const target = next[targetIndex]
      next[targetIndex] = entry
      if (target) next[sourceIndex] = target
      else next.splice(sourceIndex, 1)
      setDepth(targetRole, next.filter(Boolean).slice(0, 3), entry.player.alias + ' перемещён на #' + (targetIndex + 1))
      return
    }
    placeCandidateAt(entry, targetRole, targetIndex)
  }

  const dropPlannerSlot = (targetRole: LineupSlot, targetIndex: number) => {
    if (!draggingSlot) return
    const sourceDepth = depthForRole(draggingSlot.role)
    const sourceEntry = sourceDepth[draggingSlot.index]
    if (!sourceEntry) return
    assignExistingTo(sourceEntry, draggingSlot.role, draggingSlot.index, targetRole, targetIndex)
    setDraggingSlot(null)
  }

  const resetRole = (role: LineupSlot) => {
    const key = orderKey(role)
    updatePlanner((current) => {
      const nextOrders = { ...current.orders }
      const nextExcluded = { ...current.excluded }
      delete nextOrders[key]
      delete nextExcluded[key]
      return { ...current, orders: nextOrders, excluded: nextExcluded }
    }, ROLE_LABELS[role] + ': восстановлен автоплан')
    setPlacementSlot(null)
  }

  const copyPreviousPlan = () => {
    if (horizon === 0) return
    const sourceHorizon = (horizon - 1) as PlannerHorizon
    const copied = LINEUP_SLOTS.map((role) => [role, depthForRoleAt(role, sourceHorizon)] as const)
    updatePlanner((current) => {
      const nextOrders = { ...current.orders }
      const nextExcluded = { ...current.excluded }
      for (const [role, entries] of copied) {
        const key = orderKeyFor(horizon, role)
        nextOrders[key] = entries.map((entry) => entry.key)
        delete nextExcluded[key]
      }
      return { ...current, orders: nextOrders, excluded: nextExcluded }
    }, 'План предыдущего горизонта скопирован')
    setCopyPrompt(false)
  }


  const autoContext = {
    horizon,
    seasonLength: state.seasonLength,
    week: state.week,
  } as const

  const autoFillAllRoles = () => {
    const autoPlan = buildAutoPlannerAll(candidates, autoContext)
    updatePlanner((current) => {
      const nextOrders = { ...current.orders }
      const nextExcluded = { ...current.excluded }
      for (const role of LINEUP_SLOTS) {
        const key = orderKey(role)
        nextOrders[key] = autoPlan[role]
        delete nextExcluded[key]
      }
      return { ...current, orders: nextOrders, excluded: nextExcluded }
    }, 'Автоподбор применён ко всему составу')
    setPlacementSlot(null)
    setSelectedCandidateKey(null)
  }

  const autoFillRole = (role: LineupSlot) => {
    const reservedPrimaryKeys = new Set(
      LINEUP_SLOTS
        .filter((otherRole) => otherRole !== role)
        .map((otherRole) => depthForRole(otherRole)[0]?.key)
        .filter((key): key is string => Boolean(key)),
    )
    const autoDepth = buildAutoPlannerRole(candidates, role, autoContext, reservedPrimaryKeys)
    if (!autoDepth.length) return

    updatePlanner((current) => {
      const key = orderKey(role)
      const nextExcluded = { ...current.excluded }
      delete nextExcluded[key]
      return {
        ...current,
        orders: { ...current.orders, [key]: autoDepth },
        excluded: nextExcluded,
      }
    }, 'Автоподбор ' + ROLE_LABELS[role] + ' обновлён')
    setSelectedRole(role)
    setPlacementSlot(null)
    setSelectedCandidateKey(null)
  }

  const primaryRoleUsage = new Map<string, LineupSlot[]>()
  for (const role of LINEUP_SLOTS) {
    const primary = depthForRole(role)[0]
    if (!primary) continue
    const roles = primaryRoleUsage.get(primary.key) ?? []
    roles.push(role)
    primaryRoleUsage.set(primary.key, roles)
  }

  const roleAnalysis = (role: LineupSlot) => {
    const depth = depthForRole(role)
    const primary = depth[0]
    const securedDepth = depth.filter(isSecuredAtHorizon)
    const exact = securedDepth.filter((entry) => entry.player.role === role).length
    const contractRiskEntries = depth.filter(contractRiskAtHorizon)
    const departureEntries = depth.filter((entry) => !isSecuredAtHorizon(entry))
    const expiring = contractRiskEntries.length
    const departures = departureEntries.length
    const quality = primary && isSecuredAtHorizon(primary) ? projectedOverall(primary.player) : 0
    const fit = primary && isSecuredAtHorizon(primary) ? lineupFitScore(primary.player, role) : 0
    const targets = depth.filter((entry) => entry.source === 'target').length
    const primaryConflicts = primary ? (primaryRoleUsage.get(primary.key) ?? []).filter((item) => item !== role) : []
    const manual = Boolean(orders[orderKey(role)])

    let status: 'good' | 'watch' | 'risk' = 'good'
    if (securedDepth.length < 2 || quality < 68 || fit < 66 || primaryConflicts.length > 0) status = 'risk'
    else if (securedDepth.length < 3 || expiring > 0 || departures > 0 || exact === 0 || quality < 76) status = 'watch'

    return { depth, securedDepth, primary, exact, expiring, departures, contractRiskEntries, departureEntries, quality, fit, targets, primaryConflicts, manual, status }
  }

  const analyses = LINEUP_SLOTS.map((role) => ({ role, ...roleAnalysis(role) }))
  const riskCount = analyses.filter((item) => item.status === 'risk').length
  const watchCount = analyses.filter((item) => item.status === 'watch').length
  const contractPlayersCount = new Set(analyses.flatMap((item) => [...item.contractRiskEntries, ...item.departureEntries].map((entry) => entry.key))).size
  const conflictPlayersCount = new Set(analyses.flatMap((item) => item.primaryConflicts.length && item.primary ? [item.primary.key] : [])).size
  const selectedAnalysis = roleAnalysis(selectedRole)
  const selectedDepthKeys = new Set(selectedAnalysis.depth.map((entry) => entry.key))
  const availableAll = sortedForRole(selectedRole).filter((entry) => !selectedDepthKeys.has(entry.key)).slice(0, 12)
  const available = availableAll.slice(0, candidateLimit)
  const selectedCandidate = selectedCandidateKey ? availableAll.find((entry) => entry.key === selectedCandidateKey) ?? null : null
  const inspectedEntry = inspectedKey ? candidates.find((entry) => entry.key === inspectedKey) ?? null : null

  const previousHorizon = horizon > 0 ? (horizon - 1) as PlannerHorizon : null
  const roleDiff = (role: LineupSlot) => {
    if (previousHorizon === null) return { added: 0, removed: 0, addedKeys: new Set<string>(), manual: Boolean(orders[orderKey(role)]) }
    const current = depthForRole(role)
    const previous = depthForRoleAt(role, previousHorizon)
    const currentKeys = new Set(current.map((entry) => entry.key))
    const previousKeys = new Set(previous.map((entry) => entry.key))
    return {
      added: current.filter((entry) => !previousKeys.has(entry.key)).length,
      removed: previous.filter((entry) => !currentKeys.has(entry.key)).length,
      addedKeys: new Set(current.filter((entry) => !previousKeys.has(entry.key)).map((entry) => entry.key)),
      manual: Boolean(orders[orderKey(role)]),
    }
  }

  const selectedDiff = roleDiff(selectedRole)
  const selectedPayroll = selectedAnalysis.depth.reduce((sum, entry) => sum + entry.player.salary, 0)
  const payrollEstimated = selectedAnalysis.depth.some((entry) => entry.source !== 'club')
  const previousPayroll = previousHorizon === null
    ? selectedPayroll
    : depthForRoleAt(selectedRole, previousHorizon).reduce((sum, entry) => sum + entry.player.salary, 0)
  const payrollDelta = selectedPayroll - previousPayroll

  const comparison = selectedCandidate && selectedAnalysis.primary
    ? {
        currentOvr: projectedOverall(selectedAnalysis.primary.player),
        candidateOvr: projectedOverall(selectedCandidate.player),
        ovr: projectedOverall(selectedCandidate.player) - projectedOverall(selectedAnalysis.primary.player),
        currentFit: lineupFitScore(selectedAnalysis.primary.player, selectedRole),
        candidateFit: lineupFitScore(selectedCandidate.player, selectedRole),
        fit: lineupFitScore(selectedCandidate.player, selectedRole) - lineupFitScore(selectedAnalysis.primary.player, selectedRole),
        currentPotential: selectedAnalysis.primary.player.potential,
        candidatePotential: selectedCandidate.player.potential,
        potential: selectedCandidate.player.potential - selectedAnalysis.primary.player.potential,
        currentSalary: selectedAnalysis.primary.player.salary,
        candidateSalary: selectedCandidate.player.salary,
        salary: selectedCandidate.player.salary - selectedAnalysis.primary.player.salary,
      }
    : null

  const horizonLabel = horizon === 0 ? 'СЕЙЧАС' : 'СЕЗОН ' + (state.season + horizon)
  const statusLabel = (status: 'good' | 'watch' | 'risk') => status === 'good' ? 'ГОТОВО' : status === 'watch' ? 'ВНИМАНИЕ' : 'РИСК'
  const statusIcon = (status: 'good' | 'watch' | 'risk') => status === 'good' ? '✓' : status === 'watch' ? '!' : '×'

  const laneMatchesFilter = (analysis: ReturnType<typeof roleAnalysis>) => {
    if (summaryFilter === 'all') return true
    if (summaryFilter === 'risk') return analysis.status === 'risk'
    if (summaryFilter === 'watch') return analysis.status === 'watch'
    if (summaryFilter === 'contract') return analysis.expiring > 0 || analysis.departures > 0
    return analysis.primaryConflicts.length > 0
  }

  const openScoutForRole = () => {
    setState((current) => ({
      ...current,
      scoutBrief: { ...current.scoutBrief, role: selectedRole },
    }))
    onOpenScout()
  }

  const requestPlacement = (role: LineupSlot, index: number) => {
    setSelectedRole(role)
    setPlacementSlot({ role, index })
    setCandidateLimit(5)
    setSelectedCandidateKey(null)
  }

  const urgentRole = analyses.find((item) => item.primaryConflicts.length > 0)
    ?? analyses.find((item) => item.securedDepth.length < 2)
    ?? analyses.find((item) => item.departures > 0 || item.expiring > 0)
    ?? analyses.find((item) => item.quality > 0 && item.quality < 76)
    ?? analyses.find((item) => item.status === 'watch')
    ?? null

  const urgentLabel = !urgentRole
    ? 'ПЛАН СБАЛАНСИРОВАН'
    : urgentRole.primaryConflicts.length > 0
      ? 'РЕШИТЬ КОНФЛИКТ ' + ROLE_LABELS[urgentRole.role]
      : urgentRole.securedDepth.length < 2
        ? 'ЗАКРЫТЬ ГЛУБИНУ ' + ROLE_LABELS[urgentRole.role]
        : urgentRole.departures > 0 || urgentRole.expiring > 0
          ? 'ПРОВЕРИТЬ КОНТРАКТЫ ' + ROLE_LABELS[urgentRole.role]
          : urgentRole.quality > 0 && urgentRole.quality < 76
            ? 'УСИЛИТЬ ' + ROLE_LABELS[urgentRole.role]
            : 'ПРОВЕРИТЬ ' + ROLE_LABELS[urgentRole.role]

  const runUrgentAction = () => {
    if (!urgentRole) return
    setSelectedRole(urgentRole.role)
    if (urgentRole.primaryConflicts.length > 0) return
    if (urgentRole.securedDepth.length < 2) {
      requestPlacement(urgentRole.role, Math.min(urgentRole.depth.length, 2))
      return
    }
    const contractEntry = urgentRole.departureEntries[0] ?? urgentRole.contractRiskEntries[0]
    if (contractEntry) {
      setInspectedKey(contractEntry.key)
      return
    }
    if (urgentRole.quality > 0 && urgentRole.quality < 76) {
      setState((current) => ({ ...current, scoutBrief: { ...current.scoutBrief, role: urgentRole.role } }))
      onOpenScout()
    }
  }

  const copySourceHorizon = horizon > 0 ? (horizon - 1) as PlannerHorizon : null
  const copyRiskCount = copySourceHorizon === null
    ? 0
    : new Set(LINEUP_SLOTS.flatMap((role) => depthForRoleAt(role, copySourceHorizon).filter((entry) => !isSecuredAt(entry, horizon)).map((entry) => entry.key))).size

  return (
    <section className="sim-squad-planner">
      <div className="sim-planner-toolbar">
        <div className="sim-planner-horizons" role="tablist" aria-label="Горизонт планирования">
          {([0, 1, 2] as PlannerHorizon[]).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={horizon === value}
              className={horizon === value ? 'active' : ''}
              onClick={() => setHorizon(value)}
            >
              <span>{value === 0 ? 'СЕЙЧАС' : 'СЕЗОН ' + (state.season + value)}</span>
              <small>{value === 0 ? 'CURRENT' : 'S+' + value}</small>
            </button>
          ))}
        </div>

        <div className="sim-planner-toolbar-actions">
          <button className="sim-planner-auto-all" onClick={autoFillAllRoles} title="Автоматически заполнить все роли по FIT, рейтингу и доступности">
            <span>✦</span> АВТО
          </button>
          {horizon > 0 && (
            <button onClick={() => setCopyPrompt(true)}>
              {horizon === 1 ? 'КОПИРОВАТЬ «СЕЙЧАС»' : 'КОПИРОВАТЬ СЕЗОН ' + (state.season + horizon - 1)}
            </button>
          )}
          <span className={'sim-planner-save-state ' + saveIndicator}>
            {saveIndicator === 'saving' ? 'СОХРАНЕНИЕ…' : saveIndicator === 'error' ? 'НЕ СОХРАНЕНО' : 'СОХРАНЕНО'}
          </span>
        </div>

        <div className="sim-planner-summary" aria-label="Фильтры проблем состава">
          <button className={(summaryFilter === 'risk' ? 'active ' : '') + (riskCount ? 'risk' : '')} onClick={() => setSummaryFilter(summaryFilter === 'risk' ? 'all' : 'risk')}>
            <b>{riskCount}</b><span>ПОЗИЦИИ РИСК</span>
          </button>
          <button className={(summaryFilter === 'watch' ? 'active ' : '') + (watchCount ? 'watch' : '')} onClick={() => setSummaryFilter(summaryFilter === 'watch' ? 'all' : 'watch')}>
            <b>{watchCount}</b><span>ВНИМАНИЕ</span>
          </button>
          <button className={(summaryFilter === 'contract' ? 'active ' : '') + (contractPlayersCount ? 'watch' : '')} onClick={() => setSummaryFilter(summaryFilter === 'contract' ? 'all' : 'contract')}>
            <b>{contractPlayersCount}</b><span>ИГРОКИ · КОНТРАКТ</span>
          </button>
          <button className={(summaryFilter === 'conflict' ? 'active ' : '') + (conflictPlayersCount ? 'risk' : '')} onClick={() => setSummaryFilter(summaryFilter === 'conflict' ? 'all' : 'conflict')}>
            <b>{conflictPlayersCount}</b><span>ИГРОКИ · КОНФЛИКТ</span>
          </button>
        </div>
      </div>

      {copyPrompt && horizon > 0 && (
        <div className="sim-planner-copy-prompt" role="dialog" aria-label="Подтвердить копирование плана">
          <div>
            <span>КОПИРОВАНИЕ ПЛАНА</span>
            <b>{horizon === 1 ? '«СЕЙЧАС» → СЕЗОН ' + (state.season + 1) : 'СЕЗОН ' + (state.season + horizon - 1) + ' → СЕЗОН ' + (state.season + horizon)}</b>
            <small>Будут перезаписаны 5 ролей. {copyRiskCount > 0 ? copyRiskCount + ' игрок(а) не имеют подтверждённого контракта до целевого сезона.' : 'Контрактных потерь в копируемом плане не найдено.'}</small>
          </div>
          <button onClick={() => setCopyPrompt(false)}>ОТМЕНА</button>
          <button className="primary" onClick={copyPreviousPlan}>ПРИМЕНИТЬ</button>
        </div>
      )}

      <div className={'sim-planner-next-action' + (!urgentRole ? ' balanced' : '')}>
        <div>
          <span>{urgentRole ? 'СЛЕДУЮЩЕЕ ДЕЙСТВИЕ' : 'СОСТОЯНИЕ ПЛАНА'}</span>
          <b>{urgentLabel}</b>
        </div>
        {urgentRole && <button onClick={runUrgentAction}>ПЕРЕЙТИ <span>→</span></button>}
      </div>

      <div className="sim-planner-workspace">
        <section className="sim-planner-board">
          <div className="sim-planner-board-head">
            <div>
              <span>ГЛУБИНА СОСТАВА · {horizonLabel}</span>
              <strong>План по игровым ролям</strong>
            </div>
            <div className="sim-planner-board-actions">
              <button className="sim-planner-board-auto" type="button" onClick={autoFillAllRoles}>
                <span>✦</span>
                <b>АВТОПОДБОР</b>
                <small>5 ролей</small>
              </button>
              <button className="sim-planner-help" type="button" title="Планировщик не меняет стартовую пятёрку. #1 — основной выбор, #2 — ротация, #3 — резерв.">?</button>
            </div>
          </div>

          <div className="sim-planner-lanes">
            {LINEUP_SLOTS.map((role) => {
              const analysis = roleAnalysis(role)
              const muted = !laneMatchesFilter(analysis)
              const diff = roleDiff(role)
              return (
                <article
                  key={role}
                  className={'sim-planner-lane status-' + analysis.status + (selectedRole === role ? ' active' : '') + (muted ? ' is-muted' : '')}
                >
                  <header>
                    <button
                      type="button"
                      className="sim-planner-lane-select"
                      aria-pressed={selectedRole === role}
                      onClick={() => setSelectedRole(role)}
                    >
                      <span>
                        <b>{ROLE_LABELS_RU[role]}</b>
                        <small><i>{statusIcon(analysis.status)}</i> {statusLabel(analysis.status)} · {analysis.manual ? 'ПЛАН' : 'АВТОПЛАН'}</small>
                      </span>
                      <span className="sim-planner-lane-head-meta">
                        {horizon > 0 && <small className="sim-planner-diff-chip">{diff.manual ? 'ВАМИ' : 'ПРОГНОЗ'} · {diff.added > 0 ? '+' + diff.added : '0'} / {diff.removed > 0 ? '−' + diff.removed : '0'}</small>}
                        <b>{analysis.quality || '—'}</b>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="sim-planner-role-auto"
                      onClick={() => autoFillRole(role)}
                      title={'Автоподбор для ' + ROLE_LABELS[role]}
                    >
                      ✦ АВТО
                    </button>
                  </header>

                  <div className="sim-planner-depth">
                    {[0, 1, 2].map((index) => {
                      const entry = analysis.depth[index]
                      if (!entry) {
                        return (
                          <button
                            key={index}
                            className={'sim-planner-empty-slot' + (placementSlot?.role === role && placementSlot.index === index ? ' awaiting' : '')}
                            onClick={() => requestPlacement(role, index)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => { event.preventDefault(); dropPlannerSlot(role, index) }}
                          >
                            <i>{index + 1}</i>
                            <strong>ДОБАВИТЬ ИГРОКА</strong>
                            <small>{index === 0 ? 'основной выбор' : index === 1 ? 'ротация' : 'резерв'}</small>
                          </button>
                        )
                      }

                      const player = entry.player
                      const contractRisk = contractRiskAtHorizon(entry)
                      const projected = projectedOverall(player)
                      const delta = projectionDelta(player)
                      const fit = lineupFitScore(player, role)
                      const conflicts = primaryRoleUsage.get(entry.key) ?? []
                      const otherConflict = conflicts.find((item) => item !== role)
                      const statusBadge = otherConflict && index === 0
                        ? <button className="sim-planner-conflict-chip" onClick={() => setSelectedRole(otherConflict)}>№1 ЕЩЁ В {ROLE_LABELS[otherConflict]}</button>
                        : !isSecuredAtHorizon(entry)
                          ? <span className="risk">OUT ДО {horizonLabel}</span>
                          : contractRisk
                            ? <span className="watch">КОНТРАКТ</span>
                            : horizon > 0 && diff.addedKeys.has(entry.key)
                              ? <span className="good">NEW</span>
                              : entry.source === 'club'
                                ? <span>{player.contractWeeks} НЕД.</span>
                                : <span>{entry.source === 'target' ? 'ТРАНСФЕР' : 'КАРТА'}</span>

                      return (
                        <div
                          className={'sim-planner-player rank-' + (index + 1) + ' source-' + entry.source + (contractRisk ? ' contract-risk' : '') + (placementSlot?.role === role && placementSlot.index === index ? ' awaiting' : '')}
                          key={entry.key}
                          draggable
                          onDragStart={(event) => {
                            setDraggingSlot({ role, index })
                            event.dataTransfer.effectAllowed = role === selectedRole ? 'move' : 'copy'
                          }}
                          onDragEnd={() => setDraggingSlot(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => { event.preventDefault(); dropPlannerSlot(role, index) }}
                        >
                          <div className="sim-planner-rank">
                            <b>#{index + 1}</b>
                            <span>{index === 0 ? 'ОСНОВА' : index === 1 ? 'РОТАЦИЯ' : 'РЕЗЕРВ'}</span>
                          </div>
                          <button className="sim-planner-player-main" onClick={() => { setSelectedRole(role); setInspectedKey(entry.key) }}>
                            <div className="sim-planner-portrait-stage">
                              <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} draggable={false} />
                            </div>
                            <span>
                              <b>{player.alias}</b>
                              <small className={'source-chip source-' + entry.source}>{plannerSourceLabel[entry.source]}</small>
                            </span>
                            <strong>
                              {projected}
                              {horizon > 0 && delta !== 0 && <em className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? '+' : ''}{delta}</em>}
                            </strong>
                          </button>
                          <div className="sim-planner-player-meta">
                            <span className={fit >= 76 ? 'good' : fit >= 68 ? 'watch' : 'risk'}>{fit} FIT</span>
                            {statusBadge}
                          </div>
                          {placementSlot?.role === role && placementSlot.index === index && selectedCandidate && selectedCandidate.key !== entry.key && (
                            <div className="sim-planner-slot-preview">
                              <span>ПРЕВЬЮ ЗАМЕНЫ</span>
                              <b>{selectedCandidate.player.alias}</b>
                              <small>{projectedOverall(selectedCandidate.player)} OVR · {lineupFitScore(selectedCandidate.player, role)} FIT</small>
                            </div>
                          )}
                          <div className="sim-planner-slot-actions">
                            <button onClick={() => requestPlacement(role, index)}>ЗАМЕНИТЬ</button>
                            <select
                              aria-label={'Назначить ' + player.alias + ' в другой слот'}
                              defaultValue=""
                              onChange={(event) => {
                                const [targetRole, rawIndex] = event.target.value.split('|')
                                if (!targetRole || rawIndex === undefined) return
                                assignExistingTo(entry, role, index, targetRole as LineupSlot, Number(rawIndex))
                                event.currentTarget.value = ''
                              }}
                            >
                              <option value="" disabled>НАЗНАЧИТЬ…</option>
                              {LINEUP_SLOTS.flatMap((targetRole) => [0, 1, 2].map((targetIndex) => (
                                <option key={targetRole + '-' + targetIndex} value={targetRole + '|' + targetIndex}>
                                  {ROLE_LABELS[targetRole]} #{targetIndex + 1}
                                </option>
                              )))}
                            </select>
                            <button className="icon-action" onClick={() => removeDepth(role, entry.key)} aria-label={'Убрать ' + player.alias + ' из плана'}>×</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <aside className={'sim-planner-analysis status-' + selectedAnalysis.status}>
          <div className="sim-planner-analysis-head">
            <div>
              <span>АНАЛИЗ ПОЗИЦИИ</span>
              <h2>{ROLE_LABELS_RU[selectedRole]}</h2>
            </div>
            <div className={'sim-planner-status-pill ' + selectedAnalysis.status}>
              <i>{statusIcon(selectedAnalysis.status)}</i>{statusLabel(selectedAnalysis.status)}
            </div>
            <p>{selectedAnalysis.status === 'good'
              ? 'Позиция закрыта по качеству и глубине.'
              : selectedAnalysis.status === 'watch'
                ? 'Состав рабочий, но есть риск по глубине, качеству или контрактам.'
                : 'Позиция требует кадрового решения.'}</p>
          </div>

          {inspectedEntry && (
            <div className="sim-planner-inspector">
              <div className="sim-planner-inspector-main">
                <PlayerIdentity
                  alias={inspectedEntry.player.alias}
                  realName={inspectedEntry.player.realName}
                  country={inspectedEntry.player.country}
                  team={inspectedEntry.player.team}
                  role={inspectedEntry.player.role}
                  profileId={inspectedEntry.player.profileId}
                  size="md"
                  className="sim-planner-inspector-identity"
                  trailing={<button onClick={() => onOpenPlayer(inspectedEntry.player)}>ПРОФИЛЬ →</button>}
                />
                <small className={'source-chip source-' + inspectedEntry.source}>{plannerSourceLabel[inspectedEntry.source]} · {inspectedEntry.player.age ?? '—'} лет</small>
              </div>
              <div className="sim-planner-inspector-stats">
                <span><small>POT</small><b>{inspectedEntry.player.potential}</b></span>
                <span><small>AIM</small><b>{inspectedEntry.player.aim}</b></span>
                <span><small>SENSE</small><b>{inspectedEntry.player.gameSense}</b></span>
                <span><small>UTILITY</small><b>{inspectedEntry.player.utility}</b></span>
                <span><small>ФОРМА</small><b>{inspectedEntry.player.form}</b></span>
                <span><small>КОНТРАКТ</small><b>{inspectedEntry.source === 'club' ? inspectedEntry.player.contractWeeks + ' нед.' : '—'}</b></span>
              </div>
            </div>
          )}

          <div className="sim-planner-analysis-metrics">
            <span><small>ГЛУБИНА</small><b>{selectedAnalysis.securedDepth.length}/3</b></span>
            <span><small>OVR #1</small><b>{selectedAnalysis.quality || '—'}</b></span>
            <span><small>FIT #1</small><b>{selectedAnalysis.fit || '—'}</b></span>
            <span><small>ЦЕЛИ</small><b>{selectedAnalysis.targets}</b></span>
          </div>

          <div className="sim-planner-finance">
            <span><small>ПЛАНОВЫЙ PAYROLL</small><b>{payrollEstimated ? '≈' : ''}{selectedPayroll.toLocaleString('ru-RU')} кр./нед.</b></span>
            <span className={payrollDelta > 0 ? 'down' : payrollDelta < 0 ? 'up' : ''}><small>К {previousHorizon === null ? 'ТЕКУЩЕМУ' : 'S+' + previousHorizon}</small><b>{payrollEstimated ? '≈' : ''}{payrollDelta > 0 ? '+' : ''}{payrollDelta.toLocaleString('ru-RU')} кр.</b></span>
            {horizon > 0 && <span><small>{selectedDiff.manual ? 'ИЗМЕНЕНО ВАМИ' : 'ПРОГНОЗ ШТАБА'}</small><b>+{selectedDiff.added} / −{selectedDiff.removed}</b></span>}
          </div>

          <div className="sim-planner-diagnostics">
            <div className="sim-planner-section-title">ДИАГНОСТИКА</div>
            <ul>
              {selectedAnalysis.securedDepth.length < 3 && (
                <li className="watch">
                  <span>Подтверждено только {selectedAnalysis.securedDepth.length}/3 игроков.</span>
                  <button onClick={() => requestPlacement(selectedRole, Math.min(selectedAnalysis.depth.length, 2))}>ДОБАВИТЬ</button>
                </li>
              )}
              {selectedAnalysis.exact === 0 && (
                <li className="risk">
                  <span>Нет профильного игрока под {ROLE_LABELS[selectedRole]}.</span>
                  <button onClick={openScoutForRole}>НАЙТИ</button>
                </li>
              )}
              {selectedAnalysis.departureEntries.length > 0 && (
                <li className="risk">
                  <span>Без контракта до горизонта: {selectedAnalysis.departureEntries.map((entry) => entry.player.alias).join(', ')}.</span>
                  <button onClick={() => setInspectedKey(selectedAnalysis.departureEntries[0].key)}>ПОКАЗАТЬ</button>
                </li>
              )}
              {selectedAnalysis.contractRiskEntries.length > 0 && (
                <li className="watch">
                  <span>Контрактный риск: {selectedAnalysis.contractRiskEntries.map((entry) => entry.player.alias).join(', ')}.</span>
                  <button onClick={() => setInspectedKey(selectedAnalysis.contractRiskEntries[0].key)}>ПОКАЗАТЬ</button>
                </li>
              )}
              {selectedAnalysis.primaryConflicts.length > 0 && (
                <li className="risk">
                  <span>№1 уже используется в {selectedAnalysis.primaryConflicts.map((role) => ROLE_LABELS[role]).join(', ')}.</span>
                  <button onClick={() => setSelectedRole(selectedAnalysis.primaryConflicts[0])}>ПЕРЕЙТИ</button>
                </li>
              )}
              {selectedAnalysis.quality > 0 && selectedAnalysis.quality < 76 && (
                <li className="watch">
                  <span>Первый выбор ниже целевого уровня 76 OVR.</span>
                  <button onClick={openScoutForRole}>УСИЛИТЬ</button>
                </li>
              )}
              {selectedAnalysis.securedDepth.length === 3 && selectedAnalysis.exact > 0 && selectedAnalysis.expiring === 0 && selectedAnalysis.primaryConflicts.length === 0 && selectedAnalysis.quality >= 76 && (
                <li className="good"><span>Позиция сбалансирована. Срочное усиление не требуется.</span></li>
              )}
            </ul>
          </div>

          <div className="sim-planner-candidate-head">
            <div>
              <span>{placementSlot?.role === selectedRole ? 'ВЫБЕРИТЕ ИГРОКА ДЛЯ #' + (placementSlot.index + 1) : 'КАНДИДАТЫ'}</span>
              <small>Лучшие варианты для {ROLE_LABELS[selectedRole]}</small>
            </div>
            <button onClick={openScoutForRole}>ТРАНСФЕРЫ →</button>
          </div>

          {selectedCandidate && selectedAnalysis.primary && comparison && (
            <div className="sim-planner-compare">
              <div className="sim-planner-compare-people">
                <div>
                  <PlayerPortrait alias={selectedAnalysis.primary.player.alias} playerId={selectedAnalysis.primary.player.profileId} alt={selectedAnalysis.primary.player.alias} draggable={false} />
                  <span><small>СЕЙЧАС #1</small><b>{selectedAnalysis.primary.player.alias}</b></span>
                </div>
                <i>→</i>
                <div>
                  <PlayerPortrait alias={selectedCandidate.player.alias} playerId={selectedCandidate.player.profileId} alt={selectedCandidate.player.alias} draggable={false} />
                  <span><small>КАНДИДАТ</small><b>{selectedCandidate.player.alias}</b></span>
                </div>
              </div>
              <div className="sim-planner-compare-grid">
                <span><small>OVR</small><b>{comparison.currentOvr} → {comparison.candidateOvr}</b><em className={comparison.ovr > 0 ? 'up' : comparison.ovr < 0 ? 'down' : ''}>{comparison.ovr > 0 ? '+' : ''}{comparison.ovr}</em></span>
                <span><small>FIT</small><b>{comparison.currentFit} → {comparison.candidateFit}</b><em className={comparison.fit > 0 ? 'up' : comparison.fit < 0 ? 'down' : ''}>{comparison.fit > 0 ? '+' : ''}{comparison.fit}</em></span>
                <span><small>POT</small><b>{comparison.currentPotential} → {comparison.candidatePotential}</b><em className={comparison.potential > 0 ? 'up' : comparison.potential < 0 ? 'down' : ''}>{comparison.potential > 0 ? '+' : ''}{comparison.potential}</em></span>
                <span><small>З/П</small><b>{comparison.currentSalary} → {comparison.candidateSalary}</b><em className={comparison.salary < 0 ? 'up' : comparison.salary > 0 ? 'down' : ''}>{comparison.salary > 0 ? '+' : ''}{comparison.salary}</em></span>
              </div>
            </div>
          )}

          <div className="sim-planner-candidate-list" role="list" aria-label={'Кандидаты на ' + ROLE_LABELS[selectedRole]}>
            {available.map((entry) => {
              const fit = lineupFitScore(entry.player, selectedRole)
              const canPlace = selectedAnalysis.depth.length < 3 || placementSlot?.role === selectedRole
              return (
                <article key={entry.key} role="listitem" className={selectedCandidate?.key === entry.key ? 'selected' : ''}>
                  <button
                    className="sim-planner-candidate-select"
                    aria-pressed={selectedCandidate?.key === entry.key}
                    onClick={() => { setSelectedCandidateKey(entry.key); setInspectedKey(entry.key) }}
                  >
                    <div className="sim-planner-candidate-portrait">
                      <PlayerPortrait alias={entry.player.alias} playerId={entry.player.profileId} alt={entry.player.alias} draggable={false} />
                    </div>
                    <span>
                      <b>{entry.player.alias}</b>
                      <small><i className={'source-dot source-' + entry.source} />{plannerSourceLabel[entry.source]} · {fit} FIT</small>
                    </span>
                    <strong>{projectedOverall(entry.player)}</strong>
                  </button>
                  <button
                    className="sim-planner-candidate-action"
                    disabled={!canPlace}
                    onClick={() => {
                      if (!canPlace) return
                      placeCandidateAt(entry, selectedRole, placementSlot?.role === selectedRole ? placementSlot.index : undefined)
                    }}
                    aria-label={(placementSlot?.role === selectedRole ? 'Заменить на ' : 'Добавить ') + entry.player.alias}
                  >
                    {placementSlot?.role === selectedRole ? 'В #' + (placementSlot.index + 1) : 'ДОБАВИТЬ'}
                  </button>
                </article>
              )
            })}
            {available.length === 0 && <div className="sim-planner-no-candidates">НЕТ ДОПОЛНИТЕЛЬНЫХ КАНДИДАТОВ</div>}
          </div>

          {availableAll.length > 5 && (
            <button className="sim-planner-more" onClick={() => setCandidateLimit(candidateLimit > 5 ? 5 : 12)}>
              {candidateLimit > 5 ? 'СВЕРНУТЬ СПИСОК' : 'ПОКАЗАТЬ ЕЩЁ ' + (availableAll.length - 5)}
            </button>
          )}

          <div className="sim-planner-analysis-actions">
            <button className="sim-planner-reset" onClick={() => resetRole(selectedRole)}>СБРОСИТЬ РОЛЬ</button>
            <button className="sim-planner-scout-action" onClick={openScoutForRole}>
              НАЙТИ УСИЛЕНИЕ <span>→</span>
            </button>
          </div>
        </aside>
      </div>

      {undoNotice && (
        <div className="sim-planner-undo-toast" role="status">
          <span>{undoNotice}</span>
          <button onClick={undoLastPlannerChange}>ОТМЕНИТЬ</button>
        </div>
      )}
    </section>
  )
}

export function RosterBoard({
  state,
  setState,
  saveSignal,
  onOpenPlayer,
  onOpenScout,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
  saveSignal: { revision: number; status: 'saved' | 'error' }
  onOpenPlayer: (player: Player) => void
  onOpenScout: () => void
}) {
  const [rosterView, setRosterView] = useState<'squad' | 'planner'>('squad')

  return (
    <section className={'sim-screen sim-roster sim-roster-v2 view-' + rosterView}>
      <div className="sim-screen-head sim-roster-head">
        <div>
          <span className="eyebrow">{rosterView === 'planner' ? 'CLUB OPERATIONS · SQUAD PLANNING' : 'CLUB OPERATIONS · ACTIVE LINEUP'}</span>
          <h1>{rosterView === 'planner' ? 'SQUAD PLANNER' : 'SQUAD'}</h1>
        </div>
        <button className="sim-roster-market-action" onClick={onOpenScout}>TRANSFER MARKET <span>→</span></button>
      </div>

      <div className="sim-roster-mode-tabs" role="tablist" aria-label="Squad mode">
        <button className={rosterView === 'squad' ? 'active' : ''} onClick={() => setRosterView('squad')}>СОСТАВ <small>активная пятёрка</small></button>
        <button className={rosterView === 'planner' ? 'active' : ''} onClick={() => setRosterView('planner')}>ПЛАНИРОВЩИК <small>глубина и будущие решения</small></button>
      </div>

      {rosterView === 'planner' ? (
        <SquadPlanner state={state} setState={setState} saveSignal={saveSignal} onOpenPlayer={onOpenPlayer} onOpenScout={onOpenScout} />
      ) : (
        <SquadWorkspace
          state={state}
          setState={setState}
          onOpenPlayer={onOpenPlayer}
          onOpenScout={onOpenScout}
        />
      )}
    </section>
  )
}
