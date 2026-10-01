import { useMemo } from 'react'
import { formatGameDate } from './calendar'
import { overall, type GameState, type Player } from './game'
import { PlayerPortrait } from './PlayerPortrait'
import { countryFlag } from './playerVisuals'
import { TeamBadge } from './TeamBadge'
import { PLAYER_CLUB_WORLD_ID, type WorldPlayer, type WorldTeam } from './world'

const worldPlayerRole = (role: WorldPlayer['role']) => role ?? 'Rifler'

const clubWorldTeam = (state: GameState): WorldTeam => ({
  id: PLAYER_CLUB_WORLD_ID,
  name: 'YOUR CLUB',
  vrsRank: state.world.teams.find((team) => team.id === PLAYER_CLUB_WORLD_ID)?.vrsRank ?? 999,
  vrsPoints: state.clubVrsPoints,
  rosterKeys: state.roster.map((player) => player.playerKey ?? player.id),
  rating: Math.round(state.roster.length ? state.roster.reduce((sum, player) => sum + overall(player), 0) / state.roster.length : 0),
  form: Math.round(state.roster.length ? state.roster.reduce((sum, player) => sum + player.form, 0) / state.roster.length : 0),
  active: true,
})

export function TeamProfile({
  state,
  teamId,
  onClose,
  onOpenPlayer,
}: {
  state: GameState
  teamId: string
  onClose: () => void
  onOpenPlayer?: (player: Player) => void
}) {
  const isClub = teamId === PLAYER_CLUB_WORLD_ID
  const team = isClub
    ? clubWorldTeam(state)
    : state.world.teams.find((candidate) => candidate.id === teamId) ?? null

  const worldRoster = useMemo(() => {
    if (!team || isClub) return []
    return team.rosterKeys
      .map((key) => state.world.players[key])
      .filter((player): player is WorldPlayer => Boolean(player))
  }, [team, isClub, state.world.players])

  const competitions = useMemo(() => {
    const ecology = state.world.ecology
    if (!ecology || !team) return []
    return Object.values(ecology.competitions)
      .filter((competition) => competition.participantTeamIds.includes(team.id))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 8)
  }, [state.world.ecology, team])

  const trophies = competitions.filter((competition) => competition.winnerTeamId === team?.id)
  const transfers = useMemo(() => {
    if (!team) return []
    return state.world.transferHistory
      .filter((entry) => entry.fromTeamId === team.id || entry.toTeamId === team.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
  }, [state.world.transferHistory, team])

  const recentClubMatches = isClub ? state.history.slice(0, 6) : []

  if (!team) return null

  return (
    <div className="team-profile-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="team-profile" role="dialog" aria-modal="true" aria-label={team.name} onMouseDown={(event) => event.stopPropagation()}>
        <header className="team-profile-head">
          <TeamBadge name={team.name} size="lg" />
          <div>
            <span>{isClub ? 'CLUB PROFILE · MANAGEMENT' : 'TEAM PROFILE · WORLD'}</span>
            <h2>{team.name}</h2>
            <p>VRS #{team.vrsRank} · {Math.round(team.vrsPoints)} PTS · {team.rating} OVR</p>
          </div>
          <div className="team-profile-kpis">
            <span><small>FORM</small><b>{team.form}</b></span>
            <span><small>ROSTER</small><b>{isClub ? state.roster.length : worldRoster.length}</b></span>
            <span><small>TROPHIES</small><b>{trophies.length}</b></span>
          </div>
          <button className="team-profile-close" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        <div className="team-profile-body">
          <main className="team-profile-main">
            <section className="team-profile-section team-profile-roster">
              <div className="team-profile-section-head"><span>ROSTER</span><b>{isClub ? state.roster.length : worldRoster.length}</b></div>
              <div className="team-profile-roster-list">
                {isClub ? state.roster.map((player) => (
                  <button key={player.id} type="button" onClick={() => onOpenPlayer?.(player)}>
                    <span className="team-profile-player-photo"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} /></span>
                    <span className="team-profile-player-copy"><strong>{player.alias}</strong><small>{countryFlag(player.country)} {player.country} · {player.role}</small></span>
                    <span className="team-profile-player-ovr"><b>{overall(player)}</b><small>OVR</small></span>
                  </button>
                )) : worldRoster.map((player) => (
                  <article key={player.key}>
                    <span className="team-profile-player-photo"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} /></span>
                    <span className="team-profile-player-copy"><strong>{player.alias}</strong><small>{countryFlag(player.country ?? '')} {player.country ?? 'INT'} · {worldPlayerRole(player.role)}</small></span>
                    <span className="team-profile-player-ovr"><b>{player.currentRating}</b><small>OVR</small></span>
                  </article>
                ))}
              </div>
            </section>

            <section className="team-profile-section">
              <div className="team-profile-section-head"><span>RECENT MATCHES</span><b>{isClub ? recentClubMatches.length : 'WORLD'}</b></div>
              {isClub && recentClubMatches.length ? (
                <div className="team-profile-matches">
                  {recentClubMatches.map((match) => (
                    <div key={match.id}>
                      <span>{formatGameDate(match.date)}</span>
                      <strong>YOUR CLUB <i>{match.maps.reduce((sum, map) => sum + (map.us > map.them ? 1 : 0), 0)}:{match.maps.reduce((sum, map) => sum + (map.them > map.us ? 1 : 0), 0)}</i> {match.opponent}</strong>
                      <small>{match.mode.toUpperCase()}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="team-profile-empty">Полная match history для AI-команд пока хранится только внутри турниров мира.</div>
              )}
            </section>

            <section className="team-profile-section">
              <div className="team-profile-section-head"><span>TOURNAMENTS</span><b>{competitions.length}</b></div>
              <div className="team-profile-tournaments">
                {competitions.map((competition) => (
                  <div key={competition.id}>
                    <span>T{competition.tier} · {competition.format}</span>
                    <strong>{competition.name}</strong>
                    <small>{formatGameDate(competition.startsAt)} · {competition.winnerTeamId === team.id ? 'WINNER' : competition.status.toUpperCase()}</small>
                  </div>
                ))}
                {!competitions.length && <div className="team-profile-empty">Турнирных записей пока нет.</div>}
              </div>
            </section>
          </main>

          <aside className="team-profile-side">
            <section>
              <div className="team-profile-section-head"><span>STAFF</span><b>{isClub ? 'MANAGE' : 'INFO'}</b></div>
              <div className="team-profile-staff-slot">
                <span>◎</span>
                <strong>HEAD COACH</strong>
                <small>VACANT</small>
              </div>
              {isClub && (
                <div className="team-profile-manager-slot">
                  <span>MANAGER</span>
                  <strong>YOU</strong>
                  <small>LVL {state.managerLevel} · {state.managerXp} XP</small>
                </div>
              )}
            </section>

            <section>
              <div className="team-profile-section-head"><span>TROPHIES</span><b>{trophies.length}</b></div>
              <div className="team-profile-trophies">
                {trophies.map((competition) => <span key={competition.id}>◆ {competition.name}</span>)}
                {!trophies.length && <small>Пока без трофеев.</small>}
              </div>
            </section>

            <section>
              <div className="team-profile-section-head"><span>ROSTER CHANGES</span><b>{transfers.length}</b></div>
              <div className="team-profile-transfers">
                {transfers.map((transfer) => (
                  <div key={transfer.id}>
                    <span>{transfer.toTeamId === team.id ? 'IN' : 'OUT'}</span>
                    <strong>{transfer.alias}</strong>
                    <small>{formatGameDate(transfer.date)}</small>
                  </div>
                ))}
                {!transfers.length && <small>Изменений состава пока нет.</small>}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  )
}
