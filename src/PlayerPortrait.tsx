import { useEffect, useMemo, useState } from 'react'
import { playerPhoto } from './playerVisuals'
import { hltvSnapshotForAlias } from './cardStats'
import { playerVisualBodyshot, playerVisualProfileId } from './visualIdentity'

const staticCandidates = (playerId: number | null | undefined) => {
  if (!playerId) return []
  return [
    'https://static.hltv.org/images/playerprofile/bodyshot/compressed/' + playerId + '.png',
    'https://static.hltv.org/images/playerprofile/thumb/' + playerId + '/400.jpeg',
  ]
}

const resolvedPortraits = new Map<string, string>()
const failedPortraitUrls = new Set<string>()

const portraitKey = (alias: string, playerId: number | null | undefined) =>
  alias.toLocaleLowerCase('en-US') + ':' + (playerId ?? 'none')

const effectivePlayerId = (alias: string, playerId: number | null | undefined) =>
  playerId ?? playerVisualProfileId(alias) ?? hltvSnapshotForAlias(alias)?.playerId ?? null

const portraitCandidates = (alias: string, playerId: number | null | undefined) => {
  const resolvedId = effectivePlayerId(alias, playerId)
  const key = portraitKey(alias, resolvedId)
  const cached = resolvedPortraits.get(key)
  return [...new Set([cached, playerVisualBodyshot(alias), playerPhoto(alias), ...staticCandidates(resolvedId)]
    .filter((url): url is string => Boolean(url)))]
    .filter((url) => !failedPortraitUrls.has(url))
}

const preloadUrl = (url: string) => new Promise<boolean>((resolve) => {
  if (typeof Image === 'undefined') {
    resolve(false)
    return
  }

  const image = new Image()
  image.onload = () => resolve(true)
  image.onerror = () => resolve(false)
  image.src = url
})

export const preloadPlayerPortrait = async (alias: string, playerId?: number | null) => {
  const resolvedId = effectivePlayerId(alias, playerId)
  const key = portraitKey(alias, resolvedId)
  if (resolvedPortraits.has(key)) return true

  for (const url of portraitCandidates(alias, resolvedId)) {
    if (await preloadUrl(url)) {
      resolvedPortraits.set(key, url)
      return true
    }
    failedPortraitUrls.add(url)
  }

  return false
}

export const preloadPlayerPortraits = async (
  entries: Array<{ alias: string; playerId?: number | null }>,
  concurrency = 8,
) => {
  const unique = [...new Map(entries.map((entry) => {
    const resolvedId = effectivePlayerId(entry.alias, entry.playerId)
    return [portraitKey(entry.alias, resolvedId), { ...entry, playerId: resolvedId }] as const
  })).values()]
  if (!unique.length) return { loaded: 0, failed: 0 }

  let cursor = 0
  let loaded = 0
  let failed = 0
  const workerCount = Math.min(Math.max(1, concurrency), unique.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < unique.length) {
      const index = cursor
      cursor += 1
      const entry = unique[index]
      if (await preloadPlayerPortrait(entry.alias, entry.playerId)) loaded += 1
      else failed += 1
    }
  }))

  return { loaded, failed }
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
  const resolvedId = effectivePlayerId(alias, playerId)
  const candidates = useMemo(
    () => portraitCandidates(alias, resolvedId),
    [alias, resolvedId],
  )
  const [index, setIndex] = useState(0)

  useEffect(() => setIndex(0), [alias, resolvedId])

  const src = candidates[index]
  if (!src) {
    const initials = alias.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'PRO'
    return (
      <span
        className={'player-portrait-fallback' + (className ? ' ' + className : '')}
        role="img"
        aria-label={alt ?? alias}
        data-player-alias={alias}
      >
        <span aria-hidden="true">{initials}</span>
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? alias}
      className={className}
      loading={loading}
      draggable={draggable}
      referrerPolicy="no-referrer"
      onLoad={() => resolvedPortraits.set(portraitKey(alias, resolvedId), src)}
      onError={() => {
        failedPortraitUrls.add(src)
        setIndex((current) => current + 1)
      }}
    />
  )
}
