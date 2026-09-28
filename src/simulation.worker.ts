/// <reference lib="webworker" />
import { generateMatchPlayback } from './matchSimulation'
import type { MatchResult, Player, TacticalPlan } from './game'

type Request = {
  id: number
  result: MatchResult
  starters: Player[]
  tactic: TacticalPlan
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, result, starters, tactic } = event.data
  try {
    const playback = generateMatchPlayback(result, starters, tactic)
    self.postMessage({ id, ok: true, playback })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
