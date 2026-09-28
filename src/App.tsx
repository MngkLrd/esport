import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import {
  canPlayMatch,
  chemistry,
  getStartingFive,
  lineupWarnings,
  managerLevelProgress,
  modeInfo,
  overall,
  releasePlayer,
  renewContract,
  restPlayer,
  tacticInfo,
  teamRating,
  toggleStarter,
  trainPlayer,
  weeklyPayroll,
  type GameState,
  type MatchMode,
  type MatchResult,
  type Player,
  type TacticalPlan,
} from './game'
import { CARD_TIER_LABEL, PLAYER_PORTRAIT_STATS, cardTier, countryFlag } from './playerVisuals'
import {
  clearPackCollection,
  type PackRoll,
} from './packState'
import { createBrowserSaveRepository } from './saveRepository'
import { rollWelcomePack } from './welcomePack'
import { PlayerPortrait } from './PlayerPortrait'
import { MatchRadar } from './MatchRadar'
import { RosterBoard } from './RosterBoard'
import { tournamentForId, tournamentMode } from './events'
import { ScoutMarket } from './ScoutMarket'
import { FifaHome } from './FifaHome'
import { WorldMap } from './WorldMap'
import { ManagerProfile } from './ManagerProfile'
import { rollPack } from './packs'
import { executeGameCommand } from './gameCommands'
import type { PackCard } from './packState'

const CardDetails = lazy(() => import('./CardDetails').then((module) => ({ default: module.CardDetails })))

const PacksView = lazy(() =>
  import('./PacksView').then((module) => ({ default: module.PacksView })),
)

const saveRepository = createBrowserSaveRepository()
type Tab = 'HQ' | 'World' | 'Play' | 'Roster' | 'Packs' | 'Scout' | 'Inbox' | 'Profile'

const TAB_LABELS: Record<Tab, string> = {
  HQ: 'HOME',
  World: 'WORLD MAP',
  Play: 'MATCHDAY',
  Roster: 'SQUAD',
  Packs: 'PACKS',
  Scout: 'TRANSFERS',
  Inbox: 'NEWS',
  Profile: 'PROFILE',
}

const ROLE_LABELS: Record<Player['role'], string> = {
  IGL: 'IGL',
  Entry: 'Энтри',
  Rifler: 'Рифлер',
  AWP: 'AWP',
  Support: 'Саппорт',
}

const NEWS_KIND_LABELS: Record<GameState['news'][number]['kind'], string> = {
  match: 'матч',
  media: 'медиа',
  contract: 'контракт',
  scout: 'скаутинг',
  finance: 'финансы',
  lineup: 'состав',
}

const RISK_LABELS: Record<string, string> = {
  Low: 'Низкий',
  Medium: 'Средний',
  High: 'Высокий',
}

const format = new Intl.NumberFormat('ru-RU')

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={'metric ' + (accent ? 'metric-accent' : '')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PlayerVisualCard({ player, starter = false, compact = false, onClick }: { player: Player; starter?: boolean; compact?: boolean; onClick?: () => void }) {
  const ovr = overall(player)
  const tier = cardTier(ovr)
  const initials = player.alias.slice(0, 3).toUpperCase()
  const role = player.role === 'Rifler' ? 'РИФ' : player.role === 'Support' ? 'САП' : player.role === 'Entry' ? 'ЕНТ' : player.role

  return (
    <button type="button" aria-label={'Открыть профиль ' + player.alias} onClick={onClick} className={'visual-player-card tier-' + tier + (starter ? ' is-starter' : '') + (compact ? ' compact' : '')}>
      <div className="visual-card-shine" />
      <div className="visual-card-top">
        <div>
          <strong>{ovr}</strong>
          <span>{role}</span>
        </div>
        {starter && <b className="starter-star">★</b>}
      </div>
      <div className="visual-country">{countryFlag(player.country)} <span>{player.country}</span></div>
      <div className="visual-photo">
        <div className="visual-monogram">{initials}</div>
        <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.realName + ' (' + player.alias + ')'} />
      </div>
      <div className="visual-identity">
        <strong>{player.alias}</strong>
        <span>{player.team}</span>
      </div>
      <div className="visual-stats">
        <span><b>{player.aim}</b>АИМ</span>
        <span><b>{player.gameSense}</b>СЕНС</span>
        <span><b>{player.utility}</b>УТИЛ</span>
        <span><b>{player.clutch}</b>КЛАТЧ</span>
      </div>
      <div className="visual-rarity">{CARD_TIER_LABEL[tier]}</div>
    </button>
  )
}

