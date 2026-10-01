import { useMemo, useState } from 'react'
import { overall, type MatchNarrativeTag, type MatchResult, type Player } from './game'
import type { TournamentRosterPlayer } from './tournamentEngine'
import { PlayerPortrait } from './PlayerPortrait'
import { countryFlag } from './playerVisuals'
import { metadataForAlias } from './playerMetadata'
import { cardStatsForAlias } from './cardStats'
import { teamVisualLogo } from './visualIdentity'

export type LobbyVetoAction = {
  step: number
  type: 'BAN' | 'PICK' | 'DECIDER'
  team: 'HOME' | 'AWAY' | 'AUTO'
  map: string
}

type LobbyMap = {
  name: string
  key: string
  description: string
}

const MAPS: LobbyMap[] = [
  { name: 'Ancient', key: 'de_ancient', description: 'Плотная карта с быстрыми ротациями и сильной ценностью utility.' },
  { name: 'Anubis', key: 'de_anubis', description: 'Вертикальные размены, длинные дуэли и высокая цена контроля центра.' },
  { name: 'Dust II', key: 'de_dust2', description: 'Классическая карта про чистый aim, пространство и наказание за ошибки.' },
  { name: 'Inferno', key: 'de_inferno', description: 'Узкие зоны, utility-heavy раунды и постоянная борьба за пространство.' },
  { name: 'Mirage', key: 'de_mirage', description: 'Универсальный баланс между mid-control, сплитами и индивидуальной механикой.' },
  { name: 'Nuke', key: 'de_nuke', description: 'Сложные ротации, вертикальность и большое значение структуры команды.' },
]

const VETO_SEQUENCE: Array<{ type: LobbyVetoAction['type']; team: LobbyVetoAction['team']; label: string }> = [
  { type: 'BAN', team: 'HOME', label: 'YOUR BAN' },
  { type: 'BAN', team: 'AWAY', label: 'OPP BAN' },
  { type: 'PICK', team: 'HOME', label: 'YOUR PICK' },
  { type: 'PICK', team: 'AWAY', label: 'OPP PICK' },
  { type: 'BAN', team: 'HOME', label: 'YOUR BAN' },
  { type: 'DECIDER', team: 'AUTO', label: 'DECIDER' },
]

const hashSeed = (input: string) => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const mapAsset = (key: string) => '/esport/maps/' + key + '.png'

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0

const opponentPlayers = (result: MatchResult): TournamentRosterPlayer[] => {
  if (result.opponentRoster?.length) return result.opponentRoster.slice(0, 5)
  const stem = result.opponent.replace(/[^a-z0-9]/gi, '').slice(0, 7).toUpperCase() || 'RIVAL'
  return Array.from({ length: 5 }, (_, index) => ({
    playerKey: `fallback-${index}`,
    alias: `${stem}-${index + 1}`,
    role: ['Rifler', 'AWP', 'Entry', 'Support', 'IGL'][index] as TournamentRosterPlayer['role'],
    rating: Math.max(45, result.opponentRating - 2 + index),
    profileId: null,
    country: 'INT',
  }))
}

function HomePlayerCard({ player }: { player: Player }) {
  const rating = overall(player)
  return (
    <article className="match-lobby-player is-home">
      <div className="match-lobby-player-photo">
        <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="eager" draggable={false} />
      </div>
      <div className="match-lobby-player-copy">
        <div className="match-lobby-player-name"><strong>{player.alias}</strong><span>{countryFlag(player.country)} {player.role}</span></div>
        <div className="match-lobby-player-stats">
          <span><b>{player.aim}</b>AIM</span>
          <span><b>{player.clutch}</b>CLU</span>
          <span><b>{player.form}</b>FORM</span>
        </div>
      </div>
      <div className="match-lobby-player-ovr"><small>OVR</small><b>{rating}</b></div>
    </article>
  )
}

