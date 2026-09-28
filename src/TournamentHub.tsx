import { useState } from 'react'
import { formatGameDateTime, humanTimeUntil } from './calendar'
import { tournamentForId } from './events'
import type { GameState } from './game'
import {
  PLAYER_TEAM_ID,
  groupStandings,
  nextPlayerMatch,
  tournamentTeam,
  type TournamentMatch,
  type TournamentRun,
} from './tournamentEngine'

const scoreLabel = (match: TournamentMatch) =>
  match.status === 'complete' && match.scoreA != null && match.scoreB != null
    ? match.scoreA + ':' + match.scoreB
    : '—'

const teamName = (run: TournamentRun, teamId: string | null) =>
  teamId ? tournamentTeam(run, teamId)?.name ?? 'TBD' : 'TBD'

function MatchCard({ run, match }: { run: TournamentRun; match: TournamentMatch }) {
  const playerMatch = match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID
  const complete = match.status === 'complete'
  return (
    <article className={'bracket-match' + (playerMatch ? ' is-player' : '') + (complete ? ' is-complete' : '')}>
      <div className="bracket-match-meta">
        <span>{match.label}</span>
        <small>{formatGameDateTime(match.scheduledAt)}</small>
      </div>
      <div className={(match.winnerId === match.teamAId ? ' winner' : '')}>
        <span>{teamName(run, match.teamAId)}</span>
        <b>{complete ? match.scoreA : '—'}</b>
      </div>
      <div className={(match.winnerId === match.teamBId ? ' winner' : '')}>
        <span>{teamName(run, match.teamBId)}</span>
        <b>{complete ? match.scoreB : '—'}</b>
      </div>
    </article>
  )
}

function GroupTable({ run, group }: { run: TournamentRun; group: 'A' | 'B' }) {
  const table = groupStandings(run, group)
  return (
    <section className="tournament-group">
      <header><span>GROUP {group}</span><b>W-L</b></header>
      {table.map((row, index) => (
        <div key={row.teamId} className={row.teamId === PLAYER_TEAM_ID ? 'is-player' : ''}>
          <i>{index + 1}</i>
          <span>{teamName(run, row.teamId)}</span>
          <b>{row.wins}-{row.losses}</b>
          <small>{row.mapDiff >= 0 ? '+' : ''}{row.mapDiff}</small>
        </div>
      ))}
    </section>
  )
}

const playoffColumns = (run: TournamentRun) => {
  if (run.structure === 'single_elim') {
    return [
      { label: 'QUARTERFINALS', matches: run.matches.filter((match) => match.stage === 'quarterfinal') },
      { label: 'SEMIFINALS', matches: run.matches.filter((match) => match.stage === 'semifinal') },
      { label: 'FINAL', matches: run.matches.filter((match) => match.stage === 'final') },
    ]
  }

  if (run.structure === 'groups_single') {
    return [
      { label: 'SEMIFINALS', matches: run.matches.filter((match) => match.stage === 'semifinal') },
      { label: 'FINAL', matches: run.matches.filter((match) => match.stage === 'final') },
    ]
  }

  return [
    { label: 'UPPER', matches: run.matches.filter((match) => match.stage === 'upper') },
    { label: 'LOWER', matches: run.matches.filter((match) => match.stage === 'lower') },
    { label: 'FINAL', matches: run.matches.filter((match) => match.stage === 'final') },
  ]
}

export function TournamentHub({
  state,
  onAdvance,
}: {
  state: GameState
  onAdvance: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const run = state.activeTournament
  if (!run) return null
  const event = tournamentForId(run.eventId)
  if (!event) return null

  const next = nextPlayerMatch(run)
  const columns = playoffColumns(run)
  const canAdvance = Boolean(next && state.now < next.scheduledAt)
  const currentMatch = Boolean(next && state.now >= next.scheduledAt)
  const waiting = !next && !['eliminated', 'champion', 'complete'].includes(run.status)

  return (
    <>
      <section className="sim-event-banner">
        <div className="sim-event-banner-main">
          <div>
            <span>{event.format} · TIER {event.circuitTier} · {event.region.toUpperCase()}</span>
            <h1>{event.name}</h1>
            <p>{formatGameDateTime(run.startsAt)} — {formatGameDateTime(run.endsAt)} · {event.structure.replaceAll('_', ' ').toUpperCase()}</p>
          </div>
          <div className="sim-event-banner-status">
            <small>STATUS</small>
            <strong>{run.status.replaceAll('_', ' ').toUpperCase()}</strong>
            <span>{run.placement ?? 'LIVE BRACKET'}</span>
          </div>
        </div>

        <div className="sim-event-banner-match">
          <div>
            <span>{currentMatch ? 'CURRENT CLUB MATCH' : 'NEXT CLUB MATCH'}</span>
            {next ? (
              <>
                <strong>{teamName(run, next.teamAId)} <i>VS</i> {teamName(run, next.teamBId)}</strong>
                <small>{next.label} · {formatGameDateTime(next.scheduledAt)} · {humanTimeUntil(state.now, next.scheduledAt)}</small>
              </>
            ) : (
              <>
                <strong>{waiting ? 'BRACKET PROCESSING' : run.placement ?? run.status.toUpperCase()}</strong>
                <small>{waiting ? 'Ожидаются результаты остальных матчей.' : 'Турнирный маршрут завершён.'}</small>
              </>
            )}
          </div>
          <div className="sim-event-banner-actions">
            <button className="secondary" onClick={() => setExpanded(true)}>VIEW BRACKET</button>
            {(canAdvance || waiting) && (
              <button className="sim-primary-action" onClick={onAdvance}>
                ADVANCE TO NEXT MATCH <span>→</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {expanded && (
        <div className="tournament-bracket-backdrop" role="dialog" aria-modal="true" aria-label={event.name + ' bracket'}>
          <section className="tournament-bracket-modal">
            <header className="tournament-bracket-modal-head">
              <div>
                <span>{event.format} · TIER {event.circuitTier}</span>
                <h2>{event.name}</h2>
              </div>
              <button onClick={() => setExpanded(false)} aria-label="Закрыть сетку">×</button>
            </header>

            {run.structure !== 'single_elim' && (
              <>
                <div className="tournament-groups">
                  <GroupTable run={run} group="A" />
                  <GroupTable run={run} group="B" />
                </div>
                <div className="tournament-group-fixtures">
                  <span>YOUR GROUP FIXTURES</span>
                  <div>
                    {run.matches
                      .filter((match) => match.stage === 'group' && (match.teamAId === PLAYER_TEAM_ID || match.teamBId === PLAYER_TEAM_ID))
                      .map((match) => (
                        <article key={match.id} className={match.status === 'complete' ? 'complete' : ''}>
                          <small>{formatGameDateTime(match.scheduledAt)}</small>
                          <strong>
                            <span>{teamName(run, match.teamAId)}</span>
                            <i>{scoreLabel(match)}</i>
                            <span>{teamName(run, match.teamBId)}</span>
                          </strong>
                          <b>{match.status === 'complete' ? (match.winnerId === PLAYER_TEAM_ID ? 'WIN' : 'LOSS') : match.label}</b>
                        </article>
                      ))}
                  </div>
                </div>
              </>
            )}

            <div className="tournament-bracket">
              {columns.map((column) => (
                <section key={column.label} className="bracket-column">
                  <header>{column.label}</header>
                  <div>
                    {column.matches.map((match) => <MatchCard key={match.id} run={run} match={match} />)}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