function PlayerCard({
  player,
  state,
  isStarter,
  onTrain,
  onRest,
  onRenew,
  onToggleStarter,
  onRelease,
}: {
  player: Player
  state: GameState
  isStarter: boolean
  onTrain: () => void
  onRest: () => void
  onRenew: () => void
  onToggleStarter: () => void
  onRelease: () => void
}) {
  const expiring = player.contractWeeks <= 2
  const expired = player.contractWeeks <= 0
  const canStart = isStarter || (state.startingFive.length < 5 && !expired)

  return (
    <article className={'player-card ' + (isStarter ? 'player-card-starter' : '')}>
      <div className="player-head">
        <div>
          <div className="eyebrow">{countryFlag(player.country)} {player.country} · {player.team} · {ROLE_LABELS[player.role]} · {isStarter ? 'ОСНОВА' : 'ЗАПАС'}</div>
          <h3>{player.alias}</h3>
          <p>{player.realName} · {player.age == null ? 'Возраст —' : player.age + ' лет'} · РЕЙТ {overall(player)} · ПОТ {player.potential}</p>
        </div>
        <div className="ovr">{overall(player)}</div>
      </div>

      <div className="skill-grid">
        <span>АИМ <b>{player.aim}</b></span>
        <span>СЕНС <b>{player.gameSense}</b></span>
        <span>УТИЛ <b>{player.utility}</b></span>
        <span>КЛАТЧ <b>{player.clutch}</b></span>
      </div>

      <div className="bars">
        <label>Форма <i><em style={{ width: player.form + '%' }} /></i><b>{player.form}</b></label>
        <label>Мораль <i><em style={{ width: player.morale + '%' }} /></i><b>{player.morale}</b></label>
        <label>Усталость <i className="danger"><em style={{ width: player.fatigue + '%' }} /></i><b>{player.fatigue}</b></label>
      </div>

      <p className="bio">{player.bio}</p>
      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>

      <div className="contract-row">
        <span className={expiring ? 'warning' : ''}>
          {expired ? 'КОНТРАКТ ИСТЁК' : 'Контракт: ' + player.contractWeeks + ' нед.'} · {player.salary} кр./нед.
        </span>
        <button className="text-button" onClick={onRenew} disabled={state.credits < player.salary * 4}>
          Extend {player.salary * 4}
        </button>
      </div>

      <div className="lineup-actions">
        <button className={isStarter ? 'secondary' : 'primary'} onClick={onToggleStarter} disabled={!canStart}>
          {isStarter ? 'В запас' : state.startingFive.length >= 5 ? 'Сначала освободи место' : 'В стартовую пятёрку'}
        </button>
        <button className="text-button release" onClick={onRelease} disabled={state.roster.length <= 5 || state.credits < player.salary}>
          Release · {player.salary}
        </button>
      </div>

      <div className="card-actions">
        <button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 120}>Тренировка · 120</button>
        <button className="secondary" onClick={onRest} disabled={state.staffEnergy < 1}>Отдых</button>
      </div>
    </article>
  )
}