function AwayPlayerCard({ player }: { player: TournamentRosterPlayer }) {
  const metadata = metadataForAlias(player.alias)
  const profileMatch = metadata?.profileUrl?.match(/\/player\/(\d+)/)
  const profileId = player.profileId ?? (profileMatch ? Number(profileMatch[1]) : null)
  const country = player.country ?? metadata?.country ?? 'INT'
  const role = player.role ?? metadata?.role ?? 'PRO'
  const stats = cardStatsForAlias(player.alias, player.role ?? metadata?.role ?? null)

  return (
    <article className="match-lobby-player is-away">
      <div className="match-lobby-player-photo">
        <PlayerPortrait alias={player.alias} playerId={profileId} alt={player.alias} loading="eager" draggable={false} />
      </div>
      <div className="match-lobby-player-copy">
        <div className="match-lobby-player-name"><strong>{player.alias}</strong><span>{countryFlag(country)} {role}</span></div>
        <div className="match-lobby-player-stats">
          <span><b>{stats?.rating != null ? stats.rating.toFixed(2) : '—'}</b>HLTV</span>
          <span><b>{stats?.aim ?? '—'}</b>AIM</span>
          <span><b>{stats?.clutch ?? '—'}</b>CLU</span>
        </div>
      </div>
      <div className="match-lobby-player-ovr"><small>OVR</small><b>{player.rating}</b></div>
    </article>
  )
}

const STORY_TAG_LABELS: Record<MatchNarrativeTag, string> = {
  COMEBACK: 'COMEBACK',
  STOMP: 'STOMP',
  CHOKE: 'CHOKE',
  CLUTCH_HEAVY: 'CLUTCH HEAVY',
  TACTICAL_OUTPLAY: 'TACTICAL OUTPLAY',
  WEAK_MAP: 'WEAK MAP',
  PLAYER_COLLAPSE: 'PLAYER COLLAPSE',
  ANTI_STRAT_SUCCESS: 'ANTI-STRAT',
  FATIGUE: 'FATIGUE',
  COMMUNICATION_BREAKDOWN: 'COMMUNICATION',
}

