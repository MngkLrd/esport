# Runtime architecture

The project is still a browser game, but gameplay no longer depends on React component state alone.

## Layers

### Presentation
React components under `src/*.tsx`.

They render state and dispatch gameplay commands. They should not invent tournament results, dates, opponents, or match outcomes.

### Career clock
`src/calendar.ts`

A deterministic, timezone-independent game clock. Stored values intentionally have no real-world timezone semantics. Week boundaries, payroll, contract decay, tournament registration and match schedules derive from this clock.

### Career state
`src/game.ts`

The persisted aggregate. Current schema version: **10**.

Important career fields:
- `seasonStart`
- `now`
- `activeTournament`
- `tournamentHistory`
- squad/economy/progression state

Matches no longer advance a whole week. Calendar progression does.

### Tournament engine
`src/tournamentEngine.ts`

Pure deterministic tournament state machine:
- single elimination
- round-robin groups → single elimination
- round-robin groups → double elimination
- AI match simulation
- group standings
- bracket source resolution
- placement and prize resolution

A tournament is a run containing teams and scheduled matches. A BO3 updates one bracket match; it does not end the event automatically.

### Commands
`src/gameCommands.ts`

Boundary for larger career actions. Current high-level commands include:
- event booking
- time advance
- advance to next tournament match
- match play
- weekly decision resolution
- packs / season transitions

### Tactical simulation
`src/matchSimulation.ts`

Produces deterministic frame data for the tactical CS2 radar.

`src/simulation.worker.ts` performs heavy playback generation away from the main UI thread.

`src/MatchRadar.tsx` is the Canvas renderer only.

### Saves
`src/saveRepository.ts`

Versioned browser persistence with:
- schema migration
- legacy v2/v1 loading
- automatic backup snapshot
- collection hydration

The architecture deliberately keeps persistence behind a repository so IndexedDB or desktop filesystem storage can replace localStorage later without changing the game core.

## Core invariants

1. UI never picks a tournament opponent. The bracket does.
2. Online tournaments have zero entry/travel/service cost.
3. Time cannot advance past a mandatory club match.
4. Weekly payroll and contract duration are driven by career time, not match count.
5. A tournament remains active across all group/playoff matches until elimination or championship.
6. AI bracket results are deterministic for a save/run.
7. Match visualization cannot change the already calculated competitive result.
8. Saved v9 active events migrate into a full v10 tournament run.
9. Internal game dates are timezone-independent.
10. Heavy tactical playback generation must not block the React render thread.

## Near-term extension points

For the playable beta, new systems should attach to the career clock rather than create independent timers:
- sponsors
- player development
- transfer windows
- injuries
- staff
- invitations
- ranking updates
- travel days

The next performance step, only if required, is moving more season/AI batch simulation into workers. A move to a different rendering engine is not required for the current 2D management-game scope.
