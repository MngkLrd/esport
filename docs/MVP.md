# ESPORT AI Manager v0.2

## Product thesis

The playable loop should create management pressure, not just display management-themed UI.

The current core is deliberately small:

`lineup -> prepare -> choose tactic/mode -> play BO3 -> settle payroll -> react to fatigue/contracts -> recruit/renew -> repeat`

The deterministic simulation owns all consequential state. Narrative and advisory systems only interpret canonical facts.

## What is actually implemented

### Roster and lineup

- six-player initial roster;
- explicit five-player starting lineup;
- bench management;
- role coverage penalties for missing IGL/AWP;
- lineup continuity that drops on changes and recovers through matches;
- chemistry from roles, morale, leadership, continuity and fatigue;
- training, rest, renewals and releases;
- expired contracts cannot start.

### Match simulation

Each match is a seeded BO3. The engine uses:

- active-five rating;
- chemistry and continuity;
- form, morale and fatigue;
- role coverage;
- selected tactical plan;
- opponent strength;
- map-to-map momentum;
- deterministic RNG.

The result stores map scores, estimated map win chances, top performer, player performance ratings, MVP and a procedural recap.

### Economy

Every match advances one week.

The club receives match income and pays the entire roster payroll. Signing depth therefore creates a recurring cost. Contract extensions have an up-front cost. Scouting, training and releases also consume credits.

The economy is intentionally simple, but it now has an actual cashflow loop instead of a credits counter that only increases.

### Scouting

A scouting action spends credits and generates three deterministic fictional prospects based on reputation and seed. Prospects have roles, ratings, potential, salary and a signing fee. New signings join the bench.

### Progression

Practice Mix, Community Showmatch and Online Cup have different opponent difficulty and reward profiles. Online Cup unlocks after two wins or 45 reputation.

### Inbox and local director

The Inbox records match, finance, lineup, scouting and contract events.

The AI Director screen is currently a rule-based live advisor. It reads the actual save and flags:

- incomplete lineups;
- expiring contracts;
- starter fatigue;
- short cash runway;
- missing IGL/AWP coverage.

There is **no external LLM connected in v0.2**.

## Persistence

The current save is stored in browser localStorage under `esport-ai-manager-v2`.

A v0.1 save is migrated into the new state shape. Legacy match history is intentionally reset during migration because v0.2 match records contain additional fields that did not exist in v0.1.

## Still missing

The following are not part of the current implementation:

- backend/account persistence;
- real LLM gateway and schema validation;
- contract negotiation state machine;
- tournament brackets and calendar events;
- opponent organizations with persistent rosters and rivalries;
- injuries/tilt/recovery events;
- save export/import;
- deterministic replay test suite;
- richer map-specific team strengths and veto phase;
- longer-term player development curves.

## Next engineering priorities

1. Add unit tests around deterministic state transitions and economy invariants.
2. Add map veto plus map-specific strengths so BO3 preparation has another real decision.
3. Add a 12-week calendar with objectives and a season-end state.
4. Add contract negotiation with player demands and walk-away outcomes.
5. Add opponent organizations that persist between meetings.
6. Add export/import and then move canonical saves to a server or SQLite-backed build.
7. Only then add an LLM gateway for presentation, with schema validation, caching, prompt versioning and a deterministic fallback.

## IP boundary

All players, teams, maps and organizations are fictional. The prototype contains no Valve assets, real player likenesses, skins or copied tournament branding.
