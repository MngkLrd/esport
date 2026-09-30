import { managerLevelProgress, type GameState } from './game'
import { careerObjectives } from './progression'

const MILESTONES = [
  { level: 1, title: 'Open Circuit', body: 'Tier 3 online cups · shortlist 5 игроков.' },
  { level: 2, title: 'Challenger Circuit', body: 'Tier 2 online leagues и первые regional LAN.' },
  { level: 3, title: 'International Network', body: 'Tier 2 LAN по Европе, Америке и Азии · shortlist 6 игроков.' },
  { level: 5, title: 'Tier 1 Circuit', body: 'Cologne, Katowice, Dallas, Chengdu и São Paulo · shortlist 7 игроков.' },
]

export function ManagerProfile({ state }: { state: GameState }) {
  const progress = managerLevelProgress(state.managerXp)
  const objectives = careerObjectives(state)
  const currentIndex = objectives.findIndex((objective) => !objective.completed)
  const current = currentIndex >= 0 ? objectives[currentIndex] : objectives.at(-1) ?? null
  const visibleObjectives = currentIndex >= 0
    ? objectives.slice(Math.max(0, currentIndex - 1), currentIndex + 5)
    : objectives.slice(-6)
  const nextMilestone = MILESTONES.find((item) => item.level > progress.level) ?? null
  const currentObjectiveProgress = current
    ? Math.min(100, Math.round(current.current / Math.max(1, current.target) * 100))
    : 100

  return (
    <section className="sim-screen sim-profile sim-manager-career">
      <div className="sim-screen-head sim-profile-head">
        <div>
          <span>MANAGER CAREER</span>
          <h1>CAREER PATH</h1>
        </div>
        <div className="sim-profile-level">
          <small>LVL</small>
          <b>{progress.level}</b>
        </div>
      </div>

      <div className="sim-profile-body manager-career-body">
        <aside className="sim-profile-overview manager-level-overview">
          <span>MANAGER LEVEL</span>
          <strong>{String(progress.level).padStart(2, '0')}</strong>

          <div className="manager-level-xp">
            <div>
              <small>XP PROGRESS</small>
              <b>{progress.current} / {progress.required}</b>
            </div>
            <i><em style={{ width: progress.percent + '%' }} /></i>
          </div>

          <div className="manager-next-unlock">
            <small>NEXT UNLOCK</small>
            <h2>{nextMilestone ? nextMilestone.title : 'ALL CIRCUITS UNLOCKED'}</h2>
            <p>{nextMilestone ? 'LVL ' + nextMilestone.level + ' · ' + nextMilestone.body : 'Все Tier 1–3 события и максимальная глубина scouting уже доступны.'}</p>
          </div>

          <div className="manager-level-milestones">
            {MILESTONES.map((item) => (
              <div key={item.level} className={progress.level >= item.level ? 'complete' : ''}>
                <b>LVL {item.level}</b>
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="manager-career-path">
          <div className="manager-career-current">
            <div className="manager-career-current-head">
              <div>
                <span>CURRENT OBJECTIVE</span>
                <h2>{current?.title ?? 'CAREER COMPLETE'}</h2>
              </div>
              <b>{currentObjectiveProgress}%</b>
            </div>

            <p>{current?.description ?? 'Основные карьерные ориентиры выполнены.'}</p>

            <div className="manager-career-current-progress">
              <i><em style={{ width: currentObjectiveProgress + '%' }} /></i>
              <span>{current ? current.current + ' / ' + current.target : 'DONE'}</span>
            </div>

            {current && <strong className="manager-career-reward">{current.rewardLabel}</strong>}
          </div>

          <div className="manager-career-list-head">
            <span>CAREER ROADMAP</span>
            <b>{objectives.filter((objective) => objective.completed).length}/{objectives.length} COMPLETE</b>
          </div>

          <div className="manager-career-list">
            {visibleObjectives.map((objective, index) => {
              const absoluteIndex = objectives.findIndex((entry) => entry.id === objective.id)
              const percent = Math.min(100, Math.round(objective.current / Math.max(1, objective.target) * 100))
              const active = objective.id === current?.id

              return (
                <article
                  key={objective.id}
                  className={objective.completed ? 'complete' : active ? 'active' : ''}
                >
                  <div className="manager-career-step">
                    <small>{String(absoluteIndex + 1).padStart(2, '0')}</small>
                    <i />
                  </div>

                  <div className="manager-career-copy">
                    <span>{objective.completed ? 'COMPLETE' : active ? 'IN PROGRESS' : 'UP NEXT'}</span>
                    <strong>{objective.title}</strong>
                    <p>{objective.description}</p>
                  </div>

                  <div className="manager-career-objective-progress">
                    <b>{objective.rewardLabel}</b>
                    <i><em style={{ width: percent + '%' }} /></i>
                    <span>{objective.current}/{objective.target}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </main>
      </div>

      <div className="sim-profile-stats manager-career-stats">
        <div><span>SEASON</span><b>{state.season}</b></div>
        <div><span>RECORD</span><b>{state.wins}-{state.losses}</b></div>
        <div><span>VRS</span><b>{state.clubVrsPoints}</b></div>
        <div><span>REPUTATION</span><b>{state.reputation}</b></div>
        <div><span>FANS</span><b>{state.fans.toLocaleString('ru-RU')}</b></div>
      </div>
    </section>
  )
}
