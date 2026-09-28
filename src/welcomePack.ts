import { REAL_PLAYERS, type RealPlayerRole } from './players'
import type { PackCard } from './packState'
import { playerPower, rarityForPlayer } from './packs'

const ROLES: readonly RealPlayerRole[] = ['IGL', 'AWP', 'Entry', 'Support', 'Rifler']
const hashSeed = (input: string) => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const mulberry32 = (seed: number) => () => {
  let value = (seed += 0x6d2b79f5)
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export const rollWelcomePack = (saveId: string): PackCard[] => {
  const rng = mulberry32(hashSeed('welcome-v2:' + saveId))
  const used = new Set<string>()
  return ROLES.map((role, index) => {
    const candidates = REAL_PLAYERS.filter((player) => player.role === role && !used.has(player.alias.toLocaleLowerCase('en-US')))
    const pool = candidates.length ? candidates : REAL_PLAYERS.filter((player) => !used.has(player.alias.toLocaleLowerCase('en-US')))
    const player = pool[Math.floor(rng() * pool.length)]
    used.add(player.alias.toLocaleLowerCase('en-US'))
    const profileId = player.profileUrl?.match(/\/player\/(\d+)/)?.[1]
    return {
      id: 'welcome-card-' + index + '-' + player.alias.toLocaleLowerCase('en-US'),
      playerKey: profileId ? 'hltv:' + profileId : 'alias:' + player.alias.toLocaleLowerCase('en-US'),
      alias: player.alias,
      realName: player.realName,
      country: player.country,
      team: player.team,
      age: player.age,
      profileId: profileId ? Number(profileId) : null,
      role,
      power: playerPower(player),
      rarity: rarityForPlayer(player),
      sourceRating: player.rating,
      sourceRank: player.vrsRank ?? null,
      cardStats: null,
      edition: 'STARTER',
      packId: 'welcome',
      serial: -1,
    }
  })
}
