# Changelog

## 2026-09-28 · FIFA-style game shell pass

- Replaced the dashboard-first shell with a full-screen sports-game mode-select interface.
- Added HOME mode tiles, title/loading transitions and a FIFA-like persistent status/navigation bar.
- Added WORLD MAP with tournament pins, regions, prize pools, travel/service costs and event-week upkeep preview.
- Split economy into Club Cash for transfers/contracts/operations and Pack Tokens for packs; saves migrate to v9.
- Added manager XP/level progression and a dedicated progression screen.
- Reworked squad management with an Overview & Stats side panel while retaining card drag/drop.
- Rebuilt pack purchase flow around a centered modal: buy pack -> choose x1/x3/x5/x10 -> press SPIN to pay -> reel -> card reveal.
- Removed the always-visible pack reel from the store surface.
- Added regression tests for v8->v9 migration and pack-token-only spending.

## 2026-09-28 · Card identity and welcome reveal fix

- Added a verified HLTV identity/bodyshot fallback layer for players missing from the legacy metadata and portrait manifests.
- Rehydrates saved pack cards and roster players from the current identity layer without requiring a save reset.
- Fixed the vicu control case with verified HLTV profile data: Wiktoria Janicka, Poland, age 23, profile id 22062 and current bodyshot.
- Rebuilt welcome-pack cards as full 5:7 player cards with portrait, flag, OVR, role and AIM/UTL/POS/CLU.
- Added regression tests for identity enrichment, portrait resolution and stale-card hydration.

## 2026-09-27 · Scouting / Market 2.0

- Replaced the random three-row scouting result with a five-card shortlist built from a role, age-profile and salary brief.
- Added persistent scouting briefs and upgraded save state to v8 with migration from v7 and older careers.
- Added player fit ranking so shortlist order reflects the requested squad role and budget.
- Added transfer negotiations with fee, weekly salary, contract length and starter/rotation role promise.
- Added a deterministic interest model with visible feedback before a deal is accepted.
- Starter promises now move the signed player directly into the best-fit lineup slot while preserving a five-player starting lineup.
- CI now runs the management regression suite together with card pipeline tests.

## 2026-09-27 · P0 end-to-end

- Added a deterministic five-card welcome pack for new saves with role coverage for IGL, AWP, Entry, Support and Rifler.
- Connected welcome cards to the first roster, starting five, collection inventory and persisted browser save.
- Added version 7 state migration, a browser save repository and explicit commands for welcome, pack, match and season transitions.
- Added season boundaries, season summary metrics and next-season reset rules while keeping roster, contracts and collection continuity.
- Added player identity keys and acquired card IDs so cards, roster players and duplicates remain linked across migrations.
- Added player portraits with fallbacks, card details, current club-state details and an accessible profile modal.
- Added regression coverage for welcome flow, deterministic matches, season closure and legacy migration.

## Deferred after P0

- Deeper scouting workflows, negotiations, tournament brackets, injuries, multiplayer and server persistence remain follow-up work.
## 2026-09-27 · UI architecture redesign

- Rebuilt the management surfaces around a team-first HQ, tactical match desk, roster team sheet, scouting desk and club newsroom.
- Replaced dashboard/KPI and duplicated roster-card patterns with editorial columns, dividers and real state rows.
- Added the grayscale HQ architecture study and documented the product design grammar in `DESIGN.md`.
- Added responsive compression for 1366×768 so the primary action remains visible above the fold.
- Kept collectible card treatment inside Packs/Collection while separating it from management screens.
