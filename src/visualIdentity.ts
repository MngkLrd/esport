export interface PlayerVisualIdentity {
  profileId: number
  bodyshotUrl: string
  source: string
}

export interface TeamVisualIdentity {
  logoUrl: string
  source: string
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('en-US')

const PLAYER_VISUAL_IDENTITIES: Readonly<Record<string, PlayerVisualIdentity>> = {
  tom1jed: {
    profileId: 18554,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/rdNwRP3dv2uOXqur-BbY3B.png?ixlib=java-2.1.0&s=15526e47fc3713be774ba2abe4830e1f&w=400',
    source: 'HLTV · ShindeN roster · 2026-09-30',
  },
  abizz: {
    profileId: 20451,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/wa1wl6qJlm9RDuliS9o3Kt.png?ixlib=java-2.1.0&s=b242e3627633011484c495dc670ff8bc&w=400',
    source: 'HLTV · ShindeN roster · 2026-09-30',
  },
  ivz: {
    profileId: 20992,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/A_jZhaA9MgMekugyC5g-fY.png?ixlib=java-2.1.0&s=83087a4018dd6c6419a6d80d30b82ceb&w=400',
    source: 'HLTV · ShindeN roster · 2026-09-30',
  },
  naz: {
    profileId: 21155,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/x6ZATZ9QcrbVgEpAdfjIxV.png?ixlib=java-2.1.0&s=6af81be1f2d2ce3c2a2cb38bf9d4b947&w=400',
    source: 'HLTV · ShindeN roster · 2026-09-30',
  },
  guty: {
    profileId: 24749,
    bodyshotUrl: 'https://img-cdn.hltv.org/playerbodyshot/ZonW-1eWiBPxEP4hJ7WmKO.png?ixlib=java-2.1.0&s=def2979338a424c19b67dd0956c9a5a6&w=400',
    source: 'HLTV · ShindeN roster · 2026-09-30',
  },
}

const TEAM_VISUAL_IDENTITIES: Readonly<Record<string, TeamVisualIdentity>> = {
  shinden: {
    logoUrl: 'https://img-cdn.hltv.org/teamlogo/Wz4H8kfHRRVA3qI97__Pq1.png?ixlib=java-2.1.0&s=5a8ea5d2dea8ae4439c443aa93c30c06&w=50',
    source: 'HLTV team 12959 · 2026-09-30',
  },
}

export const playerVisualIdentity = (alias: string) =>
  PLAYER_VISUAL_IDENTITIES[normalize(alias)] ?? null

export const teamVisualIdentity = (teamName: string) =>
  TEAM_VISUAL_IDENTITIES[normalize(teamName)] ?? null

export const playerVisualProfileId = (alias: string) =>
  playerVisualIdentity(alias)?.profileId ?? null

export const playerVisualBodyshot = (alias: string) =>
  playerVisualIdentity(alias)?.bodyshotUrl ?? null

export const teamVisualLogo = (teamName: string) =>
  teamVisualIdentity(teamName)?.logoUrl ?? null
