# BRAVIA TV-first firmware contract (v0.1)

Status: DESIGN CONTRACT ONLY. Nothing has been flashed to the target TV. Exact model KD-55XG7096 is confirmed; reported running version v8.931 (partial suffix), and the individual board revision and recovery route remain unverified. Do not claim any of these conditions are currently validated.

## Core invariant

The appliance MUST remain a television. Boot into the native TV/last-selected broadcast-or-input view (unless current firmware provides a different user-configurable startup preference). The custom application launcher must open only when HOME is pressed. Original tuner, A/V and settings processes, vendor kernel, hardware drivers and license/security components remain unchanged wherever possible.

## Preservation matrix (manual acceptance after identifying exact hardware)

| ID | Feature | Acceptance criterion | State |
|----|---------|----------------------|-------|
| TV-01 | Cold boot | Standby/power toggle boots into TV view or last input with picture and sound | UNTESTED |
| TV-02 | Remote CH+/CH-, number keys, previous channel | Correctly switch channels from viewing mode and after exiting apps | UNTESTED |
| TV-03 | Channels | Previously tuned DVB-T/T2, DVB-C, and DVB-S/S2 channels remain accessible where supported | UNTESTED |
| TV-04 | Channel list | List, favourites, sorting and channel metadata preserved | UNTESTED |
| TV-05 | GUIDE/EPG | Correct electronic guide, program details and channel selection | UNTESTED |
| TV-06 | Audio | VOL+/-, MUTE, audio output selection, lip sync and HDMI ARC | UNTESTED |
| TV-07 | Picture/inputs | HDMI/USB selection, picture modes and BRAVIA Sync/CEC work as before | UNTESTED |
| TV-08 | Remote HOME | Opens new TV-first launcher; no mouse pointer; no launching before HOME | UNTESTED |
| TV-09 | Remote DPAD/OK/BACK | Predictable spatial focus movement; BACK returns to launcher or TV; long-back behavior defined | UNTESTED |
| TV-10 | Native settings | Existing SONY settings, broadcast tuning, network, picture, sound and timers remain accessible | UNTESTED |
| TV-11 | Recording, subtitling | USB recording, scheduled timers, subtitles, teletext preserved where existing | UNTESTED |
| TV-12 | Restart/recovery | Repeat cold boot, warm boot, power-cycle tests; verified way back to stock image | UNTESTED |
| TV-13 | Fail-safe | Launcher failure does NOT block TV use; fallback stock HOME/recovery path exists | UNTESTED |
| TV-14 | Network/DRM | Existing network apps keep original protected playback if supported by the platform | UNTESTED |

Do not ship or flash if any critical TV-01 through TV-09 or TV-12/13 fails. Maintain regression evidence after each change.

## Proposed layering (to be validated on real firmware)

1. Preserve bootloader/kernel/stock drivers and tuner/audio/video/HDMI subsystems.
2. Preserve stock middleware and platform settings / broadcaster databases.
3. Keep stock streaming/DRM/key and certification components; never move private device secrets to Git.
4. Investigate modifying only HOME launcher or web-app catalog with reversible overlays or configuration.
5. Use a simple configurable launcher with ten pinned entries (nine selected media services plus native browser) (see config/app_catalog.json) and optional hidden vendor entries.
6. Protect system remote keys globally (POWER, VOLUME, CH, SOURCE, SETTINGS, GUIDE) from app interception; use DPAD/OK/BACK within HOME.

## Streaming service feasibility (2026-10-25 public source review)

| Service | Feasibility | Required condition |
|---------|-------------|-------------------|
| Netflix | POSSIBLY PRESERVE existing native installation; no APK sideloading on non-Android Linux | Confirm app actually exists, current service availability, native DRM and playback |
| Kinopoisk | NOT officially supported on Sony Linux per Yandex supported-TV matrix | Vendor-supported binary/platform port OR demonstrably functioning authorized supported web playback; browser shortcut alone is not sufficient |
| YouTube | MAY retain native vendor app if currently functional | Confirm presence, current playback and remote handling |
| IPTV / local HTML5 | RESEARCHABLE | Confirm supported formats, media APIs, transport, remote key events and playback |
| Other third-party apps | NOT ASSUMED INSTALLABLE | Verify target architecture, runtime, SDK and license/DRM compatibility |

