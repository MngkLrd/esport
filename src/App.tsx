import { useEffect, useMemo, useState } from 'react'
import {
  canPlayMatch,
  chemistry,
  createInitialState,
  getStartingFive,
  lineupWarnings,
  migrateState,
  modeInfo,
  overall,
  playMatch,
  releasePlayer,
  renewContract,
  restPlayer,
  scout,
  signProspect,
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
import { VRS_STATS, VRS_SNAPSHOT_DATE } from './vrs'
import { CARD_TIER_LABEL, PLAYER_PORTRAIT_STATS, cardTier, countryFlag, playerPhoto } from './playerVisuals'
import { PacksView } from './PacksView'
import {
  LEGACY_PACK_SAVE_KEY,
  clearPackCollection,
  collectPackWinner,
  migratePackState,
  type PackRoll,
} from './packs'
import { CreditsView } from './CreditsView'

const SAVE_KEY = 'esport-ai-manager-v2'
const LEGACY_SAVE_KEY = 'esport-ai-manager-v1'
const WELCOME_KEY = 'esport-ai-manager-welcome-ru-v1'
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

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_SAVE_KEY)
    if (!raw) return createInitialState()

    let next = migrateState(JSON.parse(raw))
    const legacyPacks = localStorage.getItem(LEGACY_PACK_SAVE_KEY)
    if (legacyPacks) {
      const migratedPacks = migratePackState(JSON.parse(legacyPacks))
      if (next.packs.inventory.length === 0 && migratedPacks.inventory.length > 0) {
        next = { ...next, packs: migratedPacks }
      }
      localStorage.removeItem(LEGACY_PACK_SAVE_KEY)
    }
    return next
  } catch {
    return createInitialState()
  }
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={'metric ' + (accent ? 'metric-accent' : '')}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PlayerVisualCard({ player, starter = false, compact = false }: { player: Player; starter?: boolean; compact?: boolean }) {
  const ovr = overall(player)
  const tier = cardTier(ovr)
  const photo = playerPhoto(player.alias)
  const initials = player.alias.slice(0, 3).toUpperCase()
  const role = player.role === 'Rifler' ? 'РИФ' : player.role === 'Support' ? 'САП' : player.role === 'Entry' ? 'ЕНТ' : player.role

  return (
    <div className={'visual-player-card tier-' + tier + (starter ? ' is-starter' : '') + (compact ? ' compact' : '')}>
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
        {photo && (
          <img
            src={photo}
            alt={player.realName + ' (' + player.alias + ')'}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
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
    </div>
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
          <p>{player.realName} · {player.age} лет · РЕЙТ {overall(player)} · ПОТ {player.potential}</p>
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

function App() {
  const [state, setState] = useState<GameState>(loadState)
  const [tab, setTab] = useState<Tab>('HQ')
  const [tactic, setTactic] = useState<TacticalPlan>('balanced')
  const [seenNewsId, setSeenNewsId] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem(WELCOME_KEY) !== '1')

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
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  }, [state])

  const openTab = (next: Tab) => {
    setTab(next)
    if (next === 'Inbox') setSeenNewsId(state.news[0]?.id ?? null)
  }

  const play = (mode: MatchMode) => {
    const gate = canPlayMatch(state, mode)
    if (!gate.ok) return
    setState((current) => playMatch(current, mode, tactic))
    setTab('HQ')
  }

  const reset = () => {
    if (window.confirm('Сбросить текущее сохранение и начать новый проект? Коллекция наборов этого сейва тоже будет удалена.')) {
      const fresh = createInitialState()
      localStorage.setItem(SAVE_KEY, JSON.stringify(fresh))
      setState(fresh)
      setTab('HQ')
    }
  }

  const commitPackRoll = (roll: PackRoll) => {
    if (state.credits < roll.pack.price || state.packs.serial !== roll.winner.serial) return false
    setState((current) => {
      if (current.credits < roll.pack.price || current.packs.serial !== roll.winner.serial) return current
      return {
        ...current,
        credits: current.credits - roll.pack.price,
        packs: collectPackWinner(current.packs, roll.winner),
      }
    })
    return true
  }

  const clearPacks = () => {
    setState((current) => ({ ...current, packs: clearPackCollection(current.packs) }))
  }

  const finishWelcome = (next: Tab = 'HQ') => {
    localStorage.setItem(WELCOME_KEY, '1')
    setShowWelcome(false)
    setTab(next)
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
      {showWelcome && (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <section className="welcome-panel">
            <div className="welcome-brand">ESPORT AI MANAGER</div>
            <div className="eyebrow">НОВЫЙ СЕЗОН · 12 НЕДЕЛЬ</div>
            <h1 id="welcome-title">Ты управляешь клубом, а не полоской прогресса.</h1>
            <p>В основе лежат реальные CS2-профили и публичные данные, но рейтинг, зарплаты, потенциал и результаты матчей рассчитывает игровая симуляция.</p>
            <div className="welcome-grid">
              <article><b>01</b><strong>Собери пятёрку</strong><span>Роли, форма, усталость и стабильность состава влияют на силу команды.</span></article>
              <article><b>02</b><strong>Следи за деньгами</strong><span>Контракты и зарплаты списываются по неделям. Глубина состава тоже стоит денег.</span></article>
              <article><b>03</b><strong>Проживи сезон</strong><span>Каждая серия двигает календарь, меняет состояние игроков и оставляет запись в истории клуба.</span></article>
            </div>
            <div className="welcome-actions">
              <button className="primary" onClick={() => finishWelcome('HQ')}>Начать сезон</button>
              <button className="secondary" onClick={() => finishWelcome('Roster')}>Сначала посмотреть состав</button>
            </div>
            <small>Сохранение хранится локально в браузере.</small>
          </section>
        </div>
      )}
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

      <nav className="tabs">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => openTab(item)}>
            {TAB_LABELS[item]}
            {item === 'Inbox' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'HQ' && (
          <section className="screen">
            <div className="hero">
              <div>
                <div className="eyebrow">СЕЗОН 0 · НЕДЕЛЯ {state.week}</div>
                <h1>Управляй клубом, а не только результатом.</h1>
                <p>
                  Стартовая пятёрка, усталость, роли, контракты и недельная зарплата напрямую влияют на бюджет и силу команды. Каждый матч двигает неделю вперёд, поэтому доход от серии не бывает бесплатным.
                </p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => openTab('Play')}>Подготовиться к матчу</button>
                  <button className="secondary" onClick={() => openTab('Roster')}>Управление пятёркой</button>
                </div>
              </div>
              <div className="rating-orb">
                <span>КОМАНДА</span>
                <strong>{rating}</strong>
                <small>{chem} химия</small>
              </div>
            </div>

            <div className="kpi-grid">
              <Metric label="Репутация" value={state.reputation + '/100'} />
              <Metric label="Очки сезона" value={state.seasonPoints} />
              <Metric label="Действия штаба" value={state.staffEnergy + '/3'} />
              <Metric label="Итог недели" value={(state.lastWeekNet >= 0 ? '+' : '') + state.lastWeekNet + ' кр.'} />
            </div>

            <div className="status-strip">
              <div><span>СТАРТОВАЯ ПЯТЁРКА</span><b>{starters.map((p) => p.alias).join(' · ') || 'Не укомплектована'}</b></div>
              <div><span>СТАБИЛЬНОСТЬ</span><b>{state.lineupContinuity}/100</b></div>
              <div><span>НЕДЕЛЬНАЯ ЗАРПЛАТА</span><b>{payroll} кр.</b></div>
              <div><span>КУБОК</span><b>{state.wins >= 2 || state.reputation >= 45 ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</b></div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-stack">
                {warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}

            <div className="two-col">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">ПОСЛЕДНЯЯ СЕРИЯ</div>
                    <h2>{last ? last.opponent : 'Матчей ещё не было'}</h2>
                  </div>
                  {last && <span className={last.won ? 'result win' : 'result loss'}>{last.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</span>}
                </div>
                {last ? (
                  <>
                    <div className="map-row">
                      {last.maps.map((map) => (
                        <div key={map.map}>
                          <span>{map.map} · {map.winChance}%</span>
                          <strong>{map.us}:{map.them}</strong>
                        </div>
                      ))}
                    </div>
                    <h3 className="story-title">{last.headline}</h3>
                    <p className="muted">{last.detail}</p>
                    <div className="performance-row">
                      {last.performances.slice(0, 3).map((perf) => (
                        <span key={perf.playerId}>{perf.alias} <b>{perf.rating}</b></span>
                      ))}
                    </div>
                    <div className="reward-line">
                      <span>MVP {last.mvp}</span>
                      <span>Доход +{last.reward}</span>
                      <span>Зарплаты -{last.payroll}</span>
                      <span>Итог {last.net >= 0 ? '+' : ''}{last.net}</span>
                    </div>
                  </>
                ) : (
                  <p className="empty">Выбери стартовую пятёрку и тактику, затем сыграй BO3. После первой серии появятся вероятности по картам, оценки игроков и реальный денежный итог недели.</p>
                )}
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">ЛЕНТА МЕНЕДЖЕРА</div>
                    <h2>Что изменилось</h2>
                  </div>
                  <button className="text-button" onClick={() => openTab('Inbox')}>Открыть всё</button>
                </div>
                <div className="feed">
                  {state.news.slice(0, 5).map((item) => (
                    <div className="feed-item" key={item.id}>
                      <span>Н{item.week}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}

        {tab === 'Play' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">МАТЧ-ЦЕНТР · РЕЙТ {rating} · ХИМ {chem}</div>
                <h1>Прими решение до матча.</h1>
              </div>
              <p>Каждый матч двигает календарь на неделю, списывает зарплату всего состава и расходует срок контрактов основы. Текущая зарплата: <b>{payroll} кр.</b>.</p>
            </div>

            <div className="lineup-summary">
              <div>
                <span>АКТИВНАЯ ПЯТЁРКА</span>
                <strong>{starters.length === 5 ? starters.map((p) => p.alias).join(' · ') : starters.length + '/5 выбрано'}</strong>
              </div>
              <button className="secondary" onClick={() => openTab('Roster')}>Изменить состав</button>
            </div>

            {warnings.length > 0 && (
              <div className="warning-stack compact">
                {warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}

            <div className="tactic-grid">
              {(Object.keys(tacticInfo) as TacticalPlan[]).map((plan) => (
                <button key={plan} className={'tactic-card ' + (tactic === plan ? 'selected' : '')} onClick={() => setTactic(plan)}>
                  <span>{tacticInfo[plan].name}</span>
                  <small>{tacticInfo[plan].description}</small>
                </button>
              ))}
            </div>

            <div className="mode-grid">
              {(['scrim', 'showmatch', 'cup'] as MatchMode[]).map((mode) => {
                const gate = canPlayMatch(state, mode)
                return (
                  <article className="mode-card" key={mode}>
                    <span className={'risk risk-' + modeInfo[mode].risk.toLowerCase()}>{RISK_LABELS[modeInfo[mode].risk] ?? modeInfo[mode].risk} риск</span>
                    <h2>{modeInfo[mode].name}</h2>
                    <p>{modeInfo[mode].description}</p>
                    <div className="mode-meta">
                      <span>BO3 · инерция между картами</span>
                      <span>Важны роли + состояние + стабильность</span>
                      <span>Доход считается с учётом зарплат</span>
                    </div>
                    {!gate.ok && <div className="gate-reason">{gate.reason}</div>}
                    <button className="primary" disabled={!gate.ok} onClick={() => play(mode)}>
                      Играть с планом: {tacticInfo[tactic].name}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {tab === 'Roster' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">СОСТАВ · {state.roster.length}/8 · ОСНОВА {state.startingFive.length}/5</div>
                <h1>Запас теперь действительно нужен.</h1>
              </div>
              <p>Давай отдых уставшим, следи за контрактами, закрывай нужные роли и контролируй зарплаты. Перестановки временно снижают стабильность состава.</p>
            </div>

            <div className="lineup-card-grid">
              {[...state.roster]
                .sort((a, b) => Number(state.startingFive.includes(b.id)) - Number(state.startingFive.includes(a.id)) || overall(b) - overall(a))
                .map((player) => (
                  <PlayerVisualCard
                    key={'visual-' + player.id}
                    player={player}
                    starter={state.startingFive.includes(player.id)}
                  />
                ))}
            </div>

            <div className="roster-toolbar">
              <Metric label="Рейтинг команды" value={rating} accent />
              <Metric label="Химия" value={chem} />
              <Metric label="Стабильность" value={state.lineupContinuity} />
              <Metric label="Зарплаты" value={payroll + ' кр./нед.'} />
              <Metric label="Действия штаба" value={state.staffEnergy + '/3'} />
            </div>

            <div className="roster-grid">
              {[...state.roster]
                .sort((a, b) => Number(state.startingFive.includes(b.id)) - Number(state.startingFive.includes(a.id)) || overall(b) - overall(a))
                .map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    state={state}
                    isStarter={state.startingFive.includes(player.id)}
                    onTrain={() => setState((current) => trainPlayer(current, player.id))}
                    onRest={() => setState((current) => restPlayer(current, player.id))}
                    onRenew={() => setState((current) => renewContract(current, player.id))}
                    onToggleStarter={() => setState((current) => toggleStarter(current, player.id))}
                    onRelease={() => setState((current) => releasePlayer(current, player.id))}
                  />
                ))}
            </div>
          </section>
        )}

        {tab === 'Packs' && (
          <PacksView
            credits={state.credits}
            saveId={state.saveId}
            packState={state.packs}
            onOpen={commitPackRoll}
            onClear={clearPacks}
          />
        )}

        {tab === 'Scout' && (
          <section className="screen">
            <div className="section-title">
              <div>
                <div className="eyebrow">СКАУТИНГ · СОСТАВ {state.roster.length}/8</div>
                <h1>Ищи игроков под конкретную задачу.</h1>
              </div>
              <button className="primary" disabled={state.credits < 300} onClick={() => setState((current) => scout(current))}>
                Найти 3 кандидатов · 300 кр.
              </button>
            </div>
            <div className="callout">
              <strong>Правило экономики</strong>
              <span>У подписания две цены: разовый трансферный платёж и недельная зарплата. Глубина состава помогает с усталостью и ролями, но раздутый ростер быстро съедает запас денег.</span>
            </div>
            {state.prospects.length === 0 ? (
              <div className="empty-state">
                <span>СКАУТСКИЙ ОТДЕЛ</span>
                <h2>Нет активного отчёта</h2>
                <p>Потрать 300 кредитов, чтобы получить трёх кандидатов из {format.format(VRS_STATS.players)} реальных CS2-ников из {format.format(VRS_STATS.teams)} команд в срезе Valve VRS ({VRS_SNAPSHOT_DATE}). Сейчас слой портретов находит {format.format(PLAYER_PORTRAIT_STATS.coveredPlayers)} реальных портретов из HLTV CDN; для остальных остаётся текстовая карточка. Репутация повышает нижнюю границу игрового рейтинга.</p>
              </div>
            ) : (
              <div className="prospect-grid">
                {state.prospects.map((player) => {
                  const fee = player.salary * 3
                  return (
                    <article className="prospect-card" key={player.id}>
                      <PlayerVisualCard player={player} compact />
                      <div className="prospect-identity-line">
                        <span>{player.realName !== player.alias ? player.realName : 'Данные профиля пока не найдены'}</span>
                        <span>{player.age > 0 ? player.age + ' лет' : 'возраст неизвестен'}</span>
                      </div>
                      <p>{player.bio}</p>
                      <div className="scout-numbers">
                        <span>Потенциал <b>{player.potential}</b></span>
                        <span>Зарплата <b>{player.salary}/нед.</b></span>
                        <span>Подписание <b>{fee}</b></span>
                      </div>
                      <div className="traits">{player.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                      <button
                        className="primary"
                        disabled={state.credits < fee || state.roster.length >= 8}
                        onClick={() => setState((current) => signProspect(current, player.id))}
                      >
                        Подписать в запас · {fee} кр.
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {tab === 'Inbox' && (
          <section className="screen narrow">
            <div className="section-title">
              <div>
                <div className="eyebrow">ЛЕНТА КЛУБА · {state.news.length} СОБЫТИЙ</div>
                <h1>Сезон запоминает последствия.</h1>
              </div>
            </div>
            <div className="timeline">
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
            </div>
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
