import { managerLevelFromXp, type GameState } from './game'

export type CareerObjectiveId =
  | 'first-five'
  | 'first-practice'
  | 'book-event'
  | 'first-official'
  | 'first-win'
  | 'vrs-800'
  | 'manager-2'
  | 'finish-event'
  | 'five-wins'
  | 'vrs-950'
  | 'event-champion'
  | 'manager-3'

export interface CareerObjective {
  id: CareerObjectiveId
  title: string
  description: string
  current: number
  target: number
  completed: boolean
  rewardLabel: string
}

const officialMatches = (state: GameState) =>
  state.history.filter((match) => match.mode !== 'practice')

const completedTournament = (state: GameState) =>
  state.tournamentHistory.length > 0

const tournamentChampion = (state: GameState) =>
  state.tournamentHistory.some((run) => run.status === 'champion')

export const careerObjectives = (state: GameState): CareerObjective[] => {
  const officials = officialMatches(state)
  const officialWins = officials.filter((match) => match.won).length
  const managerLevel = managerLevelFromXp(state.managerXp)

  const raw: Omit<CareerObjective, 'completed'>[] = [
    {
      id: 'first-five',
      title: 'Собрать стартовую пятёрку',
      description: 'Закрой пять ролей и подготовь первый состав.',
      current: Math.min(5, state.startingFive.length),
      target: 5,
      rewardLabel: 'CLUB READY',
    },
    {
      id: 'book-event',
      title: 'Выбрать первый турнир',
      description: 'Забронируй событие на World Map.',
      current: state.activeEventId || completedTournament(state) || officials.some((match) => match.tournamentId) ? 1 : 0,
      target: 1,
      rewardLabel: 'CIRCUIT OPEN',
    },
    {
      id: 'first-practice',
      title: 'Провести пракк',
      description: 'Проверь стартовую пятёрку до официального матча.',
      current: state.history.some((match) => match.mode === 'practice') ? 1 : 0,
      target: 1,
      rewardLabel: '+ CONTINUITY',
    },
    {
      id: 'first-official',
      title: 'Сыграть первый официальный матч',
      description: 'Дойди до матчдея и закончи первую серию.',
      current: Math.min(1, officials.length),
      target: 1,
      rewardLabel: 'VRS ACTIVE',
    },
    {
      id: 'first-win',
      title: 'Первая победа',
      description: 'Выиграй официальный BO3.',
      current: Math.min(1, officialWins),
      target: 1,
      rewardLabel: '+ MANAGER XP',
    },
    {
      id: 'vrs-800',
      title: 'Закрепиться в рейтинге',
      description: 'Подними клуб до 800 VRS.',
      current: Math.min(800, state.clubVrsPoints),
      target: 800,
      rewardLabel: '800 VRS',
    },
    {
      id: 'manager-2',
      title: 'Manager Level 2',
      description: 'Набери достаточно опыта менеджера.',
      current: Math.min(2, managerLevel),
      target: 2,
      rewardLabel: 'LEVEL 2',
    },
    {
      id: 'finish-event',
      title: 'Закончить первый турнир',
      description: 'Пройди турнирную сетку до итогового места.',
      current: completedTournament(state) ? 1 : 0,
      target: 1,
      rewardLabel: 'EVENT RECORD',
    },
    {
      id: 'five-wins',
      title: 'Серия результатов',
      description: 'Одержи 5 официальных побед.',
      current: Math.min(5, officialWins),
      target: 5,
      rewardLabel: '5 WINS',
    },
    {
      id: 'vrs-950',
      title: 'Войти в следующий эшелон',
      description: 'Подними клуб до 950 VRS.',
      current: Math.min(950, state.clubVrsPoints),
      target: 950,
      rewardLabel: '950 VRS',
    },
    {
      id: 'event-champion',
      title: 'Первый трофей',
      description: 'Заверши турнир в статусе Champion.',
      current: tournamentChampion(state) ? 1 : 0,
      target: 1,
      rewardLabel: 'TROPHY',
    },
    {
      id: 'manager-3',
      title: 'Manager Level 3',
      description: 'Развей карьеру до третьего уровня.',
      current: Math.min(3, managerLevel),
      target: 3,
      rewardLabel: 'LEVEL 3',
    },
  ]

  return raw.map((objective) => ({
    ...objective,
    completed: objective.current >= objective.target,
  }))
}

export const currentCareerObjectives = (state: GameState, limit = 3) => {
  const all = careerObjectives(state)
  const firstIncomplete = all.findIndex((objective) => !objective.completed)
  if (firstIncomplete < 0) return all.slice(-limit)
  return all.slice(firstIncomplete, firstIncomplete + limit)
}

export const completedCareerObjectiveIds = (state: GameState) =>
  new Set(careerObjectives(state).filter((objective) => objective.completed).map((objective) => objective.id))

export type OnboardingTarget = 'World' | 'Training' | 'Calendar' | 'Play' | 'Inbox' | 'Roster'

export interface OnboardingStep {
  index: number
  total: number
  title: string
  body: string
  action: string
  target: OnboardingTarget
}

export const onboardingStep = (state: GameState): OnboardingStep | null => {
  if (!state.welcomeComplete) return null

  const hasPractice = state.history.some((match) => match.mode === 'practice')
  const officials = officialMatches(state)
  const hasOfficial = officials.length > 0

  if (!state.activeEventId && !completedTournament(state) && !hasOfficial) {
    return {
      index: 1,
      total: 4,
      title: 'Выбери первый турнир',
      body: 'На World Map находятся реальные события сезона. Начни с доступного T3 турнира.',
      action: 'OPEN WORLD MAP',
      target: 'World',
    }
  }

  if (!hasPractice && !hasOfficial) {
    return {
      index: 2,
      total: 4,
      title: 'Проверь состав на пракке',
      body: 'Пракк не тратит VRS и деньги. Он показывает, как стартовая пятёрка работает вместе.',
      action: 'START PRACTICE',
      target: 'Training',
    }
  }

  if (!hasOfficial) {
    const due = state.activeTournament?.matches.some((match) =>
      match.status === 'ready' && (match.teamAId === 'club' || match.teamBId === 'club'),
    )

    return due
      ? {
          index: 4,
          total: 4,
          title: 'Первый официальный матч готов',
          body: 'Пройди veto, сыграй BO3 и посмотри, как результат меняет VRS, XP и состояние состава.',
          action: 'GO TO MATCHDAY',
          target: 'Play',
        }
      : {
          index: 3,
          total: 4,
          title: 'Дойди до матчдея',
          body: 'Продвинь календарь до следующего официального матча турнира.',
          action: 'OPEN CALENDAR',
          target: 'Calendar',
        }
  }

  return null
}
