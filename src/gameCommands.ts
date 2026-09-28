import { applyWelcomePack, bookTournament, playMatch, startNextSeason, type GameState, type MatchMode, type TacticalPlan } from './game'
import { collectPackWinner, type PackCard, type PackRoll } from './packState'

export type GameCommand =
  | { type: 'OPEN_WELCOME_PACK'; cards: PackCard[] }
  | { type: 'PLAY_MATCH'; mode: MatchMode; tactic: TacticalPlan }
  | { type: 'BOOK_EVENT'; eventId: string }
  | { type: 'OPEN_PACK'; roll: PackRoll }
  | { type: 'START_NEXT_SEASON' }

export interface GameEvent {
  type: 'WelcomePackOpened' | 'MatchPlayed' | 'EventBooked' | 'PackOpened' | 'SeasonStarted'
  id: string
}

export interface CommandResult {
  state: GameState
  events: GameEvent[]
}

export const executeGameCommand = (state: GameState, command: GameCommand): CommandResult => {
  switch (command.type) {
    case 'OPEN_WELCOME_PACK': {
      const next = applyWelcomePack(state, command.cards)
      return { state: next, events: next === state ? [] : [{ type: 'WelcomePackOpened', id: 'welcome-' + state.saveId }] }
    }
    case 'PLAY_MATCH': {
      const next = playMatch(state, command.mode, command.tactic)
      return { state: next, events: next === state ? [] : [{ type: 'MatchPlayed', id: next.history[0]?.id ?? 'match' }] }
    }
    case 'BOOK_EVENT': {
      const next = bookTournament(state, command.eventId)
      return { state: next, events: next === state ? [] : [{ type: 'EventBooked', id: command.eventId }] }
    }
    case 'OPEN_PACK': {
      const { roll } = command
      if (state.welcomeComplete === false || state.packTokens < roll.pack.price || state.packs.serial !== roll.winner.serial) {
        return { state, events: [] }
      }
      const next = {
        ...state,
        packTokens: state.packTokens - roll.pack.price,
        managerXp: state.managerXp + 12,
        packs: collectPackWinner(state.packs, roll.winner),
      }
      return { state: next, events: [{ type: 'PackOpened', id: roll.winner.id }] }
    }
    case 'START_NEXT_SEASON': {
      const next = startNextSeason(state)
      return { state: next, events: next === state ? [] : [{ type: 'SeasonStarted', id: 'season-' + next.season }] }
    }
  }
}
