# ESPORT AI Manager

A small single-player esports management prototype with a deterministic simulation core and a local narrative/decision-support layer.

## v0.2 playable core

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
- collectible player packs with a deterministic pre-selected result, animated reveal reel and local card collection
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

## Deployment

The Vite base path is configured for this repository at `/esport/`. CI builds every branch and PR. The Pages workflow deploys `main`.

## Fan-project and source boundary

This is a personal, non-commercial fan manager. It now uses public real-player aliases, team snapshot data and remotely loaded player photographs where a verified mapping exists. Gameplay ratings, pack power, wages, potential and match outcomes are our own simulation values.

Public GitHub repositories are not treated as automatically reusable. The pack animation is our own React/TypeScript implementation informed by public case-opening references; repositories without a compatible license are credited as references rather than copied. See the in-app **Credits** page for authors, source links and license notes.

Player photographs are not committed into this repository; the app currently loads matched portraits remotely and falls back to generated text cards when an image is unavailable.
