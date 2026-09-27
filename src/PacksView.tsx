import { useEffect, useMemo, useState } from 'react'
import {
  PACKS,
  PACK_POOL_STATS,
  RARITY_COLOR,
  RARITY_LABEL,
  hydratePackState,
} from './packs'
import {
  cardKey,
  packCardCount,
  packCollectionStats,
  type PackCard,
  type PackId,
  type PackRarity,
  type PackRoll,
  type PackState,
} from './packState'
import { countryFlag } from './playerVisuals'
import { CardDetails } from './CardDetails'
import { PackArtwork } from './PackArtwork'
import { PlayerPortrait, preloadPlayerPortraits } from './PlayerPortrait'
import type { Player } from './game'

const SPIN_MS = 4300
const QUANTITIES = [1, 3, 5, 10] as const

const ROLE_LABELS: Record<NonNullable<PackCard['role']>, string> = {
  IGL: 'IGL',
  Entry: 'Энтри',
  Rifler: 'Рифлер',
  AWP: 'AWP',
  Support: 'Саппорт',
}

const FILTERS: Array<{ value: 'all' | PackRarity; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'common', label: 'Обычные' },
  { value: 'uncommon', label: 'Необычные' },
  { value: 'rare', label: 'Редкие' },
  { value: 'epic', label: 'Эпические' },
  { value: 'legendary', label: 'Легендарные' },
]

function ReelCard({ card, winner = false }: { card: PackCard; winner?: boolean }) {
  return (
    <div
      className={'pack-reel-card rarity-' + card.rarity + (winner ? ' is-winner' : '')}
      style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}
    >
      <div className="pack-reel-power">{card.power}</div>
      <div className="pack-reel-photo">
        <span>{card.alias.slice(0, 2).toUpperCase()}</span>
        <PlayerPortrait alias={card.alias} playerId={card.profileId} alt={card.alias} loading="eager" draggable={false} />
      </div>
      <strong>{card.alias}</strong>
      <small>{card.team}</small>
      <i>{RARITY_LABEL[card.rarity]}</i>
    </div>
  )
}

function CollectionCard({ card, count, onOpen }: { card: PackCard; count: number; onOpen: () => void }) {
  return (
    <button type="button" aria-label={'Открыть карточку ' + card.alias} onClick={onOpen} className={'collection-card rarity-' + card.rarity} style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}>
      <div className="collection-card-top">
        <b>{card.power}</b>
        <span>{card.role ? ROLE_LABELS[card.role] : 'ПРО'}</span>
      </div>
      <div className="collection-edition">{card.edition}</div>
      {count > 1 && <div className="collection-count">×{count}</div>}
      <div className="collection-photo">
        <span>{card.alias.slice(0, 3).toUpperCase()}</span>
        <PlayerPortrait alias={card.alias} playerId={card.profileId} alt={card.alias} loading="lazy" />
      </div>
      <div className="collection-identity">
        <strong>{card.alias}</strong>
        <span>{countryFlag(card.country ?? 'Неизвестно')} {card.country ?? '—'} · {card.team}</span>
      </div>
      {card.cardStats && (
        <div className="collection-card-stats">
          <span><b>{card.cardStats.aim}</b>АИМ</span>
          <span><b>{card.cardStats.utility}</b>УТЛ</span>
          <span><b>{card.cardStats.positioning}</b>ПОЗ</span>
          <span><b>{card.cardStats.clutch}</b>КЛА</span>
        </div>
      )}
      <div className="collection-rarity">{RARITY_LABEL[card.rarity]}</div>
    </button>
  )
}

