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
import type { PackCard } from './packState'
import { CollectiblePlayerCard, tierForPackRarity } from './CollectiblePlayerCard'

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
  onOpenPlayer,
  onOpenScout,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
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
  const planner = state.squadPlanner ?? { version: 1 as const, orders: {}, excluded: {} }
  const orders = planner.orders
  const excluded = planner.excluded

  useEffect(() => {
    setCandidateLimit(5)
    setSelectedCandidateKey(null)
    setPlacementSlot(null)
  }, [selectedRole, horizon])

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

  const weeksAhead = horizon === 0
    ? 0
    : Math.max(1, state.seasonLength - state.week + 1) + (horizon - 1) * state.seasonLength

  const projectedOverall = (player: Player) => {
    const current = overall(player)
    if (horizon === 0) return current
    const age = player.age ?? 25
    const growthRoom = Math.max(0, player.potential - current)
    const youthGrowth = age <= 22 ? Math.min(growthRoom, 3 * horizon) : age <= 25 ? Math.min(growthRoom, 2 * horizon) : age <= 28 ? Math.min(growthRoom, horizon) : 0
    const decline = age >= 31 ? Math.max(1, age - 29) * horizon : age >= 29 ? horizon : 0
    return Math.max(45, Math.min(99, current + youthGrowth - decline))
  }

  const projectionDelta = (player: Player) => projectedOverall(player) - overall(player)

  const plannerScore = (entry: PlannerCandidate, role: LineupSlot) => {
    const projection = projectionDelta(entry.player)
    const sourceBonus = entry.source === 'club' ? 2 : entry.source === 'target' ? 1 : 0
    return lineupFitScore(entry.player, role) + projection + sourceBonus
  }

  const orderKey = (role: LineupSlot) => horizon + ':' + role

  const isSecuredAtHorizon = (entry: PlannerCandidate) =>
    entry.source !== 'club' || entry.player.contractWeeks > weeksAhead

  const contractRiskAtHorizon = (entry: PlannerCandidate) =>
    entry.source === 'club' && entry.player.contractWeeks <= weeksAhead + 2

  const sortedForRole = (role: LineupSlot) => {
    const excludedKeys = new Set(excluded[orderKey(role)] ?? [])
    return [...candidates]
      .filter((entry) => !excludedKeys.has(entry.key))
      .sort((a, b) =>
        Number(isSecuredAtHorizon(b)) - Number(isSecuredAtHorizon(a)) ||
        plannerScore(b, role) - plannerScore(a, role) ||
        projectedOverall(b.player) - projectedOverall(a.player) ||
        a.player.alias.localeCompare(b.player.alias, 'en-US'),
      )
  }

  const actualStarterForRole = (role: LineupSlot) => {
    if (horizon !== 0) return null
    const id = state.lineupSlots?.[role]
    if (!id) return null
    return candidates.find((entry) => entry.source === 'club' && entry.player.id === id) ?? null
  }

  const depthForRole = (role: LineupSlot) => {
    const sorted = sortedForRole(role)
    const saved = orders[orderKey(role)]
    if (saved) {
      const byKey = new Map(sorted.map((entry) => [entry.key, entry]))
      return saved.map((key) => byKey.get(key)).filter((entry): entry is PlannerCandidate => Boolean(entry)).slice(0, 3)
    }

    const starter = actualStarterForRole(role)
    if (!starter) return sorted.slice(0, 3)
    return [starter, ...sorted.filter((entry) => entry.key !== starter.key)].slice(0, 3)
  }

  const updatePlanner = (
    updater: (current: NonNullable<GameState['squadPlanner']>) => NonNullable<GameState['squadPlanner']>,
  ) => {
    setState((current) => ({
      ...current,
      squadPlanner: updater(current.squadPlanner ?? { version: 1, orders: {}, excluded: {} }),
    }))
  }

  const setDepth = (role: LineupSlot, entries: PlannerCandidate[]) => {
    const key = orderKey(role)
    const keys = entries.map((entry) => entry.key).slice(0, 3)
    updatePlanner((current) => ({
      ...current,
      orders: { ...current.orders, [key]: keys },
      excluded: {
        ...current.excluded,
        [key]: (current.excluded[key] ?? []).filter((item) => !keys.includes(item)),
      },
    }))
  }

  const removeDepth = (role: LineupSlot, keyToRemove: string) => {
    const key = orderKey(role)
    const nextDepth = depthForRole(role).filter((entry) => entry.key !== keyToRemove)
    updatePlanner((current) => ({
      ...current,
      orders: { ...current.orders, [key]: nextDepth.map((entry) => entry.key) },
      excluded: {
        ...current.excluded,
        [key]: Array.from(new Set([...(current.excluded[key] ?? []), keyToRemove])),
      },
    }))
  }

  const placeCandidateAt = (entry: PlannerCandidate, role = selectedRole, index?: number) => {
    const depth = depthForRole(role)
    const targetIndex = index ?? (depth.length < 3 ? depth.length : -1)
    if (targetIndex < 0 || targetIndex > 2) return
    const next = depth.filter((item) => item.key !== entry.key)
    if (targetIndex >= next.length) next.push(entry)
    else next.splice(targetIndex, 1, entry)
    setDepth(role, next.slice(0, 3))
    setSelectedRole(role)
    setPlacementSlot(null)
  }

  const dropPlannerSlot = (targetRole: LineupSlot, targetIndex: number) => {
    if (!draggingSlot) return
    const sourceDepth = depthForRole(draggingSlot.role)
    const sourceEntry = sourceDepth[draggingSlot.index]
    if (!sourceEntry) return

    if (draggingSlot.role === targetRole) {
      const next = [...sourceDepth]
      const target = next[targetIndex]
      next[targetIndex] = sourceEntry
      if (target) next[draggingSlot.index] = target
      else next.splice(draggingSlot.index, 1)
      setDepth(targetRole, next.filter(Boolean).slice(0, 3))
    } else {
      placeCandidateAt(sourceEntry, targetRole, targetIndex)
    }
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
    })
    setPlacementSlot(null)
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
    const expiring = depth.filter(contractRiskAtHorizon).length
    const departures = depth.filter((entry) => !isSecuredAtHorizon(entry)).length
    const quality = primary && isSecuredAtHorizon(primary) ? projectedOverall(primary.player) : 0
    const fit = primary && isSecuredAtHorizon(primary) ? lineupFitScore(primary.player, role) : 0
    const targets = depth.filter((entry) => entry.source === 'target').length
    const primaryConflicts = primary ? (primaryRoleUsage.get(primary.key) ?? []).filter((item) => item !== role) : []
    const manual = Boolean(orders[orderKey(role)])

    let status: 'good' | 'watch' | 'risk' = 'good'
    if (securedDepth.length < 2 || quality < 68 || fit < 66 || primaryConflicts.length > 0) status = 'risk'
    else if (securedDepth.length < 3 || expiring > 0 || departures > 0 || exact === 0 || quality < 76) status = 'watch'

    return { depth, securedDepth, primary, exact, expiring, departures, quality, fit, targets, primaryConflicts, manual, status }
  }

  const analyses = LINEUP_SLOTS.map((role) => ({ role, ...roleAnalysis(role) }))
  const riskCount = analyses.filter((item) => item.status === 'risk').length
  const watchCount = analyses.filter((item) => item.status === 'watch').length
  const expiringCount = analyses.reduce((sum, item) => sum + item.expiring, 0)
  const conflictCount = analyses.filter((item) => item.primaryConflicts.length > 0).length
  const selectedAnalysis = roleAnalysis(selectedRole)
  const selectedDepthKeys = new Set(selectedAnalysis.depth.map((entry) => entry.key))
  const availableAll = sortedForRole(selectedRole).filter((entry) => !selectedDepthKeys.has(entry.key)).slice(0, 12)
  const available = availableAll.slice(0, candidateLimit)
  const selectedCandidate = availableAll.find((entry) => entry.key === selectedCandidateKey) ?? availableAll[0] ?? null

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
  }

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
              {value === 0 ? 'СЕЙЧАС' : 'S+' + value}
            </button>
          ))}
        </div>

        <div className="sim-planner-summary" aria-label="Фильтры проблем состава">
          <button className={(summaryFilter === 'risk' ? 'active ' : '') + (riskCount ? 'risk' : '')} onClick={() => setSummaryFilter(summaryFilter === 'risk' ? 'all' : 'risk')}>
            <b>{riskCount}</b><span>РИСК</span>
          </button>
          <button className={(summaryFilter === 'watch' ? 'active ' : '') + (watchCount ? 'watch' : '')} onClick={() => setSummaryFilter(summaryFilter === 'watch' ? 'all' : 'watch')}>
            <b>{watchCount}</b><span>ВНИМАНИЕ</span>
          </button>
          <button className={(summaryFilter === 'contract' ? 'active ' : '') + (expiringCount ? 'watch' : '')} onClick={() => setSummaryFilter(summaryFilter === 'contract' ? 'all' : 'contract')}>
            <b>{expiringCount}</b><span>КОНТРАКТЫ</span>
          </button>
          <button className={(summaryFilter === 'conflict' ? 'active ' : '') + (conflictCount ? 'risk' : '')} onClick={() => setSummaryFilter(summaryFilter === 'conflict' ? 'all' : 'conflict')}>
            <b>{conflictCount}</b><span>КОНФЛИКТЫ</span>
          </button>
        </div>
      </div>

      <div className="sim-planner-workspace">
        <section className="sim-planner-board">
          <div className="sim-planner-board-head">
            <div>
              <span>ГЛУБИНА СОСТАВА · {horizonLabel}</span>
              <strong>План по игровым ролям</strong>
            </div>
            <button className="sim-planner-help" type="button" title="Планировщик не меняет стартовую пятёрку. #1 — основной выбор, #2 — ротация, #3 — резерв.">?</button>
          </div>

          <div className="sim-planner-lanes">
            {LINEUP_SLOTS.map((role) => {
              const analysis = roleAnalysis(role)
              const muted = !laneMatchesFilter(analysis)
              return (
                <article
                  key={role}
                  className={'sim-planner-lane status-' + analysis.status + (selectedRole === role ? ' active' : '') + (muted ? ' is-muted' : '')}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedRole === role}
                  onClick={() => setSelectedRole(role)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedRole(role)
                    }
                  }}
                >
                  <header>
                    <div>
                      <span>{ROLE_LABELS_RU[role]}</span>
                      <small><i>{statusIcon(analysis.status)}</i> {statusLabel(analysis.status)} · {analysis.manual ? 'РУЧНОЙ' : 'АВТОПЛАН'}</small>
                    </div>
                    <b>{analysis.quality || '—'}</b>
                  </header>

                  <div className="sim-planner-depth">
                    {[0, 1, 2].map((index) => {
                      const entry = analysis.depth[index]
                      if (!entry) {
                        return (
                          <button
                            key={index}
                            className={'sim-planner-empty-slot' + (placementSlot?.role === role && placementSlot.index === index ? ' awaiting' : '')}
                            onClick={(event) => { event.stopPropagation(); requestPlacement(role, index) }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => { event.preventDefault(); event.stopPropagation(); dropPlannerSlot(role, index) }}
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
                      return (
                        <div
                          className={'sim-planner-player rank-' + (index + 1) + ' source-' + entry.source + (contractRisk ? ' contract-risk' : '') + (placementSlot?.role === role && placementSlot.index === index ? ' awaiting' : '')}
                          key={entry.key}
                          draggable
                          onDragStart={(event) => {
                            event.stopPropagation()
                            setDraggingSlot({ role, index })
                            event.dataTransfer.effectAllowed = role === selectedRole ? 'move' : 'copy'
                          }}
                          onDragEnd={() => setDraggingSlot(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => { event.preventDefault(); event.stopPropagation(); dropPlannerSlot(role, index) }}
                        >
                          <div className="sim-planner-rank">
                            <b>#{index + 1}</b>
                            <span>{index === 0 ? 'ОСНОВА' : index === 1 ? 'РОТАЦИЯ' : 'РЕЗЕРВ'}</span>
                          </div>
                          <button className="sim-planner-player-main" onClick={(event) => { event.stopPropagation(); onOpenPlayer(player) }}>
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
                            {!isSecuredAtHorizon(entry)
                              ? <span className="risk">OUT ДО {horizonLabel}</span>
                              : contractRisk
                                ? <span className="watch">КОНТРАКТ</span>
                                : entry.source === 'club'
                                  ? <span>{player.contractWeeks} НЕД.</span>
                                  : <span>{entry.source === 'target' ? 'ТРАНСФЕР' : 'КАРТА'}</span>}
                            {conflicts.length > 1 && index === 0 && (
                              <button
                                className="sim-planner-conflict-chip"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const other = conflicts.find((item) => item !== role)
                                  if (other) setSelectedRole(other)
                                }}
                              >
                                №1 ЕЩЁ В {ROLE_LABELS[conflicts.find((item) => item !== role) ?? role]}
                              </button>
                            )}
                          </div>
                          <div className="sim-planner-slot-actions">
                            <button onClick={(event) => { event.stopPropagation(); requestPlacement(role, index) }}>ЗАМЕНИТЬ</button>
                            <button className="icon-action" onClick={(event) => { event.stopPropagation(); removeDepth(role, entry.key) }} aria-label={'Убрать ' + player.alias + ' из плана'}>×</button>
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

          <div className="sim-planner-analysis-metrics">
            <span><small>ГЛУБИНА</small><b>{selectedAnalysis.securedDepth.length}/3</b></span>
            <span><small>OVR #1</small><b>{selectedAnalysis.quality || '—'}</b></span>
            <span><small>FIT #1</small><b>{selectedAnalysis.fit || '—'}</b></span>
            <span><small>ЦЕЛИ</small><b>{selectedAnalysis.targets}</b></span>
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
              {selectedAnalysis.departures > 0 && (
                <li className="risk">
                  <span>{selectedAnalysis.departures} игрок(а) не имеют контракта до горизонта.</span>
                  {selectedAnalysis.primary && <button onClick={() => onOpenPlayer(selectedAnalysis.primary!.player)}>ИГРОК</button>}
                </li>
              )}
              {selectedAnalysis.expiring > 0 && (
                <li className="watch">
                  <span>{selectedAnalysis.expiring} игрок(а) в зоне контрактного риска.</span>
                  {selectedAnalysis.primary && <button onClick={() => onOpenPlayer(selectedAnalysis.primary!.player)}>КОНТРАКТ</button>}
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

          <div className="sim-planner-candidate-list" role="listbox" aria-label={'Кандидаты на ' + ROLE_LABELS[selectedRole]}>
            {available.map((entry) => {
              const fit = lineupFitScore(entry.player, selectedRole)
              const canPlace = selectedAnalysis.depth.length < 3 || placementSlot?.role === selectedRole
              return (
                <article
                  key={entry.key}
                  className={selectedCandidate?.key === entry.key ? 'selected' : ''}
                  role="option"
                  aria-selected={selectedCandidate?.key === entry.key}
                  tabIndex={0}
                  onClick={() => setSelectedCandidateKey(entry.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedCandidateKey(entry.key)
                    }
                  }}
                >
                  <div className="sim-planner-candidate-portrait">
                    <PlayerPortrait alias={entry.player.alias} playerId={entry.player.profileId} alt={entry.player.alias} draggable={false} />
                  </div>
                  <span>
                    <b>{entry.player.alias}</b>
                    <small><i className={'source-dot source-' + entry.source} />{plannerSourceLabel[entry.source]} · {fit} FIT</small>
                  </span>
                  <strong>{projectedOverall(entry.player)}</strong>
                  <button
                    disabled={!canPlace}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!canPlace) return
                      placeCandidateAt(entry, selectedRole, placementSlot?.role === selectedRole ? placementSlot.index : undefined)
                    }}
                    aria-label={(placementSlot?.role === selectedRole ? 'Replace with ' : 'Add ') + entry.player.alias}
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
    </section>
  )
}

type Candidate = {
  key: string
  player: Player
  source: 'roster' | 'collection'
  cardId: string | null
  fit: number
}

type PoolRole = 'all' | LineupSlot
type PoolSource = 'all' | Candidate['source']
type PoolSort = 'ovr' | 'form' | 'contract'

function fitLabel(candidate: Candidate, slot: LineupSlot) {
  if (candidate.player.role === slot && candidate.fit >= 76) return 'BEST FIT'
  if (candidate.fit >= 70) return 'GOOD FIT'
  if (candidate.fit >= 60) return 'PLAYABLE'
  return 'RISKY'
}

function GameCard({
  player,
  starter = false,
  draggable = false,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  player: Player
  starter?: boolean
  draggable?: boolean
  onOpen: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}) {
  return (
    <CollectiblePlayerCard
      rating={overall(player)}
      tier={player.cardRarity ? tierForPackRarity(player.cardRarity) : cardTier(overall(player))}
      role={player.role}
      alias={player.alias}
      team={player.team}
      country={player.country}
      profileId={player.profileId}
      stats={{
        aim: player.aim,
        utility: player.utility,
        positioning: player.gameSense,
        clutch: player.clutch,
      }}
      liveState={{ form: player.form, morale: player.morale, fatigue: player.fatigue }}
      starter={starter}
      draggable={draggable}
      onOpen={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="game-roster-card"
    />
  )
}

function PoolCard({
  entry,
  starter,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  entry: Candidate
  starter: boolean
  selected: boolean
  onSelect: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}) {
  return (
    <div
      className={
        'sim-pool-card-shell' +
        (starter ? ' is-in-squad' : '') +
        (selected ? ' is-selected' : '') +
        (entry.source === 'collection' ? ' is-collection' : ' is-club')
      }
    >
      <GameCard
        player={entry.player}
        starter={starter}
        draggable={entry.source === 'roster' && entry.player.contractWeeks > 0}
        onOpen={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
      <span className="sim-pool-source-badge">
        {entry.source === 'collection' ? 'COLLECTION' : starter ? 'IN SQUAD' : 'CLUB'}
      </span>
    </div>
  )
}

export function RosterBoard({
  state,
  setState,
  onOpenPlayer,
  onOpenScout,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
  onOpenPlayer: (player: Player) => void
  onOpenScout: () => void
}) {
  const [pickerSlot, setPickerSlot] = useState<LineupSlot | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<LineupSlot | null>(null)
  const [poolQuery, setPoolQuery] = useState('')
  const [poolRole, setPoolRole] = useState<PoolRole>('all')
  const [poolSource, setPoolSource] = useState<PoolSource>('all')
  const [poolSort, setPoolSort] = useState<PoolSort>('ovr')
  const [selectedPoolKey, setSelectedPoolKey] = useState<string | null>(null)
  const [rosterView, setRosterView] = useState<'squad' | 'planner'>('squad')

  useEffect(() => {
    if (!pickerSlot) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerSlot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerSlot])

  const rating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const chem = chemistry(state.roster, state.startingFive, state.lineupContinuity)
  const starterIds = useMemo(() => new Set(state.startingFive), [state.startingFive])
  const activePlayers = useMemo(
    () => state.startingFive.map((id) => state.roster.find((player) => player.id === id)).filter((player): player is Player => Boolean(player)),
    [state.startingFive, state.roster],
  )
  const payroll = useMemo(() => state.roster.reduce((sum, player) => sum + player.salary, 0), [state.roster])
  const activeAverage = (selector: (player: Player) => number) =>
    activePlayers.length
      ? Math.round(activePlayers.reduce((sum, player) => sum + selector(player), 0) / activePlayers.length)
      : 0

  const poolEntries = useMemo<Candidate[]>(() => {
    const rows: Candidate[] = state.roster.map((player) => ({
      key: 'roster:' + player.id,
      player,
      source: 'roster',
      cardId: player.acquiredCardId ?? null,
      fit: 0,
    }))

    const rosterAliases = new Set(state.roster.map((player) => player.alias.toLocaleLowerCase('en-US')))
    const bestOwnedByAlias = new Map<string, PackCard>()

    for (const card of state.packs.inventory) {
      const alias = card.alias.toLocaleLowerCase('en-US')
      if (rosterAliases.has(alias)) continue
      const previous = bestOwnedByAlias.get(alias)
      if (!previous || card.power > previous.power) bestOwnedByAlias.set(alias, card)
    }

    let previewIndex = 1000
    for (const card of bestOwnedByAlias.values()) {
      rows.push({
        key: 'collection:' + card.id,
        player: playerFromPackCard(card, previewIndex++),
        source: 'collection',
        cardId: card.id,
        fit: 0,
      })
    }

    return rows
  }, [state.roster, state.packs.inventory])

  const candidates = useMemo<Candidate[]>(() => {
    if (!pickerSlot) return []
    return poolEntries
      .map((entry) => ({ ...entry, fit: lineupFitScore(entry.player, pickerSlot) }))
      .sort((a, b) =>
        b.fit - a.fit ||
        Number(b.player.role === pickerSlot) - Number(a.player.role === pickerSlot) ||
        overall(b.player) - overall(a.player),
      )
  }, [pickerSlot, poolEntries])

  const filteredPool = useMemo(() => {
    const query = poolQuery.trim().toLocaleLowerCase('en-US')
    return poolEntries
      .filter((entry) => {
        const player = entry.player
        if (query && ![player.alias, player.realName, player.team].some((value) => value.toLocaleLowerCase('en-US').includes(query))) return false
        if (poolRole !== 'all' && player.role !== poolRole) return false
        if (poolSource !== 'all' && entry.source !== poolSource) return false
        return true
      })
      .sort((a, b) => {
        if (poolSort === 'form') return b.player.form - a.player.form || overall(b.player) - overall(a.player)
        if (poolSort === 'contract') return b.player.contractWeeks - a.player.contractWeeks || overall(b.player) - overall(a.player)
        return overall(b.player) - overall(a.player)
      })
  }, [poolEntries, poolQuery, poolRole, poolSource, poolSort])

  const selectedPoolEntry = useMemo(() => {
    if (selectedPoolKey) {
      const explicit = poolEntries.find((entry) => entry.key === selectedPoolKey)
      if (explicit) return explicit
    }
    const firstStarter = poolEntries.find((entry) => starterIds.has(entry.player.id))
    return firstStarter ?? poolEntries[0] ?? null
  }, [poolEntries, selectedPoolKey, starterIds])

  const slotPlayer = (slot: LineupSlot) => {
    const id = state.lineupSlots?.[slot]
    return id ? state.roster.find((player) => player.id === id) ?? null : null
  }

  const playerSlot = (playerId: string) =>
    LINEUP_SLOTS.find((slot) => state.lineupSlots?.[slot] === playerId) ?? null

  const startDrag = (event: DragEvent<HTMLButtonElement>, playerId: string) => {
    event.dataTransfer.setData('text/player-id', playerId)
    event.dataTransfer.effectAllowed = 'move'
  }

  const dropIntoSlot = (event: DragEvent<HTMLElement>, slot: LineupSlot) => {
    event.preventDefault()
    const playerId = event.dataTransfer.getData('text/player-id')
    if (playerId) setState((current) => assignLineupSlot(current, slot, playerId))
    setDragOverSlot(null)
  }

  const promoteCollectionEntry = (current: GameState, entry: Candidate) => {
    const card = current.packs.inventory.find((item) => item.id === entry.cardId)
    if (!card) return { state: current, playerId: null as string | null }
    const existing = current.roster.find(
      (player) => player.alias.toLocaleLowerCase('en-US') === card.alias.toLocaleLowerCase('en-US'),
    )
    if (existing) return { state: current, playerId: existing.id }
    if (current.roster.length >= 8) return { state: current, playerId: null as string | null }

    const promoted = {
      ...playerFromPackCard(card, current.roster.length),
      id: 'card-' + card.id,
    }
    return {
      state: { ...current, roster: [...current.roster, promoted] },
      playerId: promoted.id,
    }
  }

  const fieldEntry = (entry: Candidate, slot: LineupSlot = entry.player.role) => {
    setState((current) => {
      let next = current
      let playerId: string | null = entry.player.id

      if (entry.source === 'collection') {
        const promoted = promoteCollectionEntry(current, entry)
        next = promoted.state
        playerId = promoted.playerId
      }

      if (!playerId) return current
      return assignLineupSlot(next, slot, playerId)
    })
  }

  const placeCandidate = (candidate: Candidate) => {
    if (!pickerSlot) return
    fieldEntry(candidate, pickerSlot)
    setPickerSlot(null)
  }

  const selectedPlayer = selectedPoolEntry?.player ?? null
  const selectedIsStarter = selectedPlayer ? starterIds.has(selectedPlayer.id) : false
  const selectedAssignedSlot = selectedPlayer ? playerSlot(selectedPlayer.id) : null
  const selectedCanJoinRoster = selectedPoolEntry?.source !== 'collection' || state.roster.length < 8
  const fatigueWarnings = activePlayers.filter((player) => player.fatigue >= 65).length
  const expiringContracts = state.roster.filter((player) => player.contractWeeks > 0 && player.contractWeeks <= 2).length

  return (
    <section className="sim-screen sim-roster sim-roster-v2">
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
        <SquadPlanner state={state} setState={setState} onOpenPlayer={onOpenPlayer} onOpenScout={onOpenScout} />
      ) : (
        <div className="sim-squad-mode-body">
      <div className="sim-squad-kpis">
        <div><span>TEAM RATING</span><strong>{rating}</strong><small>{rating >= 70 ? 'CONTENDER' : rating >= 60 ? 'COMPETITIVE' : 'DEVELOPING'}</small></div>
        <div className="chemistry">
          <span>CHEMISTRY</span>
          <strong>{chem}</strong>
          <i><em style={{ width: Math.min(100, chem) + '%' }} /></i>
        </div>
        <div><span>CONTINUITY</span><strong>{state.lineupContinuity}</strong><small>LINEUP STABILITY</small></div>
        <div><span>WEEKLY PAYROLL</span><strong>{payroll.toLocaleString('ru-RU')}</strong><small>CLUB CREDITS</small></div>
        <div className={fatigueWarnings > 0 ? 'warning' : ''}><span>FATIGUE</span><strong>{fatigueWarnings}</strong><small>{fatigueWarnings ? 'PLAYERS AT RISK' : 'NO WARNINGS'}</small></div>
      </div>

      <section className="sim-squad-stage">
        <div className="sim-squad-stage-head">
          <div>
            <span>STARTING FIVE</span>
            <small>Drag club players into roles or use REPLACE.</small>
          </div>
          <div className="sim-squad-stage-summary">
            <span><b>{state.startingFive.length}/5</b> ACTIVE</span>
            <span><b>{expiringContracts}</b> EXPIRING</span>
          </div>
        </div>

        <div className="sim-squad-lineup-row">
          {LINEUP_SLOTS.map((slot) => {
            const player = slotPlayer(slot)
            return (
              <article
                key={slot}
                className={'sim-squad-slot ' + (player ? 'is-filled ' : 'is-empty ') + (dragOverSlot === slot ? 'is-drop-target' : '')}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                onDragEnter={() => setDragOverSlot(slot)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverSlot(null)
                }}
                onDrop={(event) => dropIntoSlot(event, slot)}
              >
                <div className="sim-squad-role">
                  <span>{ROLE_LABELS[slot]}</span>
                  <small>{player ? (player.role === slot ? 'ROLE MATCH' : 'OFF-ROLE') : 'VACANT'}</small>
                </div>

                {player ? (
                  <>
                    <GameCard
                      player={player}
                      starter
                      draggable
                      onOpen={() => setSelectedPoolKey('roster:' + player.id)}
                      onDragStart={(event) => startDrag(event, player.id)}
                      onDragEnd={() => setDragOverSlot(null)}
                    />
                    <button className="sim-squad-replace" type="button" onClick={() => setPickerSlot(slot)}>REPLACE</button>
                  </>
                ) : (
                  <button type="button" className="sim-squad-empty" onClick={() => setPickerSlot(slot)}>
                    <span>+</span>
                    <b>ADD PLAYER</b>
                    <small>{ROLE_LABELS[slot]}</small>
                  </button>
                )}
              </article>
            )
          })}

          <article className="sim-staff-slot">
            <div className="sim-squad-role"><span>COACH</span><small>STAFF SLOT</small></div>
            <div className="sim-staff-card">
              <span>◎</span>
              <b>NO COACH</b>
              <small>Staff system will use this slot.</small>
            </div>
            <button type="button" disabled>LOCKED</button>
          </article>
        </div>
      </section>

      <section className="sim-player-pool">
        <div className="sim-player-pool-head">
          <div>
            <span>PLAYER POOL</span>
            <b>{poolEntries.length}</b>
            <small>{state.roster.length} club · {poolEntries.filter((entry) => entry.source === 'collection').length} collection</small>
          </div>

          <div className="sim-pool-filters">
            <input value={poolQuery} onChange={(event) => setPoolQuery(event.target.value)} placeholder="Search player, team…" />
            <select value={poolRole} onChange={(event) => setPoolRole(event.target.value as PoolRole)}>
              <option value="all">ALL ROLES</option>
              {LINEUP_SLOTS.map((slot) => <option key={slot} value={slot}>{ROLE_LABELS[slot]}</option>)}
            </select>
            <select value={poolSource} onChange={(event) => setPoolSource(event.target.value as PoolSource)}>
              <option value="all">ALL SOURCES</option>
              <option value="roster">CLUB</option>
              <option value="collection">COLLECTION</option>
            </select>
            <select value={poolSort} onChange={(event) => setPoolSort(event.target.value as PoolSort)}>
              <option value="ovr">SORT: OVR</option>
              <option value="form">SORT: FORM</option>
              <option value="contract">SORT: CONTRACT</option>
            </select>
          </div>
        </div>

        <div className="sim-player-pool-body">
          <div className="sim-player-pool-grid">
            {filteredPool.length > 0 ? filteredPool.map((entry) => (
              <PoolCard
                key={entry.key}
                entry={entry}
                starter={starterIds.has(entry.player.id)}
                selected={selectedPoolEntry?.key === entry.key}
                onSelect={() => setSelectedPoolKey(entry.key)}
                onDragStart={entry.source === 'roster' ? (event) => startDrag(event, entry.player.id) : undefined}
                onDragEnd={() => setDragOverSlot(null)}
              />
            )) : (
              <div className="sim-pool-empty">
                <strong>NO PLAYERS FOUND</strong>
                <span>Change filters or search query.</span>
              </div>
            )}
          </div>

          <aside className="sim-player-inspector">
            {selectedPoolEntry && selectedPlayer ? (
              <>
                <div className={'sim-inspector-hero tier-' + cardTier(overall(selectedPlayer))}>
                  <div>
                    <span>{selectedPoolEntry.source === 'collection' ? 'COLLECTION CARD' : selectedIsStarter ? 'STARTING FIVE' : 'CLUB PLAYER'}</span>
                    <strong>{overall(selectedPlayer)}</strong>
                  </div>
                  <PlayerPortrait
                    alias={selectedPlayer.alias}
                    playerId={selectedPlayer.profileId}
                    alt={selectedPlayer.alias}
                    draggable={false}
                  />
                </div>

                <div className="sim-inspector-name">
                  <span>{countryFlag(selectedPlayer.country)} {selectedPlayer.country} · {ROLE_LABELS[selectedPlayer.role]}</span>
                  <h2>{selectedPlayer.alias}</h2>
                  <p>{selectedPlayer.realName} · {selectedPlayer.team}</p>
                </div>

                <div className="sim-inspector-stats">
                  <span><b>{selectedPlayer.aim}</b>AIM</span>
                  <span><b>{selectedPlayer.utility}</b>UTL</span>
                  <span><b>{selectedPlayer.gameSense}</b>POS</span>
                  <span><b>{selectedPlayer.clutch}</b>CLU</span>
                </div>

                <div className="sim-inspector-state">
                  <span><b>{selectedPlayer.form}</b>FORM</span>
                  <span><b>{selectedPlayer.morale}</b>MORALE</span>
                  <span className={selectedPlayer.fatigue >= 65 ? 'danger' : ''}><b>{selectedPlayer.fatigue}</b>FATIGUE</span>
                  <span><b>{selectedPlayer.contractWeeks}</b>WEEKS</span>
                </div>

                {selectedPoolEntry.source === 'roster' ? (
                  <>
                    <div className="sim-inspector-primary-actions">
                      {selectedIsStarter && selectedAssignedSlot ? (
                        <button onClick={() => setState((current) => clearLineupSlot(current, selectedAssignedSlot))}>MOVE TO BENCH</button>
                      ) : (
                        <button onClick={() => fieldEntry(selectedPoolEntry)}>FIELD AS {ROLE_LABELS[selectedPlayer.role]}</button>
                      )}
                      <button onClick={() => onOpenPlayer(selectedPlayer)}>PROFILE</button>
                    </div>
                    <div className="sim-inspector-club-actions">
                      <button onClick={() => setState((current) => restPlayer(current, selectedPlayer.id))} disabled={state.staffEnergy < 1}>REST</button>
                      <button onClick={() => setState((current) => trainPlayer(current, selectedPlayer.id))} disabled={state.staffEnergy < 1 || state.credits < 120}>TRAIN</button>
                      <button onClick={() => setState((current) => renewContract(current, selectedPlayer.id))} disabled={state.credits < selectedPlayer.salary * 4}>RENEW</button>
                      <button className="danger" onClick={() => setState((current) => releasePlayer(current, selectedPlayer.id))} disabled={state.roster.length <= 5 || state.credits < selectedPlayer.salary}>RELEASE</button>
                    </div>
                  </>
                ) : (
                  <div className="sim-inspector-primary-actions collection">
                    <button disabled={!selectedCanJoinRoster || selectedPlayer.contractWeeks <= 0} onClick={() => fieldEntry(selectedPoolEntry)}>
                      {selectedCanJoinRoster ? 'ADD & FIELD AS ' + ROLE_LABELS[selectedPlayer.role] : 'ROSTER 8/8'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="sim-inspector-empty">SELECT A PLAYER</div>
            )}
          </aside>
        </div>
      </section>

      {pickerSlot && (
        <div className="lineup-picker-backdrop" role="presentation" onMouseDown={() => setPickerSlot(null)}>
          <section className="lineup-picker" role="dialog" aria-modal="true" aria-labelledby="lineup-picker-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="lineup-picker-head">
              <div>
                <span className="eyebrow">SLOT PICKER · {ROLE_LABELS[pickerSlot]}</span>
                <h2 id="lineup-picker-title">Choose a player for this role.</h2>
              </div>
              <button type="button" className="lineup-picker-close" onClick={() => setPickerSlot(null)} aria-label="Close">×</button>
            </div>

            <div className="lineup-picker-grid">
              {candidates.map((candidate, index) => {
                const disabled = candidate.source === 'collection' && state.roster.length >= 8
                return (
                  <article className="lineup-picker-card" key={candidate.key}>
                    <div className="lineup-picker-rank"><b>#{index + 1}</b><span className={'fit-' + fitLabel(candidate, pickerSlot).toLowerCase().replace(' ', '-')}>{fitLabel(candidate, pickerSlot)}</span></div>
                    <GameCard player={candidate.player} starter={starterIds.has(candidate.player.id)} onOpen={() => setSelectedPoolKey(candidate.key)} />
                    <div className="lineup-picker-info">
                      <span><b>{candidate.fit}</b> FIT</span>
                      <span>{candidate.source === 'roster' ? (starterIds.has(candidate.player.id) ? 'START' : 'CLUB') : 'COLLECTION'}</span>
                    </div>
                    <button type="button" className="primary lineup-picker-place" onClick={() => placeCandidate(candidate)} disabled={disabled || candidate.player.contractWeeks <= 0}>
                      {disabled ? 'ROSTER 8/8' : 'PLACE AS ' + ROLE_LABELS[pickerSlot]}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}
        </div>
      )}
    </section>
  )
}