function PlayerProfileModal({ player, onClose }: { player: Player; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="card-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="card-detail-modal player-profile-modal" role="dialog" aria-modal="true" aria-label={'Профиль ' + player.alias} onMouseDown={(event) => event.stopPropagation()}>
        <button className="card-detail-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div className="card-detail-hero">
          <div className="card-detail-rating"><strong>{overall(player)}</strong><span>{ROLE_LABELS[player.role]}</span></div>
          <div className="card-detail-portrait"><span>{player.alias.slice(0, 3).toUpperCase()}</span><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="eager" /></div>
          <div className="card-detail-name"><h2>{player.alias}</h2><p>{player.realName}</p></div>
        </div>
        <div className="card-detail-content">
          <div className="card-detail-kicker">ТЕКУЩЕЕ СОСТОЯНИЕ КЛУБА</div>
          <h3>{countryFlag(player.country)} {player.team}</h3>
          <div className="card-detail-facts"><span><b>Форма</b>{player.form}</span><span><b>Мораль</b>{player.morale}</span><span><b>Усталость</b>{player.fatigue}</span><span><b>Контракт</b>{player.contractWeeks} нед.</span><span><b>Зарплата</b>{player.salary} кр./нед.</span><span><b>Потенциал</b>{player.potential}</span></div>
          <div className="card-detail-section-title">Базовые характеристики</div>
          <div className="card-detail-scores"><span><b>{player.aim}</b>АИМ</span><span><b>{player.utility}</b>УТИЛИТИ</span><span><b>{player.gameSense}</b>ПОЗИЦИЯ</span><span><b>{player.clutch}</b>КЛАТЧ</span></div>
        </div>
      </section>
    </div>
  )
}

function HqStarterRow({ player, index, onOpen }: { player: Player; index: number; onOpen: () => void }) {
  const role = ROLE_LABELS[player.role]
  return (
    <button type="button" className="hq-starter-row" onClick={onOpen} aria-label={'Открыть профиль ' + player.alias}>
      <span className="hq-starter-number">0{index + 1}</span>
      <span className="hq-starter-portrait"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="lazy" /></span>
      <span className="hq-starter-copy"><strong>{player.alias}</strong><small>{role} · {player.team}</small></span>
      <span className="hq-starter-form"><b>{overall(player)}</b><i style={{ width: player.form + '%' }} /><small>{player.form} F / {player.fatigue} T</small></span>
      <span className="hq-starter-arrow">↗</span>
    </button>
  )
}

function RosterRow({ player, starter, state, onOpen, onTrain, onRest, onRenew, onToggleStarter, onRelease }: {
  player: Player
  starter: boolean
  state: GameState
  onOpen: () => void
  onTrain: () => void
  onRest: () => void
  onRenew: () => void
  onToggleStarter: () => void
  onRelease: () => void
}) {
  const expiring = player.contractWeeks <= 2
  const expired = player.contractWeeks <= 0
  const canStart = starter || (state.startingFive.length < 5 && !expired)
  return (
    <article className={'roster-player-row ' + (starter ? 'is-starter' : 'is-bench')}>
      <button className="roster-player-main" onClick={onOpen} aria-label={'Открыть профиль ' + player.alias}>
        <span className="roster-player-state"><b>{starter ? 'START' : 'BENCH'}</b><i /></span>
        <span className="roster-player-photo"><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} loading="lazy" /></span>
        <span className="roster-player-identity"><strong>{player.alias}</strong><small>{player.realName} · {countryFlag(player.country)} {player.country} · {player.team}</small></span>
        <span className="roster-player-role"><b>{ROLE_LABELS[player.role]}</b><small>{player.traits.slice(0, 2).join(' · ')}</small></span>
        <span className="roster-player-ovr"><b>{overall(player)}</b><small>OVR · POT {player.potential}</small></span>
        <span className="roster-player-bars"><label>Форма <i><em style={{ width: player.form + '%' }} /></i><b>{player.form}</b></label><label>Мораль <i><em style={{ width: player.morale + '%' }} /></i><b>{player.morale}</b></label><label>Усталость <i className="danger"><em style={{ width: player.fatigue + '%' }} /></i><b>{player.fatigue}</b></label></span>
        <span className="roster-player-contract"><b className={expiring ? 'warning' : ''}>{expired ? 'ИСТЁК' : player.contractWeeks + ' нед.'}</b><small>{player.salary} кр./нед.</small></span>
      </button>
      <div className="roster-row-actions"><button className={starter ? 'secondary' : 'primary'} onClick={onToggleStarter} disabled={!canStart}>{starter ? 'В запас' : 'В старт'}</button><button onClick={onRenew} disabled={state.credits < player.salary * 4}>Продлить · {player.salary * 4}</button><button onClick={onTrain} disabled={state.staffEnergy < 1 || state.credits < 120}>Тренировка</button><button onClick={onRest} disabled={state.staffEnergy < 1}>Отдых</button><button className="text-button release" onClick={onRelease} disabled={state.roster.length <= 5 || state.credits < player.salary}>Убрать</button></div>
    </article>
  )
}

