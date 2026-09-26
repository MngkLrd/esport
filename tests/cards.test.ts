import { describe, expect, it } from 'vitest'
import { REAL_PLAYERS } from '../src/players'
import {
  HLTV_CARD_SNAPSHOT_META,
  HLTV_CARD_SNAPSHOTS,
} from '../src/hltvCardStats.generated'
import {
  cardStatsForAlias,
  hltvSnapshotForAlias,
} from '../src/cardStats'
import {
  PACK_POOL_STATS,
  createPackState,
  migratePackState,
  playerPower,
  rollPack,
} from '../src/packs'

describe('HLTV collectible card pipeline', () => {
  it('covers the full current player pool without duplicate aliases', () => {
    expect(REAL_PLAYERS).toHaveLength(1634)
    expect(HLTV_CARD_SNAPSHOT_META.requestedPlayers).toBe(REAL_PLAYERS.length)

    const aliases = REAL_PLAYERS.map((player) => player.alias.toLocaleLowerCase('en-US'))
    expect(new Set(aliases).size).toBe(REAL_PLAYERS.length)
    expect(Object.keys(HLTV_CARD_SNAPSHOTS)).toHaveLength(REAL_PLAYERS.length)

    for (const alias of aliases) {
      expect(HLTV_CARD_SNAPSHOTS[alias]).toBeDefined()
    }
  })

  it('keeps HLTV coverage above the production floor', () => {
    expect(HLTV_CARD_SNAPSHOT_META.withStats).toBeGreaterThanOrEqual(1400)
    expect(HLTV_CARD_SNAPSHOT_META.errors).toBe(0)

    const ok = Object.values(HLTV_CARD_SNAPSHOTS).filter((snapshot) => snapshot.status === 'ok')
    expect(ok).toHaveLength(HLTV_CARD_SNAPSHOT_META.withStats)

    for (const snapshot of ok) {
      expect(snapshot.cardScores).not.toBeNull()
      for (const value of Object.values(snapshot.cardScores!)) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }

      const player = REAL_PLAYERS.find(
        (candidate) => candidate.alias.toLocaleLowerCase('en-US') === snapshot.alias.toLocaleLowerCase('en-US'),
      )
      expect(player).toBeDefined()
      const card = cardStatsForAlias(snapshot.alias, player!.role)
      expect(card).not.toBeNull()
      for (const value of [card!.aim, card!.utility, card!.positioning, card!.clutch, card!.ovr]) {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(99)
      }
    }
  })

  it('produces plausible known-player examples from HLTV data', () => {
    const donk = cardStatsForAlias('donk', 'Entry')
    const zywoo = cardStatsForAlias('ZywOo', 'AWP')

    expect(donk).not.toBeNull()
    expect(zywoo).not.toBeNull()

    expect(donk!.aim).toBe(99)
    expect(donk!.ovr).toBe(92)
    expect(donk!.source).toBe('hltv')

    expect(zywoo!.aim).toBe(96)
    expect(zywoo!.clutch).toBe(92)
    expect(zywoo!.ovr).toBe(82)
    expect(zywoo!.source).toBe('hltv')
  })

  it('does not fabricate HLTV stats for a known no-data player', () => {
    const snapshot = hltvSnapshotForAlias('0z')
    expect(snapshot).not.toBeNull()
    expect(snapshot!.status).toBe('no-data')
    expect(cardStatsForAlias('0z', null)).toBeNull()

    const player = REAL_PLAYERS.find((candidate) => candidate.alias.toLocaleLowerCase('en-US') === '0z')
    expect(player).toBeDefined()
    expect(Number.isFinite(playerPower(player!))).toBe(true)
  })

  it('keeps all rarity pools populated and totals aligned', () => {
    const total =
      PACK_POOL_STATS.common +
      PACK_POOL_STATS.uncommon +
      PACK_POOL_STATS.rare +
      PACK_POOL_STATS.epic +
      PACK_POOL_STATS.legendary

    expect(total).toBe(REAL_PLAYERS.length)
    expect(PACK_POOL_STATS.common).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.uncommon).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.rare).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.epic).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.legendary).toBeGreaterThan(0)
  })

  it('rolls packs deterministically per save and serial', () => {
    const a = rollPack('major', 7, 'smoke-save')
    const b = rollPack('major', 7, 'smoke-save')

    expect(b.winner).toEqual(a.winner)
    expect(b.reel).toEqual(a.reel)
    expect(a.winnerIndex).toBe(37)
    expect(a.reel[a.winnerIndex]).toEqual(a.winner)
    expect(a.reel).toHaveLength(46)

    for (const card of a.reel) {
      expect(Number.isFinite(card.power)).toBe(true)
      expect(card.power).toBeGreaterThanOrEqual(1)
      expect(card.power).toBeLessThanOrEqual(99)
    }

    const alternateSequence = Array.from({ length: 8 }, (_, serial) =>
      rollPack('major', serial, 'another-save').winner.alias,
    )
    const baselineSequence = Array.from({ length: 8 }, (_, serial) =>
      rollPack('major', serial, 'smoke-save').winner.alias,
    )
    expect(alternateSequence).not.toEqual(baselineSequence)
  })

  it('migrates empty pack state without corrupting versioned state', () => {
    const initial = createPackState()
    expect(migratePackState(initial)).toEqual(initial)

    const legacy = {
      version: 1,
      serial: 4,
      inventory: [],
      history: [],
    }
    const migrated = migratePackState(legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.serial).toBe(4)
    expect(migrated.inventory).toEqual([])
  })
})
