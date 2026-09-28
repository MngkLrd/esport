export type TournamentTier = 'S' | 'A' | 'B'
export type TournamentRegion = 'Europe' | 'Americas' | 'Asia' | 'CIS'

export interface TournamentEvent {
  id: string
  name: string
  city: string
  region: TournamentRegion
  tier: TournamentTier
  x: number
  y: number
  prize: number
  travel: number
  service: number
  fatigue: number
  label: string
  unlockLevel: number
}

export const TOURNAMENTS: readonly TournamentEvent[] = [
  { id: 'helsinki', name: 'Nordic Masters', city: 'Helsinki', region: 'Europe', tier: 'A', x: 56, y: 25, prize: 3200, travel: 180, service: 240, fatigue: 6, label: 'LAN · 8 TEAMS', unlockLevel: 1 },
  { id: 'almaty', name: 'Steppe Invitational', city: 'Almaty', region: 'CIS', tier: 'B', x: 66, y: 36, prize: 2200, travel: 430, service: 280, fatigue: 8, label: 'LAN · 8 TEAMS', unlockLevel: 1 },
  { id: 'dallas', name: 'Lone Star Clash', city: 'Dallas', region: 'Americas', tier: 'A', x: 25, y: 43, prize: 4100, travel: 760, service: 510, fatigue: 15, label: 'LAN · 12 TEAMS', unlockLevel: 3 },
  { id: 'sao-paulo', name: 'São Paulo Open', city: 'São Paulo', region: 'Americas', tier: 'A', x: 34, y: 70, prize: 3800, travel: 880, service: 460, fatigue: 16, label: 'LAN · 12 TEAMS', unlockLevel: 3 },
  { id: 'cologne', name: 'Rhine Arena', city: 'Cologne', region: 'Europe', tier: 'S', x: 49, y: 31, prize: 6200, travel: 260, service: 360, fatigue: 9, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'katowice', name: 'Steel Cup', city: 'Katowice', region: 'Europe', tier: 'S', x: 53, y: 33, prize: 7000, travel: 250, service: 380, fatigue: 10, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'chengdu', name: 'Chengdu Masters', city: 'Chengdu', region: 'Asia', tier: 'S', x: 78, y: 44, prize: 6800, travel: 980, service: 590, fatigue: 18, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
] as const

export const tournamentForId = (id: string | null | undefined) =>
  id ? TOURNAMENTS.find((event) => event.id === id) ?? null : null

export const tournamentEntryCost = (event: TournamentEvent) => event.travel + event.service

export const tournamentMode = (event: TournamentEvent) =>
  event.tier === 'S' ? 'cup' : event.tier === 'A' ? 'showmatch' : 'scrim'