function MatchStoryPanel({ result }: { result: MatchResult }) {
  const story = result.story
  if (!story) return null

  return (
    <section className="match-story-panel" aria-label="Разбор матча">
      <header>
        <div>
          <span>MATCH STORY</span>
          <strong>{result.headline}</strong>
        </div>
        <div className="match-story-tags">
          {story.tags.slice(0, 5).map((tag) => <b key={tag}>{STORY_TAG_LABELS[tag]}</b>)}
          {!story.tags.length && <b>CONTROLLED SERIES</b>}
        </div>
      </header>

      <p className="match-story-summary">{story.summary}</p>

      <div className="match-story-maps">
        {story.maps.map((mapStory, index) => {
          const score = result.maps[index]
          return (
            <article key={mapStory.map + index}>
              <div className="match-story-map-head">
                <span>MAP {index + 1}</span>
                <strong>{mapStory.map}</strong>
                <b>{score ? score.us + ':' + score.them : '—'}</b>
              </div>
              <div className="match-story-map-tags">
                {mapStory.tags.slice(0, 4).map((tag) => <span key={tag}>{STORY_TAG_LABELS[tag]}</span>)}
              </div>
              <p>{mapStory.explanation}</p>
              <small>{mapStory.turningPoint}</small>
              <div className="match-story-factors">
                <span><i style={{ width: mapStory.factors.tactics + '%' }} /><b>TACTICS</b><em>{mapStory.factors.tactics}</em></span>
                <span><i style={{ width: mapStory.factors.preparation + '%' }} /><b>PREP</b><em>{mapStory.factors.preparation}</em></span>
                <span><i style={{ width: mapStory.factors.communication + '%' }} /><b>COMMS</b><em>{mapStory.factors.communication}</em></span>
                <span><i style={{ width: mapStory.factors.fatigue + '%' }} /><b>ENERGY</b><em>{mapStory.factors.fatigue}</em></span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function MatchLobby({
  result,
  starters,
  phase,
  initialVeto = [],
  onStart,
  onContinue,
}: {
  result: MatchResult
  starters: Player[]
  phase: 'prematch' | 'result'
  initialVeto?: LobbyVetoAction[]
  onStart?: (maps: string[], veto: LobbyVetoAction[]) => void
  onContinue?: () => void
}) {
  const rivals = useMemo(() => opponentPlayers(result), [result])
  const opponentLogo = teamVisualLogo(result.opponent)
  const [veto, setVeto] = useState<LobbyVetoAction[]>(initialVeto)
  const [focusedMap, setFocusedMap] = useState(
    initialVeto.find((action) => action.type === 'PICK')?.map ?? MAPS[2].name,
  )

  const actionByMap = useMemo(
    () => new Map(veto.map((action) => [action.map, action])),
    [veto],
  )

  const selectedMaps = veto
    .filter((action) => action.type === 'PICK' || action.type === 'DECIDER')
    .map((action) => action.map)
  const nextStep = VETO_SEQUENCE[veto.length]
  const vetoComplete = selectedMaps.length === 3
  const focused = MAPS.find((map) => map.name === focusedMap) ?? MAPS[0]
  const ourMapScore = result.maps.filter((map) => map.us > map.them).length
  const theirMapScore = result.maps.filter((map) => map.them > map.us).length
  const homeRating = average(starters.map(overall))
  const awayRating = average(rivals.map((player) => player.rating))

  const resolveAutomaticSteps = (source: LobbyVetoAction[]) => {
    const next = [...source]
    while (next.length < VETO_SEQUENCE.length) {
      const expected = VETO_SEQUENCE[next.length]
      if (expected.team === 'HOME') break

      const used = new Set(next.map((action) => action.map))
      const remaining = MAPS.filter((map) => !used.has(map.name))
      if (!remaining.length) break

      const map = expected.type === 'DECIDER'
        ? remaining[0]
        : remaining[hashSeed(result.id + ':' + next.length + ':' + result.opponent) % remaining.length]

      next.push({
        step: next.length,
        type: expected.type,
        team: expected.team,
        map: map.name,
      })
    }
    return next
  }

  const chooseMap = (map: LobbyMap) => {
    setFocusedMap(map.name)
    if (phase !== 'prematch' || vetoComplete || actionByMap.has(map.name) || nextStep?.team !== 'HOME') return

    const next = resolveAutomaticSteps([
      ...veto,
      {
        step: veto.length,
        type: nextStep.type,
        team: 'HOME',
        map: map.name,
      },
    ])
    setVeto(next)
  }

  const mapSummary = phase === 'result'
    ? result.maps.map((map) => `${map.map} ${map.us}:${map.them}`)
    : selectedMaps.map((map) => `${map} —:—`)

  return (
    <div className="match-lobby-overlay" role="dialog" aria-modal="true" aria-label={phase === 'result' ? 'Результат серии' : 'Предматчевое лобби'}>
      <section className={'match-lobby-shell ' + (phase === 'result' ? 'is-result' : 'is-prematch')}>
        <header className="match-lobby-scoreboard">
          <div className="match-lobby-team-title home">
            <span>YOUR CLUB</span>
            <strong>{homeRating} OVR</strong>
            <small>5 / 5 READY</small>
          </div>

          <div className="match-lobby-score-center">
            <small>BEST OF 3</small>
            <div>
              <b>{phase === 'result' ? ourMapScore : 0}</b>
              <i><span>VS</span></i>
              <b>{phase === 'result' ? theirMapScore : 0}</b>
            </div>
            <p>{mapSummary.length ? mapSummary.join(' · ') : 'COMPLETE MAP VETO TO LOCK THE SERIES'}</p>
          </div>

          <div className="match-lobby-team-title away">
            <div className="match-lobby-team-copy">
              <span>{result.opponent}</span>
              <strong>{awayRating} OVR</strong>
              <small>5 / 5 READY</small>
            </div>
            {opponentLogo && (
              <img
                className="match-lobby-team-logo"
                src={opponentLogo}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </header>

        <div className="match-lobby-body">
          <aside className="match-lobby-roster home">
            {starters.slice(0, 5).map((player) => <HomePlayerCard key={player.id} player={player} />)}
          </aside>

          <main className={'match-lobby-center' + (phase === 'result' && result.story ? ' is-story' : '')}>
            <div className="match-lobby-veto-head">
              <div>
                <span>MAP VETO & PICKS</span>
                <strong>{phase === 'result' ? 'SERIES COMPLETE' : nextStep?.label ?? 'VETO COMPLETE'}</strong>
              </div>
              <b>BO3</b>
            </div>

            <div className="match-lobby-veto-timeline">
              {VETO_SEQUENCE.map((step, index) => {
                const action = veto[index]
                return (
                  <div key={step.label + index} className={action ? 'is-complete' : index === veto.length ? 'is-current' : ''}>
                    <i>{index + 1}</i>
                    <b>{step.type}</b>
                    <span>{action?.map ?? step.label}</span>
                  </div>
                )
              })}
            </div>

            {phase === 'result' && result.story ? (
              <MatchStoryPanel result={result} />
            ) : (
              <>
              <div className="match-lobby-map-grid">
                {MAPS.map((map) => {
                  const action = actionByMap.get(map.name)
                  const isFocused = focusedMap === map.name
                  const stateClass = action ? 'is-' + action.type.toLowerCase() : 'is-available'
                  return (
                    <button
                      type="button"
                      key={map.name}
                      className={'match-lobby-map ' + stateClass + (isFocused ? ' is-focused' : '')}
                      onClick={() => chooseMap(map)}
                      disabled={phase === 'prematch' && Boolean(action)}
                    >
                      <img src={mapAsset(map.key)} alt="" />
                      <strong>{map.name}</strong>
                      <span>
                        {action
                          ? action.type === 'DECIDER'
                            ? 'DECIDER'
                            : action.type + ' · ' + (action.team === 'HOME' ? 'YOU' : 'OPP')
                          : phase === 'prematch' && nextStep?.team === 'HOME'
                            ? 'SELECT'
                            : 'AVAILABLE'}
                      </span>
                    </button>
                  )
                })}
              </div>
  
              <div className="match-lobby-map-detail">
                <div className="match-lobby-map-preview"><img src={mapAsset(focused.key)} alt="" /></div>
                <div className="match-lobby-map-copy">
                  <span>TACTICAL OVERVIEW</span>
                  <h2>{focused.name}</h2>
                  <p>{focused.description}</p>
                </div>
                <div className="match-lobby-map-facts">
                  <span><small>YOUR OVR</small><b>{homeRating}</b></span>
                  <span><small>OPP OVR</small><b>{awayRating}</b></span>
                  <span><small>DELTA</small><b>{homeRating - awayRating > 0 ? '+' : ''}{homeRating - awayRating}</b></span>
                </div>
              </div>
  
              </>
            )}

            <div className="match-lobby-actions">
              {phase === 'prematch' ? (
                <button
                  type="button"
                  className="match-lobby-primary"
                  disabled={!vetoComplete}
                  onClick={() => onStart?.(selectedMaps, veto)}
                >
                  {vetoComplete ? 'START SERIES' : nextStep?.label ?? 'COMPLETE VETO'}
                </button>
              ) : (
                <button type="button" className="match-lobby-primary" onClick={onContinue}>
                  CONTINUE
                </button>
              )}
            </div>
          </main>

          <aside className="match-lobby-roster away">
            {rivals.map((player) => <AwayPlayerCard key={player.playerKey} player={player} />)}
          </aside>
        </div>
      </section>
    </div>
  )
}
