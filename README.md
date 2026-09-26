# ESPORT AI Manager

Playable AI-first single-player esports management MVP.

The product takes the useful management principles from browser team-manager games — readable player cards, short match loops, progression, contracts, scouting and risk/reward modes — and rebuilds them around a strict architecture rule:

**simulation decides facts; AI interprets facts.**

## v0.1 is playable

- 5-player fictional starting roster with roles, skills, potential, form, morale and fatigue
- deterministic team rating and chemistry
- Practice Mix, Community Showmatch and Online Cup
- seeded best-of-three match simulation
- credits, fans, reputation, season points and streaks
- training and rest staff actions
- contracts and renewals
- deterministic scouting with fictional prospects
- signings and a 7-player roster cap
- procedural season headlines and club inbox
- local browser save
- AI Director architecture/debug screen
- responsive desktop/mobile UI

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

## Architecture

The deterministic core owns all consequential state transitions:

```text
state + action + seed -> nextState
```

The narrative layer only turns canonical events into presentation. v0.1 uses local procedural generation so it works without an API key. A future LLM gateway can generate press conferences, negotiations, rivalries, scouting prose and media stories, but it must not decide winners, rewards, ratings or RNG.

See [docs/MVP.md](docs/MVP.md) for the product specification and v0.2 backlog.

## Deployment

The Vite base path is configured for this repository at `/esport/`. CI builds every branch and PR. A Pages workflow is included for `main`; GitHub Pages must use **GitHub Actions** as its deployment source.

## IP boundary

This is an original fictional esports universe. It does not use Counter-Strike/Valve branding, real teams, real players, logos, skins, tournament marks or scraped private data. Scouting is used instead of gambling-like paid pack opening.
