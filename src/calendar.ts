export const INITIAL_SEASON_START = '2026-09-28T09:00:00'

const pad = (value: number) => String(value).padStart(2, '0')

const withUtc = (value: string) => value.endsWith('Z') ? value : value + 'Z'

export const parseGameDate = (value: string) => new Date(withUtc(value))

export const toGameIso = (date: Date) =>
  date.getUTCFullYear() + '-' +
  pad(date.getUTCMonth() + 1) + '-' +
  pad(date.getUTCDate()) + 'T' +
  pad(date.getUTCHours()) + ':' +
  pad(date.getUTCMinutes()) + ':00'

export const addGameHours = (value: string, hours: number) => {
  const date = parseGameDate(value)
  date.setUTCHours(date.getUTCHours() + hours)
  return toGameIso(date)
}

export const addGameDays = (value: string, days: number, hour?: number) => {
  const date = parseGameDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  if (hour != null) {
    date.setUTCHours(hour, 0, 0, 0)
  }
  return toGameIso(date)
}

export const compareGameTime = (a: string, b: string) =>
  parseGameDate(a).getTime() - parseGameDate(b).getTime()

export const hoursBetween = (from: string, to: string) =>
  Math.max(0, (parseGameDate(to).getTime() - parseGameDate(from).getTime()) / 3_600_000)

export const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.floor(hoursBetween(from, to) / 24))

export const gameWeekForDate = (seasonStart: string, now: string) =>
  Math.max(1, Math.floor(hoursBetween(seasonStart, now) / (24 * 7)) + 1)

export const formatGameDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseGameDate(value)).toUpperCase()

export const formatGameTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(parseGameDate(value))

export const formatGameDateTime = (value: string) =>
  formatGameDate(value) + ' · ' + formatGameTime(value)

export const startOfGameDay = (value: string) => {
  const date = parseGameDate(value)
  date.setUTCHours(0, 0, 0, 0)
  return toGameIso(date)
}

export const gameDayKey = (value: string) => value.slice(0, 10)

export const isSameGameDay = (a: string, b: string) => gameDayKey(a) === gameDayKey(b)

export const monthKey = (value: string) => value.slice(0, 7)

export const humanTimeUntil = (from: string, to: string) => {
  const hours = Math.max(0, Math.round(hoursBetween(from, to)))
  if (hours < 1) return 'NOW'
  if (hours < 24) return hours + 'H'
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? days + 'D ' + rest + 'H' : days + 'D'
}
