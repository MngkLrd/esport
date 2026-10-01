import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_SCOUT_BRIEF,
  LINEUP_SLOTS,
  SCOUT_REPORT_COST,
  beginTransferCase,
  defaultNegotiationTerms,
  evaluateNegotiation,
  negotiateProspect,
  overall,
  managerLevelProgress,
  scout,
  scoutFitScore,
  type GameState,
  type NegotiationTerms,
  type Player,
  type Role,
  type ScoutAgeProfile,
  type ScoutBrief,
} from './game'
import { PlayerPortrait } from './PlayerPortrait'
import { cardTier, countryFlag } from './playerVisuals'
import './ScoutMarket.css'
import { CollectiblePlayerCard } from './CollectiblePlayerCard'

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
  const fitLabel = fit >= 78 ? 'TOP' : fit >= 68 ? 'GOOD' : fit >= 58 ? 'OK' : 'RISK'

  return (
    <article className={'market-candidate tier-' + tier}>
      <div className="market-shared-card">
        <CollectiblePlayerCard
          rating={ovr}
          tier={tier}
          role={player.role}
          alias={player.alias}
          team={player.team}
          country={player.country}
          profileId={player.profileId}
          stats={{
            aim: player.aim,
            utility: player.utility,
            positioning: player.gameSense,
            clutch: player.clutch,
          }}
          onOpen={onOpen}
          className="market-card-shared"
          badge={<><b>{fitLabel}</b><span>FIT</span></>}
        />
      </div>
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
  const managerLevel = managerLevelProgress(state.managerXp).level
  const scoutSlots = managerLevel >= 5 ? 7 : managerLevel >= 3 ? 6 : 5
  const rankedProspects = useMemo(
    () => [...state.prospects].sort((a, b) => scoutFitScore(b, reportBrief) - scoutFitScore(a, reportBrief)),
    [state.prospects, reportBrief],
  )

  const evaluation = useMemo(
    () => negotiating && terms ? evaluateNegotiation(state, negotiating, terms) : null,
    [state, negotiating, terms],
  )

  const openNegotiation = (player: Player) => {
    setState((current) => beginTransferCase(current, player.id))
    setNegotiating(player)
    setTerms(defaultNegotiationTerms(player))
    setFeedback(null)
  }

  const updateTerms = (patch: Partial<NegotiationTerms>) => {
    setTerms((current) => current ? { ...current, ...patch } : current)
    setFeedback(null)
  }

  const applyOfferPackage = (kind: 'lean' | 'standard' | 'push') => {
    if (!negotiating) return
    const base = defaultNegotiationTerms(negotiating)
    const multiplier = kind === 'lean'
      ? { fee: .9, salary: .95 }
      : kind === 'push'
        ? { fee: 1.12, salary: 1.08 }
        : { fee: 1, salary: 1 }
    setTerms((current) => ({
      ...(current ?? base),
      fee: Math.round(base.fee * multiplier.fee / 10) * 10,
      salary: Math.round(base.salary * multiplier.salary / 5) * 5,
    }))
    setFeedback(null)
  }

  const submitOffer = () => {
    if (!negotiating || !terms || !evaluation) return
    const result = negotiateProspect(state, negotiating.id, terms)
    setState(result.state)
    if (!result.evaluation.accepted) {
      setFeedback(result.evaluation.reason)
      return
    }
    setNegotiating(null)
    setTerms(null)
    setFeedback(null)
  }

  return (
    <section className="sim-screen sim-market">
      <div className="sim-screen-head sim-market-head">
        <div>
          <span className="eyebrow">TRANSFER WINDOW · SCOUT NETWORK LVL {managerLevel}</span>
          <h1>BUILD YOUR SHORTLIST</h1>
        </div>
        <div className="sim-head-stat sim-market-budget">
          <span>БЮДЖЕТ КЛУБА</span>
          <b>{state.credits.toLocaleString('ru-RU')} кр.</b>
          <small>отчёт стоит {SCOUT_REPORT_COST} кр.</small>
        </div>
      </div>

      <div className={'sim-market-body ' + (rankedProspects.length > 0 ? 'has-results' : 'awaiting-results')}>
        <aside className="sim-market-brief">
          <div className="sim-market-brief-head">
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
          </label>

          <div className="market-brief-preview">
            <span>ЗАДАЧА ШТАБА</span>
            <strong>{brief.role === 'Any' ? 'Усилить глубину состава' : 'Найти ' + ROLE_LABELS[brief.role]}</strong>
            <p>{AGE_LABELS[brief.ageProfile]} · до {brief.maxSalary} кр./нед. · {scoutSlots} targets</p>
          </div>

          <button
            type="button"
            className="sim-primary-action market-search"
            disabled={state.credits < SCOUT_REPORT_COST}
            onClick={() => setState((current) => scout(current, brief))}
          >
            Запустить поиск · {SCOUT_REPORT_COST} <span>→</span>
          </button>

        </aside>

        <section className="sim-market-results">
          <div className="sim-market-results-head">
            <div>
              <span>SHORTLIST</span>
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
            <div className="sim-market-empty">
              <div className="sim-market-empty-mark">+</div>
              <h2>Сформируй запрос скауту.</h2>
            </div>
          ) : (
            <div className="sim-market-grid">
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
              <small>{evaluation.reason}</small>
            </div>

            <div className="market-offer-packages">
              <button type="button" onClick={() => applyOfferPackage('lean')}>
                <span>LEAN</span><b>Сдержанно</b><small>Ниже запроса · выше риск отказа</small>
              </button>
              <button type="button" onClick={() => applyOfferPackage('standard')}>
                <span>STANDARD</span><b>По рынку</b><small>{evaluation.askingFee} кр. · {evaluation.askingSalary}/нед.</small>
              </button>
              <button type="button" onClick={() => applyOfferPackage('push')}>
                <span>PUSH</span><b>Закрыть быстро</b><small>Выше рынка · сильнее интерес</small>
              </button>
            </div>

            <div className="market-terms-grid">
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
              <button type="button" className="sim-primary-action" onClick={submitOffer} disabled={state.roster.length >= 8}>
                СДЕЛАТЬ ПРЕДЛОЖЕНИЕ <span>→</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
