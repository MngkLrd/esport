import { LEGACY_PACK_SAVE_KEY, migratePackState, type PackState } from './packState'
import { hydratePackState } from './packs'
import { createInitialState, migrateState, type GameState } from './game'

export const SAVE_KEY = 'esport-ai-manager-v3'
export const BACKUP_SAVE_KEY = 'esport-ai-manager-v3-backup'
export const LEGACY_SAVE_KEY_V2 = 'esport-ai-manager-v2'
export const LEGACY_SAVE_KEY = 'esport-ai-manager-v1'

export interface SaveRepository {
  load(): GameState
  save(state: GameState): void
  reset(): GameState
  snapshot(): GameState
}

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const readFirstValid = () => {
  const candidates = [SAVE_KEY, BACKUP_SAVE_KEY, LEGACY_SAVE_KEY_V2, LEGACY_SAVE_KEY]
  for (const key of candidates) {
    const raw = readJson(key)
    if (raw && typeof raw === 'object') return raw
  }
  return null
}

const hydrateCareer = (raw: unknown) => {
  let state = migrateState(raw)
  state = { ...state, packs: hydratePackState(state.packs) }
  return state
}

export const createBrowserSaveRepository = (): SaveRepository => ({
  load() {
    let state = hydrateCareer(readFirstValid())
    const legacyPacks = readJson(LEGACY_PACK_SAVE_KEY)
    if (legacyPacks) {
      const packs = hydratePackState(migratePackState(legacyPacks))
      if (state.packs.inventory.length === 0 && packs.inventory.length > 0) {
        state = { ...state, packs }
      }
      localStorage.removeItem(LEGACY_PACK_SAVE_KEY)
    }

    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    return state
  },

  save(state) {
    try {
      const current = localStorage.getItem(SAVE_KEY)
      if (current) localStorage.setItem(BACKUP_SAVE_KEY, current)
      localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    } catch {
      // The current in-memory state remains playable even if browser storage is unavailable.
    }
  },

  reset() {
    const state = createInitialState()
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(BACKUP_SAVE_KEY)
    localStorage.removeItem(LEGACY_SAVE_KEY_V2)
    localStorage.removeItem(LEGACY_SAVE_KEY)
    localStorage.removeItem(LEGACY_PACK_SAVE_KEY)
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    return state
  },

  snapshot() {
    const state = hydrateCareer(readJson(SAVE_KEY) ?? readJson(BACKUP_SAVE_KEY))
    localStorage.setItem(BACKUP_SAVE_KEY, JSON.stringify(state))
    return state
  },
})
