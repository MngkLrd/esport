import { useEffect, useMemo, useState } from 'react'
import { playerPhoto } from './playerVisuals'

const staticCandidates = (playerId: number | null | undefined) => {
  if (!playerId) return []
  return [
    'https://static.hltv.org/images/playerprofile/bodyshot/compressed/' + playerId + '.png',
    'https://static.hltv.org/images/playerprofile/thumb/' + playerId + '/400.jpeg',
  ]
}

export function PlayerPortrait({
  alias,
  playerId,
  alt,
  className,
  loading = 'lazy',
  draggable,
}: {
  alias: string
  playerId?: number | null
  alt?: string
  className?: string
  loading?: 'eager' | 'lazy'
  draggable?: boolean
}) {
  const candidates = useMemo(
    () => [playerPhoto(alias), ...staticCandidates(playerId)].filter((url): url is string => Boolean(url)),
    [alias, playerId],
  )
  const [index, setIndex] = useState(0)

  useEffect(() => setIndex(0), [alias, playerId])

  const src = candidates[index]
  if (!src) return null

  return (
    <img
      src={src}
      alt={alt ?? alias}
      className={className}
      loading={loading}
      draggable={draggable}
      referrerPolicy="no-referrer"
      onError={() => setIndex((current) => current + 1)}
    />
  )
}
