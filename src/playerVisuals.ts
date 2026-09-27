import { PLAYER_PORTRAIT_STATS, portraitForAlias } from './playerPhotos'
import { hltvIdentityFallbackForAlias } from './hltvIdentityFallbacks'

export type CardTier = 'gold' | 'elite' | 'rare' | 'silver'

const COUNTRY_CODES: Record<string, string> = {
  Russia: 'RU',
  France: 'FR',
  Estonia: 'EE',
  Israel: 'IL',
  'United Kingdom': 'GB',
  UK: 'GB',
  Ukraine: 'UA',
  Belarus: 'BY',
  Hungary: 'HU',
  Brazil: 'BR',
  Latvia: 'LV',
  Kazakhstan: 'KZ',
  Denmark: 'DK',
  Finland: 'FI',
  Romania: 'RO',
  Kosovo: 'XK',
  'Bosnia and Herzegovina': 'BA',
  'Bosnia & Herzegovina': 'BA',
  'Czech Republic': 'CZ',
  Czechia: 'CZ',
  Poland: 'PL',
  Sweden: 'SE',
  Norway: 'NO',
  Germany: 'DE',
  Netherlands: 'NL',
  Belgium: 'BE',
  Spain: 'ES',
  Portugal: 'PT',
  Lithuania: 'LT',
  Serbia: 'RS',
  Croatia: 'HR',
  Slovakia: 'SK',
  Slovenia: 'SI',
  Bulgaria: 'BG',
  Turkey: 'TR',
  'United States': 'US',
  USA: 'US',
  Canada: 'CA',
  Mexico: 'MX',
  Argentina: 'AR',
  Chile: 'CL',
  Peru: 'PE',
  Colombia: 'CO',
  Uruguay: 'UY',
  Australia: 'AU',
  'New Zealand': 'NZ',
  China: 'CN',
  Mongolia: 'MN',
  Japan: 'JP',
  'South Korea': 'KR',
}

const flagFromCode = (code: string) =>
  code
    .toUpperCase()
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('')

export function playerPhoto(alias: string) {
  return portraitForAlias(alias)?.url ?? hltvIdentityFallbackForAlias(alias)?.bodyshotUrl ?? null
}

export function playerPhotoSource(alias: string) {
  return portraitForAlias(alias)?.source ?? hltvIdentityFallbackForAlias(alias)?.source ?? null
}

export { PLAYER_PORTRAIT_STATS }

export function countryFlag(country: string) {
  const code = COUNTRY_CODES[country.trim()]
  return code ? flagFromCode(code) : '🌐'
}

export function cardTier(ovr: number): CardTier {
  if (ovr >= 82) return 'gold'
  if (ovr >= 76) return 'elite'
  if (ovr >= 68) return 'rare'
  return 'silver'
}

export const CARD_TIER_LABEL: Record<CardTier, string> = {
  gold: 'ЗОЛОТАЯ ЗВЕЗДА',
  elite: 'ЭЛИТНАЯ',
  rare: 'РЕДКАЯ',
  silver: 'СЕРЕБРЯНАЯ',
}
