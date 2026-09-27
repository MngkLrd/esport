import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_SCOUT_BRIEF,
  LINEUP_SLOTS,
  SCOUT_REPORT_COST,
  defaultNegotiationTerms,
  evaluateNegotiation,
  negotiateProspect,
  overall,
  scout,
  scoutFitScore,
  type GameState,
  type NegotiationTerms,
  type Player,
  type Role,
  type ScoutAgeProfile,
  type ScoutBrief,
} from './game'
import { VRS_SNAPSHOT_DATE, VRS_STATS } from './vrs'
import { PlayerPortrait } from './PlayerPortrait'
import { cardTier, countryFlag } from './playerVisuals'
import './ScoutMarket.css'

const ROLE_LABELS: Record<Role, string> = {
  IGL: 'IGL',
  Entry: 'ENTRY',
  Rifler: 'RIFLER',
  AWP: 'AWP',
  Support: 'SUPPORT',
}

const AGE_LABELS: Record<ScoutAgeProfile, string> = {
  any: 'Любой возраст',
  u23: 'U23',
  prime: '24–28',
  veteran: '29+',
}

const INTEREST_LABELS = {
  cold: 'ХОЛОДНО',
  open: 'СЛУШАЕТ',
  warm: 'БЛИЗКО',
  ready: 'ГОТОВ',
} as const

function CandidateCard({
  player,
  fit,
  onOpen,
  disabled,
}: {
  player: Player
  fit: number
  onOpen: () => void
  disabled: boolean
}) {
  const ovr = overall(player)
  const tier = cardTier(ovr)
  return (
    <article className={'market-candidate tier-' + tier}>
      <button type="button" className="market-card-visual" onClick={onOpen} aria-label={'Открыть переговоры с ' + player.alias}>
        <div className="market-card-top">
          <div><b>{ovr}</b><span>{ROLE_LABELS[player.role]}</span></div>
          <div className="market-fit"><b>{Math.min(99, fit)}</b><span>FIT</span></div>
        </div>
        <div className="market-card-country">{countryFlag(player.country)} <span>{player.country}</span></div>
        <div className="market-card-photo">
          <span>{player.alias.slice(0, 3).toUpperCase()}</span>
          <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} draggable={false} />
        </div>
        <div className="market-card-name">
          <strong>{player.alias}</strong>
          <span>{player.team}</span>
        </div>
        <div className="market-card-stats">
          <span><b>{player.aim}</b>AIM</span>
          <span><b>{player.utility}</b>UTL</span>
          <span><b>{player.gameSense}</b>POS</span>
          <span><b>{player.clutch}</b>CLU</span>
        </div>
      </button>
      <div className="market-card-meta">
        <span>{player.age == null ? 'AGE —' : player.age + ' лет'}</span>
        <span>POT {player.potential}</span>
        <span>{player.salary} кр./нед.</span>
      </div>
      <button type="button" className="primary market-negotiate" onClick={onOpen} disabled={disabled}>
        {disabled ? 'Ростер 8/8' : 'Переговоры'}
      </button>
    </article>
  )
}

