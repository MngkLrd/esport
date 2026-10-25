# BRAVIA HOME Stage 17 — logo-background product implementation

Date: 2026-10-26 · Target: Sony BRAVIA KD-55XG7096 (native Linux) · Branch: `feature/bravia-home-stage15`.

## Result

All **10 service tiles** now use a **preblurred, proportionately fitted image underlay**, preserving the existing 5×2 TV-first grid, native HOME/TV state machine, app availability truthfulness and system remote-key passthrough.

| Parameter | 1280×720 native coordinates |
|---|---|
| Tile | 216×130, 5 columns × 2 rows, horizontal spacing 22px |
| Preblur logo area | **144×75px (66.7% of tile width)**, top-center above footer |
| Position | tile x+36, y+13 |
| READY | preblur radius 2.2px, alpha 0.46 |
| UNKNOWN | radius 2.9px, alpha 0.33 |
| UNAVAILABLE | radius 4.3px, alpha 0.14, grayscale |
| Foreground | unchanged app title, status indicator, focus outlines |
| Native draw-call count | **94 HOME commands** unchanged from v14 |
| Asset count | **30 RGBA PNG files**, 144×75 |
| Runtime cost | no Gaussian blur, network fetch or dynamic PNG decoding in the pure C99 HOME core |

The fallback remains the previous large text/service mark if the authorized host supplies no DirectFB image surface for a slot.

### Original versus fallback assets

- **Sourced real vector symbols (Simple Icons):** Kinopoisk, Netflix, YouTube. Their SVG sources are stored under `stage17/assets/source/`, obtained from the public `simple-icons/simple-icons` icon collection.
- **Project-made typographic stand-ins, *not official logos*:** Иви, START, RUTUBE, Media Station X, Al(co)pac, Sony browser, КИОН. Names are exact while marks are visually approximated. This distinction is intentional; don't label these seven as verified trademark assets.
- The offline generator `stage17/build_assets.py` reads the source SVGs (CairoSVG), draws wordmarks using installed typefaces (Pillow), Gaussian-blurs and embeds alpha **once at build time**. Generated PNGs are not fetched online during TV use.

### Native integration

- New `UI_LOGO` command in `native_core/render.h` with `image_id=0..9` and `image_variant` (0 UNKNOWN, 1 READY, 2 UNAVAILABLE). Replaces previous giant text command, maintaining the **94-command** frame budget.
- `native_core/render_dump.c` serializes these extra metadata fields for offline preview and testing.
- `native_core/directfb_backend.[ch]`: optional `IDirectFBSurface *logos[10][3]` provided and owned by a future verified Sony native host. `StretchBlit` with `DSBLIT_BLEND_ALPHACHANNEL` for pre-blurred RGBA; explicitly restores flags to `DSBLIT_NOFX`. If unavailable, draws the previous textual fallback.
- The test-only DirectFB header and mock adapter now validate bitmap operation and fallback. **Actual Sony asset decoding/surface provisioning has not been implemented or physically tested.** No Sony IPC or update images touched.

### Verified tests and previews

- GitHub Actions native/ARM/QEMU, DirectFB mock, synthetic remote fuzz and source-only tests: [Stage17 green CI run](https://github.com/MngkLrd/esport/actions/runs/40238257811). Stage17 steps include 30 image generation, 8 Python asset/geometry/status tests, PNG/HTML preview build and artifact upload.
- Dedicated off-device images: `stage17/previews/`, including 720p and 1080p.
- Interactive single-file keyboard demo `stage17/BRAVIA_HOME_v17_LOGO_BLUR_DEMO.html` produced from native C draw commands, with offline base64 data images. The demo's Netflix READY / KION UNAVAILABLE statuses are fictional and are never used to claim real TV compatibility.
- Chromium smoke test of bundled HTML (by injecting into a local browser context): **30/30 embedded images loaded**, keys DOWN → RIGHT → OK → BACK navigated accurately, **zero JavaScript exceptions**.

### Build

```bash
cd bravia-lab
make -C native_core test adapter-test
python3 stage17/build_assets.py
python3 -m unittest -v stage17/test_logo_assets.py
python3 stage17/build_preview.py
```

Dependencies for generating assets: Python 3.11+, Pillow, CairoSVG, fonts-dejavu. CI installs these. C99 pure core uses none of them at runtime.

**Status:** product visual update and offline testing complete. Real Sony graphics, loader, app services and DRM remain unverified; `Stage17` is not installable Sony firmware and must not be flashed.
