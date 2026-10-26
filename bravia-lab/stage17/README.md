# BRAVIA HOME Stage 17 — blurred service logos and optional DirectFB image loader

Branch: `feature/bravia-home-stage15`. Target: Sony BRAVIA KD-55XG7096 (native non-Android Linux). **Offline research build, not installable Sony firmware.**

## Render contract

At 1280 × 720, ten tiles form a 5 × 2 grid. Each is 216 × 130 px; the preblurred artwork is 144 × 75 px and is placed at x + 36 / y + 13. Names, availability markers, focus outlines, TV card and system key delegation are unchanged. The pure C99 UI continues to emit 94 commands on the HOME screen.

**One canonical asset generator**: `stage17/build_assets.py`. The older `generate_assets.py` is only a compatibility wrapper; both produce the same 30 PNG files and one `stage17/assets/manifest.json` (a list of 30 records).

| Availability state | Prebaked alpha | Gaussian blur on 144 × 75 source |
|---|---:|---:|
| UNKNOWN (default, not a claim of installation) | 0.14 | 3.4 px |
| READY (only from verified host) | 0.22 | 2.6 px |
| UNAVAILABLE | 0.08, grayscale | 5.8 px |

No dynamic blur, logo download or PNG decoding occurs in the C99 renderer. Three services use sourced Simple Icons vector elements: Kinopoisk, Netflix, YouTube. The remaining seven are **local typographic placeholders, not verified official logos**. Replace those with duly licensed, aspect-preserving logo assets before any product distribution. The preview's READY/UNAVAILABLE test statuses are fictional.

## Optional DirectFB host integration (Stage17 patch)

`native_core/directfb_logos.[ch]` now provides a real **standard DirectFB 1.x image-provider loading path** for the 30 files, without requiring network calls. It is opt-in and **requires an authorized host-provided `IDirectFB*`, already usable graphics context, and a read-only local assets directory**.

```c
#include "directfb_logos.h"
BraviaDfb backend = {0};        /* host must supply backend.surface + fonts */
BraviaLogoPack pack = {0};     /* caller owns this pack */
if (bravia_logo_pack_load(&pack, dfb, "/authorized/app/stage17/assets") == 0)
    bravia_logo_pack_attach(&backend, &pack);

/* bravia_dfb_draw(&backend, ...): images from cached ARGB surfaces */
/* Shut down only after all draw calls have stopped: */
bravia_logo_pack_detach(&backend);
bravia_logo_pack_release(&pack);
```

Loader behavior: use `CreateImageProvider → GetSurfaceDescription → CreateSurface(ARGB) → RenderTo`. It rejects wrong-sized images, loads 30/30 or releases everything and retains the text fallback, never double-owns the host's canvas and never calls `DirectFBCreate` or sets cooperative/primary fullscreen mode. Attach is non-owning: **detach before release and never release while a draw is in progress**. The missing-logo text fallback remains operational if no pack is loaded.

**Scope limit:** DirectFB entrypoints are tested against a mock header/provider. They have not been compiled against the television's actual SDK, provided an authenticated Sony compositor, or run on real KD-55XG7096 hardware. PNG provider codec availability, host graphics layer ownership and application deployment remain unknown. Do not flash these sources as firmware.

## Reproduce locally

From repository root:

```bash
python3 bravia-lab/stage17/build_assets.py
python3 -m unittest -v bravia-lab/stage17/test_logo_assets.py
python3 -m unittest -v bravia-lab/stage17/test_assets.py
make -C bravia-lab/native_core test adapter-test
python3 bravia-lab/stage17/build_preview.py
```

Dependencies for asset generation: Python 3.11+, Pillow, CairoSVG and DejaVu fonts. The mock DirectFB adapter does **not** prove Sony ABI compatibility; `make -C bravia-lab/native_core directfb-check` additionally requires real DirectFB 1.x headers on a supported development host.

The CI workflow archives offline PNG assets, a keyboard-driven HTML demo and screenshots from native C99 draw commands. The demo does not exercise the actual Sony remote, launcher, firmware, DRM or tuner.
