# BRAVIA HOME v2 · QA handoff (2026-10-25)

**Target:** Sony KD-55XG7096, firmware v8.931. **Type:** functional OFF-DEVICE HTML5 UI prototype, not a flashed firmware. No real video services installed.

## Executed tests

- Node.js state-machine and reverse checks: **67/67 passed**.
- Python + Playwright Chromium + firmware-inspector tests: **74/74 passed**.
- Total: **141/141 passed**, evidenced in `reports/test_run_v2.txt`.
- Chromium screenshots visually inspected for 1280×720 and 1920×1080, also exported 3840×2160 and 1024×768.
- Geometry tests cover 1280×720, 1920×1080, 3840×2160, 1366×768, and 1024×768: no tile/dock/TV-card overlaps or viewport scrolling. Manual aesthetic assessment remains subjective.
- D-pad: TV hero -> application cards -> system dock. OK/BACK and shortcut HOME/TV. Reverse tests cover focus bounds, return paths, reserved TV keys not consumed, error panels, and offline operation.

## Key UX changes

- webOS-inspired quick navigation, dark compact streaming-first visuals without large advertising banners.
- Sony-like restrained typography, varied but coherent branded tile backgrounds, large focus ring, 4 native-system quick actions.
- 9 tiles: Кинопоиск, Иви, START, Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac, Браузер.
- Al(co)pac source is Go media server and has documented MSX integration; it is not a native Sony Android APK.
- Lightweight browser tile points to preserving stock Vewd, not installing an unverified new browser.

## Critical blockers before real-device deployment

1. Stock Sony v8.931 firmware not extracted/repacked/flashed.
2. Physical remote key events in Sony Vewd not proven to reach HTML. TV's virtual pointer may intercept them.
3. Real tuner/EPG/HDMI/standby/remote hardware behavior untested; web UI simulation cannot establish firmware compatibility.
4. MSX, Al(co)pac and other services' login/playback/DRM not verified.
5. Chromium results do not guarantee CSS/JS support in older Vewd engine; test on hardware.
6. No verified eMMC backup and working recovery flow; **do not flash**.

References: https://www.msx.benzac.de/info/index.html | https://wiki.alcopa.cc/docs/plugins/msx/ | https://alcopa.cc/