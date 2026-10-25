# BRAVIA HOME v2.2 | Performance/debloat QA (2026-10-25)

**Real TV status: NOT TESTED.** This is an offline launcher and read-only service-classification audit. No original Sony firmware has been unpacked, modified or flashed; no vendor tracker or background service has been verified, disabled or removed.

## Automated results (local)

- **81/81** JavaScript navigation and native-system-handoff state tests (including preserved Sony system keys).
- **103/103** Python/Chromium tests: read-only firmware inspector, safe service audit and HOME browser UI.
- **184/184 PASS** total, including 20 new service classification policy tests and 5 light-theme browser tests.
- Browser geometry tested on 720p, 1080p, 4K, 1366×768, and 1024×768. Lite screenshot references at 720p and 1080p produced locally; no measured overlap.
- Four HOME files (HTML/CSS/JS/catalog) approx **23.2 KiB uncompressed**, not runtime RSS. No external scripts, webfonts or HOME analytics.

## Changes

- Enable performance-lite on HOME by default, keeping matte branding and strong D-pad focus.
- Remove CSS blur, scaled focus transition, decorative pseudo-glow layers from the lite path.
- Native picture/volume/settings/Guide/Options/inputs/remote keys, tuner, analog/digital switching, DRM, keyboard and recovery remain protected in the proposed integration architecture.
- New read-only audit_bloat.py classifies service inventory as KEEP, KEEP_PENDING_EVIDENCE, DEPENDENCY_REVIEW, HIDE_UI_FIRST or REVIEW_DISABLE. It **never creates deletion/flash instructions**.

## Blocked / unproven

- Native Sony HOME hook, physical remote events, system settings panel handoff, actual RAM/CPU consumption, process map, tracking domains and stock boot latency.
- TV firmware format/signatures/flash backup and rollback.
- Any actual streaming service playback.

P0 rule: do not disable or erase firmware components without a verified inventory, dependency graph, full recovery and on-hardware regression evidence.
