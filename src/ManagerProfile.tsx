import { managerLevelProgress, type GameState } from './game'

const MILESTONES = [
  { level: 1, title: 'Open Circuit', body: 'Tier 3 online cups · shortlist 5 игроков.' },
  { level: 2, title: 'Challenger Circuit', body: 'Tier 2 online leagues и первые regional LAN.' },
  { level: 3, title: 'International Network', body: 'Tier 2 LAN по Европе, Америке и Азии · shortlist 6 игроков.' },
  { level: 5, title: 'Tier 1 Circuit', body: 'Cologne, Katowice, Dallas, Chengdu и São Paulo · shortlist 7 игроков.' },
]

export function ManagerProfile({ state }: { state: GameState }) {
  const progress = managerLevelProgress(state.managerXp)
  const nextMilestone = MILESTONES.find((item) => item.level > progress.level) ?? null

  return (
    <section className="screen manager-profile-screen">
      <div className="fifa-screen-header">
        <div>
          <span>CAREER PROGRESSION</span>
          <h1>MANAGER LEVEL</h1>
        </div>
        <div className="manager-level-badge">{progress.level}</div>
      </div>

      <div className="manager-progress-hero">
        <div className="manager-progress-copy">
          <span>CURRENT LEVEL</span>
          <strong>{String(progress.level).padStart(2, '0')}</strong>
          <h2>{nextMilestone ? nextMilestone.title : 'ALL CIRCUITS UNLOCKED'}</h2>
          <p>{nextMilestone ? 'NEXT · LVL ' + nextMilestone.level + ' · ' + nextMilestone.body : 'Все Tier 1–3 ивенты и максимальная глубина scouting доступны.'}</p>
        </div>
        <div className="manager-progress-track">
          <div className="manager-progress-line"><i style={{ width: progress.percent + '%' }} /></div>
          <div className="manager-progress-labels"><span>{progress.current} XP</span><span>{progress.required} XP</span></div>
          <div className="manager-milestones">
            {MILESTONES.map((item) => (
              <article key={item.level} className={progress.level >= item.level ? 'complete' : ''}>
                <b>{progress.level >= item.level ? 'UNLOCKED' : 'LVL ' + item.level}</b>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="manager-stat-strip">
        <div><span>SEASON</span><b>{state.season}</b></div>
        <div><span>RECORD</span><b>{state.wins}-{state.losses}</b></div>
        <div><span>REPUTATION</span><b>{state.reputation}</b></div>
        <div><span>FANS</span><b>{state.fans.toLocaleString('ru-RU')}</b></div>
        <div><span>COLLECTION</span><b>{state.packs.inventory.length}</b></div>
      </div>
    </section>
  )
}
