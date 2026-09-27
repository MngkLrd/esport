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
  hydratePackState,
  migratePackState,
  playerPower,
  rollPack,
} from '../src/packs'
import { playerPhoto } from '../src/playerVisuals'
import type { PackCard } from '../src/packState'

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

  it('enriches HLTV-known players even when the legacy metadata manifest missed them', () => {
    const vicu = REAL_PLAYERS.find((player) => player.alias.toLocaleLowerCase('en-US') === 'vicu')
    expect(vicu).toBeDefined()
    expect(vicu!.realName).toBe('Wiktoria Janicka')
    expect(vicu!.country).toBe('Poland')
    expect(vicu!.age).toBe(23)
    expect(vicu!.profileUrl).toContain('/22062/')
    expect(playerPhoto('vicu')).toContain('img-cdn.hltv.org/playerbodyshot/')
  })

  it('rehydrates saved cards with current identity and profile data', () => {
    const stale: PackCard = {
      id: 'legacy-b1t',
      playerKey: 'alias:b1t',
      alias: 'b1t',
      realName: null,
      country: null,
      team: 'Natus Vincere',
      age: null,
      profileId: null,
      role: null,
      power: 69,
      rarity: 'epic',
      sourceRating: null,
      sourceRank: 10,
      cardStats: null,
      edition: 'VRS',
      packId: 'major',
      serial: 7,
    }
    const hydrated = hydratePackState({
      version: 2,
      serial: 8,
      inventory: [stale],
      history: [stale],
    })
    expect(hydrated.inventory[0].realName).toBe('Valeriy Vakhovskiy')
    expect(hydrated.inventory[0].country).toBe('Ukraine')
    expect(hydrated.inventory[0].age).toBe(23)
    expect(hydrated.inventory[0].profileId).toBe(18987)
    expect(hydrated.inventory[0].cardStats).not.toBeNull()
    expect(playerPhoto(hydrated.inventory[0].alias)).toBeTruthy()
  })

  it('keeps all rarity pools populated and totals aligned', () => {
    const total =
      PACK_POOL_STATS.common +
      PACK_POOL_STATS.uncommon +
      PACK_POOL_STATS.rare +
      PACK_POOL_STATS.epic +
      PACK_POOL_STATS.legendary

    expect(total).toBe(PACK_POOL_STATS.totalPlayers)
    expect(PACK_POOL_STATS.totalPlayers).toBeGreaterThan(200)
    expect(PACK_POOL_STATS.totalPlayers).toBeLessThanOrEqual(REAL_PLAYERS.length)
    expect(PACK_POOL_STATS.common).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.uncommon).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.rare).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.epic).toBeGreaterThan(0)
    expect(PACK_POOL_STATS.legendary).toBeGreaterThan(0)
  })

  it('never puts visually incomplete players into a pack reel', () => {
    for (const packId of ['academy', 'challenger', 'major', 'afterdark'] as const) {
      for (let serial = 0; serial < 12; serial += 1) {
        const roll = rollPack(packId, serial, 'p0-visual-contract')

        for (const card of roll.reel) {
          expect(card.country).toBeTruthy()
          expect(card.cardStats).not.toBeNull()
          expect(card.role).toBeTruthy()
          expect(playerPhoto(card.alias)).toContain('hltv')
        }

        expect(roll.winner.country).toBeTruthy()
        expect(roll.winner.cardStats).not.toBeNull()
        expect(playerPhoto(roll.winner.alias)).toContain('hltv')
      }
    }
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
