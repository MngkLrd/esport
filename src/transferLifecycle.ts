export type TransferStatus =
  | 'listed'
  | 'interest'
  | 'offer'
  | 'negotiation'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled'

export interface TransferTermsSnapshot {
  fee: number
  salary: number
  contractWeeks: number
  squadRole: 'starter' | 'rotation'
}

export interface TransferTransition {
  status: TransferStatus
  at: string
  note: string
}

export interface TransferCase {
  id: string
  playerId: string
  playerKey?: string | null
  alias: string
  sourceTeamId?: string | null
  destinationTeamId: string
  status: TransferStatus
  openedAt: string
  updatedAt: string
  terms?: TransferTermsSnapshot | null
  transitions: TransferTransition[]
}

export const createTransferCase = (input: {
  id: string
  playerId: string
  playerKey?: string | null
  alias: string
  sourceTeamId?: string | null
  destinationTeamId: string
  at: string
}): TransferCase => ({
  id: input.id,
  playerId: input.playerId,
  playerKey: input.playerKey ?? null,
  alias: input.alias,
  sourceTeamId: input.sourceTeamId ?? null,
  destinationTeamId: input.destinationTeamId,
  status: 'listed',
  openedAt: input.at,
  updatedAt: input.at,
  terms: null,
  transitions: [{
    status: 'listed',
    at: input.at,
    note: 'Кандидат добавлен в трансферный процесс.',
  }],
})

export const transitionTransferCase = (
  source: TransferCase,
  status: TransferStatus,
  at: string,
  note: string,
  terms?: TransferTermsSnapshot | null,
): TransferCase => ({
  ...source,
  status,
  updatedAt: at,
  terms: terms === undefined ? source.terms : terms,
  transitions: [...source.transitions, { status, at, note }].slice(-24),
})

export const normalizeTransferCases = (raw: unknown): TransferCase[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is TransferCase =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof (entry as TransferCase).id === 'string' &&
        typeof (entry as TransferCase).playerId === 'string' &&
        typeof (entry as TransferCase).status === 'string',
      ),
    )
    .slice(0, 120)
}

export const activeTransferCaseForPlayer = (
  cases: TransferCase[],
  playerId: string,
) => cases.find((candidate) =>
  candidate.playerId === playerId &&
  !['completed', 'cancelled'].includes(candidate.status),
) ?? null
