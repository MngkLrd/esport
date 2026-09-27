export interface HltvIdentityFallback {
  profileId: number
  profileUrl: string
  realName: string | null
  country: string | null
  age: number | null
  bodyshotUrl: string | null
  source: string
}

// Fallbacks are intentionally sparse and only contain identities verified against
// an HLTV player page. The normal metadata/portrait manifests remain primary.
export const HLTV_IDENTITY_FALLBACKS: Readonly<Record<string, HltvIdentityFallback>> = {
  vicu: {
    profileId: 22062,
    profileUrl: 'https://www.hltv.org/player/22062/vicu',
    realName: 'Wiktoria Janicka',
    country: 'Poland',
    age: 23,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/nkBkrWRTLVq_qah3pPAEBm.png?ixlib=java-2.1.0&s=c9fca870686f990ecdc0a8cd5fe710b0&w=400',
    source: 'HLTV player page · Sep 2026',
  },
} as const

export function hltvIdentityFallbackForAlias(alias: string) {
  return HLTV_IDENTITY_FALLBACKS[alias.toLocaleLowerCase('en-US')] ?? null
}
