import { useEffect, useMemo, useState } from 'react'
import {
  PACKS,
  PACK_POOL_STATS,
  RARITY_COLOR,
  RARITY_LABEL,
  packAliasCount,
  packCollectionStats,
  rollPack,
  type PackCard,
  type PackId,
  type PackRarity,
  type PackRoll,
  type PackState,
} from './packs'
import { countryFlag, playerPhoto } from './playerVisuals'

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
  const photo = playerPhoto(card.alias)
  return (
    <div
      className={'pack-reel-card rarity-' + card.rarity + (winner ? ' is-winner' : '')}
      style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}
    >
      <div className="pack-reel-power">{card.power}</div>
      <div className="pack-reel-photo">
        <span>{card.alias.slice(0, 2).toUpperCase()}</span>
        {photo && (
          <img
            src={photo}
            alt={card.alias}
            draggable={false}
            referrerPolicy="no-referrer"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
      </div>
      <strong>{card.alias}</strong>
      <small>{card.team}</small>
      <i>{RARITY_LABEL[card.rarity]}</i>
    </div>
  )
}

function CollectionCard({ card, count }: { card: PackCard; count: number }) {
  const photo = playerPhoto(card.alias)
  return (
    <article className={'collection-card rarity-' + card.rarity} style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}>
      <div className="collection-card-top">
        <b>{card.power}</b>
        <span>{card.role ? ROLE_LABELS[card.role] : 'ПРО'}</span>
      </div>
      {count > 1 && <div className="collection-count">×{count}</div>}
      <div className="collection-photo">
        <span>{card.alias.slice(0, 3).toUpperCase()}</span>
        {photo && (
          <img
            src={photo}
            alt={card.alias}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
      </div>
      <div className="collection-identity">
        <strong>{card.alias}</strong>
        <span>{countryFlag(card.country ?? 'Неизвестно')} {card.team}</span>
      </div>
      <div className="collection-rarity">{RARITY_LABEL[card.rarity]}</div>
    </article>
  )
}

function WinnerReveal({ card, duplicate }: { card: PackCard; duplicate: boolean }) {
  const photo = playerPhoto(card.alias)
  const source = card.sourceRating != null
    ? 'rating seed ' + card.sourceRating.toFixed(2)
    : card.sourceRank
      ? 'VRS rank #' + card.sourceRank
      : 'VRS long-tail'

  return (
    <div
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
        </div>
        <div className="pack-reveal-country">{countryFlag(card.country ?? 'Неизвестно')}</div>
        <div className="pack-reveal-photo">
          <span>{card.alias.slice(0, 3).toUpperCase()}</span>
          {photo && (
            <img
              src={photo}
              alt={card.alias}
              referrerPolicy="no-referrer"
              onError={(event) => { event.currentTarget.style.display = 'none' }}
            />
          )}
        </div>
        <div className="pack-reveal-name">
          <strong>{card.alias}</strong>
          <span>{card.team}</span>
        </div>
      </div>

      <div className="pack-reveal-copy">
        <div className="eyebrow">{RARITY_LABEL[card.rarity]} · КАРТА #{card.serial + 1}</div>
        <h2>{card.alias}</h2>
        <p>{card.realName ?? 'Данные профиля пока не найдены'} · {card.team}</p>
        <div className="pack-reveal-meta">
          <span><b>{card.power}</b> сила / 100</span>
          <span><b>{countryFlag(card.country ?? 'Неизвестно')}</b> {card.country ?? 'Страна неизвестна'}</span>
          <span><b>{duplicate ? 'ДУБЛЬ' : 'НОВАЯ'}</b> {duplicate ? 'уже есть в коллекции' : 'новая для коллекции'}</span>
          <span><b>ИСТОЧНИК</b> {source}</span>
        </div>
      </div>
    </div>
  )
}

export function PacksView({
  credits,
  saveId,
  packState,
  onOpen,
  onClear,
}: {
  credits: number
  saveId: string
  packState: PackState
  onOpen: (roll: PackRoll) => boolean
  onClear: () => void
}) {
  const [roll, setRoll] = useState<PackRoll | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [query, setQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState<'all' | PackRarity>('all')
  const stats = useMemo(() => packCollectionStats(packState), [packState])

  useEffect(() => {
    if (!spinning) return
    const timer = window.setTimeout(() => {
      setSpinning(false)
      setRevealed(true)
    }, SPIN_MS)
    return () => window.clearTimeout(timer)
  }, [spinning, roll])

  const openPack = (packId: PackId) => {
    if (spinning) return
    const pack = PACKS.find((item) => item.id === packId)
    if (!pack || credits < pack.price) return

    const nextRoll = rollPack(packId, packState.serial, saveId)
    const isDuplicate = packAliasCount(packState, nextRoll.winner.alias) > 0
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
    for (const card of packState.inventory) {
      const key = card.alias.toLocaleLowerCase('en-US')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [packState.inventory])

  const collection = useMemo(() => {
    const seen = new Set<string>()
    return packState.inventory.filter((card) => {
      const key = card.alias.toLocaleLowerCase('en-US')
      if (seen.has(key)) return false
      seen.add(key)
      if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false
      const needle = query.trim().toLocaleLowerCase('ru-RU')
      if (!needle) return true
      return [card.alias, card.realName ?? '', card.team, card.country ?? '']
        .some((value) => value.toLocaleLowerCase('ru-RU').includes(needle))
    })
  }, [packState.inventory, query, rarityFilter])

  return (
    <section className="screen packs-screen">
      <div className="section-title">
        <div>
          <div className="eyebrow">ЛАБОРАТОРИЯ НАБОРОВ · {PACK_POOL_STATS.totalPlayers.toLocaleString('ru-RU')} ИГРОКОВ В ПУЛЕ</div>
          <h1>Открытие теперь часть сейва, а не отдельная мини-игра.</h1>
        </div>
        <p>Покупка, результат и коллекция фиксируются вместе. Новый сейв получает собственную последовательность дропов.</p>
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
            <div className="pack-box-glow" />
            <span>{pack.eyebrow}</span>
            <h2>{pack.name}</h2>
            <p>{pack.description}</p>
            <div className="pack-odds">
              <span><i style={{ background: RARITY_COLOR.rare }} /> Редкая {pack.weights.rare}%</span>
              <span><i style={{ background: RARITY_COLOR.epic }} /> Эпическая {pack.weights.epic}%</span>
              <span><i style={{ background: RARITY_COLOR.legendary }} /> Легендарная {pack.weights.legendary}%</span>
            </div>
            <button className="primary" disabled={spinning || credits < pack.price} onClick={() => openPack(pack.id)}>
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
            <WinnerReveal card={roll.winner} duplicate={duplicate} />
            <div className="pack-winner-actions pack-reopen">
              <button className="secondary" onClick={() => openPack(roll.pack.id)} disabled={credits < roll.pack.price}>
                Открыть ещё · {roll.pack.price} кр.
              </button>
            </div>
          </>
        )}
      </div>

      <div className="pack-rating-note">
        <div>
          <span>КАК СЧИТАЕТСЯ СИЛА 1–100</span>
          <strong>Это игровая шкала, а не официальный рейтинг игрока.</strong>
        </div>
        <p>
          Для профилей с индивидуальным rating используется формула <code>60 + (rating − 0.80) × 62</code> и стабильный
          модификатор ника от −3 до +3. Для остальных базовый диапазон задаёт место команды в VRS. В текущем пуле
          профессионалов фактический диапазон примерно 54–99.
        </p>
      </div>

      {packState.history.length > 0 && (
        <div className="pack-history">
          <span>ПОСЛЕДНИЕ ДРОПЫ</span>
          <div>
            {packState.history.slice(0, 8).map((card) => (
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

      {packState.inventory.length > 0 && (
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

      {packState.inventory.length ? (
        collection.length ? (
          <div className="collection-grid">
            {collection.map((card) => (
              <CollectionCard
                card={card}
                count={aliasCounts.get(card.alias.toLocaleLowerCase('en-US')) ?? 1}
                key={card.alias.toLocaleLowerCase('en-US')}
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
    </section>
  )
}
