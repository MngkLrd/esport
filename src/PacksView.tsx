import { useEffect, useMemo, useState } from 'react'
import {
  PACKS,
  RARITY_LABEL,
  hydratePackState,
  packPoolCount,
  packPoolPreview,
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
import { preloadPlayerPortraits } from './PlayerPortrait'
import type { Player } from './game'
import { CollectiblePlayerCard, tierForPackRarity } from './CollectiblePlayerCard'

const SPIN_MS = 6000
const QUANTITIES = [1, 3, 5, 10] as const
const PREVIEW_RARITIES: PackRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']

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

function packStats(card: PackCard) {
  return card.cardStats
    ? {
        aim: card.cardStats.aim,
        utility: card.cardStats.utility,
        positioning: card.cardStats.positioning,
        clutch: card.cardStats.clutch,
      }
    : null
}

function ReelCard({ card, winner = false }: { card: PackCard; winner?: boolean }) {
  return (
    <div className={'pack-reel-card shared-card-reel rarity-' + card.rarity + (winner ? ' is-winner' : '')}>
      <CollectiblePlayerCard
        rating={card.power}
        tier={tierForPackRarity(card.rarity)}
        role={card.role}
        alias={card.alias}
        team={card.team}
        country={card.country}
        profileId={card.profileId}
        stats={packStats(card)}
        loading="eager"
        className="pack-shared-card"
        badge={RARITY_LABEL[card.rarity]}
      />
    </div>
  )
}

function CollectionCard({ card, count, onOpen }: { card: PackCard; count: number; onOpen: () => void }) {
  return (
    <div className={'collection-card-shell rarity-' + card.rarity}>
      <CollectiblePlayerCard
        rating={card.power}
        tier={tierForPackRarity(card.rarity)}
        role={card.role}
        alias={card.alias}
        team={card.team}
        country={card.country}
        profileId={card.profileId}
        stats={packStats(card)}
        onOpen={onOpen}
        className="collection-shared-card"
        badge={RARITY_LABEL[card.rarity]}
      />
      <div className="collection-edition-shared">{card.edition}</div>
      {count > 1 && <div className="collection-count-shared">×{count}</div>}
    </div>
  )
}

function WinnerReveal({ card, duplicate, onOpen }: { card: PackCard; duplicate: boolean; onOpen: () => void }) {
  return (
    <div className={'pack-reveal shared-pack-reveal rarity-' + card.rarity}>
      <div className="pack-reveal-beam beam-one" />
      <div className="pack-reveal-beam beam-two" />
      <div className="pack-reveal-grid" />

      <div className="pack-reveal-card-shared">
        <CollectiblePlayerCard
          rating={card.power}
          tier={tierForPackRarity(card.rarity)}
          role={card.role}
          alias={card.alias}
          team={card.team}
          country={card.country}
          profileId={card.profileId}
          stats={packStats(card)}
          onOpen={onOpen}
          loading="eager"
          className="winner-shared-card"
          badge={RARITY_LABEL[card.rarity]}
        />
      </div>

      <div className="pack-reveal-copy">
        <div className="eyebrow">{RARITY_LABEL[card.rarity]}</div>
        <h2>{card.alias}</h2>
        <p>{card.realName ? card.realName + ' · ' : ''}{card.team}</p>
        <div className="pack-reveal-meta">
          <span><b>{countryFlag(card.country ?? 'Неизвестно')}</b> {card.country}</span>
          <span><b>{duplicate ? 'ДУБЛЬ' : 'НОВАЯ'}</b> {duplicate ? 'уже есть в коллекции' : 'новая для коллекции'}</span>
        </div>
      </div>
    </div>
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
  const [section, setSection] = useState<'store' | 'collection'>('store')
  const [selectedPackId, setSelectedPackId] = useState<Exclude<PackId, 'welcome'> | null>(null)
  const [focusedPackId, setFocusedPackId] = useState<Exclude<PackId, 'welcome'>>('challenger')
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
  const focusedPack = PACKS.find((item) => item.id === focusedPackId) ?? PACKS[0]
  const roll = queue[queueIndex] ?? null
  const selectedPlayer = selectedCard
    ? roster.find((player) => player.acquiredCardId === selectedCard.id || player.playerKey === selectedCard.playerKey || player.alias.toLowerCase() === selectedCard.alias.toLowerCase())
    : undefined

  const duplicate = useMemo(() => {
    if (!roll) return false
    if (packCardCount(viewState, roll.winner) > 0) return true
    return queue.slice(0, queueIndex).some((entry) => entry.winner.alias.toLowerCase() === roll.winner.alias.toLowerCase())
  }, [roll, queue, queueIndex, viewState])

  const poolPreview = useMemo(() => {
    if (!selectedPack) return []
    return PREVIEW_RARITIES
      .filter((rarity) => selectedPack.weights[rarity] > 0)
      .map((rarity) => {
        const cards = packPoolPreview(rarity, 3)
        const total = packPoolCount(rarity)
        return {
          rarity,
          cards,
          total,
          hidden: Math.max(0, total - cards.length),
          chance: selectedPack.weights[rarity],
        }
      })
  }, [selectedPack])

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
    <section className="sim-screen sim-packs">
      <div className="sim-subnav">
        <button className={section === 'store' ? 'active' : ''} onClick={() => setSection('store')}>PACKS</button>
        <button className={section === 'collection' ? 'active' : ''} onClick={() => setSection('collection')}>
          COLLECTION <span>{stats.unique}</span>
        </button>
      </div>

      {section === 'store' ? (
        <div className="sim-pack-store">
          <section className="sim-pack-hero" style={{ '--pack-accent': focusedPack.accent } as React.CSSProperties}>
            <div className="sim-pack-hero-art"><PackArtwork variant={focusedPack.id} title={focusedPack.name} kicker={focusedPack.eyebrow} /></div>
            <div className="sim-pack-hero-copy">
              <span>{focusedPack.eyebrow}</span>
              <h2>{focusedPack.name}</h2>
              <p>{focusedPack.description}</p>
              <div className="sim-pack-odds">
                <div><small>RARE</small><b>{focusedPack.weights.rare}%</b></div>
                <div><small>EPIC</small><b>{focusedPack.weights.epic}%</b></div>
                <div><small>LEGENDARY</small><b>{focusedPack.weights.legendary}%</b></div>
              </div>
              <div className="sim-pack-price"><small>PRICE</small><strong>{focusedPack.price.toLocaleString('ru-RU')}</strong><span>PACK TOKENS</span></div>
              <button className="sim-primary-action" onClick={() => openPurchase(focusedPack.id as Exclude<PackId, 'welcome'>)}>
                OPEN PACK <span>→</span>
              </button>
            </div>
          </section>
          <aside className="sim-pack-selector" aria-label="Pack catalog">
            {PACKS.map((pack) => (
              <button
                key={pack.id}
                className={focusedPack.id === pack.id ? 'active' : ''}
                style={{ '--pack-accent': pack.accent } as React.CSSProperties}
                onClick={() => setFocusedPackId(pack.id as Exclude<PackId, 'welcome'>)}
              >
                <div className="sim-pack-selector-art">
                  <PackArtwork variant={pack.id} title={pack.name} kicker={pack.eyebrow} />
                </div>
                <span className="sim-pack-selector-copy">
                  <b>{pack.name}</b>
                  <small>{pack.eyebrow}</small>
                </span>
                <strong className="sim-pack-selector-price">
                  {pack.price.toLocaleString('ru-RU')}
                  <small>PACK TOKENS</small>
                </strong>
              </button>
            ))}
          </aside>
        </div>
      ) : (
        <div className="sim-collection">
          <div className="sim-collection-tools">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ник, команда или страна"
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
            {stats.total > 0 && <button className="text-button release pack-clear" onClick={resetCollection}>Очистить</button>}
          </div>

          <div className="sim-collection-scroll">
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
                <div className="empty-state pack-empty"><span>НИЧЕГО НЕ НАЙДЕНО</span><h2>Смени фильтр.</h2></div>
              )
            ) : (
              <div className="empty-state pack-empty"><span>ПОКА НЕТ КАРТ</span><h2>Открой первый пак.</h2></div>
            )}
          </div>
        </div>
      )}

      {selectedPack && (
        <div className="pack-purchase-backdrop" role="presentation" onMouseDown={closeSpin}>
          <section className={'pack-purchase-modal ' + (spinning ? 'is-spinning' : '') + (revealed ? 'is-revealed' : '')} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="pack-purchase-close" onClick={closeSpin} disabled={spinning || preparing} aria-label="Закрыть">×</button>

            {!queue.length ? (
              <>
                <div className="pack-purchase-toolbar">
                  <div className="pack-fast-row">
                    {QUANTITIES.map((count) => (
                      <button key={count} className={quantity === count ? 'active' : ''} onClick={() => setQuantity(count)}>×{count}</button>
                    ))}
                  </div>

                  <button className="pack-spin-button" disabled={preparing || packTokens < selectedPack.price * quantity} onClick={spin}>
                    {preparing ? 'ПОДГОТОВКА' : 'КРУТИТЬ'}
                  </button>

                  <div className="pack-purchase-cost">
                    <b>{(selectedPack.price * quantity).toLocaleString('ru-RU')}</b>
                    <span>PACK TOKENS</span>
                    {packTokens < selectedPack.price * quantity && <small className="pack-token-warning">Недостаточно Pack Tokens</small>}
                  </div>
                </div>

                <div className="pack-pool-preview">
                  <div className="pack-pool-preview-head">
                    <div>
                      <span>ИГРОКИ В ПУЛЕ</span>
                      <strong>Кого можно выбить</strong>
                    </div>
                    <small>Показываем по 3 примера каждой редкости. Остальной пул не ограничен.</small>
                  </div>

                  <div className="pack-pool-groups">
                    {poolPreview.map(({ rarity, cards, total, hidden, chance }) => (
                      <section className={'pack-pool-group rarity-' + rarity} key={rarity}>
                        <header>
                          <div>
                            <b>{RARITY_LABEL[rarity]}</b>
                            <span>{chance}% DROP</span>
                          </div>
                          <small>{total} игроков</small>
                        </header>

                        <div className="pack-pool-row">
                          {cards.map((card) => (
                            <CollectiblePlayerCard
                              key={card.id}
                              rating={card.power}
                              tier={tierForPackRarity(card.rarity)}
                              role={card.role}
                              alias={card.alias}
                              team={card.team}
                              country={card.country}
                              profileId={card.profileId}
                              stats={packStats(card)}
                              className="pack-pool-preview-card"
                              badge={RARITY_LABEL[card.rarity]}
                            />
                          ))}
                          {hidden > 0 && (
                            <div className={'pack-pool-more rarity-' + rarity}>
                              <strong>+{hidden}</strong>
                              <span>ИГРОКОВ</span>
                              <small>{RARITY_LABEL[rarity]}</small>
                            </div>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

              </>
            ) : (
              <>
                <div className="pack-spin-topline">
                  <span>ОТКРЫТИЕ</span>
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
