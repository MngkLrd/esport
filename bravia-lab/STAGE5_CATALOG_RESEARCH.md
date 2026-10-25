# KD-55XG7096 Stage 5 — service-list and BIVL catalog audit

**2026-10-25. Original user-supplied Sony v8.931-1000 analyzed offline. Nothing flashed or changed on the TV.**

## What the actual files show

- `root:/basic/am_config` launches `/3rd/sony/sony_dockui/launcher.bin` as a separate native DockUI application.
- `3rdp:/sony/sony_dockui/launcher.bin` contains `/3rd_rw/service_list/dockui`. ARM disassembly at `0x1e828` loads that pathname and calls imported `access` with `R_OK (4)`. **This checks path readability; it is NOT proof of a writable app catalog, configuration format, or HOME replacement.**
- `3rd2:/cobalt/content/web/html5ui/service_list` is a symlink to `/3rd_rw/service_list`; the OTA does not include the actual runtime data from `/3rd_rw`.
- Stock `3rd2:/cobalt/content/web/html5ui/allappsmodule.js` uses JSON from `currentBivlList` and displays tiles using `service_name` and `icon_url`, sorted partly by `service_type` and `service_index`.
- Stock `3rd2:/cobalt/content/web/html5ui/homeuiapi.js` reads `HomeuiInterface.bivlservicelist` and launches registered entries using `HomeuiInterface.LaunchApp(JSON.stringify(payload))`. The original caller supplies `icon_url`, `service_name`, `service_id`, `service_type`, `service_index`, and an empty `uri`.
- Cobalt HTML5UI launch still points to fixed `file:///html5ui/index.html`. Real hardware HOME ownership (DockUI versus Cobalt) remains unknown.

## Actual development completed

- Added `ui/sony_catalog_bridge.js`. At activation, and **only in a Sony runtime exposing the actual BIVL list**, it attempts to match one of our ten app tiles against one unique, valid, already registered service.
- Native app IDs are taken **only** from the registered Sony record. Absent, duplicate, malformed, or unknown services fail closed; no guessed ID, arbitrary web URI, install step, external dependency, tracker, or background polling.
- Updated `ui/launcher.js` and `ui/index.html` to route successful native launches through `HomeuiInterface.LaunchApp`. Native settings and channel-list handlers remain separate. After successful dispatch the HTML launcher refrains from immediately reclaiming focus.
- Passing `LaunchApp` to the native API **does not prove a player opens or DRM playback works**. All real TV apps require on-device validation; unsupported apps remain visual placeholders.

## Verified checks and materials

- **11/11** read-only real-firmware assertions from `inspect_catalog_route.py` (exact original root, 3rd2, 3rdp partitions).
- **121/121** Node.js tests (81 HOME/navigation, 15 native-menu contract, 25 registered-catalog input/output validation).
- **7/7** Chromium browser integration tests with *mocked* Sony API. Includes Netflix registered service dispatch and negative Kinopoisk/KION scenarios.
- **139/139** checks total. No hardware tests.
- Reproducible research source, samples and check runner are in user-provided conversation artifact `BRAVIA_STAGE5_NATIVE_CATALOG_RESEARCH.zip`. **It does not include Sony binaries, original OTA, credentials, DRM files, fonts or keys.**

## What is NOT solved

1. Accessing or modifying real `/3rd_rw/service_list/dockui`; static `access(R_OK)` proves no more than a readability check.
2. Registering or installing new Sony Linux-native applications. A fabricated BIVL entry is not an installable app.
3. Replacing original DockUI/HTML5UI stored in dm-verity-protected SquashFS.
4. Authorized recovery, native focus and remote ownership, live service inventory, actual memory and playback on physical KD-55XG7096.

**Decision:** Work on a true HOME resource loader and, separately, an authorized route for native application distribution. Keep stock TV/system menus, audio/video, INPUT, EPG, OPTIONS, DRM and remote handling unchanged. No USB flash image or service-list edit is safe at this stage.
