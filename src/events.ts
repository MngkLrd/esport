export type TournamentTier = 'S' | 'A' | 'B' | 'C'
export type CircuitTier = 1 | 2 | 3
export type EventFormat = 'LAN' | 'ONLINE'
export type TournamentRegion = 'Europe' | 'Americas' | 'Asia' | 'CIS'
export type TournamentStructure = 'single_elim' | 'groups_single' | 'groups_double'

export interface TournamentEvent {
  id: string
  name: string
  city: string
  region: TournamentRegion
  tier: TournamentTier
  circuitTier: CircuitTier
  format: EventFormat
  structure: TournamentStructure
  longitude: number
  latitude: number
  prize: number
  travel: number
  service: number
  fatigue: number
  label: string
  unlockLevel: number
  startDay: number
  durationDays: number
}

export const TOURNAMENTS: readonly TournamentEvent[] = [
  { id: 'eu-open-1', name: 'European Open Series', city: 'Europe Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: 15, latitude: 51, prize: 900, travel: 0, service: 0, fatigue: 2, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 2, durationDays: 3 },
  { id: 'nordic-online', name: 'Nordic Challenger', city: 'Nordics Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: 20, latitude: 61, prize: 1100, travel: 0, service: 0, fatigue: 2, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 12, durationDays: 3 },
  { id: 'dach-online', name: 'DACH Open Cup', city: 'DACH Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: 10, latitude: 50, prize: 1050, travel: 0, service: 0, fatigue: 2, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 22, durationDays: 3 },
  { id: 'cis-open', name: 'Eastern Circuit Open', city: 'CIS Online', region: 'CIS', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: 45, latitude: 50, prize: 950, travel: 0, service: 0, fatigue: 2, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 32, durationDays: 3 },
  { id: 'na-open', name: 'North America Open', city: 'NA Online', region: 'Americas', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: -98, latitude: 39, prize: 1150, travel: 0, service: 0, fatigue: 3, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 42, durationDays: 3 },
  { id: 'sa-open', name: 'South America Open', city: 'SA Online', region: 'Americas', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: -58, latitude: -15, prize: 1000, travel: 0, service: 0, fatigue: 3, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 52, durationDays: 3 },
  { id: 'asia-open', name: 'Asia Open Series', city: 'Asia Online', region: 'Asia', tier: 'C', circuitTier: 3, format: 'ONLINE', structure: 'single_elim', longitude: 105, latitude: 34, prize: 1000, travel: 0, service: 0, fatigue: 3, label: 'ONLINE · 8 TEAM SINGLE ELIM', unlockLevel: 1, startDay: 62, durationDays: 3 },

  { id: 'eu-challenger', name: 'European Challenger League', city: 'Europe Online', region: 'Europe', tier: 'B', circuitTier: 2, format: 'ONLINE', structure: 'groups_single', longitude: 18, latitude: 48, prize: 2400, travel: 0, service: 0, fatigue: 4, label: 'ONLINE · GROUPS → SINGLE ELIM', unlockLevel: 2, startDay: 8, durationDays: 7 },
  { id: 'na-challenger', name: 'NA Challenger League', city: 'NA Online', region: 'Americas', tier: 'B', circuitTier: 2, format: 'ONLINE', structure: 'groups_single', longitude: -96, latitude: 37, prize: 2500, travel: 0, service: 0, fatigue: 4, label: 'ONLINE · GROUPS → SINGLE ELIM', unlockLevel: 2, startDay: 28, durationDays: 7 },
  { id: 'cis-challenger', name: 'Eastern Challenger League', city: 'CIS Online', region: 'CIS', tier: 'B', circuitTier: 2, format: 'ONLINE', structure: 'groups_single', longitude: 50, latitude: 51, prize: 2300, travel: 0, service: 0, fatigue: 4, label: 'ONLINE · GROUPS → SINGLE ELIM', unlockLevel: 2, startDay: 48, durationDays: 7 },
  { id: 'asia-challenger', name: 'Asia Challenger League', city: 'Asia Online', region: 'Asia', tier: 'B', circuitTier: 2, format: 'ONLINE', structure: 'groups_single', longitude: 112, latitude: 30, prize: 2300, travel: 0, service: 0, fatigue: 4, label: 'ONLINE · GROUPS → SINGLE ELIM', unlockLevel: 2, startDay: 68, durationDays: 7 },

  { id: 'helsinki', name: 'Nordic Masters', city: 'Helsinki', region: 'Europe', tier: 'A', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: 24.94, latitude: 60.17, prize: 3200, travel: 180, service: 240, fatigue: 6, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 2, startDay: 18, durationDays: 8 },
  { id: 'almaty', name: 'Steppe Invitational', city: 'Almaty', region: 'CIS', tier: 'B', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: 76.89, latitude: 43.24, prize: 2700, travel: 430, service: 280, fatigue: 8, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 2, startDay: 38, durationDays: 8 },
  { id: 'prague', name: 'Prague Challenger', city: 'Prague', region: 'Europe', tier: 'B', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: 14.44, latitude: 50.08, prize: 2900, travel: 240, service: 260, fatigue: 7, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 2, startDay: 58, durationDays: 8 },
  { id: 'lisbon', name: 'Atlantic Invitational', city: 'Lisbon', region: 'Europe', tier: 'A', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: -9.14, latitude: 38.72, prize: 3500, travel: 390, service: 300, fatigue: 8, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 3, startDay: 72, durationDays: 8 },
  { id: 'buenos-aires', name: 'Southern Masters', city: 'Buenos Aires', region: 'Americas', tier: 'A', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: -58.38, latitude: -34.6, prize: 3700, travel: 820, service: 390, fatigue: 13, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 3, startDay: 86, durationDays: 8 },
  { id: 'dubai', name: 'Gulf Invitational', city: 'Dubai', region: 'Asia', tier: 'A', circuitTier: 2, format: 'LAN', structure: 'groups_double', longitude: 55.27, latitude: 25.2, prize: 3900, travel: 610, service: 420, fatigue: 11, label: 'LAN · GROUPS → DOUBLE ELIM', unlockLevel: 3, startDay: 98, durationDays: 8 },

  { id: 'dallas', name: 'Lone Star Clash', city: 'Dallas', region: 'Americas', tier: 'S', circuitTier: 1, format: 'LAN', structure: 'groups_double', longitude: -96.8, latitude: 32.78, prize: 5800, travel: 760, service: 510, fatigue: 15, label: 'LAN · T1 GROUPS → DOUBLE ELIM', unlockLevel: 5, startDay: 30, durationDays: 9 },
  { id: 'cologne', name: 'Rhine Arena', city: 'Cologne', region: 'Europe', tier: 'S', circuitTier: 1, format: 'LAN', structure: 'groups_double', longitude: 6.96, latitude: 50.94, prize: 7200, travel: 260, service: 360, fatigue: 9, label: 'LAN · T1 GROUPS → DOUBLE ELIM', unlockLevel: 5, startDay: 54, durationDays: 9 },
  { id: 'katowice', name: 'Steel Cup', city: 'Katowice', region: 'Europe', tier: 'S', circuitTier: 1, format: 'LAN', structure: 'groups_double', longitude: 19.02, latitude: 50.26, prize: 7600, travel: 250, service: 380, fatigue: 10, label: 'LAN · T1 GROUPS → DOUBLE ELIM', unlockLevel: 5, startDay: 76, durationDays: 9 },
  { id: 'chengdu', name: 'Chengdu Masters', city: 'Chengdu', region: 'Asia', tier: 'S', circuitTier: 1, format: 'LAN', structure: 'groups_double', longitude: 104.07, latitude: 30.67, prize: 7400, travel: 980, service: 590, fatigue: 18, label: 'LAN · T1 GROUPS → DOUBLE ELIM', unlockLevel: 5, startDay: 92, durationDays: 9 },
  { id: 'sao-paulo', name: 'São Paulo Championship', city: 'São Paulo', region: 'Americas', tier: 'S', circuitTier: 1, format: 'LAN', structure: 'groups_double', longitude: -46.63, latitude: -23.55, prize: 7000, travel: 880, service: 460, fatigue: 16, label: 'LAN · T1 GROUPS → DOUBLE ELIM', unlockLevel: 5, startDay: 104, durationDays: 9 },
] as const

export const tournamentForId = (id: string | null | undefined) =>
  id ? TOURNAMENTS.find((event) => event.id === id) ?? null : null

export const tournamentEntryCost = (event: TournamentEvent) =>
  event.format === 'ONLINE' ? 0 : event.travel + event.service

export const tournamentMode = (event: TournamentEvent) =>
  event.circuitTier === 1 ? 'cup' : event.circuitTier === 2 ? 'showmatch' : 'scrim'
