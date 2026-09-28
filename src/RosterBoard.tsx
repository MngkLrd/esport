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
import { CARD_TIER_LABEL, cardTier, countryFlag } from './playerVisuals'
import { PlayerPortrait } from './PlayerPortrait'
import type { PackCard } from './packState'

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
  const ovr = overall(player)
  const tier = cardTier(ovr)
  const role = player.role === 'Rifler' ? 'РИФ' : player.role === 'Support' ? 'САП' : player.role === 'Entry' ? 'ЕНТ' : player.role

  return (
    <button
      type="button"
      className={'visual-player-card compact game-roster-card tier-' + tier + (starter ? ' is-starter' : '')}
      onClick={onOpen}
      aria-label={'Открыть профиль ' + player.alias}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="visual-card-shine" />
      <div className="visual-card-top">
        <div><strong>{ovr}</strong><span>{role}</span></div>
        {starter && <b className="starter-star">★</b>}
      </div>
      <div className="visual-country">{countryFlag(player.country)} <span>{player.country}</span></div>
      <div className="visual-photo">
        <div className="visual-monogram">{player.alias.slice(0, 3).toUpperCase()}</div>
        <PlayerPortrait
          alias={player.alias}
          playerId={player.profileId}
          alt={player.realName + ' (' + player.alias + ')'}
          draggable={false}
        />
      </div>
      <div className="visual-identity">
        <strong>{player.alias}</strong>
        <span>{player.team}</span>
      </div>
      <div className="visual-stats">
        <span><b>{player.aim}</b>АИМ</span>
        <span><b>{player.utility}</b>УТЛ</span>
        <span><b>{player.gameSense}</b>ПОЗ</span>
        <span><b>{player.clutch}</b>КЛА</span>
      </div>
      <div className="visual-live-state">
        <span><b>{player.form}</b>FORM</span>
        <span><b>{player.morale}</b>MOR</span>
        <span className={player.fatigue >= 65 ? 'danger' : ''}><b>{player.fatigue}</b>FAT</span>
      </div>
      <div className="visual-rarity">{CARD_TIER_LABEL[tier]}</div>
    </button>
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
  const bench = useMemo(
    () => state.roster.filter((player) => !starterIds.has(player.id)).sort((a, b) => overall(b) - overall(a)),
    [state.roster, starterIds],
  )
  const activePlayers = useMemo(() => state.startingFive.map((id) => state.roster.find((player) => player.id === id)).filter((player): player is Player => Boolean(player)), [state.startingFive, state.roster])
  const activeAverage = (selector: (player: Player) => number) => activePlayers.length ? Math.round(activePlayers.reduce((sum, player) => sum + selector(player), 0) / activePlayers.length) : 0

  const candidates = useMemo<Candidate[]>(() => {
    if (!pickerSlot) return []

    const rows: Candidate[] = state.roster.map((player) => ({
      key: 'roster:' + player.id,
      player,
      source: 'roster',
      cardId: player.acquiredCardId ?? null,
      fit: lineupFitScore(player, pickerSlot),
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
      const player = playerFromPackCard(card, previewIndex++)
      rows.push({
        key: 'collection:' + card.id,
        player,
        source: 'collection',
        cardId: card.id,
        fit: lineupFitScore(player, pickerSlot),
      })
    }

    return rows.sort((a, b) =>
      b.fit - a.fit ||
      Number(b.player.role === pickerSlot) - Number(a.player.role === pickerSlot) ||
      overall(b.player) - overall(a.player),
    )
  }, [pickerSlot, state.roster, state.packs.inventory])

  const slotPlayer = (slot: LineupSlot) => {
    const id = state.lineupSlots?.[slot]
    return id ? state.roster.find((player) => player.id === id) ?? null : null
  }

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

  const placeCandidate = (candidate: Candidate) => {
    if (!pickerSlot) return
    if (candidate.source === 'collection' && state.roster.length >= 8) return

    const slot = pickerSlot
    setState((current) => {
      let next = current
      let playerId = candidate.player.id

      if (candidate.source === 'collection') {
        const card = current.packs.inventory.find((entry) => entry.id === candidate.cardId)
        if (!card) return current

        const existing = current.roster.find(
          (player) => player.alias.toLocaleLowerCase('en-US') === card.alias.toLocaleLowerCase('en-US'),
        )
        if (existing) {
          playerId = existing.id
        } else {
          if (current.roster.length >= 8) return current
          const promoted = {
            ...playerFromPackCard(card, current.roster.length),
            id: 'card-' + card.id,
          }
          next = { ...current, roster: [...current.roster, promoted] }
          playerId = promoted.id
        }
      }

      return assignLineupSlot(next, slot, playerId)
    })
    setPickerSlot(null)
  }

  return (
    <section className="sim-screen sim-roster">
      <div className="sim-screen-head sim-roster-head">
        <div>
          <span className="eyebrow">ACTIVE LINEUP</span>
          <h1>STARTING FIVE</h1>
        </div>
        <div className="sim-roster-rating">
          <b>{rating}</b>
          <span>OVR КОМАНДЫ</span>
          <small>{chem} химия · {state.lineupContinuity} стабильность</small>
        </div>
      </div>

      <div className="sim-roster-toolbar">
        <span><b>{state.startingFive.length}/5</b> START</span>
        <span><b>{bench.length}</b> BENCH</span>
        <button className="secondary" onClick={onOpenScout}>TRANSFER MARKET</button>
      </div>

      <div className="sim-roster-body">
      <div className="sim-lineup-stage">
        <div className="sim-lineup-head">
          <div><span>STARTING FIVE</span></div>
          <div className="sim-lineup-chem"><b>{chem}</b><span>CHEM</span></div>
        </div>

        <div className="sim-lineup-grid">
          {LINEUP_SLOTS.map((slot) => {
            const player = slotPlayer(slot)
            return (
              <article
                key={slot}
                className={'sim-lineup-slot ' + (player ? 'is-filled ' : 'is-empty ') + (dragOverSlot === slot ? 'is-drop-target' : '')}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                onDragEnter={() => setDragOverSlot(slot)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverSlot(null)
                }}
                onDrop={(event) => dropIntoSlot(event, slot)}
              >
                <div className="sim-lineup-role">
                  <span>{ROLE_LABELS[slot]}</span>
                  <small>{player ? (player.role === slot ? 'ROLE MATCH' : 'OFF-ROLE') : 'EMPTY SLOT'}</small>
                </div>

                {player ? (
                  <>
                    <GameCard
                      player={player}
                      starter
                      draggable
                      onOpen={() => onOpenPlayer(player)}
                      onDragStart={(event) => startDrag(event, player.id)}
                      onDragEnd={() => setDragOverSlot(null)}
                    />
                    <div className="sim-lineup-actions">
                      <button type="button" onClick={() => setPickerSlot(slot)}>Заменить</button>
                      <button type="button" className="text-button" onClick={() => setState((current) => clearLineupSlot(current, slot))}>В запас</button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="sim-lineup-empty-card" onClick={() => setPickerSlot(slot)}>
                    <span className="sim-lineup-empty-plus">+</span>
                    <strong>Добавить {ROLE_LABELS[slot]}</strong>
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </div>
      <aside className="sim-roster-analysis">
        <div className="sim-analysis-head"><span>OVERVIEW & STATS</span><b>{rating}</b></div>
        <div className="squad-radar">
          <div className="squad-radar-shape" style={{ '--aim': activeAverage((player) => player.aim) + '%', '--pos': activeAverage((player) => player.gameSense) + '%', '--utl': activeAverage((player) => player.utility) + '%', '--clu': activeAverage((player) => player.clutch) + '%' } as React.CSSProperties} />
          <span className="radar-aim">AIM</span><span className="radar-pos">POS</span><span className="radar-utl">UTL</span><span className="radar-clu">CLU</span>
        </div>
        <div className="sim-analysis-stats">
          <span><b>{chem}</b> CHEMISTRY</span>
          <span><b>{state.lineupContinuity}</b> CONTINUITY</span>
          <span><b>{activeAverage((player) => player.form)}</b> FORM</span>
          <span><b>{activeAverage((player) => player.morale)}</b> MORALE</span>
          <span><b>{activeAverage((player) => player.fatigue)}</b> FATIGUE</span>
        </div>
      </aside>
      </div>

      <div className="sim-bench">
        <div className="sim-bench-head">
          <div><span>BENCH / CLUB CARDS</span></div>
          <b>{bench.length}</b>
        </div>

        {bench.length > 0 ? (
          <div className="sim-bench-grid">
            {bench.map((player) => (
              <article className="sim-bench-card" key={player.id}>
                <GameCard
                  player={player}
                  draggable={player.contractWeeks > 0}
                  onOpen={() => onOpenPlayer(player)}
                  onDragStart={(event) => startDrag(event, player.id)}
                  onDragEnd={() => setDragOverSlot(null)}
                />
                <div className="sim-bench-meta">
                  <span>{ROLE_LABELS[player.role]}</span>
                  <span>{player.contractWeeks > 0 ? player.contractWeeks + ' нед.' : 'КОНТРАКТ ИСТЁК'}</span>
                </div>
                <div className="sim-bench-actions">
                  <button type="button" onClick={() => setState((current) => restPlayer(current, player.id))} disabled={state.staffEnergy < 1}>Отдых</button>
                  <button type="button" onClick={() => setState((current) => trainPlayer(current, player.id))} disabled={state.staffEnergy < 1 || state.credits < 120}>Трен.</button>
                  <button type="button" onClick={() => setState((current) => renewContract(current, player.id))} disabled={state.credits < player.salary * 4}>Контракт</button>
                  <button type="button" className="release" onClick={() => setState((current) => releasePlayer(current, player.id))} disabled={state.roster.length <= 5 || state.credits < player.salary}>Убрать</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="sim-empty">Все доступные игроки сейчас стоят в стартовой пятёрке.</div>
        )}
      </div>

      {pickerSlot && (
        <div className="lineup-picker-backdrop" role="presentation" onMouseDown={() => setPickerSlot(null)}>
          <section className="lineup-picker" role="dialog" aria-modal="true" aria-labelledby="lineup-picker-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="lineup-picker-head">
              <div>
                <span className="eyebrow">SLOT PICKER · {ROLE_LABELS[pickerSlot]}</span>
                <h2 id="lineup-picker-title">Выбери карту для слота.</h2>
              </div>
              <button type="button" className="lineup-picker-close" onClick={() => setPickerSlot(null)} aria-label="Закрыть">×</button>
            </div>

            <div className="lineup-picker-grid">
              {candidates.map((candidate, index) => {
                const disabled = candidate.source === 'collection' && state.roster.length >= 8
                return (
                  <article className="lineup-picker-card" key={candidate.key}>
                    <div className="lineup-picker-rank"><b>#{index + 1}</b><span className={'fit-' + fitLabel(candidate, pickerSlot).toLowerCase().replace(' ', '-')}>{fitLabel(candidate, pickerSlot)}</span></div>
                    <GameCard player={candidate.player} starter={starterIds.has(candidate.player.id)} onOpen={() => onOpenPlayer(candidate.player)} />
                    <div className="lineup-picker-info">
                      <span><b>{candidate.fit}</b> FIT</span>
                      <span>{candidate.source === 'roster' ? (starterIds.has(candidate.player.id) ? 'СТАРТ' : 'РОСТЕР') : 'КОЛЛЕКЦИЯ'}</span>
                    </div>
                    <button type="button" className="primary lineup-picker-place" onClick={() => placeCandidate(candidate)} disabled={disabled || candidate.player.contractWeeks <= 0}>
                      {disabled ? 'Ростер 8/8' : 'Поставить в ' + ROLE_LABELS[pickerSlot]}
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
