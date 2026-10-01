import { financeAccountTotals, financeSeriesByWeek, financeSummary } from './finance'
import { weeklyPayroll, type GameState } from './game'
import './FinanceView.css'

const format = new Intl.NumberFormat('ru-RU')

const accountLabel = {
  operating: 'OPERATING',
  salary: 'SALARY',
  transfer: 'TRANSFERS',
  sponsor: 'SPONSORS',
  prize: 'PRIZE MONEY',
} as const

const money = (value: number) =>
  (value > 0 ? '+' : value < 0 ? '−' : '') + format.format(Math.abs(Math.round(value)))

function CashflowChart({ state }: { state: GameState }) {
  const series = financeSeriesByWeek(state.finance, state.week, 12)
  const width = 720
  const height = 210
  const padX = 34
  const padY = 28
  const values = series.map((point) => point.cash)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = Math.max(1, max - min)
  const x = (index: number) =>
    padX + index * ((width - padX * 2) / Math.max(1, series.length - 1))
  const y = (value: number) =>
    height - padY - ((value - min) / span) * (height - padY * 2)
  const line = series.map((point, index) => x(index) + ',' + y(point.cash)).join(' ')

  return (
    <div className="finance-chart">
      <div className="finance-chart-head">
        <div><span>CASHFLOW</span><strong>Динамика денежных средств</strong></div>
        <small>последние {series.length} нед.</small>
      </div>
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="График денежного баланса">
        {[0, .25, .5, .75, 1].map((tick) => {
          const value = min + span * tick
          const yy = y(value)
          return <g key={tick}><line x1={padX} x2={width - padX} y1={yy} y2={yy} /><text x={4} y={yy + 4}>{Math.round(value)}</text></g>
        })}
        <polyline points={line} />
        {series.map((point, index) => (
          <g key={point.week}>
            <circle cx={x(index)} cy={y(point.cash)} r="3.2" />
            <text className="finance-week-label" x={x(index)} y={height - 5} textAnchor="middle">W{point.week}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function WeeklyFlow({ state }: { state: GameState }) {
  const series = financeSeriesByWeek(state.finance, state.week, 8)
  const max = Math.max(1, ...series.flatMap((point) => [point.income, point.expenses]))
  return (
    <div className="finance-weekly">
      <div className="finance-chart-head">
        <div><span>WEEKLY FLOW</span><strong>Доходы и расходы</strong></div>
      </div>
      <div className="finance-weekly-bars">
        {series.map((point) => (
          <div key={point.week} className="finance-week-bar">
            <div className="finance-week-columns">
              <i className="income" style={{ height: Math.max(2, point.income / max * 100) + '%' }} />
              <i className="expense" style={{ height: Math.max(2, point.expenses / max * 100) + '%' }} />
            </div>
            <span>W{point.week}</span>
          </div>
        ))}
      </div>
      <div className="finance-legend"><span><i className="income" />Доход</span><span><i className="expense" />Расход</span></div>
    </div>
  )
}

export function FinanceView({ state }: { state: GameState }) {
  const summary = financeSummary(state.finance)
  const accounts = financeAccountTotals(state.finance)
  const maxAccount = Math.max(1, ...accounts.map((item) => Math.abs(item.value)))
  const recent = state.finance.ledger.slice(0, 18)
  const payroll = weeklyPayroll(state)

  return (
    <section className="sim-screen finance-screen">
      <div className="sim-screen-head finance-head">
        <div>
          <span>CLUB FINANCE · LEDGER</span>
          <h1>FINANCES</h1>
        </div>
        <div className="finance-head-meta">
          <span>WEEKLY PAYROLL</span>
          <strong>{format.format(payroll)} кр.</strong>
        </div>
      </div>

      <div className="finance-kpis">
        <article><span>CASH</span><strong>{format.format(summary.cash)}</strong><small>текущий остаток</small></article>
        <article><span>INCOME</span><strong className="positive">{money(summary.income)}</strong><small>все поступления</small></article>
        <article><span>EXPENSES</span><strong className="negative">{money(-summary.expenses)}</strong><small>все расходы</small></article>
        <article><span>NET</span><strong className={summary.net >= 0 ? 'positive' : 'negative'}>{money(summary.net)}</strong><small>чистый денежный поток</small></article>
        <article><span>SPONSORS</span><strong>{money(summary.sponsor)}</strong><small>спонсорские поступления</small></article>
        <article><span>PRIZE MONEY</span><strong>{money(summary.prize)}</strong><small>турнирные призовые</small></article>
      </div>

      <div className="finance-dashboard">
        <CashflowChart state={state} />
        <WeeklyFlow state={state} />

        <div className="finance-accounts">
          <div className="finance-chart-head">
            <div><span>ACCOUNTS</span><strong>Структура денег клуба</strong></div>
          </div>
          <div className="finance-account-list">
            {accounts.map((item) => (
              <div key={item.account}>
                <span>{accountLabel[item.account]}</span>
                <i><em className={item.value >= 0 ? 'positive' : 'negative'} style={{ width: Math.max(3, Math.abs(item.value) / maxAccount * 100) + '%' }} /></i>
                <b className={item.value >= 0 ? 'positive' : 'negative'}>{money(item.value)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="finance-ledger">
          <div className="finance-chart-head">
            <div><span>GENERAL LEDGER</span><strong>Последние операции</strong></div>
            <small>{state.finance.ledger.length} entries</small>
          </div>
          <div className="finance-ledger-head"><span>WEEK</span><span>ACCOUNT</span><span>DESCRIPTION</span><span>AMOUNT</span></div>
          <div className="finance-ledger-scroll">
            {recent.length === 0 && <div className="finance-empty">Операций пока нет.</div>}
            {recent.map((entry) => (
              <div className="finance-ledger-row" key={entry.id}>
                <span>W{entry.week}</span>
                <b>{accountLabel[entry.account]}</b>
                <div><strong>{entry.title}</strong><small>{entry.description}</small></div>
                <em className={entry.amount >= 0 ? 'positive' : 'negative'}>{money(entry.amount)}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