function WinnerReveal({ card, duplicate, onOpen }: { card: PackCard; duplicate: boolean; onOpen: () => void }) {
  const source = card.cardStats
    ? 'Форма игрока · ' + card.cardStats.periodStart + ' — ' + card.cardStats.periodEnd
    : 'Игровой профиль'

  return (
    <button type="button" onClick={onOpen} aria-label={'Открыть подробности ' + card.alias}
      className={'pack-reveal rarity-' + card.rarity}
      style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}
    >
      <div className="pack-reveal-beam beam-one" />
      <div className="pack-reveal-beam beam-two" />
      <div className="pack-reveal-grid" />
      <div className="pack-reveal-card">
        <div className="pack-reveal-rating">
          <b>{card.power}</b>
          <span>{card.role ? ROLE_LABELS[card.role] : 'ПРО'}</span>
          <i>{card.edition}</i>
        </div>
        <div className="pack-reveal-country">{countryFlag(card.country ?? 'Неизвестно')}</div>
        <div className="pack-reveal-photo">
          <span>{card.alias.slice(0, 3).toUpperCase()}</span>
          <PlayerPortrait alias={card.alias} playerId={card.profileId} alt={card.alias} loading="eager" />
        </div>
        <div className="pack-reveal-name">
          <strong>{card.alias}</strong>
          <span>{card.team}</span>
        </div>
        {card.cardStats && (
          <div className="pack-reveal-card-stats">
            <span><b>{card.cardStats.aim}</b>АИМ</span>
            <span><b>{card.cardStats.utility}</b>УТЛ</span>
            <span><b>{card.cardStats.positioning}</b>ПОЗ</span>
            <span><b>{card.cardStats.clutch}</b>КЛА</span>
          </div>
        )}
      </div>

      <div className="pack-reveal-copy">
        <div className="eyebrow">{RARITY_LABEL[card.rarity]} · КАРТА #{card.serial + 1}</div>
        <h2>{card.alias}</h2>
        <p>{card.realName ?? 'Данные профиля пока не найдены'} · {card.team}</p>
        <div className="pack-reveal-meta">
          <span><b>{card.power}</b> сила / 100</span>
          <span><b>{countryFlag(card.country ?? 'Неизвестно')}</b> {card.country ?? 'Страна неизвестна'}</span>
          <span><b>{duplicate ? 'ДУБЛЬ' : 'НОВАЯ'}</b> {duplicate ? 'уже есть в коллекции' : 'новая для коллекции'}</span>
          <span><b>ПЕРИОД</b> {source}</span>
        </div>
      </div>
    </button>
  )
}

