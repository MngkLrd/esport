import { useEffect, useMemo, useState } from 'react'
import {
  PACKS,
  PACK_POOL_STATS,
  RARITY_COLOR,
  RARITY_LABEL,
  hydratePackState,
  rollPack,
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
import { PlayerPortrait } from './PlayerPortrait'
import type { Player } from './game'

const SPIN_MS = 5200

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
        <PlayerPortrait alias={card.alias} alt={card.alias} draggable={false} />
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
        <PlayerPortrait alias={card.alias} alt={card.alias} loading="lazy" />
      </div>
      <div className="collection-identity">
        <strong>{card.alias}</strong>
        <span>{countryFlag(card.country ?? 'Неизвестно')} {card.team}</span>
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
  credits,
  saveId,
  packState,
  roster,
  onOpen,
  onClear,
}: {
  credits: number
  saveId: string
  packState: PackState
  roster: Player[]
  onOpen: (roll: PackRoll) => boolean
  onClear: () => void
}) {
  const [roll, setRoll] = useState<PackRoll | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [query, setQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState<'all' | PackRarity>('all')
  const [selectedCard, setSelectedCard] = useState<PackCard | null>(null)
  const viewState = useMemo(() => hydratePackState(packState), [packState])
  const stats = useMemo(() => packCollectionStats(viewState), [viewState])
  const selectedPlayer = selectedCard
    ? roster.find((player) => player.acquiredCardId === selectedCard.id || player.playerKey === selectedCard.playerKey || player.alias.toLowerCase() === selectedCard.alias.toLowerCase())
    : undefined

  useEffect(() => {
    if (!spinning) return
    const timer = window.setTimeout(() => {
      setSpinning(false)
      setRevealed(true)
    }, SPIN_MS)
    return () => window.clearTimeout(timer)
  }, [spinning, roll])

  const openPack = (packId: Exclude<PackId, 'welcome'>) => {
    if (spinning) return
    const pack = PACKS.find((item) => item.id === packId)
    if (!pack || credits < pack.price) return

    const nextRoll = rollPack(packId, packState.serial, saveId)
    const isDuplicate = packCardCount(viewState, nextRoll.winner) > 0
    if (!onOpen(nextRoll)) return

    setRoll(nextRoll)
    setDuplicate(isDuplicate)
    setRevealed(false)
    setSpinning(true)
  }

  const skip = () => {
    if (!spinning) return
    setSpinning(false)
    setRevealed(true)
  }

  const resetCollection = () => {
    if (!window.confirm('Очистить коллекцию и историю наборов этого сейва? Счётчик открытий не сбросится, поэтому старые дропы нельзя будет переиграть.')) return
    onClear()
    setRoll(null)
    setSpinning(false)
    setRevealed(false)
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
    <section className="screen packs-screen">
      <div className="section-title">
        <div>
          <div className="eyebrow">ЛАБОРАТОРИЯ НАБОРОВ · {PACK_POOL_STATS.totalPlayers.toLocaleString('ru-RU')} ИГРОКОВ В ПУЛЕ</div>
          <h1>Открой следующий дроп.</h1>
        </div>
        <p>Дропы, кредиты и коллекция живут внутри этого сейва.</p>
      </div>

      <div className="pack-stats pack-stats-v2">
        <div><span>ОТКРЫТО</span><b>{stats.total}</b></div>
        <div><span>УНИКАЛЬНЫХ</span><b>{stats.unique}</b></div>
        <div><span>ДУБЛЕЙ</span><b>{stats.duplicates}</b></div>
        <div><span>ЛЕГЕНДАРНЫХ</span><b>{stats.legendary}</b></div>
        <div><span>ЛУЧШАЯ СИЛА</span><b>{stats.bestPower || '—'}</b></div>
        <div><span>КРЕДИТЫ</span><b>{credits.toLocaleString('ru-RU')}</b></div>
      </div>

      <div className="pack-shelf">
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
            <button className="primary" disabled={spinning || credits < pack.price} onClick={() => openPack(pack.id as Exclude<PackId, 'welcome'>)}>
              {spinning ? 'Открывается…' : 'Открыть · ' + pack.price + ' кр.'}
            </button>
          </article>
        ))}
      </div>

      <div className={'pack-stage ' + (spinning ? 'is-spinning' : '') + (revealed ? 'is-revealed' : '')}>
        <div className="pack-stage-head">
          <div>
            <span>ОТКРЫТИЕ НАБОРА</span>
            <strong>{roll ? roll.pack.name : 'Выбери набор выше'}</strong>
          </div>
          <div className="pack-stage-actions">
            {spinning && <button className="text-button" onClick={skip}>Пропустить</button>}
            {roll && <b style={{ color: RARITY_COLOR[roll.winner.rarity] }}>{revealed ? RARITY_LABEL[roll.winner.rarity] : 'КРУТИТСЯ'}</b>}
          </div>
        </div>

        <div className="pack-reel-window">
          <div className="pack-center-line"><i /></div>
          {roll ? (
            <div
              className="pack-reel-track"
              style={{
                '--winner-index': roll.winnerIndex,
                '--spin-ms': SPIN_MS + 'ms',
              } as React.CSSProperties}
            >
              {roll.reel.map((card, index) => <ReelCard key={card.id} card={card} winner={revealed && index === roll.winnerIndex} />)}
            </div>
          ) : (
            <div className="pack-reel-placeholder">ВЫБЕРИ НАБОР, ЧТОБЫ ЗАПУСТИТЬ ЛЕНТУ</div>
          )}
        </div>

        {roll && revealed && (
          <>
            <WinnerReveal card={roll.winner} duplicate={duplicate} onOpen={() => setSelectedCard(roll.winner)} />
            <div className="pack-winner-actions pack-reopen">
              <button className="secondary" onClick={() => openPack(roll.pack.id as Exclude<PackId, 'welcome'>)} disabled={credits < roll.pack.price}>
                Открыть ещё · {roll.pack.price} кр.
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pack-rating-note">
        <div>
          <span>КАРТОЧКИ · ФОРМА ИГРОКА</span>
          <strong>Базовая сила карты и текущая форма — разные вещи.</strong>
        </div>
        <p>
          Карточка определяет базовые характеристики игрока. Результаты матчей и решения менеджера меняют состояние состава отдельно.
        </p>
      </div>

      {viewState.history.length > 0 && (
        <div className="pack-history">
          <span>ПОСЛЕДНИЕ ДРОПЫ</span>
          <div>
            {viewState.history.slice(0, 8).map((card) => (
              <b key={card.id} style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}>
                {card.power} · {card.alias}
              </b>
            ))}
          </div>
        </div>
      )}

      <div className="collection-head">
        <div>
          <div className="eyebrow">МОИ КАРТЫ · {stats.total}</div>
          <h2>Коллекция</h2>
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
          <div className="empty-state pack-empty">
            <span>НИЧЕГО НЕ НАЙДЕНО</span>
            <h2>Попробуй другой фильтр.</h2>
          </div>
        )
      ) : (
        <div className="empty-state pack-empty">
          <span>ПОКА НЕТ КАРТ</span>
          <h2>Твой первый набор уже ждёт.</h2>
          <p>Карты принадлежат текущему сейву клуба и сохраняются вместе с его экономикой.</p>
        </div>
      )}
      {selectedCard && <CardDetails card={selectedCard} playerState={selectedPlayer} onClose={() => setSelectedCard(null)} />}
    </section>
  )
}
