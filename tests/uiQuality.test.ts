import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

const visual = read('src/visualHierarchy.css')
const simCss = read('src/simUI.css')
const app = read('src/App.tsx')
const news = read('src/WorldPortal.tsx')
const teamProfile = read('src/TeamProfile.tsx')
const teamBadge = read('src/TeamBadge.tsx')
const playerIdentity = read('src/PlayerIdentity.tsx')
const tournament = read('src/TournamentHub.tsx')
const world = read('src/WorldMap.tsx')
const lobby = read('src/MatchLobby.tsx')
const radar = read('src/MatchRadar.tsx')
const packs = read('src/PacksView.tsx')

describe('2026 UI quality pass', () => {
  it('locks collectible cards to the intended portrait ratio', () => {
    expect(visual).toMatch(/\.collectible-player-card,[\s\S]*?aspect-ratio:5 \/ 7!important;[\s\S]*?height:auto!important;/)
    expect(visual).toMatch(/\.squad-opt-starter-card \.visual-player-card\{[\s\S]*?aspect-ratio:5 \/ 7!important;/)
    expect(visual).toMatch(/\.squad-opt-pool-card \.visual-player-card\{[\s\S]*?aspect-ratio:5 \/ 7!important;/)
  })

  it('prevents the late hierarchy stylesheet from collapsing the new Squad layout', () => {
    expect(visual).toMatch(/\.sim-roster-v2\.view-squad\{[\s\S]*?grid-template-rows:44px 40px minmax\(0,1fr\)!important;/)
    expect(visual).toMatch(/\.view-squad \.squad-opt-stage-grid\{[\s\S]*?align-items:start!important;/)
  })

  it('removes the legacy blue modal chrome and defines contrast-safe states', () => {
    expect(simCss).not.toContain('#091027')
    expect(simCss).not.toContain('#0e1731')
    expect(simCss).not.toContain('rgba(96,69,214,.12)')
    expect(simCss).not.toContain('background:rgba(12,18,43,.78)')
    expect(visual).toContain('Dark-theme contrast guard for interactive states.')
    expect(visual).toMatch(/:disabled\{[\s\S]*?color:var\(--ui-muted\)!important;/)
    expect(visual).toMatch(/:focus-visible\{[\s\S]*?outline:2px solid var\(--ui-accent\)/)
  })

  it('uses the modern player management profile instead of the old detail card', () => {
    expect(app).toContain('className="player-profile-v2"')
    expect(app).toContain('player-profile-contract')
    expect(app).toContain('player-profile-stat-grid')
    expect(app).toContain('RENEW CONTRACT')
    expect(app).toContain('DEVELOPMENT FOCUS')
    expect(app).toContain('RECENT FORM')
    expect(app).toContain('recentPerformances')
    expect(app).toContain('<TeamBadge name={player.team}')
  })

  it('provides shared player and team identity primitives with fallbacks', () => {
    expect(teamBadge).toContain('teamVisualLogo')
    expect(teamBadge).toContain('initialsFor')
    expect(playerIdentity).toContain('PlayerPortrait')
    expect(playerIdentity).toContain('countryFlag')
    expect(playerIdentity).toContain("team ? ' · ' + team")
  })

  it('uses team identities in VRS, bracket, prematch lobby and current matchup', () => {
    expect(world).toContain('<TeamBadge name={row.name}')
    expect(tournament).toContain('className="bracket-team"')
    expect(tournament).toContain('<TeamBadge name={teamName(run, match.teamAId)}')
    expect(lobby).toContain('<TeamBadge name="YOUR CLUB"')
    expect(lobby).toContain('<TeamBadge name={result.opponent}')
    expect(radar).toContain('<TeamBadge name={result.opponent} size="sm" />')
    expect(radar).toContain('className="match-radar-score-team away"')
    expect(app).toContain('className="fifa-current-match-teams"')
    expect(app).toContain('<TeamBadge name={bracketOpponent?.name')
  })

  it('exposes HLTV-style world and own-club profiles', () => {
    expect(teamProfile).toContain('TEAM PROFILE · WORLD')
    expect(teamProfile).toContain('CLUB PROFILE · MANAGEMENT')
    expect(teamProfile).toContain('ROSTER')
    expect(teamProfile).toContain('RECENT MATCHES')
    expect(teamProfile).toContain('TOURNAMENTS')
    expect(teamProfile).toContain('TROPHIES')
    expect(teamProfile).toContain('ROSTER CHANGES')
    expect(teamProfile).toContain('MANAGER')
    expect(news).toContain('YOUR CLUB PROFILE')
  })

  it('opens every news item as an article before optional contextual navigation', () => {
    expect(news).toContain("type PortalView = 'inbox' | 'feed' | 'news' | 'article'")
    expect(news).toContain('className="newsroom-article-page"')
    expect(news).toContain('setSelectedStory(story)')
    expect(news).toContain('setSelectedClubItem(item)')
    expect(news).toContain("setView('article')")
    expect(news).toContain('className="newsroom-article-actions"')
    expect(news).toContain('ПЕРЕЙТИ К РЕШЕНИЮ')
    const handlerStart = news.indexOf('const openClubItem')
    const handlerEnd = news.indexOf('const openStory', handlerStart)
    expect(news.slice(handlerStart, handlerEnd)).not.toContain('onNavigate(')
  })

  it('covers newly added tactics, match story and live simulation states', () => {
    expect(lobby).toContain('className="match-lobby-tactics"')
    expect(lobby).toContain('className="match-story-panel"')
    expect(simCss).toContain('.match-lobby-tactics button.is-active')
    expect(simCss).toContain('.match-story-maps>article')
    expect(simCss).toContain('.match-radar-score-team')
  })

  it('keeps tournament visuals in one shared graphite system', () => {
    expect(visual).toContain('Tournament screens share one visual language')
    expect(visual).toMatch(/\.sim-event-banner,[\s\S]*?\.bracket-match\{[\s\S]*?background-color:rgb\(var\(--ui-panel-rgb\) \/ \.88\)!important;/)
    expect(visual).toContain('.bracket-match.is-player')
  })

  it('places the pack spin action immediately after the reel', () => {
    const reel = packs.indexOf("className={'pack-reel-window pack-reel-modal'")
    const launch = packs.indexOf('className="pack-spin-launch"')
    expect(reel).toBeGreaterThan(-1)
    expect(launch).toBeGreaterThan(reel)
    expect(packs.slice(reel, launch)).not.toContain('className="pack-spin-button"')
  })

  it('keeps game pages fixed while long regions own their scroll', () => {
    expect(visual).toContain('Internal scroll only: page shell stays fixed like a game screen.')
    expect(visual).toMatch(/\.sim-world,[\s\S]*?\.newsroom\{[\s\S]*?overflow:hidden!important;/)
    expect(visual).toMatch(/\.world-vrs-panel,[\s\S]*?\.player-profile-body>aside\{[\s\S]*?overflow:auto;/)
  })

  it('emphasizes primary Home and Matchday actions and team identity', () => {
    expect(visual).toMatch(/\.fifa-home-continue,[\s\S]*?\.match-lobby-primary\{[\s\S]*?min-height:42px!important;/)
    expect(app).toContain('className="sim-match-team-identity"')
    expect(app).toContain('className="sim-match-team-identity away"')
  })
})
