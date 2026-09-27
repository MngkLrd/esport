# Changelog

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
