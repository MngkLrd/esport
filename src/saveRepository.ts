import { LEGACY_PACK_SAVE_KEY, migratePackState, type PackState } from './packState'
import { createInitialState, migrateState, type GameState } from './game'

export const SAVE_KEY = 'esport-ai-manager-v2'
export const LEGACY_SAVE_KEY = 'esport-ai-manager-v1'

export interface SaveRepository {
  load(): GameState
  save(state: GameState): void
  reset(): GameState
}

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const createBrowserSaveRepository = (): SaveRepository => ({
  load() {
    const raw = readJson(SAVE_KEY) ?? readJson(LEGACY_SAVE_KEY)
    let state = migrateState(raw)
    const legacyPacks = readJson(LEGACY_PACK_SAVE_KEY)
    if (legacyPacks) {
      const packs = migratePackState(legacyPacks)
      if (state.packs.inventory.length === 0 && packs.inventory.length > 0) {
        state = { ...state, packs }
      }
      localStorage.removeItem(LEGACY_PACK_SAVE_KEY)
    }
    return state
  },
  save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  },
  reset() {
    const state = createInitialState()
    localStorage.removeItem(LEGACY_SAVE_KEY)
    localStorage.removeItem(LEGACY_PACK_SAVE_KEY)
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    return state
  },
})
