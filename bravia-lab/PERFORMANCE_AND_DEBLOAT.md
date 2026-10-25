# KD-55XG7096 | Stock system preservation and debloat policy v1

**State: proposed rules + tested offline code only. No genuine Sony firmware contents have been inspected. No tracker has been identified or removed, and no TV service disabled.**

## Product requirements

- Replace stock HOME launcher, app menu/catalog and optional app UI. Keep the video, tuner, Guide/EPG, digital↔analog TV switching, channel lists, subtitle/recording functions, on-screen keyboard, TV input source dialogs, full original Sony picture/audio/network/system setting panels, time/date, native OSD (volume/INFO) and all physical remote buttons.
- Never replace Sony native functionality with our mocked settings/Guide/HDMI pages. MENU/OPTIONS/SETTINGS/GUIDE/SOURCE/VOLUME/CH/TV/POWER remain reserved for firmware. Native calls require reverse-engineered and tested IPC adapter.
- Keep native streaming/DRM, security, update/recovery and firmware integrity protections. Without verified recovery, do not write device flash.
- Stock app removal priorities: hide undesired icon → stop verified-independent auto-launch → reversible disable → consider actual removal only if every dependent and system test is green. Removing icon alone does **not** necessarily free RAM; disable/remove only if proven safe.
- **No assertions about specific 'trackers' without evidence.** Vewd, Sony telemetry, crash diagnostics, OTA, recommender/catalog requests and DRM/auth services can share code paths or be essential. Review signed binaries, configs, network destinations, process samples and dependencies first.

## Candidate classification

| Group | Rule |
|---|---|
| Boot, drivers, tuner, analog/digital, picture/audio, HDMI/CEC, EPG, channel DB, remote input, volume OSD, keyboard | **KEEP** |
| Settings, support, OTA/recovery, DRM/auth, network stack, clocks, system security | **KEEP** |
| Store/catalog UI, unused preinstalled service icons, marketing tiles | **HIDE_UI_FIRST**, then assess if processes truly load at boot |
| Separately verified analytics/optional reporting, old diagnostics, legacy unused background jobs | **REVIEW_DISABLE** after process/ram/CPU/dependency evidence |
| Unknown, encrypted, undocumented or shared libraries | **KEEP_PENDING_EVIDENCE**, no speculative removal |

The `audit_bloat.py` tool is deliberately **read-only** and emits no kill, delete or flash commands. It accepts a manually verified JSON inventory of services and calls out dependencies. Reports alone do not authorize disabling services.

## HOME lightweight profile

Default `performance-lite` CSS (not a new browser/runtime). Keep brand-tinted matte cards and legible focus; disable large radial decorative pseudo-elements, CSS blur, scale animation and nonessential motion. Local Arial fallback. **No analytics, CDN, webfonts, external scripts, timers, dynamic preload or tracking requests in our HOME implementation.** Custom service pages/embedded vendors are a separate trust boundary: their telemetry cannot be assumed absent.

Suggested **acceptance budgets**, not measured Sony performance:
- launcher's additional steady-state RSS: target <= 32 MiB (reassess after collecting actual `/proc`/service stats);
- launcher idle CPU: target <= 1% averaged for 60 sec on TV (hardware-specific, must measure);
- D-pad input-to-highlight: target p95 <= 100 ms, without repeated key loss;
- no background polling, timers or video thumbnails in HOME;
- cold power-on native TV latency and channel change no worse than stock (compare baseline);
- after 100 HOME/TV/Settings/Guide cycles, no progressive memory growth or hung keyboard focus;
- on native pane activation, launcher must cede focus; backup restore proven first.

Test sample screens: 1280x720 and 1920x1080 minimum; 4K scaled only if the actual TV middleware produces 4K GUI buffer. For old Vewd browser engine, HTML/CSS compatibility must be verified on hardware before approving layout.

## Next gates

1. Obtain region-correct v8.931 update as reference (an update package is not a full raw flash backup). Read only.
2. Determine actual SoC board and boot image/signature/container format; extract or inspect rootfs if possible.
3. Inventory startup services + timestamps + dependencies, network listeners and requests, RSS/CPU at idle TV versus HOME.
4. Classify and preserve system daemon allowlist; do not misclassify DRM, NTP, remote service, OTA or crash reporting as removable by filename.
5. Test a reversible sandbox overlay/app list filter, without deleting system components. Exercise all native menu buttons.
6. Only after reliable full recovery and hardware regression tests, consider changes to boot/startup or physical removal.