import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  canPlayMatch,
  chemistry,
  getStartingFive,
  lineupWarnings,
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
  type Player,
  type TacticalPlan,
} from './game'
import { CARD_TIER_LABEL, PLAYER_PORTRAIT_STATS, cardTier, countryFlag } from './playerVisuals'
import {
  clearPackCollection,
  type PackRoll,
} from './packState'
import { CreditsView } from './CreditsView'
import { createBrowserSaveRepository } from './saveRepository'
import { rollWelcomePack } from './welcomePack'
import { PlayerPortrait } from './PlayerPortrait'
import { RosterBoard } from './RosterBoard'
import { ScoutMarket } from './ScoutMarket'
import { executeGameCommand } from './gameCommands'
import type { PackCard } from './packState'

const CardDetails = lazy(() => import('./CardDetails').then((module) => ({ default: module.CardDetails })))

const PacksView = lazy(() =>
  import('./PacksView').then((module) => ({ default: module.PacksView })),
)

const saveRepository = createBrowserSaveRepository()
type Tab = 'HQ' | 'Play' | 'Roster' | 'Packs' | 'Scout' | 'Inbox' | 'AI Director' | 'Credits'

const TAB_LABELS: Record<Tab, string> = {
  HQ: 'Штаб',
  Play: 'Матч',
  Roster: 'Состав',
  Packs: 'Наборы',
  Scout: 'Скаутинг',
  Inbox: 'Лента',
  'AI Director': 'ИИ-директор',
  Credits: 'Источники',
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

const DIRECTOR_LEVEL_LABELS = {
  urgent: 'СРОЧНО',
  watch: 'ВНИМАНИЕ',
  good: 'НОРМА',
} as const

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
          <p className="card-detail-empty">База игрока приходит из карточки, а форма, мораль и усталость меняются решениями менеджера.</p>
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
  const unread = seenNewsId === state.news[0]?.id ? 0 : Math.min(state.news.length, 9)

  useEffect(() => {
    saveRepository.save(state)
  }, [state])

  const openTab = (next: Tab) => {
    setTab(next)
    if (next === 'Inbox') setSeenNewsId(state.news[0]?.id ?? null)
  }

  const play = (mode: MatchMode) => {
    const gate = canPlayMatch(state, mode)
    if (!gate.ok) return
    setState((current) => executeGameCommand(current, { type: 'PLAY_MATCH', mode, tactic }).state)
    setTab('HQ')
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

  const commitPackRoll = (roll: PackRoll) => {
    if (state.credits < roll.pack.price || state.packs.serial !== roll.winner.serial) return false
    setState((current) => {
      if (current.credits < roll.pack.price || current.packs.serial !== roll.winner.serial) return current
      return executeGameCommand(current, { type: 'OPEN_PACK', roll }).state
    })
    return true
  }

  const clearPacks = () => {
    setState((current) => ({ ...current, packs: clearPackCollection(current.packs) }))
  }

  const welcomeCards = useMemo(() => rollWelcomePack(state.saveId), [state.saveId])

  const finishWelcome = () => {
    setState((current) => executeGameCommand(current, { type: 'OPEN_WELCOME_PACK', cards: welcomeCards }).state)
    setWelcomeStep('complete')
    setTab('HQ')
  }

  const directorNotes = useMemo(() => {
    const notes: { level: 'urgent' | 'watch' | 'good'; title: string; body: string }[] = []
    const tired = starters.filter((p) => p.fatigue >= 65)
    const expiring = state.roster.filter((p) => p.contractWeeks <= 2)
    const runway = payroll > 0 ? state.credits / payroll : 99

    if (state.startingFive.length !== 5) {
      notes.push({ level: 'urgent', title: 'Состав не укомплектован', body: 'Матч недоступен, пока не выбраны ровно пять игроков с действующими контрактами.' })
    }
    if (expiring.length) {
      notes.push({ level: 'urgent', title: 'Риск по контрактам', body: 'До окончания контрактов осталось не больше двух недель: ' + expiring.map((p) => p.alias).join(', ') + '.' })
    }
    if (tired.length) {
      notes.push({ level: 'watch', title: 'Высокая усталость', body: 'Усталость выше 65 у: ' + tired.map((p) => p.alias).join(', ') + '. Перед сложной серией лучше дать отдых или посадить в запас.' })
    }
    if (runway < 3) {
      notes.push({ level: 'watch', title: 'Короткий финансовый запас', body: 'Текущих средств хватит примерно на ' + runway.toFixed(1) + ' зарплатных цикла без дохода от матчей.' })
    }
    if (!starters.some((player) => player.role === 'IGL')) {
      notes.push({ level: 'watch', title: 'В пятёрке нет IGL', body: 'Симуляция реально снижает рейтинг активного состава, если в нём нет IGL.' })
    }
    if (!starters.some((player) => player.role === 'AWP')) {
      notes.push({ level: 'watch', title: 'В пятёрке нет AWP', body: 'Без выделенного AWP активный состав получает штраф к контролю карты.' })
    }
    if (!notes.length) {
      notes.push({ level: 'good', title: 'Клуб в рабочем состоянии', body: 'Состав корректен, контракты стабильны, критических рисков по усталости и деньгам сейчас нет.' })
    }
    return notes.slice(0, 4)
  }, [state, starters, payroll, warnings])

  const tabs: Tab[] = ['HQ', 'Play', 'Roster', 'Packs', 'Scout', 'Inbox', 'AI Director', 'Credits']

  return (
    <div className="app-shell">
      {!state.welcomeComplete && (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <section className="welcome-panel">
            <div className="welcome-brand">ESPORT AI MANAGER</div>
            {welcomeStep === 'intro' && <>
              <div className="eyebrow">ПЕРВЫЙ СЕЙВ · СТАРТОВЫЙ НАБОР</div>
              <h1 id="welcome-title">Собери свою первую пятёрку.</h1>
              <p>Один набор, пять ролей, один клуб. Карты станут игроками состава и останутся в коллекции.</p>
              <div className="welcome-grid">
                <article><b>01</b><strong>Пять игроков</strong><span>IGL, AWP, Entry, Support и Rifler — роли закрыты заранее.</span></article>
                <article><b>02</b><strong>Один результат</strong><span>Открытие привязано к этому сейву и не меняется после перезагрузки.</span></article>
                <article><b>03</b><strong>Дальше — сезон</strong><span>Состав, матч, деньги и последствия начинаются сразу после открытия.</span></article>
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
            <small>Карты раскрываются один раз и сохраняются вместе с сейвом.</small>
          </section>
        </div>
      )}
      {selectedCard && <Suspense fallback={null}><CardDetails card={selectedCard} onClose={() => setSelectedCard(null)} /></Suspense>}
      {selectedPlayer && <PlayerProfileModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <span>ESPORT</span>
            <strong>AI MANAGER</strong>
          </div>
        </div>
        <div className="top-stats">
          <Metric label="РЕЙТ" value={rating} accent />
          <Metric label="Матчи" value={state.wins + 'В ' + state.losses + 'П'} />
          <Metric label="Неделя" value={state.week + '/' + state.seasonLength} />
          <Metric label="Кредиты" value={format.format(state.credits)} />
          <Metric label="Зарплаты" value={format.format(payroll)} />
        </div>
      </header>

      <nav className="tabs domain-nav">
        <div className="nav-group"><span className="nav-group-label">КЛУБ</span>{(['HQ', 'Play', 'Roster'] as Tab[]).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => openTab(item)}>{TAB_LABELS[item]}</button>)}</div>
        <div className="nav-group"><span className="nav-group-label">КОЛЛЕКЦИЯ</span>{(['Packs', 'Scout'] as Tab[]).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => openTab(item)}>{TAB_LABELS[item]}</button>)}</div>
        <div className="nav-group nav-group-utility"><span className="nav-group-label">ЖУРНАЛ</span>{(['Inbox', 'AI Director', 'Credits'] as Tab[]).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => openTab(item)}>{TAB_LABELS[item]}{item === 'Inbox' && unread > 0 && <span className="badge">{unread}</span>}</button>)}</div>
      </nav>

      <main>
        {tab === 'HQ' && (
          <section className="screen hq-screen">
            {state.seasonEnded && state.seasonSummary && (
              <article className="season-summary-panel broadcast-summary">
                <div className="eyebrow">СЕЗОН {state.seasonSummary.season} · ИТОГ</div>
                <h1>Финальный свисток.</h1>
                <div className="season-summary-grid">
                  <span><b>{state.seasonSummary.wins}–{state.seasonSummary.losses}</b>Результат</span>
                  <span><b>{state.seasonSummary.points}</b>Очки</span>
                  <span><b>{state.seasonSummary.reputation}</b>Репутация</span>
                  <span><b>{state.seasonSummary.credits}</b>Кредиты</span>
                  <span><b>{state.seasonSummary.bestPlayer ?? '—'}</b>Лучший игрок</span>
                </div>
                <p>{state.seasonSummary.objective.completed ? 'Цель владельца выполнена.' : 'Цель владельца не выполнена: ' + state.seasonSummary.objective.value + '/' + state.seasonSummary.objective.target + ' побед.'}</p>
                <button className="primary" onClick={() => setState((current) => executeGameCommand(current, { type: 'START_NEXT_SEASON' }).state)}>Начать сезон {state.season + 1}</button>
              </article>
            )}
            <div className="hq-intro-line">
              <div><span className="eyebrow">КЛУБНЫЙ ПУЛЬТ · СЕЗОН {state.season}</span><h1>Неделя {state.week}: играем составом.</h1></div>
              <div className="hq-week-mark"><small>WEEK</small><b>{String(state.week).padStart(2, '0')}</b><span>/{state.seasonLength}</span></div>
            </div>

            <div className="hq-layout">
              <aside className="team-dossier">
                <div className="hq-section-head"><span>STARTING FIVE</span><button className="text-button" onClick={() => openTab('Roster')}>Изменить</button></div>
                <div className="team-dossier-score"><strong>{rating}</strong><span>OVR КЛУБА</span><i>{chem} ХИМИЯ</i></div>
                <div className="hq-starter-list">
                  {starters.length ? starters.map((player, index) => <HqStarterRow key={player.id} player={player} index={index} onOpen={() => setSelectedPlayer(player)} />) : <p className="empty">Стартовая пятёрка не собрана.</p>}
                </div>
                <div className="team-dossier-foot"><span><b>{state.lineupContinuity}</b> СТАБИЛЬНОСТЬ</span><span><b>{payroll}</b> КР./НЕД.</span><span><b>{state.staffEnergy}/3</b> ШТАБ</span></div>
              </aside>

              <section className="match-desk">
                <div className="hq-section-head"><span>СЛЕДУЮЩЕЕ РЕШЕНИЕ</span><span className="desk-status">BO3 · НЕДЕЛЯ {state.week}</span></div>
                <div className="match-desk-main">
                  <div className="match-crest match-crest-home"><b>{starters[0]?.team?.slice(0, 3).toUpperCase() || 'CLB'}</b><small>НАШ КЛУБ</small></div>
                  <div className="match-versus"><span>{modeInfo.scrim.name}</span><strong>VS</strong><small>соперник определяется перед стартом серии</small></div>
                  <div className="match-crest match-crest-away"><b>?</b><small>СОПЕРНИК</small></div>
                </div>
                <div className="match-plan-line"><div><span>ПЛАН</span><strong>{tacticInfo[tactic].name}</strong><small>{tacticInfo[tactic].description}</small></div><button className="text-button" onClick={() => openTab('Play')}>Настроить</button></div>
                <button className="hq-primary-action" onClick={() => openTab('Play')}>Подготовиться к матчу <span>→</span></button>
                {last && <div className="latest-result"><div><span>ПОСЛЕДНЯЯ СЕРИЯ · {last.opponent}</span><strong>{last.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'} · {last.mvp}</strong></div><b>{last.maps.map((map) => map.us + ':' + map.them).join('  ')}</b><button className="text-button" onClick={() => openTab('Inbox')}>Открыть recap</button></div>}
              </section>

              <aside className="club-pulse">
                <div className="hq-section-head"><span>CLUB PULSE</span><button className="text-button" onClick={() => openTab('Inbox')}>Лента</button></div>
                <div className="pulse-score"><b>{state.reputation}</b><span>РЕПУТАЦИЯ</span><i>{state.reputation >= 45 ? 'КУБОК ОТКРЫТ' : 'КУБОК ЗАКРЫТ'}</i></div>
                <div className="pulse-rail"><span><b>{state.credits.toLocaleString('ru-RU')}</b> КРЕДИТЫ</span><span><b>{state.lastWeekNet >= 0 ? '+' : ''}{state.lastWeekNet}</b> ИТОГ НЕДЕЛИ</span><span><b>{state.wins}–{state.losses}</b> СЕРИИ</span></div>
                <div className="pulse-alerts">{(warnings.length ? warnings.slice(0, 2) : directorNotes.slice(0, 2).map((note) => note.title)).map((note) => <div key={note}><span>!</span><p>{note}</p></div>)}</div>
              </aside>
            </div>

            <div className="hq-news-strip"><span>ПОСЛЕДНИЕ ИЗМЕНЕНИЯ</span>{state.news.slice(0, 3).map((item) => <button key={item.id} onClick={() => openTab('Inbox')}><b>Н{item.week}</b><span>{item.title}</span><i>→</i></button>)}</div>
          </section>
        )}

        {tab === 'Play' && (
          <section className="screen tactical-screen">
            <div className="tactical-heading"><div><span className="eyebrow">TACTICAL DESK · WEEK {state.week}</span><h1>Решение до серии.</h1><p>Собери пятёрку, выбери план и запусти BO3. Соперник появится внутри симуляции.</p></div><div className="tactical-budget"><span>ЗАРПЛАТА</span><b>{payroll} кр.</b><small>{state.credits.toLocaleString('ru-RU')} кр. в кассе</small></div></div>
            <div className="tactical-board">
              <section className="tactical-team tactical-team-home"><div className="tactical-team-label">НАШ КЛУБ · {rating} OVR</div><div className="tactical-team-name">{starters.map((player) => player.alias).join(' · ')}</div><div className="tactical-team-meta"><span>{chem} химия</span><span>{state.lineupContinuity} стабильность</span></div><div className="tactical-mini-roster">{starters.map((player) => <button key={player.id} onClick={() => setSelectedPlayer(player)}><PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} /><b>{player.alias}</b><small>{ROLE_LABELS[player.role]}</small></button>)}</div><button className="secondary tactical-edit" onClick={() => openTab('Roster')}>Изменить пятёрку</button></section>
              <div className="tactical-vs"><span>BO3</span><strong>VS</strong><small>сила соперника рассчитывается перед стартом</small></div>
              <section className="tactical-opponent"><span className="eyebrow">СЕРИЯ</span><h2>{modeInfo.scrim.name}</h2><p>{modeInfo.scrim.description}</p><div className="opponent-line"><b>?</b><span>СОПЕРНИК БУДЕТ ОПРЕДЕЛЁН</span></div></section>
            </div>
            <div className="tactical-control">
              <div className="tactical-plans"><div className="control-label">ПЛАН ИГРЫ</div>{(Object.keys(tacticInfo) as TacticalPlan[]).map((plan) => <button key={plan} className={'tactical-plan ' + (tactic === plan ? 'selected' : '')} onClick={() => setTactic(plan)}><span>{tacticInfo[plan].name}</span><small>{tacticInfo[plan].description}</small></button>)}</div>
              <div className="tactical-modes"><div className="control-label">УРОВЕНЬ СЕРИИ</div>{(['scrim', 'showmatch', 'cup'] as MatchMode[]).map((mode) => { const gate = canPlayMatch(state, mode); return <button key={mode} className={'tactical-mode ' + (mode === 'scrim' ? 'selected' : '')} disabled={!gate.ok} onClick={() => play(mode)}><span>{modeInfo[mode].name}</span><small>{RISK_LABELS[modeInfo[mode].risk]} · {gate.ok ? 'готово' : gate.reason}</small></button> })}</div>
              <div className="tactical-launch"><span className="control-label">СЛЕДУЮЩИЙ ХОД</span><strong>{tacticInfo[tactic].name}</strong><button className="hq-primary-action" disabled={!canPlayMatch(state, 'scrim').ok} onClick={() => play('scrim')}>Начать серию <span>→</span></button>{warnings.length > 0 && <small>{warnings[0]}</small>}</div>
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
                  <h2>Загружаю коллекцию и HLTV-карточки…</h2>
                </div>
              </section>
            )}
          >
            <PacksView
              credits={state.credits}
              saveId={state.saveId}
              packState={state.packs}
              roster={state.roster}
              onOpen={commitPackRoll}
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

        {tab === 'Inbox' && (
          <section className="screen newsroom-screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">CLUB NEWSROOM · {state.news.length} СОБЫТИЙ</div>
                <h1>Новости, которые меняют сезон.</h1>
              </div>
              <p>Матчи, деньги и состав собраны в одну хронику. Здесь видно, почему клуб оказался в текущей точке.</p>
            </div>
            <div className="newsroom-layout"><div className="newsroom-season-mark"><span>SEASON</span><b>{state.season}</b><small>WEEK {state.week}/{state.seasonLength}</small></div><div className="timeline">
              {state.news.map((item) => (
                <article key={item.id}>
                  <div className="timeline-marker">{NEWS_KIND_LABELS[item.kind].slice(0, 1).toUpperCase()}</div>
                  <div>
                    <span>Неделя {item.week} · {NEWS_KIND_LABELS[item.kind]}</span>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div></div>
          </section>
        )}

        {tab === 'AI Director' && (
          <section className="screen narrow">
            <div className="section-title">
              <div>
                <div className="eyebrow">ЛОКАЛЬНЫЙ ДИРЕКТОР · АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ</div>
                <h1>Полезен уже сейчас, к LLM готов позже.</h1>
              </div>
            </div>

            <div className="director-grid">
              {directorNotes.map((note) => (
                <article className={'director-note ' + note.level} key={note.title}>
                  <span>{DIRECTOR_LEVEL_LABELS[note.level]}</span>
                  <h2>{note.title}</h2>
                  <p>{note.body}</p>
                </article>
              ))}
            </div>

            <div className="architecture">
              <article>
                <span>01 · КАНОНИЧЕСКОЕ СОСТОЯНИЕ</span>
                <h2>Источник истины — симуляция</h2>
                <p>Стартовая пятёрка, контракты, зарплаты, усталость, вероятность на карте, оценки игроков и награды считаются детерминированными переходами состояния.</p>
                <code>состояние + состав + тактика + режим + сид → новое состояние</code>
              </article>
              <article>
                <span>02 · ДИРЕКТОР СЕЙЧАС</span>
                <h2>Подсказки по правилам</h2>
                <p>Экран читает реальное сохранение и отмечает риски по контрактам, усталости, ролям и деньгам. Он работает без имитации подключённой LLM.</p>
                <code>факты → конкретные предупреждения</code>
              </article>
              <article>
                <span>03 · ГРАНИЦА LLM</span>
                <h2>Генерация отвечает только за подачу</h2>
                <p>В будущем шлюз сможет превращать эти факты в переговоры, медиа и конфликты, но не должен решать исходы матчей или транзакций.</p>
                <code>факты → проверенная схема → нарратив</code>
              </article>
            </div>

            <div className="debug-panel">
              <div><span>Сид</span><b>{state.seed}</b></div>
              <div><span>Рейтинг команды</span><b>{rating}</b></div>
              <div><span>Химия</span><b>{chem}</b></div>
              <div><span>Зарплаты</span><b>{payroll}</b></div>
            </div>
            <button className="danger-button" onClick={reset}>Сбросить сохранение</button>
          </section>
        )}
        {tab === 'Credits' && <CreditsView />}
      </main>

      <footer>
        <span>ESPORT AI Manager · локальный фан-проект</span>
        <button className="footer-link" onClick={() => openTab('Credits')}>Источники и авторство</button>
      </footer>
    </div>
  )
}

export default App