function App() {
  const [state, setState] = useState<GameState>(() => saveRepository.load())
  const [tab, setTab] = useState<Tab>('HQ')
  const [tactic, setTactic] = useState<TacticalPlan>('balanced')
  const [seenNewsId, setSeenNewsId] = useState<string | null>(null)
  const [welcomeStep, setWelcomeStep] = useState<'intro' | 'reveal' | 'complete'>('intro')
  const [welcomeRevealed, setWelcomeRevealed] = useState(0)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedCard, setSelectedCard] = useState<PackCard | null>(null)
  const [transition, setTransition] = useState<{ target: Tab; title: string } | null>(null)
  const [pendingMatch, setPendingMatch] = useState<{ nextState: GameState; result: MatchResult } | null>(null)

  const starters = useMemo(() => getStartingFive(state.roster, state.startingFive), [state.roster, state.startingFive])
  const rating = useMemo(
    () => teamRating(state.roster, state.startingFive, state.lineupContinuity),
    [state.roster, state.startingFive, state.lineupContinuity],
  )
  const chem = useMemo(
    () => chemistry(state.roster, state.startingFive, state.lineupContinuity),
    [state.roster, state.startingFive, state.lineupContinuity],
  )
  const warnings = useMemo(() => lineupWarnings(state.roster, state.startingFive), [state.roster, state.startingFive])
  const payroll = useMemo(() => weeklyPayroll(state), [state])
  const last = state.history[0]
  const activeEvent = tournamentForId(state.activeEventId)
  const activeEventMode = activeEvent ? tournamentMode(activeEvent) : null
  const unreadNews = seenNewsId === state.news[0]?.id ? 0 : Math.min(state.news.length, 9)
  const unread = Math.min(9, unreadNews + (state.pendingDecision ? 1 : 0))

  useEffect(() => {
    saveRepository.save(state)
  }, [state])

  useEffect(() => {
    if (!transition) return
    const switchTimer = window.setTimeout(() => {
      setTab(transition.target)
      if (transition.target === 'Inbox') setSeenNewsId(state.news[0]?.id ?? null)
    }, 180)
    const clearTimer = window.setTimeout(() => setTransition(null), 620)
    return () => {
      window.clearTimeout(switchTimer)
      window.clearTimeout(clearTimer)
    }
  }, [transition, state.news])

  const openTab = (next: Tab) => {
    if (next === tab && !transition) return
    setTransition({ target: next, title: TAB_LABELS[next] })
  }

  const finishPendingMatch = useCallback(() => {
    setPendingMatch((current) => {
      if (!current) return null
      setState(current.nextState)
      setTab('HQ')
      return null
    })
  }, [])

  const play = (mode: MatchMode) => {
    const gate = canPlayMatch(state, mode)
    if (!gate.ok || pendingMatch) return
    const result = executeGameCommand(state, { type: 'PLAY_MATCH', mode, tactic })
    const match = result.state.history[0]
    if (result.state === state || !match) return
    setPendingMatch({ nextState: result.state, result: match })
  }

  const reset = () => {
    if (window.confirm('Сбросить текущее сохранение и начать новый проект? Коллекция наборов этого сейва тоже будет удалена.')) {
      const fresh = saveRepository.reset()
      setState(fresh)
      setTab('HQ')
      setWelcomeStep('intro')
      setWelcomeRevealed(0)
    }
  }

  const commitPackBatch = (packId: Exclude<PackRoll['pack']['id'], 'welcome'>, quantity: number) => {
    let next = state
    const rolls: PackRoll[] = []
    for (let index = 0; index < quantity; index += 1) {
      const roll = rollPack(packId, next.packs.serial, next.saveId)
      const result = executeGameCommand(next, { type: 'OPEN_PACK', roll })
      if (result.state === next) return null
      rolls.push(roll)
      next = result.state
    }
    setState(next)
    return rolls
  }

  const clearPacks = () => {
    setState((current) => ({ ...current, packs: clearPackCollection(current.packs) }))
  }

  const bookEvent = (eventId: string) => {
    const result = executeGameCommand(state, { type: 'BOOK_EVENT', eventId })
    if (result.state === state) return
    setState(result.state)
    openTab('Play')
  }

  const resolveDecision = (choice: 'a' | 'b') => {
    const result = executeGameCommand(state, { type: 'RESOLVE_DECISION', choice })
    if (result.state === state) return
    setState(result.state)
    openTab('HQ')
  }

  const welcomeCards = useMemo(() => rollWelcomePack(state.saveId), [state.saveId])

  const finishWelcome = () => {
    setState((current) => executeGameCommand(current, { type: 'OPEN_WELCOME_PACK', cards: welcomeCards }).state)
    setWelcomeStep('complete')
    setTab('HQ')
  }


  const managerProgress = managerLevelProgress(state.managerXp)

  return (
    <div className="app-shell">
      {!state.welcomeComplete && (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <section className="welcome-panel">
            <div className="welcome-brand">ESPORT AI MANAGER</div>
            {welcomeStep === 'intro' && <>
              <div className="eyebrow">ПЕРВЫЙ СЕЙВ · СТАРТОВЫЙ НАБОР</div>
              <h1 id="welcome-title">Собери свою первую пятёрку.</h1>
              <div className="welcome-grid">
                <article><b>01</b><strong>Пять игроков</strong><span>IGL, AWP, Entry, Support и Rifler — роли закрыты заранее.</span></article>
                <article><b>02</b><strong>Один результат</strong></article>
                <article><b>03</b><strong>Дальше — сезон</strong></article>
              </div>
              <div className="welcome-actions"><button className="primary" onClick={() => { setWelcomeStep('reveal'); setWelcomeRevealed(0) }}>Открыть стартовый набор</button></div>
            </>}
            {welcomeStep !== 'intro' && <>
              <div className="eyebrow">WELCOME PACK · {Math.min(welcomeRevealed, 5)}/5</div>
              <h1 id="welcome-title">Ваша первая пятёрка</h1>
              <div className="welcome-card-grid">
                {welcomeCards.map((card, index) => {
                  const visible = index < welcomeRevealed
                  return <button key={card.id} className={'welcome-card rarity-' + card.rarity + (visible ? ' is-visible' : '')} onClick={() => visible && setSelectedCard(card)} aria-label={visible ? 'Карточка ' + card.alias : 'Скрытая карта'}>
                    {visible ? <>
                      <div className="welcome-card-top">
                        <div><b>{card.power}</b><small>{card.role ?? 'PRO'}</small></div>
                        <span>{countryFlag(card.country ?? '')}</span>
                      </div>
                      <div className="welcome-card-photo">
                        <i>{card.alias.slice(0, 3).toUpperCase()}</i>
                        <PlayerPortrait alias={card.alias} playerId={card.profileId} alt={card.alias} draggable={false} loading="eager" />
                      </div>
                      <div className="welcome-card-identity">
                        <strong>{card.alias}</strong>
                        <span>{card.team}</span>
                      </div>
                      <div className="welcome-card-stats">
                        <span><b>{card.cardStats?.aim ?? '—'}</b>AIM</span>
                        <span><b>{card.cardStats?.utility ?? '—'}</b>UTL</span>
                        <span><b>{card.cardStats?.positioning ?? '—'}</b>POS</span>
                        <span><b>{card.cardStats?.clutch ?? '—'}</b>CLU</span>
                      </div>
                      <em>{card.edition}</em>
                    </> : <div className="welcome-card-back"><span>E</span><small>ESPORT AI MANAGER</small></div>}
                  </button>
                })}
              </div>
              <div className="welcome-actions">
                {welcomeRevealed < 5 && <button className="secondary" onClick={() => setWelcomeRevealed(5)}>Показать сразу</button>}
                {welcomeRevealed < 5 && <button className="primary" onClick={() => setWelcomeRevealed((count) => Math.min(5, count + 1))}>Открыть карту</button>}
                {welcomeRevealed >= 5 && <button className="primary" onClick={finishWelcome}>Перейти в штаб</button>}
              </div>
            </>}
          </section>
        </div>
      )}
      {selectedCard && <Suspense fallback={null}><CardDetails card={selectedCard} onClose={() => setSelectedCard(null)} /></Suspense>}
      {selectedPlayer && <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      {transition && (
        <div className="fifa-title-transition" aria-hidden="true">
          <div><span>ESPORT AI MANAGER</span><strong>{transition.title}</strong><i /></div>
        </div>
      )}
      <header className="fifa-topbar">
        <button className="fifa-brand" onClick={() => openTab('HQ')} aria-label="Home">
          <span className="fifa-brand-mark">E</span>
          <strong>ESPORT AI MANAGER</strong>
        </button>
        <div className="fifa-topbar-center">
          <span>SEASON {state.season}</span>
          <b>WEEK {state.week}/{state.seasonLength}</b>
          <i />
          <span>{activeEvent ? 'NEXT · ' + activeEvent.city.toUpperCase() : 'NO EVENT BOOKED'}</span>
        </div>
        <div className="fifa-wallets">
          <button onClick={() => openTab('Inbox')} className={unread > 0 ? 'has-unread' : ''}><span>INBOX</span><b>{unread > 0 ? unread + ' NEW' : 'CLEAR'}</b></button>
          <button onClick={() => openTab('Profile')}><span>MANAGER LVL {managerProgress.level}</span><b>{managerProgress.percent}%</b></button>
          <div><span>CLUB CASH</span><b>{format.format(state.credits)}</b></div>
          <div><span>PACK TOKENS</span><b>{format.format(state.packTokens)}</b></div>
        </div>
      </header>



      <main>
        {tab !== 'HQ' && !pendingMatch && (
          <button className="screen-back-button" onClick={() => openTab('HQ')} aria-label="Назад">
            <span>←</span> НАЗАД
          </button>
        )}
        {tab === 'HQ' && (
          <>
            {state.seasonEnded && state.seasonSummary && (
              <article className="season-summary-panel fifa-season-summary">
                <div className="eyebrow">SEASON {state.seasonSummary.season} · COMPLETE</div>
                <h1>SEASON COMPLETE</h1>
                <div className="season-summary-grid">
                  <span><b>{state.seasonSummary.wins}–{state.seasonSummary.losses}</b>Record</span>
                  <span><b>{state.seasonSummary.points}</b>Points</span>
                  <span><b>{state.seasonSummary.reputation}</b>Reputation</span>
                  <span><b>{state.seasonSummary.credits}</b>Club cash</span>
                  <span><b>{state.seasonSummary.bestPlayer ?? '—'}</b>MVP</span>
                </div>
                <button className="fifa-primary-cta" onClick={() => setState((current) => executeGameCommand(current, { type: 'START_NEXT_SEASON' }).state)}>START SEASON {state.season + 1} <span>→</span></button>
              </article>
            )}
            <FifaHome state={state} starters={starters} unread={unread} onOpen={(mode) => openTab(mode)} />
          </>
        )}

        {tab === 'World' && <WorldMap state={state} onBook={bookEvent} onPrepareMatch={() => openTab('Play')} />}

        {tab === 'Play' && (
          <section className="screen tactical-screen">
            <div className="tactical-heading"><div><span className="eyebrow">{activeEvent ? activeEvent.city.toUpperCase() + ' · TIER ' + activeEvent.circuitTier + ' · ' + activeEvent.format : 'TACTICAL DESK · WEEK ' + state.week}</span><h1>{activeEvent ? activeEvent.name : 'Решение до серии.'}</h1></div><div className="tactical-budget"><span>{activeEvent ? 'PRIZE POOL' : 'ЗАРПЛАТА'}</span><b>{activeEvent ? activeEvent.prize.toLocaleString('ru-RU') : payroll} кр.</b><small>{state.credits.toLocaleString('ru-RU')} кр. в кассе</small></div></div>
            <div className="tactical-board">
              <section className="tactical-team tactical-team-home"><div className="tactical-team-label">НАШ КЛУБ · {rating} OVR</div><div className="tactical-team-name">{starters.map((player) => player.alias).join(' · ')}</div><div className="tactical-team-meta"><span>{chem} химия</span><span>{state.lineupContinuity} стабильность</span></div><div className="tactical-mini-roster">{starters.map((player) => <button key={player.id} onClick={() => setSelectedPlayer(player)}><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} /><b>{player.alias}</b><small>{ROLE_LABELS[player.role]}</small></button>)}</div><button className="secondary tactical-edit" onClick={() => openTab('Roster')}>Изменить пятёрку</button></section>
              <div className="tactical-vs"><span>BO3</span><strong>VS</strong></div>
              <section className="tactical-opponent"><span className="eyebrow">{activeEvent ? 'EVENT FORMAT' : 'СЕРИЯ'}</span><h2>{modeInfo[activeEventMode ?? 'scrim'].name}</h2><p>{modeInfo[activeEventMode ?? 'scrim'].description}</p><div className="opponent-line"><b>?</b><span>СОПЕРНИК БУДЕТ ОПРЕДЕЛЁН</span></div></section>
            </div>
            <div className="tactical-control">
              <div className="tactical-plans"><div className="control-label">ПЛАН ИГРЫ</div>{(Object.keys(tacticInfo) as TacticalPlan[]).map((plan) => <button key={plan} className={'tactical-plan ' + (tactic === plan ? 'selected' : '')} onClick={() => setTactic(plan)}><span>{tacticInfo[plan].name}</span><small>{tacticInfo[plan].description}</small></button>)}</div>
              <div className="tactical-modes">
                <div className="control-label">{activeEvent ? 'EVENT FORMAT' : 'УРОВЕНЬ СЕРИИ'}</div>
                {activeEventMode ? (() => { const gate = canPlayMatch(state, activeEventMode); return <button className="tactical-mode selected" disabled={!gate.ok} onClick={() => play(activeEventMode)}><span>{modeInfo[activeEventMode].name}</span><small>{RISK_LABELS[modeInfo[activeEventMode].risk]} · {gate.ok ? 'TIER ' + activeEvent?.circuitTier + ' · ' + activeEvent?.format : gate.reason}</small></button> })() : (['scrim', 'showmatch', 'cup'] as MatchMode[]).map((mode) => { const gate = canPlayMatch(state, mode); return <button key={mode} className={'tactical-mode ' + (mode === 'scrim' ? 'selected' : '')} disabled={!gate.ok} onClick={() => play(mode)}><span>{modeInfo[mode].name}</span><small>{RISK_LABELS[modeInfo[mode].risk]} · {gate.ok ? 'готово' : gate.reason}</small></button> })}
              </div>
              <div className="tactical-launch"><span className="control-label">СЛЕДУЮЩИЙ ХОД</span><strong>{tacticInfo[tactic].name}</strong><button className="hq-primary-action" disabled={!canPlayMatch(state, activeEventMode ?? 'scrim').ok} onClick={() => play(activeEventMode ?? 'scrim')}>{activeEvent ? 'Играть турнир' : 'Начать серию'} <span>→</span></button>{warnings.length > 0 && <small>{warnings[0]}</small>}</div>
            </div>
            {last && <div className="match-recap-line"><span>ПОСЛЕДНИЙ RECAP · {last.opponent}</span><b>{last.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'} {last.maps.map((map) => map.us + ':' + map.them).join(' ')}</b><button className="text-button" onClick={() => openTab('Inbox')}>Открыть ленту</button></div>}
          </section>
        )}

        {tab === 'Roster' && (
          <RosterBoard
            state={state}
            setState={setState}
            onOpenPlayer={setSelectedPlayer}
            onOpenScout={() => openTab('Scout')}
          />
        )}

        {tab === 'Packs' && (
          <Suspense
            fallback={(
              <section className="screen">
                <div className="empty-state">
                  <span>НАГРАДЫ</span>
                  <h2>Загрузка…</h2>
                </div>
              </section>
            )}
          >
            <PacksView
              packTokens={state.packTokens}
              packState={state.packs}
              roster={state.roster}
              onOpenBatch={commitPackBatch}
              onClear={clearPacks}
            />
          </Suspense>
        )}

        {tab === 'Scout' && (
          <ScoutMarket
            state={state}
            setState={setState}
          />
        )}

        {tab === 'Profile' && <ManagerProfile state={state} />}

        {tab === 'Inbox' && (
          <section className="screen newsroom-screen">
            <div className="fifa-screen-header">
              <div>
                <span>CLUB FEED · WEEK {state.week}</span>
                <h1>INBOX</h1>
              </div>
              <div className="fifa-screen-rank"><small>EVENTS</small><b>{state.news.length + (state.pendingDecision ? 1 : 0)}</b></div>
            </div>
            {state.pendingDecision && (
              <article className={'club-decision-card decision-' + state.pendingDecision.kind}>
                <span>DECISION REQUIRED</span>
                <h2>{state.pendingDecision.title}</h2>
                <p>{state.pendingDecision.body}</p>
                <div>
                  <button onClick={() => resolveDecision('a')}>{state.pendingDecision.optionA}</button>
                  <button onClick={() => resolveDecision('b')}>{state.pendingDecision.optionB}</button>
                </div>
              </article>
            )}
            <div className="newsroom-layout">
              <div className="newsroom-season-mark"><span>SEASON</span><b>{state.season}</b><small>WEEK {state.week}/{state.seasonLength}</small></div>
              <div className="timeline">
                {state.news.map((item) => {
                  const target: Tab | null =
                    item.kind === 'contract' || item.kind === 'lineup' ? 'Roster' :
                    item.kind === 'scout' ? 'Scout' :
                    item.kind === 'match' ? 'World' :
                    item.kind === 'media' ? 'World' :
                    item.kind === 'finance' ? 'Profile' : null
                  return (
                    <article key={item.id}>
                      <div className="timeline-marker">{NEWS_KIND_LABELS[item.kind].slice(0, 1).toUpperCase()}</div>
                      <div>
                        <span>Неделя {item.week} · {NEWS_KIND_LABELS[item.kind]}</span>
                        <h2>{item.title}</h2>
                        <p>{item.body}</p>
                        {target && <button className="news-action" onClick={() => openTab(target)}>ОТКРЫТЬ <b>→</b></button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            <button className="danger-button save-reset" onClick={reset}>Сбросить сохранение</button>
          </section>
        )}
      </main>

      {pendingMatch && (
        <MatchRadar
          result={pendingMatch.result}
          starters={starters}
          onComplete={finishPendingMatch}
          onSkip={finishPendingMatch}
        />
      )}
    </div>
  )
}

export default App
