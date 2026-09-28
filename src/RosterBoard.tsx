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
import { CollectiblePlayerCard } from './CollectiblePlayerCard'

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
      tier={cardTier(overall(player))}
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
          <span className="eyebrow">CLUB OPERATIONS · ACTIVE LINEUP</span>
          <h1>SQUAD</h1>
        </div>
        <button className="sim-roster-market-action" onClick={onOpenScout}>TRANSFER MARKET <span>→</span></button>
      </div>

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
    </section>
  )
}
