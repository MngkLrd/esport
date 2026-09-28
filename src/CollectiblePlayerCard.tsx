import type { DragEvent, ReactNode } from 'react'
import { PlayerPortrait } from './PlayerPortrait'
import { countryFlag } from './playerVisuals'

export type CollectibleCardTier = 'silver' | 'rare' | 'elite' | 'gold'

export const tierForPackRarity = (rarity: string): CollectibleCardTier => {
  if (rarity === 'legendary') return 'gold'
  if (rarity === 'epic') return 'elite'
  if (rarity === 'common') return 'silver'
  return 'rare'
}

const shortRole = (role: string | null | undefined) => {
  if (!role) return 'PRO'
  if (role === 'Rifler') return 'RIF'
  if (role === 'Support') return 'SUP'
  if (role === 'Entry') return 'ENT'
  return role.toUpperCase()
}

export function CollectiblePlayerCard({
  rating,
  tier,
  role,
  alias,
  team,
  country,
  profileId,
  stats,
  liveState,
  starter = false,
  draggable = false,
  onOpen,
  onDragStart,
  onDragEnd,
  className = '',
  loading = 'lazy',
  badge,
}: {
  rating: number
  tier: CollectibleCardTier
  role?: string | null
  alias: string
  team?: string | null
  country?: string | null
  profileId?: number | null
  stats?: { aim: number; utility: number; positioning: number; clutch: number } | null
  liveState?: { form: number; morale: number; fatigue: number } | null
  starter?: boolean
  draggable?: boolean
  onOpen?: () => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  className?: string
  loading?: 'eager' | 'lazy'
  badge?: ReactNode
}) {
  const safeCountry = country || '—'

  return (
    <button
      type="button"
      className={'visual-player-card compact collectible-player-card tier-' + tier + (starter ? ' is-starter' : '') + (className ? ' ' + className : '')}
      onClick={onOpen}
      aria-label={'Select ' + alias}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="visual-card-shine" />
      <div className="visual-card-top">
        <div><strong>{rating}</strong><span>{shortRole(role)}</span></div>
        {starter && <b className="starter-star">★</b>}
      </div>
      <div className="visual-country">{countryFlag(safeCountry)} <span>{safeCountry}</span></div>
      {badge && <div className="collectible-card-badge">{badge}</div>}
      <div className="visual-photo">
        <div className="visual-monogram">{alias.slice(0, 3).toUpperCase()}</div>
        <PlayerPortrait
          alias={alias}
          playerId={profileId}
          alt={alias}
          loading={loading}
          draggable={false}
        />
      </div>
      <div className="visual-identity">
        <strong>{alias}</strong>
        <span>{team || 'FREE AGENT'}</span>
      </div>
      {stats && (
        <div className="visual-stats">
          <span><b>{stats.aim}</b>AIM</span>
          <span><b>{stats.utility}</b>UTL</span>
          <span><b>{stats.positioning}</b>POS</span>
          <span><b>{stats.clutch}</b>CLU</span>
        </div>
      )}
      {liveState && (
        <div className="visual-live-state">
          <span><b>{liveState.form}</b>FORM</span>
          <span><b>{liveState.morale}</b>MOR</span>
          <span className={liveState.fatigue >= 65 ? 'danger' : ''}><b>{liveState.fatigue}</b>FAT</span>
        </div>
      )}
    </button>
  )
}
