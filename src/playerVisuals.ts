// Visual layer for collectible-style player cards.
// Portraits are loaded remotely; the repository does not re-host third-party photographs.
// Missing portraits deliberately fall back to a generated monogram card instead of a broken image.

export type CardTier = 'gold' | 'elite' | 'rare' | 'silver'

const PLAYER_PHOTOS: Record<string, string> = {
  donk: 'https://www.game-settings.com/uploads/donk.webp',
  apex: 'https://framerusercontent.com/images/LwIGyRGUFU1srH3RNBZ42a1jvDI.png?height=1044&width=830',
  zywoo: 'https://profilerr.net/static/content/thumbs/560x583/a/ae/rps5ue---c560x583x50px50p--042acc2efbf4ec175762101e74d8baea.png',
  mezii: 'https://configs-csgo.ru/upload/000/u1/8/3/ec31ed8b.png',
  ropz: 'https://hel1.your-objectstorage.com/hel2/2025/08/22131615/ropz-Vitality.webp',
  flamez: 'https://img-cdn.hltv.org/playerbodyshot/LUQi5dX9boyO0uDadUGht5.png?ixlib=java-2.1.0&s=1c5c46fe41e79b19a69b479d8abbbb41&w=400',
}

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
  return PLAYER_PHOTOS[alias.toLocaleLowerCase('en-US')] ?? null
}

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
