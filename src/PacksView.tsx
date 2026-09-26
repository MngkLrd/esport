import { useEffect, useMemo, useState } from 'react'
import {
  PACKS,
  PACK_POOL_STATS,
  RARITY_COLOR,
  RARITY_LABEL,
  collectPackWinner,
  createPackState,
  migratePackState,
  packCollectionStats,
  rollPack,
  type PackCard,
  type PackId,
  type PackRoll,
  type PackState,
} from './packs'
import { countryFlag, playerPhoto } from './playerVisuals'

const PACK_SAVE_KEY = 'esport-ai-manager-packs-v1'
const SPIN_MS = 5200

const loadPackState = (): PackState => {
  try {
    const raw = localStorage.getItem(PACK_SAVE_KEY)
    return raw ? migratePackState(JSON.parse(raw)) : createPackState()
  } catch {
    return createPackState()
  }
}

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

function CollectionCard({ card }: { card: PackCard }) {
  const photo = playerPhoto(card.alias)
  return (
    <article className={'collection-card rarity-' + card.rarity} style={{ '--rarity': RARITY_COLOR[card.rarity] } as React.CSSProperties}>
      <div className="collection-card-top">
        <b>{card.power}</b>
        <span>{card.role ?? 'PRO'}</span>
      </div>
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
        <span>{countryFlag(card.country ?? 'Unknown')} {card.team}</span>
      </div>
      <div className="collection-rarity">{RARITY_LABEL[card.rarity]}</div>
    </article>
  )
}

export function PacksView({ credits, onSpend }: { credits: number; onSpend: (amount: number) => void }) {
  const [packState, setPackState] = useState<PackState>(loadPackState)
  const [roll, setRoll] = useState<PackRoll | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const stats = useMemo(() => packCollectionStats(packState), [packState])

  useEffect(() => {
    localStorage.setItem(PACK_SAVE_KEY, JSON.stringify(packState))
  }, [packState])

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

    const nextRoll = rollPack(packId, packState.serial)
    onSpend(pack.price)
    setPackState((current) => collectPackWinner(current, nextRoll.winner))
    setRoll(nextRoll)
    setRevealed(false)
    setSpinning(true)
  }

  const resetCollection = () => {
    if (!window.confirm('Clear only the pack collection and pack history? Club save stays untouched.')) return
    setPackState(createPackState())
    setRoll(null)
    setSpinning(false)
    setRevealed(false)
  }

  return (
    <section className="screen packs-screen">
      <div className="section-title">
        <div>
          <div className="eyebrow">PACK LAB · {PACK_POOL_STATS.totalPlayers.toLocaleString('en-US')} PLAYER POOL</div>
          <h1>Open cards, chase names, build a collection.</h1>
        </div>
        <p>The result is selected before the animation starts. The reel only reveals it — no fake last-frame rerolls.</p>
      </div>

      <div className="pack-stats">
        <div><span>OPENED</span><b>{stats.total}</b></div>
        <div><span>UNIQUE</span><b>{stats.unique}</b></div>
        <div><span>EPIC</span><b>{stats.epic}</b></div>
        <div><span>LEGENDARY</span><b>{stats.legendary}</b></div>
        <div><span>CREDITS</span><b>{credits.toLocaleString('en-US')}</b></div>
      </div>

      <div className="pack-shelf">
        {PACKS.map((pack) => (
          <article className={'pack-box pack-' + pack.id} key={pack.id} style={{ '--pack-accent': pack.accent } as React.CSSProperties}>
            <div className="pack-box-glow" />
            <span>{pack.eyebrow}</span>
            <h2>{pack.name}</h2>
            <p>{pack.description}</p>
            <div className="pack-odds">
              <span><i style={{ background: RARITY_COLOR.rare }} /> Rare {pack.weights.rare}%</span>
              <span><i style={{ background: RARITY_COLOR.epic }} /> Epic {pack.weights.epic}%</span>
              <span><i style={{ background: RARITY_COLOR.legendary }} /> Legend {pack.weights.legendary}%</span>
            </div>
            <button className="primary" disabled={spinning || credits < pack.price} onClick={() => openPack(pack.id)}>
              {spinning ? 'Opening…' : 'Open · ' + pack.price + ' cr'}
            </button>
          </article>
        ))}
      </div>

      <div className={'pack-stage ' + (spinning ? 'is-spinning' : '') + (revealed ? 'is-revealed' : '')}>
        <div className="pack-stage-head">
          <div>
            <span>CASE OPENING</span>
            <strong>{roll ? roll.pack.name : 'Choose a pack above'}</strong>
          </div>
          {roll && <b style={{ color: RARITY_COLOR[roll.winner.rarity] }}>{revealed ? RARITY_LABEL[roll.winner.rarity] : 'ROLLING'}</b>}
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
            <div className="pack-reel-placeholder">SELECT A PACK TO LOAD THE REEL</div>
          )}
        </div>

        {roll && revealed && (
          <div className="pack-winner">
            <div>
              <span>NEW CARD #{roll.winner.serial + 1}</span>
              <h2>{roll.winner.alias}</h2>
              <p>
                {roll.winner.realName ?? 'Identity metadata pending'} · {roll.winner.team} · power {roll.winner.power}
                {roll.winner.sourceRank ? ' · VRS team rank #' + roll.winner.sourceRank : ''}
              </p>
            </div>
            <div className="pack-winner-actions">
              <button className="secondary" onClick={() => openPack(roll.pack.id)} disabled={credits < roll.pack.price}>Open again · {roll.pack.price}</button>
            </div>
          </div>
        )}
      </div>

      <div className="collection-head">
        <div>
          <div className="eyebrow">MY CARDS · {stats.total}</div>
          <h2>Collection</h2>
        </div>
        {stats.total > 0 && <button className="text-button release" onClick={resetCollection}>Clear collection</button>}
      </div>

      {packState.inventory.length ? (
        <div className="collection-grid">
          {packState.inventory.map((card) => <CollectionCard card={card} key={card.id} />)}
        </div>
      ) : (
        <div className="empty-state pack-empty">
          <span>NO CARDS YET</span>
          <h2>Your first pack is waiting.</h2>
          <p>Cards are separate from the signed roster for now, so opening packs cannot silently mutate the competitive lineup.</p>
        </div>
      )}
    </section>
  )
}