Sources:
- Sony specifications for exact target: https://www.sony.ru/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096/specifications
- Sony EU exact-model support (v8.933): https://www.sony.ee/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096/downloads
- Sony RU exact-model support (v8.931): https://www.sony.ru/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096
- Sony non-Android app restrictions: https://www.sony.com/electronics/support/televisions-projectors-lcd-tvs/articles/00351426
- Kinopoisk supported TVs: https://www.yandex.ru/support/kinopoisk/ru/viewing/conditions
- Netflix Sony support: https://help.netflix.com/ru/node/23878

## Hardware validation gates

H0. PARTIAL: full model and firmware major/minor confirmed as KD-55XG7096, v8.931. Board revision, full version suffix and recovery state need verification.
H1. Obtain model-specific vendor firmware file plus hash and any accessible stock backups (a vendor update is not a full-device backup).
H2. Identify package format, verification and boot chain without attempting a write.
H3. Identify TV/launcher boundaries and whether a purely configurational change is possible.
H4. Test prototypes in offline emulator/matching spare unit; confirm remote input mapping.
H5. Document and rehearse physical restoration path, full backup, known-good signed original firmware where applicable.
H6. Only then consider changes to a real TV, with explicit separate approval.

## Out of scope without new evidence

- Replacing Linux wholesale with Android TV
- Guessing or bypassing device DRM material, transplanting Netflix app images
- Cross-flashing a guessed board revision
- Claiming TV functions have been preserved before actual bench tests

## User requested application contract

All ten tiles must be present in intended HOME: Кинопоиск, Иви, START, Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac, Браузер, КИОН. Responsive layout is provisionally 5 columns by 2 rows, pending TV usability review. Use stock Vewd/Opera as the light-weight browser, not a fictitious native port. A visible tile is NOT proof that the service has been ported or can play content; every service needs an independent launch/login/playback/resume/BACK acceptance test. Media Station X and Al(co)pac identities have been confirmed by the user.

## Native Sony UI is mandatory (no custom substitutes)

**User confirmation:** keep original Sony picture/sound/network/system settings, on-screen channel list and GUIDE/EPG, original input/HDMI source chooser, the Options/context button, recording/timers, and every dedicated remote key. These must invoke their existing Sony firmware screens, not recreated HTML/CSS imitation panels.

- HOME is the **only** proposed surface to replace, once firmware integration is proven.
- Dock SETTINGS invokes the **real stock Sony settings UI**. Never render our own settings copy.
- Dock CHANNELS invokes native channel list; GUIDE key invokes vendor EPG independently.
- Dock INPUTS invokes original Sony source/input selector; physical INPUT/SOURCE/OPTIONS/SETTINGS/PICTURE/AUDIO keys are reserved.
- POWER, VOL+/−, MUTE, CH+/−, numerical channel entry, HDMI-CEC and TV key must retain their stock system routing whether HOME is visible or not.
- BACK/RETURN first exits an app or custom HOME; while a Sony system overlay is active, Sony handles BACK and all focus. Our launcher MUST NOT intercept keys belonging to an open stock screen.
- Our UI defines a **BraviaNativeBridge.openNative(action)** integration contract for channels/inputs/settings. This is OUR interface, NOT an established Sony API. It must be implemented against the real firmware IPC or process lifecycle after reverse engineering; no fake success, no guessed commands.
- In an off-device prototype where this bridge is absent, an **explicit unintegrated informational screen** is acceptable, but cannot appear on production hardware pretending to be settings.
- Integration acceptance requires filming or recording a real device showing HOME → Settings (stock menu) → BACK → HOME, HOME → Inputs (stock input selection) → BACK, HOME → channel list → channel switch → TV, and physical MENU/OPTIONS/GUIDE/Volume across HOME/native view.
- Missing native bridge, simulated stock screens, or loss of any system remote key are **P0 release blockers**. Do not flash.
