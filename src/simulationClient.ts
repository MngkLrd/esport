import { generateMatchPlayback, type MatchPlayback } from './matchSimulation'
import type { MatchResult, Player, TacticalPlan } from './game'

let worker: Worker | null = null
let sequence = 0
const pending = new Map<number, {
  resolve: (value: MatchPlayback) => void
  reject: (reason?: unknown) => void
}>()

const getWorker = () => {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker

  worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; playback?: MatchPlayback; error?: string }>) => {
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    if (event.data.ok && event.data.playback) request.resolve(event.data.playback)
    else request.reject(new Error(event.data.error ?? 'Simulation worker failed'))
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Simulation worker crashed')
    for (const request of pending.values()) request.reject(error)
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export const buildMatchPlayback = async (
  result: MatchResult,
  starters: Player[],
  tactic: TacticalPlan,
): Promise<MatchPlayback> => {
  const target = getWorker()
  if (!target) return generateMatchPlayback(result, starters, tactic)

  const id = ++sequence
  return new Promise<MatchPlayback>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    target.postMessage({ id, result, starters, tactic })
  }).catch(() => generateMatchPlayback(result, starters, tactic))
}
