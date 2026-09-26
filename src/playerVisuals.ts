import { PLAYER_PORTRAIT_STATS, portraitForAlias } from './playerPhotos'

export type CardTier = 'gold' | 'elite' | 'rare' | 'silver'

const FLAGS: Record<string, string> = {
  Russia: '🇷🇺',
  France: '🇫🇷',
  Estonia: '🇪🇪',
  Israel: '🇮🇱',
  'United Kingdom': '🇬🇧',
  Ukraine: '🇺🇦',
  Belarus: '🇧🇾',
  Hungary: '🇭🇺',
  Brazil: '🇧🇷',
  Latvia: '🇱🇻',
  Kazakhstan: '🇰🇿',
  Denmark: '🇩🇰',
  Finland: '🇫🇮',
  Romania: '🇷🇴',
  Kosovo: '🇽🇰',
  'Bosnia and Herzegovina': '🇧🇦',
  'Czech Republic': '🇨🇿',
}

export function playerPhoto(alias: string) {
  return portraitForAlias(alias)?.url ?? null
}

export function playerPhotoSource(alias: string) {
  return portraitForAlias(alias)?.source ?? null
}

export { PLAYER_PORTRAIT_STATS }

export function countryFlag(country: string) {
  return FLAGS[country] ?? '🌐'
}

export function cardTier(ovr: number): CardTier {
  if (ovr >= 82) return 'gold'
  if (ovr >= 76) return 'elite'
  if (ovr >= 68) return 'rare'
  return 'silver'
}

export const CARD_TIER_LABEL: Record<CardTier, string> = {
  gold: 'GOLD STAR',
  elite: 'ELITE',
  rare: 'RARE',
  silver: 'SILVER',
}
