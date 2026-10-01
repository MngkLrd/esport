import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  activeTournamentMatch,
  getStartingFive,
  playerDevelopmentThreshold,
  teamRating,
  type GameState,
} from './game'
import {
  addGameDays,
  compareGameTime,
  formatGameDate,
  formatGameTime,
  gameDayKey,
  humanTimeUntil,
  startOfGameDay,
} from './calendar'
import { opponentForPlayerMatch } from './tournamentEngine'
import {
  autoPlanTrainingWeek,
  removeTrainingSession,
  scrimOpponentCandidates,
  setDevelopmentFocus,
  TRAINING_SESSION_DEFS,
  trainingSlotTime,
  upsertTrainingSession,
} from './trainingSystem'
import {
  TRAINING_MAPS,
  type TrainingDevelopmentFocus,
  type TrainingFocus,
  type TrainingIntensity,
  type TrainingMap,
  type TrainingSessionType,
} from './trainingTypes'

type SlotPeriod = 'am' | 'pm'

const SESSION_TYPES: TrainingSessionType[] = [
  'team',
  'scrim',
  'map',
  'anti-strat',
  'utility',
  'mechanics',
  'recovery',
  'match-prep',
]

const FOCUS_OPTIONS: { value: TrainingFocus; label: string }[] = [
  { value: 'general', label: 'GENERAL' },
  { value: 'ct', label: 'CT' },
  { value: 't', label: 'T' },
  { value: 'pistols', label: 'PISTOLS' },
  { value: 'retakes', label: 'RETAKES' },
  { value: 'late-round', label: 'LATE ROUND' },
]

const weekday = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(value + (value.endsWith('Z') ? '' : 'Z'))).toUpperCase()

const dayNumber = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'UTC' }).format(new Date(value + (value.endsWith('Z') ? '' : 'Z')))

const sessionNeedsMap = (type: TrainingSessionType) =>
  type === 'scrim' || type === 'map' || type === 'utility' || type === 'match-prep'

const sessionNeedsOpponent = (type: TrainingSessionType) =>
  type === 'scrim' || type === 'anti-strat' || type === 'match-prep'

