export type FinanceAccount = 'operating' | 'salary' | 'transfer' | 'sponsor' | 'prize'
export type FinanceDirection = 'income' | 'expense'

export interface FinanceLedgerEntry {
  id: string
  at: string
  week: number
  amount: number
  account: FinanceAccount
  direction: FinanceDirection
  title: string
  description: string
  sourceType: 'match' | 'tournament' | 'transfer' | 'contract' | 'scouting' | 'training' | 'sponsor' | 'payroll' | 'system'
  sourceId?: string | null
  eventId?: string | null
}

export interface FinanceState {
  version: 1
  openingCash: number
  cash: number
  ledger: FinanceLedgerEntry[]
}

export interface FinanceSummary {
  cash: number
  income: number
  expenses: number
  operating: number
  salary: number
  transfer: number
  sponsor: number
  prize: number
  net: number
}

export interface FinancePoint {
  week: number
  cash: number
  income: number
  expenses: number
}

export const createFinanceState = (openingCash: number): FinanceState => ({
  version: 1,
  openingCash: Math.max(0, Math.round(openingCash)),
  cash: Math.max(0, Math.round(openingCash)),
  ledger: [],
})

export const normalizeFinanceState = (
  raw: unknown,
  fallbackCash: number,
): FinanceState => {
  if (!raw || typeof raw !== 'object') return createFinanceState(fallbackCash)
  const source = raw as Partial<FinanceState>
  const ledger = Array.isArray(source.ledger)
    ? source.ledger.filter((entry): entry is FinanceLedgerEntry =>
        Boolean(
          entry &&
          typeof entry === 'object' &&
          typeof (entry as FinanceLedgerEntry).id === 'string' &&
          typeof (entry as FinanceLedgerEntry).amount === 'number',
        ),
      ).slice(0, 600)
    : []
  const openingCash = typeof source.openingCash === 'number'
    ? Math.max(0, Math.round(source.openingCash))
    : Math.max(0, Math.round(fallbackCash - ledger.reduce((sum, entry) => sum + entry.amount, 0)))
  const derivedCash = openingCash + ledger.reduce((sum, entry) => sum + entry.amount, 0)
  const cash = typeof source.cash === 'number'
    ? Math.max(0, Math.round(source.cash))
    : Math.max(0, Math.round(derivedCash))
  return {
    version: 1,
    openingCash,
    cash,
    ledger,
  }
}

export const postFinanceEntry = (
  source: FinanceState,
  entry: FinanceLedgerEntry,
): FinanceState => {
  const normalizedAmount = Math.round(entry.amount)
  const nextEntry = {
    ...entry,
    amount: normalizedAmount,
    direction: normalizedAmount >= 0 ? 'income' as const : 'expense' as const,
  }
  const alreadyExists = source.ledger.some((candidate) => candidate.id === nextEntry.id)
  if (alreadyExists) return source
  return {
    ...source,
    cash: Math.max(0, source.cash + normalizedAmount),
    ledger: [nextEntry, ...source.ledger].slice(0, 600),
  }
}

export const financeSummary = (state: FinanceState): FinanceSummary => {
  const byAccount = (account: FinanceAccount) =>
    state.ledger
      .filter((entry) => entry.account === account)
      .reduce((sum, entry) => sum + entry.amount, 0)
  const income = state.ledger.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)
  const expenses = Math.abs(state.ledger.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0))
  return {
    cash: state.cash,
    income,
    expenses,
    operating: byAccount('operating'),
    salary: byAccount('salary'),
    transfer: byAccount('transfer'),
    sponsor: byAccount('sponsor'),
    prize: byAccount('prize'),
    net: income - expenses,
  }
}

export const financeSeriesByWeek = (
  state: FinanceState,
  currentWeek: number,
  maxWeeks = 12,
): FinancePoint[] => {
  const firstWeek = Math.max(1, currentWeek - maxWeeks + 1)
  const points: FinancePoint[] = []
  let cash = state.openingCash

  const chronological = [...state.ledger].sort((a, b) =>
    a.week - b.week || a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  )
  for (let week = 1; week <= currentWeek; week += 1) {
    const entries = chronological.filter((entry) => entry.week === week)
    const income = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)
    const expenses = Math.abs(entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0))
    cash += income - expenses
    if (week >= firstWeek) points.push({ week, cash: Math.max(0, cash), income, expenses })
  }

  if (!points.length) points.push({ week: Math.max(1, currentWeek), cash: state.cash, income: 0, expenses: 0 })
  if (points.length) points[points.length - 1] = { ...points[points.length - 1], cash: state.cash }
  return points
}

export const financeAccountTotals = (state: FinanceState) =>
  (['operating', 'salary', 'transfer', 'sponsor', 'prize'] as FinanceAccount[]).map((account) => ({
    account,
    value: state.ledger
      .filter((entry) => entry.account === account)
      .reduce((sum, entry) => sum + entry.amount, 0),
  }))