export function PacksView({
  packTokens,
  packState,
  roster,
  onOpenBatch,
  onClear,
}: {
  packTokens: number
  packState: PackState
  roster: Player[]
  onOpenBatch: (packId: Exclude<PackId, 'welcome'>, quantity: number) => PackRoll[] | null
  onClear: () => void
}) {
  const [selectedPackId, setSelectedPackId] = useState<Exclude<PackId, 'welcome'> | null>(null)
  const [quantity, setQuantity] = useState<(typeof QUANTITIES)[number]>(1)
  const [queue, setQueue] = useState<PackRoll[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [query, setQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState<'all' | PackRarity>('all')
  const [selectedCard, setSelectedCard] = useState<PackCard | null>(null)

  const viewState = useMemo(() => hydratePackState(packState), [packState])
  const stats = useMemo(() => packCollectionStats(viewState), [viewState])
  const selectedPack = PACKS.find((item) => item.id === selectedPackId) ?? null
  const roll = queue[queueIndex] ?? null
  const selectedPlayer = selectedCard
    ? roster.find((player) => player.acquiredCardId === selectedCard.id || player.playerKey === selectedCard.playerKey || player.alias.toLowerCase() === selectedCard.alias.toLowerCase())
    : undefined

  const duplicate = useMemo(() => {
    if (!roll) return false
    if (packCardCount(viewState, roll.winner) > 0) return true
    return queue.slice(0, queueIndex).some((entry) => entry.winner.alias.toLowerCase() === roll.winner.alias.toLowerCase())
  }, [roll, queue, queueIndex, viewState])

  useEffect(() => {
    if (!spinning) return
    const timer = window.setTimeout(() => {
      setSpinning(false)
      setRevealed(true)
    }, SPIN_MS)
    return () => window.clearTimeout(timer)
  }, [spinning, roll])

  useEffect(() => {
    if (!selectedPackId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !spinning && !preparing) {
        setSelectedPackId(null)
        setQueue([])
        setQueueIndex(0)
        setRevealed(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedPackId, spinning, preparing])

  const openPurchase = (packId: Exclude<PackId, 'welcome'>) => {
    setSelectedPackId(packId)
    setQuantity(1)
    setQueue([])
    setQueueIndex(0)
    setRevealed(false)
    setSpinning(false)
    setPreparing(false)
  }

  const warmRoll = (target: PackRoll | null | undefined) =>
    target
      ? preloadPlayerPortraits(target.reel.map((card) => ({ alias: card.alias, playerId: card.profileId })))
      : Promise.resolve({ loaded: 0, failed: 0 })

  const startSpinAnimation = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSpinning(true))
    })
  }

  const spin = async () => {
    if (!selectedPack || spinning || preparing) return
    const total = selectedPack.price * quantity
    if (packTokens < total) return

    setPreparing(true)
    const rolls = onOpenBatch(selectedPack.id as Exclude<PackId, 'welcome'>, quantity)
    if (!rolls?.length) {
      setPreparing(false)
      return
    }

    await warmRoll(rolls[0])
    setQueue(rolls)
    setQueueIndex(0)
    setRevealed(false)
    setSpinning(false)
    setPreparing(false)
    startSpinAnimation()

    if (rolls[1]) void warmRoll(rolls[1])
  }

  const nextRoll = async () => {
    if (queueIndex >= queue.length - 1 || spinning || preparing) return
    const nextIndex = queueIndex + 1

    setPreparing(true)
    await warmRoll(queue[nextIndex])
    setQueueIndex(nextIndex)
    setRevealed(false)
    setSpinning(false)
    setPreparing(false)
    startSpinAnimation()

    if (queue[nextIndex + 1]) void warmRoll(queue[nextIndex + 1])
  }

  const skip = () => {
    if (!spinning) return
    setSpinning(false)
    setRevealed(true)
  }

  const closeSpin = () => {
    if (spinning || preparing) return
    setSelectedPackId(null)
    setQueue([])
    setQueueIndex(0)
    setRevealed(false)
  }

  const resetCollection = () => {
    if (!window.confirm('Очистить коллекцию и историю наборов этого сейва? Счётчик открытий не сбросится, поэтому старые дропы нельзя будет переиграть.')) return
    onClear()
    setQueue([])
    setSelectedPackId(null)
  }

  const aliasCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of viewState.inventory) {
      const key = cardKey(card)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [viewState.inventory])

  const collection = useMemo(() => {
    const seen = new Set<string>()
    return viewState.inventory.filter((card) => {
      const key = card.alias.toLocaleLowerCase('en-US')
      if (seen.has(key)) return false
      seen.add(key)
      if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false
      const needle = query.trim().toLocaleLowerCase('ru-RU')
      if (!needle) return true
      return [card.alias, card.realName ?? '', card.team, card.country ?? '']
        .some((value) => value.toLocaleLowerCase('ru-RU').includes(needle))
    })
  }, [viewState.inventory, query, rarityFilter])

  return (
    <section className="screen packs-screen fifa-packs-screen">
      <div className="fifa-screen-header">
        <div>
          <span>STORE &gt; PLAYER PACKS</span>
          <h1>PACK STORE</h1>
        </div>
        <div className="fifa-currency-large"><small>PACK TOKENS</small><b>{packTokens.toLocaleString('ru-RU')}</b></div>
      </div>

      <div className="pack-stats pack-stats-v2">
        <div><span>ОТКРЫТО</span><b>{stats.total}</b></div>
        <div><span>УНИКАЛЬНЫХ</span><b>{stats.unique}</b></div>
        <div><span>ДУБЛЕЙ</span><b>{stats.duplicates}</b></div>
        <div><span>ЛЕГЕНДАРНЫХ</span><b>{stats.legendary}</b></div>
        <div><span>ЛУЧШАЯ СИЛА</span><b>{stats.bestPower || '—'}</b></div>
        <div><span>ПУЛ</span><b>{PACK_POOL_STATS.totalPlayers.toLocaleString('ru-RU')}</b></div>
      </div>

      <div className="pack-shelf fifa-pack-shelf">
        {PACKS.map((pack) => (
          <article className={'pack-box pack-' + pack.id} key={pack.id} style={{ '--pack-accent': pack.accent } as React.CSSProperties}>
            <PackArtwork variant={pack.id} title={pack.name} kicker={pack.eyebrow} />
            <div className="pack-box-glow" />
            <span>{pack.eyebrow}</span>
            <h2>{pack.name}</h2>
            <p>{pack.description}</p>
            <div className="pack-odds">
              <span><i style={{ background: RARITY_COLOR.rare }} /> Редкая {pack.weights.rare}%</span>
              <span><i style={{ background: RARITY_COLOR.epic }} /> Эпическая {pack.weights.epic}%</span>
              <span><i style={{ background: RARITY_COLOR.legendary }} /> Легендарная {pack.weights.legendary}%</span>
            </div>
            <button className="fifa-primary-cta" onClick={() => openPurchase(pack.id as Exclude<PackId, 'welcome'>)}>
              КУПИТЬ ПАК <span>→</span>
            </button>
            <small className="pack-box-price">{pack.price} TOKENS</small>
          </article>
        ))}
      </div>

      <div className="collection-head fifa-collection-head">
        <div>
          <div className="eyebrow">MY CLUB · {stats.total}</div>
          <h2>PLAYER COLLECTION</h2>
        </div>
        {stats.total > 0 && <button className="text-button release" onClick={resetCollection}>Очистить коллекцию</button>}
      </div>

      {viewState.inventory.length > 0 && (
        <div className="collection-tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ник, имя, команда или страна"
            aria-label="Поиск по коллекции"
          />
          <div className="collection-filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={rarityFilter === filter.value ? 'active' : ''}
                onClick={() => setRarityFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewState.inventory.length ? (
        collection.length ? (
          <div className="collection-grid">
            {collection.map((card) => (
              <CollectionCard
                card={card}
                count={aliasCounts.get(cardKey(card)) ?? 1}
                onOpen={() => setSelectedCard(card)}
                key={cardKey(card)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state pack-empty"><span>НИЧЕГО НЕ НАЙДЕНО</span><h2>Попробуй другой фильтр.</h2></div>
        )
      ) : (
        <div className="empty-state pack-empty"><span>ПОКА НЕТ КАРТ</span><h2>Твой первый набор уже ждёт.</h2></div>
      )}

      {selectedPack && (
        <div className="pack-purchase-backdrop" role="presentation" onMouseDown={closeSpin}>
          <section className={'pack-purchase-modal ' + (spinning ? 'is-spinning' : '') + (revealed ? 'is-revealed' : '')} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="pack-purchase-close" onClick={closeSpin} disabled={spinning || preparing} aria-label="Закрыть">×</button>

            {!queue.length ? (
              <>
                <div className="pack-purchase-head">
                  <span>PLAYER PACK</span>
                  <h2>{selectedPack.name}</h2>
                  <p>{selectedPack.description}</p>
                </div>

                <div className="pack-purchase-art"><PackArtwork variant={selectedPack.id} title={selectedPack.name} kicker={selectedPack.eyebrow} /></div>

                <div className="pack-fast-row">
                  {QUANTITIES.map((count) => (
                    <button key={count} className={quantity === count ? 'active' : ''} onClick={() => setQuantity(count)}>×{count}</button>
                  ))}
                </div>

                <button className="pack-spin-button" disabled={preparing || packTokens < selectedPack.price * quantity} onClick={spin}>
                  {preparing ? 'ПОДГОТОВКА' : 'КРУТИТЬ'}
                </button>
                <div className="pack-spin-price">{(selectedPack.price * quantity).toLocaleString('ru-RU')} PACK TOKENS</div>
                {packTokens < selectedPack.price * quantity && <small className="pack-token-warning">Недостаточно Pack Tokens</small>}
              </>
            ) : (
              <>
                <div className="pack-spin-topline">
                  <span>{selectedPack.name}</span>
                  <b>{queueIndex + 1}/{queue.length}</b>
                </div>

                <div className="pack-reel-window pack-reel-modal">
                  <div className="pack-center-line"><i /></div>
                  {roll && (
                    <div
                      className="pack-reel-track"
                      style={{
                        '--winner-index': roll.winnerIndex,
                        '--spin-ms': SPIN_MS + 'ms',
                      } as React.CSSProperties}
                    >
                      {roll.reel.map((card, index) => <ReelCard key={card.id} card={card} winner={revealed && index === roll.winnerIndex} />)}
                    </div>
                  )}
                </div>

                <div className="pack-spin-controls">
                  {spinning && <button className="text-button" onClick={skip}>ПРОПУСТИТЬ</button>}
                </div>

                {roll && revealed && (
                  <>
                    <WinnerReveal card={roll.winner} duplicate={duplicate} onOpen={() => setSelectedCard(roll.winner)} />
                    <div className="pack-reveal-actions">
                      {queueIndex < queue.length - 1
                        ? <button className="fifa-primary-cta" onClick={nextRoll} disabled={preparing}>{preparing ? 'ПОДГОТОВКА' : 'СЛЕДУЮЩИЙ ДРОП'} <span>→</span></button>
                        : <button className="fifa-primary-cta" onClick={closeSpin}>ГОТОВО <span>→</span></button>}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {selectedCard && <CardDetails card={selectedCard} playerState={selectedPlayer} onClose={() => setSelectedCard(null)} />}
    </section>
  )
}
