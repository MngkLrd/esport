import type { ReactNode } from 'react'
import { PlayerPortrait } from './PlayerPortrait'
import { countryFlag } from './playerVisuals'

export function PlayerIdentity({
  alias,
  realName,
  country,
  team,
  role,
  profileId,
  size = 'md',
  trailing,
  className = '',
}: {
  alias: string
  realName?: string | null
  country?: string | null
  team?: string | null
  role?: string | null
  profileId?: number | null
  size?: 'sm' | 'md' | 'lg'
  trailing?: ReactNode
  className?: string
}) {
  return (
    <span className={'player-identity player-identity-' + size + (className ? ' ' + className : '')}>
      <span className="player-identity-photo">
        <PlayerPortrait alias={alias} playerId={profileId} alt={alias} />
      </span>
      <span className="player-identity-copy">
        <strong>{alias}</strong>
        <small>{countryFlag(country ?? '')} {country ?? 'INT'} · {role ?? 'PRO'}{team ? ' · ' + team : ''}</small>
        {realName && <em>{realName}</em>}
      </span>
      {trailing && <span className="player-identity-trailing">{trailing}</span>}
    </span>
  )
}
