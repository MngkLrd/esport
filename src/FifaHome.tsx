import { managerLevelProgress, type GameState, type Player } from './game'
import { PlayerPortrait } from './PlayerPortrait'

type ModeKey = 'Play' | 'World' | 'Roster' | 'Scout' | 'Packs' | 'Profile'

export function FifaHome({
  state,
  starters,
  onOpen,
}: {
  state: GameState
  starters: Player[]
  onOpen: (mode: ModeKey) => void
}) {
  const level = managerLevelProgress(state.managerXp)
  const hero = starters[0]
  const last = state.history[0]

  return (
    <section className="fifa-home-screen">
      <div className="fifa-home-status">
        <div>
          <span>SEASON {state.season}</span>
          <strong>WEEK {String(state.week).padStart(2, '0')}</strong>
        </div>
        <div className="fifa-level-strip">
          <span>MANAGER LVL {level.level}</span>
          <i><em style={{ width: level.percent + '%' }} /></i>
          <b>{level.current}/{level.required} XP</b>
        </div>
      </div>

      <div className="fifa-mode-grid">
        <button className="fifa-mode-tile fifa-mode-hero" onClick={() => onOpen('Play')}>
          <div className="fifa-mode-art">
            {hero && <PlayerPortrait alias={hero.alias} playerId={hero.profileId} alt={hero.alias} loading="eager" />}
          </div>
          <div className="fifa-mode-copy">
            <span>NEXT MATCH</span>
            <h1>MATCHDAY</h1>
            <p>{last ? 'Последняя серия: ' + (last.won ? 'победа' : 'поражение') + ' против ' + last.opponent : 'Подготовь пятёрку, план игры и запускай BO3.'}</p>
          </div>
          <b className="fifa-mode-arrow">→</b>
        </button>

        <button className="fifa-mode-tile fifa-world-tile" onClick={() => onOpen('World')}>
          <div className="fifa-tile-kicker">GLOBAL CIRCUIT</div>
          <h2>WORLD MAP</h2>
          <div className="fifa-mini-map">
            <i className="pin p1" /><i className="pin p2" /><i className="pin p3" /><i className="pin p4" />
          </div>
          <p>Турниры, поездки и стоимость обслуживания по регионам.</p>
        </button>

        <button className="fifa-mode-tile fifa-squad-tile" onClick={() => onOpen('Roster')}>
          <div className="fifa-tile-kicker">CLUB</div>
          <h2>SQUAD</h2>
          <div className="fifa-mini-lineup">
            {starters.slice(0, 5).map((player) => (
              <span key={player.id}>
                <PlayerPortrait alias={player.alias} playerId={player.profileId} alt={player.alias} />
              </span>
            ))}
          </div>
          <p>Overview, stats, роли и drag & drop состава.</p>
        </button>

        <button className="fifa-mode-tile fifa-transfer-tile" onClick={() => onOpen('Scout')}>
          <div className="fifa-tile-kicker">MARKET</div>
          <h2>TRANSFERS</h2>
          <strong>{state.credits.toLocaleString('ru-RU')} <small>CLUB CASH</small></strong>
          <p>Скаутинг, shortlist и переговоры по контрактам.</p>
        </button>

        <button className="fifa-mode-tile fifa-packs-tile" onClick={() => onOpen('Packs')}>
          <div className="fifa-tile-kicker">COLLECTION</div>
          <h2>PACKS</h2>
          <strong>{state.packTokens.toLocaleString('ru-RU')} <small>PACK TOKENS</small></strong>
          <p>Паки, спин и коллекция игроков.</p>
        </button>

        <button className="fifa-mode-tile fifa-profile-tile" onClick={() => onOpen('Profile')}>
          <div className="fifa-tile-kicker">PROGRESSION</div>
          <h2>MANAGER</h2>
          <strong>LVL {level.level}</strong>
          <div className="fifa-profile-progress"><i style={{ width: level.percent + '%' }} /></div>
          <p>Уровень менеджера, сезонный прогресс и milestones.</p>
        </button>
      </div>

      <div className="fifa-home-hints">
        <span><b>ENTER</b> ВЫБРАТЬ</span>
        <span><b>ESC</b> НАЗАД</span>
        <span><b>← →</b> НАВИГАЦИЯ</span>
      </div>
    </section>
  )
}