export function TrainingGround({
  state,
  setState,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
}) {
  const [selectedSlot, setSelectedSlot] = useState<{ dayOffset: number; period: SlotPeriod }>({ dayOffset: 0, period: 'pm' })
  const [type, setType] = useState<TrainingSessionType>('team')
  const [intensity, setIntensity] = useState<TrainingIntensity>('normal')
  const [focus, setFocus] = useState<TrainingFocus>('general')
  const [map, setMap] = useState<TrainingMap>('Nuke')
  const [opponentId, setOpponentId] = useState<string>('')
  const [reportIndex, setReportIndex] = useState(0)

  const training = state.training
  const starters = useMemo(() => getStartingFive(state.roster, state.startingFive), [state.roster, state.startingFive])
  const avgFatigue = starters.length
    ? Math.round(starters.reduce((sum, player) => sum + player.fatigue, 0) / starters.length)
    : 0
  const activeMatch = activeTournamentMatch(state)
  const opponent = state.activeTournament ? opponentForPlayerMatch(state.activeTournament) : null
  const opponentIdForMatch = opponent?.worldTeamId ?? ''
  const opponentKnowledge = opponentIdForMatch ? training.opponentKnowledge[opponentIdForMatch] ?? 0 : 0
  const teamOvr = teamRating(state.roster, state.startingFive, state.lineupContinuity)
  const scrimOpponents = useMemo(() => scrimOpponentCandidates(state), [state])
  const weekStart = startOfGameDay(state.now)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, dayOffset) => addGameDays(weekStart, dayOffset, 0)),
    [weekStart],
  )

  const slotAt = (dayOffset: number, period: SlotPeriod) => trainingSlotTime(state, dayOffset, period)
  const sessionAt = (dayOffset: number, period: SlotPeriod) => {
    const at = slotAt(dayOffset, period)
    return training.sessions.find((session) => session.scheduledAt === at && session.status === 'planned') ?? null
  }

  const selectedSession = sessionAt(selectedSlot.dayOffset, selectedSlot.period)
  const selectedAt = slotAt(selectedSlot.dayOffset, selectedSlot.period)
  const selectedLocked = compareGameTime(selectedAt, state.now) <= 0

  useEffect(() => {
    const session = selectedSession
    if (session) {
      setType(session.type)
      setIntensity(session.intensity)
      setFocus(session.focus)
      setMap(session.map ?? 'Nuke')
      setOpponentId(session.opponentTeamId ?? '')
      return
    }

    const weakest = [...TRAINING_MAPS].sort((a, b) => training.mapPreparation[a] - training.mapPreparation[b])[0]
    setType('team')
    setIntensity('normal')
    setFocus('general')
    setMap(weakest)
    setOpponentId(opponentIdForMatch || scrimOpponents[0]?.id || '')
  }, [selectedSlot.dayOffset, selectedSlot.period, selectedSession?.id, state.saveId])

  const selectedOpponent = scrimOpponents.find((team) => team.id === opponentId)
    ?? state.world.teams.find((team) => team.id === opponentId)
    ?? null

  const weakestMap = [...TRAINING_MAPS].sort((a, b) => training.mapPreparation[a] - training.mapPreparation[b])[0]
  const strongestMap = [...TRAINING_MAPS].sort((a, b) => training.mapPreparation[b] - training.mapPreparation[a])[0]
  const plannedSessions = training.sessions.filter((session) =>
    session.status === 'planned' &&
    compareGameTime(session.scheduledAt, weekStart) >= 0 &&
    compareGameTime(session.scheduledAt, addGameDays(weekStart, 7, 23)) < 0,
  )

  const recommendations = [
    avgFatigue >= 46
      ? { tone: 'risk', title: 'Нагрузка основы высокая', body: 'Добавь Recovery до следующей тяжёлой сессии.', action: 'recovery' as TrainingSessionType }
      : null,
    training.mapPreparation[weakestMap] < 60
      ? { tone: 'warn', title: weakestMap + ' ниже соревновательного уровня', body: 'Map Practice даст временную подготовку без роста OVR.', action: 'map' as TrainingSessionType }
      : null,
    opponent && opponentKnowledge < 45
      ? { tone: 'warn', title: 'Недостаточно данных по ' + opponent.name, body: 'Anti-Strat поднимет opponent knowledge к официальной серии.', action: 'anti-strat' as TrainingSessionType }
      : null,
    training.tacticalCohesion < 62
      ? { tone: 'neutral', title: 'Связки требуют работы', body: 'Team Practice быстрее всего восстанавливает cohesion после перестановок.', action: 'team' as TrainingSessionType }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3)

  const saveSession = () => {
    if (selectedLocked) return
    setState((current) => upsertTrainingSession(current, {
      scheduledAt: trainingSlotTime(current, selectedSlot.dayOffset, selectedSlot.period),
      type,
      intensity,
      focus,
      map: sessionNeedsMap(type) ? map : null,
      opponentTeamId: sessionNeedsOpponent(type) ? (opponentId || null) : null,
      opponentName: sessionNeedsOpponent(type) ? (selectedOpponent?.name ?? opponent?.name ?? null) : null,
    }))
  }

  const deleteSession = () => {
    if (!selectedSession) return
    setState((current) => removeTrainingSession(current, selectedSession.id))
  }

  const autoPlan = () => {
    setState((current) => autoPlanTrainingWeek(current))
  }

  const jumpRecommendation = (sessionType: TrainingSessionType) => {
    const firstFree = weekDays.flatMap((_, dayOffset) => (['am', 'pm'] as SlotPeriod[]).map((period) => ({ dayOffset, period })))
      .find((slot) => compareGameTime(slotAt(slot.dayOffset, slot.period), state.now) > 0 && !sessionAt(slot.dayOffset, slot.period))
    if (!firstFree) return
    setSelectedSlot(firstFree)
    setType(sessionType)
    if (sessionType === 'map') setMap(weakestMap)
    if (sessionType === 'anti-strat' && opponentIdForMatch) setOpponentId(opponentIdForMatch)
  }

  const selectedReport = training.reports[reportIndex] ?? training.reports[0] ?? null

  return (
    <section className="training-ground">
      <header className="training-ground-head">
        <div className="training-ground-title">
          <span>CLUB OPERATIONS · PREPARATION</span>
          <h1>TRAINING GROUND</h1>
        </div>

        <div className="training-ground-next">
          <span>NEXT OFFICIAL</span>
          <strong>{activeMatch ? (opponent ? 'YOUR CLUB vs ' + opponent.name : activeMatch.label) : 'NO MATCH BOOKED'}</strong>
          <small>{activeMatch ? formatGameDate(activeMatch.scheduledAt) + ' · ' + humanTimeUntil(state.now, activeMatch.scheduledAt) : 'Используй неделю для системной подготовки'}</small>
        </div>

        <div className="training-ground-kpis">
          <span><small>READINESS</small><b>{training.readiness}</b></span>
          <span><small>COHESION</small><b>{training.tacticalCohesion}</b></span>
          <span><small>SHARPNESS</small><b>{training.sharpness}</b></span>
          <span className={avgFatigue >= 46 ? 'risk' : ''}><small>FATIGUE</small><b>{avgFatigue}</b></span>
        </div>
      </header>

      <div className="training-ground-body">
        <div className="training-ground-workspace">
          <section className="training-week">
            <div className="training-panel-head">
              <div>
                <span>WEEK PLAN</span>
                <strong>Подготовка на 7 дней</strong>
                <small>{plannedSessions.length} сессий · permanent OVR не фармится</small>
              </div>
              <button className="training-auto" onClick={autoPlan}><span>✦</span><b>AUTO PLAN</b><small>по матчу и нагрузке</small></button>
            </div>

            <div className="training-week-grid">
              {weekDays.map((day, dayOffset) => {
                const matchToday = activeMatch && gameDayKey(activeMatch.scheduledAt) === gameDayKey(day)
                return (
                  <article className={'training-day' + (dayOffset === 0 ? ' today' : '') + (matchToday ? ' match-day' : '')} key={day}>
                    <header>
                      <span>{weekday(day)}</span>
                      <b>{dayNumber(day)}</b>
                      {matchToday && <small>MATCH</small>}
                    </header>

                    <div className="training-day-slots">
                      {(['am', 'pm'] as SlotPeriod[]).map((period) => {
                        const at = slotAt(dayOffset, period)
                        const session = sessionAt(dayOffset, period)
                        const locked = compareGameTime(at, state.now) <= 0
                        const selected = selectedSlot.dayOffset === dayOffset && selectedSlot.period === period
                        return (
                          <button
                            type="button"
                            key={period}
                            className={'training-slot' + (session ? ' has-session tone-' + TRAINING_SESSION_DEFS[session.type].tone : '') + (selected ? ' selected' : '') + (locked ? ' locked' : '')}
                            disabled={locked}
                            onClick={() => setSelectedSlot({ dayOffset, period })}
                          >
                            <time>{formatGameTime(at)}</time>
                            {session ? (
                              <>
                                <strong>{TRAINING_SESSION_DEFS[session.type].short}</strong>
                                <small>{session.map ?? session.opponentName ?? session.focus.toUpperCase()}</small>
                                <i>{session.intensity.toUpperCase()}</i>
                              </>
                            ) : (
                              <>
                                <strong>+ SESSION</strong>
                                <small>{period === 'am' ? 'утренний слот' : 'вечерний слот'}</small>
                              </>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="training-prep">
            <div className="training-panel-head compact">
              <div>
                <span>MATCH PREPARATION</span>
                <strong>Карта и соперник</strong>
              </div>
              <div className="training-prep-summary">
                <span><small>TEAM OVR</small><b>{teamOvr}</b></span>
                <span><small>OPP. KNOWLEDGE</small><b>{opponent ? opponentKnowledge : '—'}</b></span>
                <span><small>WEAK MAP</small><b>{weakestMap}</b></span>
              </div>
            </div>

            <div className="training-map-grid">
              {TRAINING_MAPS.map((mapName) => {
                const value = training.mapPreparation[mapName]
                return (
                  <button
                    type="button"
                    key={mapName}
                    className={'training-map' + (mapName === weakestMap ? ' weak' : '') + (mapName === strongestMap ? ' strong' : '')}
                    onClick={() => { setMap(mapName); setType('map') }}
                  >
                    <span>{mapName}</span>
                    <b>{value}</b>
                    <i><em style={{ width: value + '%' }} /></i>
                    <small>{value < 55 ? 'RISK' : value < 68 ? 'WORK' : 'READY'}</small>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="training-side">
          <section className="training-editor">
            <div className="training-side-head">
              <div>
                <span>SESSION BUILDER</span>
                <strong>{weekday(selectedAt)} · {formatGameTime(selectedAt)}</strong>
              </div>
              {selectedSession && <button className="training-delete" onClick={deleteSession}>REMOVE</button>}
            </div>

            {selectedLocked ? (
              <div className="training-locked-note">Этот слот уже прошёл через игровое время.</div>
            ) : (
              <>
                <div className="training-type-grid">
                  {SESSION_TYPES.map((sessionType) => (
                    <button
                      type="button"
                      key={sessionType}
                      className={(type === sessionType ? 'active ' : '') + 'tone-' + TRAINING_SESSION_DEFS[sessionType].tone}
                      onClick={() => setType(sessionType)}
                    >
                      <b>{TRAINING_SESSION_DEFS[sessionType].short}</b>
                      <small>{TRAINING_SESSION_DEFS[sessionType].load > 0 ? '+' + TRAINING_SESSION_DEFS[sessionType].load + ' load' : TRAINING_SESSION_DEFS[sessionType].load + ' load'}</small>
                    </button>
                  ))}
                </div>

                <p className="training-type-description">{TRAINING_SESSION_DEFS[type].description}</p>

                <div className="training-field-row">
                  <label>
                    <span>INTENSITY</span>
                    <select value={intensity} onChange={(event) => setIntensity(event.target.value as TrainingIntensity)}>
                      <option value="light">LIGHT</option>
                      <option value="normal">NORMAL</option>
                      <option value="high">HIGH</option>
                    </select>
                  </label>
                  <label>
                    <span>FOCUS</span>
                    <select value={focus} onChange={(event) => setFocus(event.target.value as TrainingFocus)}>
                      {FOCUS_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>

                {sessionNeedsMap(type) && (
                  <label className="training-editor-field">
                    <span>MAP</span>
                    <select value={map} onChange={(event) => setMap(event.target.value as TrainingMap)}>
                      {TRAINING_MAPS.map((mapName) => <option value={mapName} key={mapName}>{mapName} · {training.mapPreparation[mapName]}</option>)}
                    </select>
                  </label>
                )}

                {sessionNeedsOpponent(type) && (
                  <label className="training-editor-field">
                    <span>OPPONENT / TARGET</span>
                    <select value={opponentId} onChange={(event) => setOpponentId(event.target.value)}>
                      {opponentIdForMatch && opponent && <option value={opponentIdForMatch}>{opponent.name} · NEXT MATCH</option>}
                      {scrimOpponents.map((team) => <option value={team.id} key={team.id}>{team.name} · {team.rating} OVR</option>)}
                    </select>
                  </label>
                )}

                <div className="training-editor-impact">
                  <span><small>LOAD</small><b>{TRAINING_SESSION_DEFS[type].load}</b></span>
                  <span><small>OVR GAIN</small><b>0</b></span>
                  <span><small>IMPACT</small><b>{type === 'recovery' ? 'RECOVERY' : type === 'anti-strat' ? 'KNOWLEDGE' : type === 'map' ? 'MAP PREP' : 'READINESS'}</b></span>
                </div>

                <button className="training-save" onClick={saveSession}>{selectedSession ? 'UPDATE SESSION' : 'ADD TO WEEK'} <span>→</span></button>
              </>
            )}
          </section>

          <section className="training-staff">
            <div className="training-side-head">
              <div><span>STAFF BRIEF</span><strong>Что делать дальше</strong></div>
            </div>
            <div className="training-recommendations">
              {recommendations.length ? recommendations.map((item) => (
                <article className={'tone-' + item.tone} key={item.title}>
                  <span>{item.tone === 'risk' ? '!' : item.tone === 'warn' ? '•' : '✓'}</span>
                  <div><b>{item.title}</b><small>{item.body}</small></div>
                  <button onClick={() => jumpRecommendation(item.action)}>ADD</button>
                </article>
              )) : (
                <div className="training-all-good">План выглядит сбалансированным. Не перегружай состав без причины.</div>
              )}
            </div>
          </section>

          <section className="training-development">
            <div className="training-side-head">
              <div><span>PLAYER DEVELOPMENT</span><strong>Долгосрочный фокус</strong></div>
            </div>
            <div className="training-development-list">
              {starters.map((player) => {
                const development = training.development[player.id] ?? { focus: 'balanced' as const, progress: 0 }
                const threshold = playerDevelopmentThreshold(player)
                const percent = Math.min(100, Math.round(development.progress / Math.max(1, threshold) * 100))
                return (
                  <article key={player.id}>
                    <div>
                      <b>{player.alias}</b>
                      <small>{development.progress}/{threshold} · {percent}%</small>
                    </div>
                    <i><em style={{ width: percent + '%' }} /></i>
                    <select
                      value={development.focus}
                      onChange={(event) => setState((current) => setDevelopmentFocus(current, player.id, event.target.value as TrainingDevelopmentFocus))}
                    >
                      <option value="balanced">BALANCED</option>
                      <option value="mechanics">MECHANICS</option>
                      <option value="game-sense">GAME SENSE</option>
                      <option value="utility">UTILITY</option>
                      <option value="leadership">LEADERSHIP</option>
                    </select>
                  </article>
                )
              })}
            </div>
            <p>Mechanics-сессии двигают этот прогресс медленно. Постоянный +1 требует десятков тренировок, а не одной кнопки.</p>
          </section>

          <section className="training-report">
            <div className="training-side-head">
              <div><span>LAST SCRIM REPORT</span><strong>{selectedReport?.headline ?? 'Нет данных'}</strong></div>
              {training.reports.length > 1 && (
                <div className="training-report-nav">
                  <button disabled={reportIndex >= training.reports.length - 1} onClick={() => setReportIndex((value) => Math.min(training.reports.length - 1, value + 1))}>‹</button>
                  <button disabled={reportIndex <= 0} onClick={() => setReportIndex((value) => Math.max(0, value - 1))}>›</button>
                </div>
              )}
            </div>

            {selectedReport ? (
              <>
                <p>{selectedReport.detail}</p>
                <div className="training-report-metrics">
                  {selectedReport.metrics.map((metric) => (
                    <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b><em className={metric.delta >= 0 ? 'up' : 'down'}>{metric.delta >= 0 ? '+' : ''}{metric.delta}</em></span>
                  ))}
                </div>
                <div className="training-report-notes">
                  {selectedReport.notes.map((note) => <span key={note}>{note}</span>)}
                </div>
              </>
            ) : (
              <p>Запланируй SCRIM. После обработки через Continue здесь появится реальный отчёт штаба.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  )
}
