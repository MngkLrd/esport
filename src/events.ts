export type TournamentTier = 'S' | 'A' | 'B' | 'C'
export type CircuitTier = 1 | 2 | 3
export type EventFormat = 'LAN' | 'ONLINE'
export type TournamentRegion = 'Europe' | 'Americas' | 'Asia' | 'CIS'

export interface TournamentEvent {
  id: string
  name: string
  city: string
  region: TournamentRegion
  tier: TournamentTier
  circuitTier: CircuitTier
  format: EventFormat
  longitude: number
  latitude: number
  prize: number
  travel: number
  service: number
  fatigue: number
  label: string
  unlockLevel: number
}

export const TOURNAMENTS: readonly TournamentEvent[] = [
  // Tier 3: dense online circuit. These should be the player's bread-and-butter early season.
  { id: 'eu-open-1', name: 'European Open Series', city: 'Europe Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: 15, latitude: 51, prize: 900, travel: 0, service: 80, fatigue: 2, label: 'ONLINE · OPEN BRACKET', unlockLevel: 1 },
  { id: 'nordic-online', name: 'Nordic Challenger', city: 'Nordics Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: 20, latitude: 61, prize: 1100, travel: 0, service: 90, fatigue: 2, label: 'ONLINE · 16 TEAMS', unlockLevel: 1 },
  { id: 'dach-online', name: 'DACH Open Cup', city: 'DACH Online', region: 'Europe', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: 10, latitude: 50, prize: 1050, travel: 0, service: 90, fatigue: 2, label: 'ONLINE · SWISS', unlockLevel: 1 },
  { id: 'cis-open', name: 'Eastern Circuit Open', city: 'CIS Online', region: 'CIS', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: 45, latitude: 50, prize: 950, travel: 0, service: 85, fatigue: 2, label: 'ONLINE · OPEN BRACKET', unlockLevel: 1 },
  { id: 'na-open', name: 'North America Open', city: 'NA Online', region: 'Americas', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: -98, latitude: 39, prize: 1150, travel: 0, service: 100, fatigue: 3, label: 'ONLINE · 16 TEAMS', unlockLevel: 1 },
  { id: 'sa-open', name: 'South America Open', city: 'SA Online', region: 'Americas', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: -58, latitude: -15, prize: 1000, travel: 0, service: 90, fatigue: 3, label: 'ONLINE · 16 TEAMS', unlockLevel: 1 },
  { id: 'asia-open', name: 'Asia Open Series', city: 'Asia Online', region: 'Asia', tier: 'C', circuitTier: 3, format: 'ONLINE', longitude: 105, latitude: 34, prize: 1000, travel: 0, service: 95, fatigue: 3, label: 'ONLINE · OPEN BRACKET', unlockLevel: 1 },

  // Tier 2: online leagues + regional LANs.
  { id: 'eu-challenger', name: 'European Challenger League', city: 'Europe Online', region: 'Europe', tier: 'B', circuitTier: 2, format: 'ONLINE', longitude: 18, latitude: 48, prize: 2400, travel: 0, service: 160, fatigue: 4, label: 'ONLINE · LEAGUE', unlockLevel: 2 },
  { id: 'na-challenger', name: 'NA Challenger League', city: 'NA Online', region: 'Americas', tier: 'B', circuitTier: 2, format: 'ONLINE', longitude: -96, latitude: 37, prize: 2500, travel: 0, service: 170, fatigue: 4, label: 'ONLINE · LEAGUE', unlockLevel: 2 },
  { id: 'cis-challenger', name: 'Eastern Challenger League', city: 'CIS Online', region: 'CIS', tier: 'B', circuitTier: 2, format: 'ONLINE', longitude: 50, latitude: 51, prize: 2300, travel: 0, service: 155, fatigue: 4, label: 'ONLINE · LEAGUE', unlockLevel: 2 },
  { id: 'asia-challenger', name: 'Asia Challenger League', city: 'Asia Online', region: 'Asia', tier: 'B', circuitTier: 2, format: 'ONLINE', longitude: 112, latitude: 30, prize: 2300, travel: 0, service: 155, fatigue: 4, label: 'ONLINE · LEAGUE', unlockLevel: 2 },
  { id: 'helsinki', name: 'Nordic Masters', city: 'Helsinki', region: 'Europe', tier: 'A', circuitTier: 2, format: 'LAN', longitude: 24.94, latitude: 60.17, prize: 3200, travel: 180, service: 240, fatigue: 6, label: 'LAN · 8 TEAMS', unlockLevel: 2 },
  { id: 'almaty', name: 'Steppe Invitational', city: 'Almaty', region: 'CIS', tier: 'B', circuitTier: 2, format: 'LAN', longitude: 76.89, latitude: 43.24, prize: 2700, travel: 430, service: 280, fatigue: 8, label: 'LAN · 8 TEAMS', unlockLevel: 2 },
  { id: 'prague', name: 'Prague Challenger', city: 'Prague', region: 'Europe', tier: 'B', circuitTier: 2, format: 'LAN', longitude: 14.44, latitude: 50.08, prize: 2900, travel: 240, service: 260, fatigue: 7, label: 'LAN · 12 TEAMS', unlockLevel: 2 },
  { id: 'lisbon', name: 'Atlantic Invitational', city: 'Lisbon', region: 'Europe', tier: 'A', circuitTier: 2, format: 'LAN', longitude: -9.14, latitude: 38.72, prize: 3500, travel: 390, service: 300, fatigue: 8, label: 'LAN · 12 TEAMS', unlockLevel: 3 },
  { id: 'buenos-aires', name: 'Southern Masters', city: 'Buenos Aires', region: 'Americas', tier: 'A', circuitTier: 2, format: 'LAN', longitude: -58.38, latitude: -34.6, prize: 3700, travel: 820, service: 390, fatigue: 13, label: 'LAN · 12 TEAMS', unlockLevel: 3 },
  { id: 'dubai', name: 'Gulf Invitational', city: 'Dubai', region: 'Asia', tier: 'A', circuitTier: 2, format: 'LAN', longitude: 55.27, latitude: 25.2, prize: 3900, travel: 610, service: 420, fatigue: 11, label: 'LAN · 12 TEAMS', unlockLevel: 3 },

  // Tier 1: top LAN circuit.
  { id: 'dallas', name: 'Lone Star Clash', city: 'Dallas', region: 'Americas', tier: 'S', circuitTier: 1, format: 'LAN', longitude: -96.8, latitude: 32.78, prize: 5800, travel: 760, service: 510, fatigue: 15, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'cologne', name: 'Rhine Arena', city: 'Cologne', region: 'Europe', tier: 'S', circuitTier: 1, format: 'LAN', longitude: 6.96, latitude: 50.94, prize: 7200, travel: 260, service: 360, fatigue: 9, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'katowice', name: 'Steel Cup', city: 'Katowice', region: 'Europe', tier: 'S', circuitTier: 1, format: 'LAN', longitude: 19.02, latitude: 50.26, prize: 7600, travel: 250, service: 380, fatigue: 10, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'chengdu', name: 'Chengdu Masters', city: 'Chengdu', region: 'Asia', tier: 'S', circuitTier: 1, format: 'LAN', longitude: 104.07, latitude: 30.67, prize: 7400, travel: 980, service: 590, fatigue: 18, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
  { id: 'sao-paulo', name: 'São Paulo Championship', city: 'São Paulo', region: 'Americas', tier: 'S', circuitTier: 1, format: 'LAN', longitude: -46.63, latitude: -23.55, prize: 7000, travel: 880, service: 460, fatigue: 16, label: 'LAN · 16 TEAMS', unlockLevel: 5 },
] as const

export const tournamentForId = (id: string | null | undefined) =>
  id ? TOURNAMENTS.find((event) => event.id === id) ?? null : null

export const tournamentEntryCost = (event: TournamentEvent) => event.travel + event.service

export const tournamentMode = (event: TournamentEvent) =>
  event.circuitTier === 1 ? 'cup' : event.circuitTier === 2 ? 'showmatch' : 'scrim'
