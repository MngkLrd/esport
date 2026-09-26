# ESPORT AI Manager v0.1

## Product thesis

The MVP keeps the strongest transferable management-game principles from the reference product without copying its visual identity, data, assets or IP:

- short loop: inspect roster -> choose risk -> simulate -> receive rewards/story -> improve roster;
- readable player cards and team OVR;
- multiple match modes with different risk/reward;
- persistent economy and progression;
- contracts and roster pressure;
- scouting as discovery;
- a feed that turns simulation facts into a season narrative.

The major change is AI-first architecture. Generative systems are an interpretation layer, not the authority for match outcomes or economy.

## Playable loop

1. Start with five fictional players and 2,200 credits.
2. Spend two staff actions between matches on training/rest.
3. Pick Practice Mix, Community Showmatch or Online Cup.
4. The seeded engine resolves a best-of-three series.
5. Credits, fans, reputation, form, morale, fatigue and contracts update.
6. The narrative director writes a recap from structured facts.
7. Scout generated prospects, sign depth and renew contracts.
8. Repeat and build season points.

A first session should expose all core systems in 15-25 minutes and support a 2-3 hour sandbox without requiring an account or API key.

## Deterministic core

The deterministic layer owns:

- player attributes and OVR;
- active-five selection;
- chemistry;
- opponent rating;
- match probability;
- map scores;
- rewards;
- fan/reputation progression;
- training/rest effects;
- fatigue, morale and form;
- contracts;
- scouting ratings and costs.

The transition model is conceptually:

`state + action + seed -> nextState`

This makes saves debuggable and allows future simulation tests.

## Generative layer

v0.1 ships with a local procedural narrative director so the game works offline. A future LLM gateway should receive only structured canonical facts and return schema-validated presentation content such as:

- press conference answers;
- player personality dialogue;
- rivalry and media framing;
- scouting prose;
- negotiation dialogue;
- weekly story summaries.

The LLM must never choose winners, rewards, RNG results, ratings or transaction outcomes.

## Current screens

- **HQ**: club health, latest result, season story and key KPIs.
- **Play**: three risk/reward match formats.
- **Roster**: player cards, form/morale/fatigue, training, rest and renewals.
- **Scout**: seeded fictional prospects and signings.
- **Inbox**: chronological club memory.
- **AI Director**: architecture/debug view showing deterministic vs narrative responsibilities.

## Persistence

The MVP stores a versioned save in browser localStorage under `esport-ai-manager-v1`. No authentication or backend is required.

For the next phase, move canonical saves to SQLite in a desktop/local-server build while keeping the reducer-style simulation API.

## IP boundary

This prototype intentionally uses a fictional esports universe. It contains no Counter-Strike branding, Valve assets, real players, real teams, logos, skins or tournament marks. Scouting replaces gambling-like paid pack opening.

## v0.2 priorities

1. Explicit starting-five / bench management and role conflicts.
2. Player relationships and pairwise chemistry graph.
3. Calendar with tournaments and season objectives.
4. Contract negotiation state machine with agents.
5. Injuries, tilt and recovery with transparent deterministic rules.
6. LLM gateway with JSON schema, caching, fallback and prompt/version logging.
7. Save export/import and deterministic replay tests.
8. SQLite persistence for desktop/local builds.
9. Tactical choices before maps that modify simulation parameters.
10. Procedural opponent organizations with memory and rivalries.
