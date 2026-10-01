import { useMemo, useState } from 'react'
import { teamVisualLogo } from './visualIdentity'

const initialsFor = (name: string) => {
  const parts = name.trim().split(/s+/).filter(Boolean)
  if (!parts.length) return 'TM'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function TeamBadge({
  name,
  size = 'md',
  className = '',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const logo = useMemo(() => teamVisualLogo(name), [name])
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(logo && !failed)

  return (
    <span
      className={'team-badge team-badge-' + size + (className ? ' ' + className : '')}
      aria-label={name}
      role="img"
      title={name}
    >
      {showImage ? (
        <img
          src={logo!}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <b aria-hidden="true">{initialsFor(name)}</b>
      )}
    </span>
  )
}

export function TeamIdentity({
  name,
  meta,
  size = 'md',
  align = 'left',
  className = '',
}: {
  name: string
  meta?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <span className={'team-identity align-' + align + (className ? ' ' + className : '')}>
      {align === 'left' && <TeamBadge name={name} size={size} />}
      <span className="team-identity-copy">
        <strong>{name}</strong>
        {meta && <small>{meta}</small>}
      </span>
      {align === 'right' && <TeamBadge name={name} size={size} />}
    </span>
  )
}