export function ScoutMarket({
  state,
  setState,
}: {
  state: GameState
  setState: Dispatch<SetStateAction<GameState>>
}) {
  const [brief, setBrief] = useState<ScoutBrief>(() => state.scoutBrief ?? { ...DEFAULT_SCOUT_BRIEF })
  const [negotiating, setNegotiating] = useState<Player | null>(null)
  const [terms, setTerms] = useState<NegotiationTerms | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    setBrief(state.scoutBrief ?? { ...DEFAULT_SCOUT_BRIEF })
  }, [state.scoutBrief])

  useEffect(() => {
    if (!negotiating) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNegotiating(null)
        setTerms(null)
        setFeedback(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [negotiating])

  const reportBrief = state.scoutBrief ?? DEFAULT_SCOUT_BRIEF
  const rankedProspects = useMemo(
    () => [...state.prospects].sort((a, b) => scoutFitScore(b, reportBrief) - scoutFitScore(a, reportBrief)),
    [state.prospects, reportBrief],
  )

  const evaluation = useMemo(
    () => negotiating && terms ? evaluateNegotiation(state, negotiating, terms) : null,
    [state, negotiating, terms],
  )

  const openNegotiation = (player: Player) => {
    setNegotiating(player)
    setTerms(defaultNegotiationTerms(player))
    setFeedback(null)
  }

  const updateTerms = (patch: Partial<NegotiationTerms>) => {
    setTerms((current) => current ? { ...current, ...patch } : current)
    setFeedback(null)
  }

  const submitOffer = () => {
    if (!negotiating || !terms || !evaluation) return
    if (!evaluation.accepted) {
      setFeedback(evaluation.reason)
      return
    }
    const playerId = negotiating.id
    setState((current) => negotiateProspect(current, playerId, terms).state)
    setNegotiating(null)
    setTerms(null)
    setFeedback(null)
  }

  return (
    <section className="screen scout-market-screen">
      <div className="market-heading">
        <div>
          <span className="eyebrow">TRANSFER DESK · {state.roster.length}/8 PLAYERS</span>
          <h1>Ищи игрока под конкретную задачу.</h1>
          <p>Задай роль, возрастной профиль и потолок зарплаты. Скаут вернёт пять карточек, а переход решается через переговоры.</p>
        </div>
        <div className="market-budget">
          <span>БЮДЖЕТ КЛУБА</span>
          <b>{state.credits.toLocaleString('ru-RU')} кр.</b>
          <small>отчёт стоит {SCOUT_REPORT_COST} кр.</small>
        </div>
      </div>

      <div className="market-layout">
        <aside className="market-brief">
          <div className="market-brief-title">
            <span>SCOUT BRIEF</span>
            <b>01</b>
          </div>

          <label className="market-field">
            <span>Искомая роль</span>
            <select
              value={brief.role}
              onChange={(event) => setBrief((current) => ({ ...current, role: event.target.value as ScoutBrief['role'] }))}
            >
              <option value="Any">Любая роль</option>
              {LINEUP_SLOTS.map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </label>

          <div className="market-field">
            <span>Возрастной профиль</span>
            <div className="market-segmented">
              {(['any', 'u23', 'prime', 'veteran'] as ScoutAgeProfile[]).map((profile) => (
                <button
                  type="button"
                  key={profile}
                  className={brief.ageProfile === profile ? 'active' : ''}
                  onClick={() => setBrief((current) => ({ ...current, ageProfile: profile }))}
                >
                  {AGE_LABELS[profile]}
                </button>
              ))}
            </div>
          </div>

          <label className="market-field market-salary-field">
            <span>Потолок зарплаты <b>{brief.maxSalary} кр./нед.</b></span>
            <input
              type="range"
              min="80"
              max="260"
              step="10"
              value={brief.maxSalary}
              onChange={(event) => setBrief((current) => ({ ...current, maxSalary: Number(event.target.value) }))}
            />
            <small>Это приоритет поиска, а не жёсткий запрет: сильный кандидат может попросить больше.</small>
          </label>

          <div className="market-brief-preview">
            <span>ЗАДАЧА ШТАБА</span>
            <strong>{brief.role === 'Any' ? 'Усилить глубину состава' : 'Найти ' + ROLE_LABELS[brief.role]}</strong>
            <p>{AGE_LABELS[brief.ageProfile]} · до {brief.maxSalary} кр./нед. · shortlist 5 игроков</p>
          </div>

          <button
            type="button"
            className="hq-primary-action market-search"
            disabled={state.credits < SCOUT_REPORT_COST}
            onClick={() => setState((current) => scout(current, brief))}
          >
            Запустить поиск · {SCOUT_REPORT_COST} <span>→</span>
          </button>

          <div className="market-database-note">
            <span>DATABASE</span>
            <b>{VRS_STATS.players.toLocaleString('ru-RU')} игроков</b>
            <small>Valve VRS · {VRS_SNAPSHOT_DATE}</small>
          </div>
        </aside>

        <section className="market-report">
          <div className="market-report-head">
            <div>
              <span>SHORTLIST · REPORT #{state.scoutCycle}</span>
              <strong>
                {state.prospects.length
                  ? (reportBrief.role === 'Any' ? 'Лучшие доступные кандидаты' : 'Кандидаты на ' + ROLE_LABELS[reportBrief.role])
                  : 'Новый отчёт ещё не заказан'}
              </strong>
            </div>
            {state.prospects.length > 0 && (
              <small>{AGE_LABELS[reportBrief.ageProfile]} · ≤ {reportBrief.maxSalary} кр./нед.</small>
            )}
          </div>

          {rankedProspects.length === 0 ? (
            <div className="market-empty">
              <div className="market-empty-mark">+</div>
              <h2>Сформируй запрос скауту.</h2>
              <p>Вместо трёх случайных строк здесь появятся пять игровых карточек, ранжированных под выбранную роль и бюджет.</p>
            </div>
          ) : (
            <div className="market-card-grid">
              {rankedProspects.map((player) => (
                <CandidateCard
                  key={player.id}
                  player={player}
                  fit={scoutFitScore(player, reportBrief)}
                  onOpen={() => openNegotiation(player)}
                  disabled={state.roster.length >= 8}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {negotiating && terms && evaluation && (
        <div className="market-negotiation-backdrop" role="presentation" onMouseDown={() => setNegotiating(null)}>
          <section className="market-negotiation" role="dialog" aria-modal="true" aria-labelledby="negotiation-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="market-negotiation-close" onClick={() => setNegotiating(null)} aria-label="Закрыть">×</button>

            <div className="market-negotiation-player">
              <div className="market-negotiation-photo">
                <span>{negotiating.alias.slice(0, 3).toUpperCase()}</span>
                <PlayerPortrait alias={negotiating.alias} playerId={negotiating.profileId} alt={negotiating.alias} loading="eager" />
              </div>
              <div>
                <span className="eyebrow">{countryFlag(negotiating.country)} {negotiating.team} · {ROLE_LABELS[negotiating.role]}</span>
                <h2 id="negotiation-title">{negotiating.alias}</h2>
                <p>{negotiating.realName} · OVR {overall(negotiating)} · POT {negotiating.potential}</p>
              </div>
            </div>

            <div className="market-interest">
              <div>
                <span>ИНТЕРЕС К ПЕРЕХОДУ</span>
                <b className={'interest-' + evaluation.interest}>{INTEREST_LABELS[evaluation.interest]}</b>
              </div>
              <div className="market-interest-track"><i style={{ width: Math.min(100, Math.round(evaluation.score / evaluation.threshold * 100)) + '%' }} /></div>
              <small>{evaluation.reason}</small>
            </div>

            <div className="market-terms-grid">
              <label className="market-term">
                <span>Трансферный платёж</span>
                <b>{terms.fee} кр.</b>
                <input
                  type="range"
                  min={Math.max(50, Math.round(evaluation.askingFee * 0.65 / 10) * 10)}
                  max={Math.round(evaluation.askingFee * 1.4 / 10) * 10}
                  step="10"
                  value={terms.fee}
                  onChange={(event) => updateTerms({ fee: Number(event.target.value) })}
                />
                <small>Запрос: около {evaluation.askingFee} кр.</small>
              </label>

              <label className="market-term">
                <span>Зарплата в неделю</span>
                <b>{terms.salary} кр.</b>
                <input
                  type="range"
                  min={Math.max(40, Math.round(evaluation.askingSalary * 0.7 / 5) * 5)}
                  max={Math.round(evaluation.askingSalary * 1.4 / 5) * 5}
                  step="5"
                  value={terms.salary}
                  onChange={(event) => updateTerms({ salary: Number(event.target.value) })}
                />
                <small>Ожидание: {evaluation.askingSalary} кр./нед.</small>
              </label>

              <div className="market-term">
                <span>Срок контракта</span>
                <div className="market-contract-options">
                  {[6, 8, 10, 12, 16].map((weeks) => (
                    <button
                      type="button"
                      key={weeks}
                      className={terms.contractWeeks === weeks ? 'active' : ''}
                      onClick={() => updateTerms({ contractWeeks: weeks })}
                    >
                      {weeks} нед.
                    </button>
                  ))}
                </div>
                <small>Длинный контракт делает предложение привлекательнее.</small>
              </div>

              <div className="market-term">
                <span>Роль в проекте</span>
                <div className="market-role-promise">
                  <button type="button" className={terms.squadRole === 'rotation' ? 'active' : ''} onClick={() => updateTerms({ squadRole: 'rotation' })}>
                    Ротация
                  </button>
                  <button type="button" className={terms.squadRole === 'starter' ? 'active' : ''} onClick={() => updateTerms({ squadRole: 'starter' })}>
                    Основа
                  </button>
                </div>
                <small>{terms.squadRole === 'starter' ? 'После сделки игрок сразу займёт наиболее подходящий слот.' : 'После сделки игрок попадёт на скамейку.'}</small>
              </div>
            </div>

            {feedback && <div className="market-offer-feedback">{feedback}</div>}

            <div className="market-negotiation-footer">
              <div>
                <span>СРАЗУ ИЗ КАССЫ</span>
                <b>{terms.fee} кр.</b>
                <small>останется {Math.max(0, state.credits - terms.fee)} кр.</small>
              </div>
              <button type="button" className="hq-primary-action" onClick={submitOffer} disabled={state.roster.length >= 8}>
                {evaluation.accepted ? 'Закрыть сделку' : 'Сделать предложение'} <span>→</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
