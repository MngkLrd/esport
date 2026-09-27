# ESPORT AI Manager

A small single-player esports management prototype with a deterministic simulation core and a local narrative/decision-support layer.

## v0.3 P0 playable core

The current P0 slice is end-to-end: a new save opens with a deterministic five-card welcome pack, turns those cards into the first roster, persists the save locally, runs a seeded BO3 match, records the weekly economy, and closes a season with a summary before the next season can start.

The implementation keeps card identity, roster state, and command boundaries in one versioned save model. The browser UI is a view over that model; it does not create a second source of truth for the welcome flow or match results.

### v0.2 playable core

The previous build exposed many management concepts but several of them were mostly labels. v0.2 makes the core loop consequential:

- 6-player initial roster with an explicit **starting five and bench**
- lineup changes affect **continuity and chemistry**
- missing IGL/AWP roles create real simulation penalties
- starter **fatigue, morale, form and contracts** affect team strength
- three pre-match tactical plans: Balanced, Aggressive and Structured
- seeded **best-of-three** simulation with map-to-map momentum and per-map win chance
- per-series player performance ratings and MVP
- **weekly payroll** is charged after every match
- signings add recurring salary, not only a one-off fee
- expired contracts block a player from starting until renewed
- players can be benched, renewed, trained, rested and released
- scouting draws from a large real-player alias/team snapshot, while gameplay ratings, wages and development remain simulation data
- Online Cup has a real progression gate
- Inbox records match, finance, lineup, scouting and contract events
- AI Director is currently a **rule-based live advisor** over canonical state; it does not pretend an LLM is connected
- versioned browser save with migration from the v0.1 save
- collectible player packs bound to the club save, with deterministic per-save rolls, animated reel + cinematic reveal, duplicate tracking, filters and collection history
- card snapshots for the full 1,634-player pool, preferring direct HLTV PlayerScreen skill scores and falling back to HLTV-derived match aggregates
- in-app Credits page documenting GitHub references, source datasets and license boundaries

The architecture rule remains:

**simulation decides facts; generative systems may interpret facts.**

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Current boundaries

This is still a browser-only prototype. It does **not** yet have accounts, server persistence, a real LLM gateway, tournament brackets, negotiations, injuries, opponent organizations with memory, or multiplayer.

Those are follow-up systems, not features claimed by the current build.

The card-data pipeline is intentionally period-aware (`past3m`, `last12m`, `calendar-year`) so yearly editions can be added later without changing the pack/save model.

## Deployment

The Vite base path is configured for this repository at `/esport/`. CI builds every branch and PR. The Pages workflow deploys `main`.

## Fan-project and source boundary

This is a personal, non-commercial fan manager. It now uses public real-player aliases, team snapshot data and remotely loaded player photographs where a verified mapping exists. Gameplay ratings, wages, potential and match outcomes are our own simulation values. Collectible-card attributes are a separate data layer: direct HLTV PlayerScreen skill scores are preferred, then HLTV-derived last-12-month / latest-year aggregates are used when current skill scores are unavailable. Players without usable verified statistics retain the older VRS/rating fallback rather than receiving fabricated HLTV numbers.

Public GitHub repositories are not treated as automatically reusable. The pack animation is our own React/TypeScript implementation informed by public case-opening references; repositories without a compatible license are credited as references rather than copied. See the in-app **Credits** page for authors, source links and license notes.

Player photographs are not committed into this repository; the app currently loads matched portraits remotely and falls back to generated text cards when an image is unavailable.
## v0.4 visual architecture

The P0 loop is now presented through a team-first club desk instead of a dashboard of equal-weight cards. HQ keeps the starting five, next tactical decision, club pulse and season news in one editorial frame. Match is a tactical desk, Roster is a team sheet, Scout is a report workspace and Inbox is a newsroom. The design rules are documented in `DESIGN.md`; the grayscale HQ alternatives and selection rationale are in `docs/HQ_GRAYSCALE_CONCEPTS.md`.

The browser pass targets 1366×768 and 1920×1080. Management screens use restrained dark surfaces and dividers; collectible colour and motion remain in Packs and Collection.
