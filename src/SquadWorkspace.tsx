import { useEffect, useMemo, useState, type Dispatch, type DragEvent, type SetStateAction } from 'react'
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

type Candidate = {
  key: string
  player: Player
  source: 'roster' | 'collection'
  cardId: string | null
  fit: number
}

type PoolSource = 'all' | Candidate['source']
type PoolSort = 'fit' | 'ovr' | 'form'

const scoreTone = (value: number) => value >= 80 ? 'good' : value >= 68 ? 'watch' : 'risk'

const fitLabel = (value: number) =>
  value >= 82 ? 'ELITE FIT' : value >= 74 ? 'GOOD FIT' : value >= 64 ? 'PLAYABLE' : 'RISK'

function SquadCard({
  player,
  starter = false,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  player: Player
  starter?: boolean
  onOpen: () => void
  draggable?: boolean
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

export function SquadWorkspace({
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
  const [selectedSlot, setSelectedSlot] = useState<LineupSlot>('AWP')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<LineupSlot | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<PoolSource>('all')
  const [sort, setSort] = useState<PoolSort>('fit')
  const [showAll, setShowAll] = useState(false)

  const starterIds = useMemo(() => new Set(state.startingFive), [state.startingFive])
  const activePlayers = useMemo(
    () => state.startingFive
      .map((id) => state.roster.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player)),
    [state.startingFive, state.roster],
  )

  const rating = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const chem = chemistry(state.roster, state.startingFive, state.lineupContinuity)
  const fatigueWarnings = activePlayers.filter((player) => player.fatigue >= 65).length
  const expiringPlayers = state.roster.filter((player) => player.contractWeeks > 0 && player.contractWeeks <= 4)

  const slotPlayer = (slot: LineupSlot) => {
    const id = state.lineupSlots?.[slot]
    return id ? state.roster.find((player) => player.id === id) ?? null : null
  }

  const playerSlot = (playerId: string) =>
    LINEUP_SLOTS.find((slot) => state.lineupSlots?.[slot] === playerId) ?? null

  const poolEntries = useMemo<Candidate[]>(() => {
    const rows: Candidate[] = state.roster.map((player) => ({
      key: 'roster:' + player.id,
      player,
      source: 'roster',
      cardId: player.acquiredCardId ?? null,
      fit: lineupFitScore(player, selectedSlot),
    }))

    const rosterAliases = new Set(state.roster.map((player) => player.alias.toLocaleLowerCase('en-US')))
    const bestOwnedByAlias = new Map<string, PackCard>()

    for (const card of state.packs.inventory) {
      const alias = card.alias.toLocaleLowerCase('en-US')
      if (rosterAliases.has(alias)) continue
      const previous = bestOwnedByAlias.get(alias)
      if (!previous || card.power > previous.power) bestOwnedByAlias.set(alias, card)
    }

    let previewIndex = 2200
    for (const card of bestOwnedByAlias.values()) {
      const player = playerFromPackCard(card, previewIndex++)
      rows.push({
        key: 'collection:' + card.id,
        player,
        source: 'collection',
        cardId: card.id,
        fit: lineupFitScore(player, selectedSlot),
      })
    }

    return rows
  }, [state.roster, state.packs.inventory, selectedSlot])

  const targetPlayer = slotPlayer(selectedSlot)

  const filteredPool = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('en-US')
    return poolEntries
      .filter((entry) => {
        if (targetPlayer && entry.source === 'roster' && entry.player.id === targetPlayer.id) return false
        if (source !== 'all' && entry.source !== source) return false
        if (q && ![entry.player.alias, entry.player.realName, entry.player.team].some((value) => value.toLocaleLowerCase('en-US').includes(q))) return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'ovr') return overall(b.player) - overall(a.player) || b.fit - a.fit
        if (sort === 'form') return b.player.form - a.player.form || b.fit - a.fit
        return b.fit - a.fit || Number(b.player.role === selectedSlot) - Number(a.player.role === selectedSlot) || overall(b.player) - overall(a.player)
      })
  }, [poolEntries, query, source, sort, selectedSlot, targetPlayer])

  const visiblePool = showAll ? filteredPool : filteredPool.slice(0, 7)

  const selectedEntry = useMemo(() => {
    if (selectedKey) {
      const explicit = poolEntries.find((entry) => entry.key === selectedKey)
      if (explicit) return explicit
    }
    if (targetPlayer) {
      return poolEntries.find((entry) => entry.source === 'roster' && entry.player.id === targetPlayer.id) ?? null
    }
    return visiblePool[0] ?? poolEntries[0] ?? null
  }, [selectedKey, poolEntries, targetPlayer, visiblePool])

  useEffect(() => {
    if (selectedKey && !poolEntries.some((entry) => entry.key === selectedKey)) {
      setSelectedKey(null)
    }
  }, [poolEntries, selectedKey])

  const selectedPlayer = selectedEntry?.player ?? null
  const selectedAssignedSlot = selectedPlayer ? playerSlot(selectedPlayer.id) : null
  const selectedIsStarter = selectedPlayer ? starterIds.has(selectedPlayer.id) : false
  const selectedCanJoinRoster = selectedEntry?.source !== 'collection' || state.roster.length < 8
  const comparing = Boolean(
    targetPlayer &&
    selectedEntry &&
    (selectedEntry.source !== 'roster' || selectedEntry.player.id !== targetPlayer.id),
  )

  const roleFits = selectedPlayer
    ? LINEUP_SLOTS
        .map((role) => ({ role, fit: lineupFitScore(selectedPlayer, role) }))
        .sort((a, b) => b.fit - a.fit)
    : []

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

  const fieldEntry = (entry: Candidate, slot: LineupSlot) => {
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
    setSelectedKey(null)
    setShowAll(false)
  }

  const selectSlot = (slot: LineupSlot) => {
    setSelectedSlot(slot)
    const player = slotPlayer(slot)
    setSelectedKey(player ? 'roster:' + player.id : null)
    setShowAll(false)
    setSort('fit')
  }

  const startDrag = (event: DragEvent<HTMLButtonElement>, playerId: string) => {
    event.dataTransfer.setData('text/player-id', playerId)
    event.dataTransfer.effectAllowed = 'move'
  }

  const dropIntoSlot = (event: DragEvent<HTMLElement>, slot: LineupSlot) => {
    event.preventDefault()
    const playerId = event.dataTransfer.getData('text/player-id')
    if (playerId) {
      setState((current) => assignLineupSlot(current, slot, playerId))
      setSelectedSlot(slot)
      setSelectedKey('roster:' + playerId)
    }
    setDragOverSlot(null)
  }

  const compareRows = comparing && targetPlayer && selectedPlayer ? [
    { label: 'OVR', current: overall(targetPlayer), candidate: overall(selectedPlayer), higherBetter: true },
    { label: 'FIT', current: lineupFitScore(targetPlayer, selectedSlot), candidate: lineupFitScore(selectedPlayer, selectedSlot), higherBetter: true },
    { label: 'FORM', current: targetPlayer.form, candidate: selectedPlayer.form, higherBetter: true },
    { label: 'FATIGUE', current: targetPlayer.fatigue, candidate: selectedPlayer.fatigue, higherBetter: false },
    { label: 'CONTRACT', current: targetPlayer.contractWeeks, candidate: selectedPlayer.contractWeeks, higherBetter: true },
    { label: 'SALARY', current: targetPlayer.salary, candidate: selectedPlayer.salary, higherBetter: false },
  ] : []

  return (
    <div className="squad-opt">
      <div className="squad-opt-status">
        <div><span>OVR</span><b>{rating}</b><small>{rating >= 70 ? 'CONTENDER' : rating >= 60 ? 'COMPETITIVE' : 'DEVELOPING'}</small></div>
        <div><span>CHEM</span><b>{chem}</b><small>TEAM CHEMISTRY</small></div>
        <div className={state.lineupContinuity < 30 ? 'risk' : ''}><span>CONTINUITY</span><b>{state.lineupContinuity}</b><small>{state.lineupContinuity < 30 ? 'REBUILDING' : 'STABLE'}</small></div>
        <div className={fatigueWarnings > 0 ? 'risk' : ''}><span>FATIGUE</span><b>{fatigueWarnings}</b><small>{fatigueWarnings ? 'PLAYERS AT RISK' : 'NO WARNINGS'}</small></div>
        <button className={expiringPlayers.length ? 'risk' : ''} onClick={() => { setSource('roster'); setQuery(''); setShowAll(true) }}>
          <span>CONTRACTS</span><b>{expiringPlayers.length}</b><small>{expiringPlayers.length ? 'EXPIRING ≤ 4W' : 'CLEAR'}</small>
        </button>
      </div>

      <div className="squad-opt-layout">
        <div className="squad-opt-left">
          <section className="squad-opt-stage">
            <header>
              <div>
                <span>STARTING FIVE</span>
                <strong>Активная пятёрка</strong>
              </div>
              <small>Выбери роль → получи лучшие варианты → сравни → замени</small>
            </header>

            <div className="squad-opt-stage-grid">
              {LINEUP_SLOTS.map((slot) => {
                const player = slotPlayer(slot)
                const active = selectedSlot === slot
                const fit = player ? lineupFitScore(player, slot) : 0
                return (
                  <article
                    key={slot}
                    className={'squad-opt-slot' + (active ? ' active' : '') + (dragOverSlot === slot ? ' drop-target' : '')}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                    onDragEnter={() => setDragOverSlot(slot)}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverSlot(null)
                    }}
                    onDrop={(event) => dropIntoSlot(event, slot)}
                  >
                    <button className="squad-opt-role" onClick={() => selectSlot(slot)}>
                      <span>{ROLE_LABELS[slot]}</span>
                      <small>{player ? fitLabel(fit) + ' · ' + fit : 'VACANT'}</small>
                    </button>

                    {player ? (
                      <>
                        <div className="squad-opt-starter-card">
                          <SquadCard
                            player={player}
                            starter
                            draggable={player.contractWeeks > 0}
                            onOpen={() => selectSlot(slot)}
                            onDragStart={(event) => startDrag(event, player.id)}
                            onDragEnd={() => setDragOverSlot(null)}
                          />
                          {player.contractWeeks > 0 && player.contractWeeks <= 4 && (
                            <span className="squad-opt-contract-alert">⚠ {player.contractWeeks}W</span>
                          )}
                        </div>
                        <button className="squad-opt-replace" onClick={() => selectSlot(slot)}>REPLACE <span>→</span></button>
                      </>
                    ) : (
                      <button className="squad-opt-empty" onClick={() => selectSlot(slot)}>
                        <span>+</span><b>ADD PLAYER</b><small>{ROLE_LABELS[slot]}</small>
                      </button>
                    )}
                  </article>
                )
              })}

              <aside className="squad-opt-staff">
                <span>STAFF</span>
                <div><b>◎</b><strong>HEAD COACH</strong><small>VACANT</small></div>
                <button disabled>HIRE →</button>
              </aside>
            </div>
          </section>

          <section className="squad-opt-pool">
            <header className="squad-opt-pool-head">
              <div className="squad-opt-pool-context">
                <span>PLAYER POOL</span>
                <strong>BEST OPTIONS FOR {ROLE_LABELS[selectedSlot]}</strong>
                <small>{filteredPool.length} доступно · показано {Math.min(visiblePool.length, filteredPool.length)}</small>
              </div>

              <div className="squad-opt-pool-tools">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player…" />
                <select value={sort} onChange={(event) => setSort(event.target.value as PoolSort)}>
                  <option value="fit">BEST FIT</option>
                  <option value="ovr">OVR</option>
                  <option value="form">FORM</option>
                </select>
                <select value={source} onChange={(event) => setSource(event.target.value as PoolSource)}>
                  <option value="all">ALL</option>
                  <option value="roster">CLUB</option>
                  <option value="collection">COLLECTION</option>
                </select>
                <button className="squad-opt-show-all" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? 'TOP 7' : 'SHOW ALL'}
                </button>
              </div>
            </header>

            <div className="squad-opt-pool-grid">
              {visiblePool.map((entry) => (
                <div
                  key={entry.key}
                  className={'squad-opt-pool-card' + (selectedEntry?.key === entry.key ? ' selected' : '') + (starterIds.has(entry.player.id) ? ' starter' : '')}
                >
                  <SquadCard
                    player={entry.player}
                    starter={starterIds.has(entry.player.id)}
                    draggable={entry.source === 'roster' && entry.player.contractWeeks > 0}
                    onOpen={() => setSelectedKey(entry.key)}
                    onDragStart={entry.source === 'roster' ? (event) => startDrag(event, entry.player.id) : undefined}
                    onDragEnd={() => setDragOverSlot(null)}
                  />
                  <button className="squad-opt-pool-meta" onClick={() => setSelectedKey(entry.key)}>
                    <span className={scoreTone(entry.fit)}>{entry.fit} FIT</span>
                    <small>{entry.source === 'collection' ? 'COLLECTION' : starterIds.has(entry.player.id) ? 'STARTING FIVE' : 'CLUB'}</small>
                  </button>
                </div>
              ))}
              {visiblePool.length === 0 && (
                <div className="squad-opt-pool-empty">
                  <strong>NO RELEVANT PLAYERS</strong>
                  <span>Измени поиск или источник.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className={'squad-opt-inspector' + (comparing ? ' comparing' : '')}>
          {selectedPlayer && selectedEntry ? (
            <>
              <div className={'squad-opt-inspector-hero tier-' + cardTier(overall(selectedPlayer))}>
                <div>
                  <span>{comparing ? 'CANDIDATE FOR ' + ROLE_LABELS[selectedSlot] : selectedIsStarter ? 'STARTING FIVE' : selectedEntry.source === 'collection' ? 'COLLECTION' : 'CLUB PLAYER'}</span>
                  <strong>{overall(selectedPlayer)}</strong>
                  <small>OVR</small>
                </div>
                <PlayerPortrait alias={selectedPlayer.alias} playerId={selectedPlayer.profileId} alt={selectedPlayer.alias} draggable={false} />
              </div>

              <div className="squad-opt-inspector-name">
                <span>{countryFlag(selectedPlayer.country)} {selectedPlayer.country} · {selectedPlayer.role}</span>
                <h2>{selectedPlayer.alias}</h2>
                <p>{selectedPlayer.realName} · {selectedPlayer.team}</p>
              </div>

              {comparing && targetPlayer ? (
                <div className="squad-opt-compare">
                  <div className="squad-opt-compare-head">
                    <span><small>CURRENT</small><b>{targetPlayer.alias}</b></span>
                    <i>→</i>
                    <span><small>CANDIDATE</small><b>{selectedPlayer.alias}</b></span>
                  </div>
                  <div className="squad-opt-compare-grid">
                    {compareRows.map((row) => {
                      const delta = row.candidate - row.current
                      const better = row.higherBetter ? delta > 0 : delta < 0
                      const worse = row.higherBetter ? delta < 0 : delta > 0
                      return (
                        <div key={row.label}>
                          <small>{row.label}</small>
                          <span>{row.current}</span>
                          <b>→ {row.candidate}</b>
                          <em className={better ? 'good' : worse ? 'risk' : ''}>{delta > 0 ? '+' : ''}{delta}</em>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="squad-opt-role-fits">
                    <span>ROLE FIT</span>
                    {roleFits.slice(0, 3).map((item) => (
                      <div key={item.role}>
                        <b>{ROLE_LABELS[item.role]}</b>
                        <i><em style={{ width: item.fit + '%' }} /></i>
                        <strong className={scoreTone(item.fit)}>{item.fit}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="squad-opt-player-stats">
                    <span><small>AIM</small><b>{selectedPlayer.aim}</b></span>
                    <span><small>SENSE</small><b>{selectedPlayer.gameSense}</b></span>
                    <span><small>UTILITY</small><b>{selectedPlayer.utility}</b></span>
                    <span><small>CLUTCH</small><b>{selectedPlayer.clutch}</b></span>
                    <span><small>FORM</small><b>{selectedPlayer.form}</b></span>
                    <span><small>FATIGUE</small><b className={selectedPlayer.fatigue >= 65 ? 'risk' : ''}>{selectedPlayer.fatigue}</b></span>
                  </div>

                  <div className="squad-opt-contract">
                    <span><small>CONTRACT</small><b className={selectedPlayer.contractWeeks <= 4 ? 'risk' : ''}>{selectedPlayer.contractWeeks} weeks</b></span>
                    <span><small>SALARY</small><b>{selectedPlayer.salary.toLocaleString('ru-RU')} cr.</b></span>
                  </div>
                </>
              )}

              <div className="squad-opt-inspector-actions">
                {comparing ? (
                  <button
                    className="primary"
                    disabled={!selectedCanJoinRoster || selectedPlayer.contractWeeks <= 0}
                    onClick={() => fieldEntry(selectedEntry, selectedSlot)}
                  >
                    {selectedCanJoinRoster ? 'REPLACE ' + ROLE_LABELS[selectedSlot] : 'ROSTER 8/8'} <span>→</span>
                  </button>
                ) : selectedEntry.source === 'roster' ? (
                  selectedIsStarter && selectedAssignedSlot ? (
                    <button onClick={() => setState((current) => clearLineupSlot(current, selectedAssignedSlot))}>MOVE TO BENCH</button>
                  ) : (
                    <button className="primary" onClick={() => fieldEntry(selectedEntry, selectedSlot)}>FIELD AS {ROLE_LABELS[selectedSlot]} <span>→</span></button>
                  )
                ) : (
                  <button className="primary" disabled={!selectedCanJoinRoster} onClick={() => fieldEntry(selectedEntry, selectedSlot)}>
                    {selectedCanJoinRoster ? 'ADD & FIELD' : 'ROSTER 8/8'} <span>→</span>
                  </button>
                )}
                <button onClick={() => onOpenPlayer(selectedPlayer)}>PROFILE</button>
              </div>

              {selectedEntry.source === 'roster' && !comparing && (
                <div className="squad-opt-secondary-actions">
                  <button onClick={() => setState((current) => restPlayer(current, selectedPlayer.id))} disabled={state.staffEnergy < 1}>REST</button>
                  <button onClick={() => setState((current) => trainPlayer(current, selectedPlayer.id))} disabled={state.staffEnergy < 1 || state.credits < 120}>DEVELOP</button>
                  <button onClick={() => setState((current) => renewContract(current, selectedPlayer.id))} disabled={state.credits < selectedPlayer.salary * 4}>RENEW</button>
                  <button className="danger" onClick={() => setState((current) => releasePlayer(current, selectedPlayer.id))} disabled={state.roster.length <= 5 || state.credits < selectedPlayer.salary}>RELEASE</button>
                </div>
              )}

              <button className="squad-opt-market" onClick={onOpenScout}>OPEN TRANSFER MARKET <span>→</span></button>
            </>
          ) : (
            <div className="squad-opt-inspector-empty">
              <strong>SELECT A PLAYER</strong>
              <span>Выбери роль или кандидата для сравнения.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
