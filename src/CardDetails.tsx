import { hltvSnapshotForAlias } from './cardStats'
import { PlayerPortrait } from './PlayerPortrait'
import { countryFlag } from './playerVisuals'
import type { PackCard } from './packState'
import type { Player } from './game'

const ROLE_LABELS: Record<NonNullable<PackCard['role']>, string> = {
  IGL: 'IGL',
  Entry: 'Энтри',
  Rifler: 'Рифлер',
  AWP: 'AWP',
  Support: 'Саппорт',
}

const formatStat = (value: number | null, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)

export function CardDetails({
  card,
  onClose,
  playerState,
}: {
  card: PackCard
  onClose: () => void
  playerState?: Player
}) {
  const snapshot = hltvSnapshotForAlias(card.alias)
  const raw = snapshot?.raw
  const period = card.cardStats
    ? card.cardStats.periodStart + ' — ' + card.cardStats.periodEnd
    : card.edition

  return (
    <div className="card-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={'card-detail-modal rarity-' + card.rarity}
        role="dialog"
        aria-modal="true"
        aria-label={'Карточка ' + card.alias}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="card-detail-close" onClick={onClose} aria-label="Закрыть">×</button>

        <div className="card-detail-hero">
          <div className="card-detail-rating">
            <strong>{card.power}</strong>
            <span>{card.role ? ROLE_LABELS[card.role] : 'PRO'}</span>
          </div>
          <div className="card-detail-edition">{card.edition}</div>
          <div className="card-detail-portrait">
            <span>{card.alias.slice(0, 3).toUpperCase()}</span>
            <PlayerPortrait
              alias={card.alias}
              playerId={card.profileId}
              alt={card.alias}
              loading="eager"
            />
          </div>
          <div className="card-detail-name">
            <h2>{card.alias}</h2>
            <p>{card.realName ?? 'Имя не указано'}</p>
          </div>
        </div>

        <div className="card-detail-content">
          <div className="card-detail-kicker">ПРОФИЛЬ ИГРОКА</div>
          <h3>{countryFlag(card.country ?? '')} {card.team}</h3>
          <div className="card-detail-facts">
            <span><b>Роль</b>{card.role ? ROLE_LABELS[card.role] : '—'}</span>
            <span><b>Возраст</b>{card.age ?? '—'}</span>
            <span><b>Период карты</b>{period}</span>
            <span><b>Редкость</b>{card.rarity.toUpperCase()}</span>
          </div>

          {playerState && (
            <>
              <div className="card-detail-section-title">Текущее состояние в клубе</div>
              <div className="card-detail-scores card-detail-management">
                <span><b>{playerState.form}</b>Форма</span>
                <span><b>{playerState.morale}</b>Мораль</span>
                <span><b>{playerState.fatigue}</b>Усталость</span>
                <span><b>{playerState.contractWeeks}</b>Нед. контракта</span>
                <span><b>{playerState.salary}</b>Кр./нед.</span>
                <span><b>{playerState.potential}</b>Потенциал</span>
              </div>
            </>
          )}

          {card.cardStats ? (
            <>
              <div className="card-detail-section-title">Ключевые показатели</div>
              <div className="card-detail-scores">
                <span><b>{card.cardStats.aim}</b>АИМ</span>
                <span><b>{card.cardStats.utility}</b>УТИЛИТИ</span>
                <span><b>{card.cardStats.positioning}</b>ПОЗИЦИЯ</span>
                <span><b>{card.cardStats.clutch}</b>КЛАТЧ</span>
              </div>

              <div className="card-detail-section-title">Подробная статистика</div>
              <div className="card-detail-raw">
                <span><b>{formatStat(raw?.rating ?? card.cardStats.rating, 2)}</b>Рейтинг</span>
                <span><b>{formatStat(raw?.adr ?? null, 1)}</b>ADR</span>
                <span><b>{formatStat(raw?.kast ?? null, 1)}{raw?.kast != null ? '%' : ''}</b>KAST</span>
                <span><b>{raw?.maps ?? card.cardStats.maps ?? '—'}</b>Карт</span>
                <span><b>{formatStat(raw?.killsPerMap ?? null, 1)}</b>Убийств / карта</span>
                <span><b>{formatStat(raw?.deathsPerMap ?? null, 1)}</b>Смертей / карта</span>
                <span><b>{formatStat(raw?.roundSwing ?? null, 2)}{raw?.roundSwing != null ? '%' : ''}</b>Round swing</span>
                <span><b>{card.power}</b>OVR карты</span>
              </div>
            </>
          ) : (
            <div className="card-detail-empty">
              Для этой карты нет полного набора матчевых показателей. Игровой OVR сохранён, но подробные поля не дорисовываются вымышленными числами.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
