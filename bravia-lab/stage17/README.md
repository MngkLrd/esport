# BRAVIA HOME Stage 17 — TV tile blurred logo backplates

Implemented in `feature/bravia-home-stage15` **without changing Sony HOME launch behavior**.

## Visual contract

Tile bounding box: **216×130** at 1280×720. Logo backplate inset: **144×75**, positioned x+36 / y+13, centered and aspect-preserving; foreground app name and availability indicator remain separate and readable. 5×2 grid stays 10 apps.

| Service state | PNG variant | Peak source opacity | Gaussian blur reference |
|---|---|---|---|
| `APP_UNKNOWN` (default) | `unknown` | 16% | 3.4 px |
| `APP_READY` (host-reported only) | `ready` | 26% | 2.6 px |
| `APP_UNAVAILABLE` | `unavailable`, desaturated | 10% | 5.8 px |

Blurring and opacity are **prebaked at asset generation**, not computed per rendered TV frame. At 1080p and 4K the native UI-logo destination rectangle follows the C99 renderer scaling. Existing DirectFB adapter's `logos[10][3]` uses its `DSBLIT_BLEND_ALPHACHANNEL` / `StretchBlit` path if a permitted host has loaded the surfaces. **Actual Sony texture loading and physical TV are still not verified.** If the supplied host texture is absent the backend retains its text fallback.

A 30-PNG pack generated with `python3 bravia-lab/stage17/generate_assets.py` and the manifest is provided. **These are locally drawn and blurred wordmark placeholders, not certified official brand artwork**. The ten service labels are Kinopoisk, Ivi, START, Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac, Sony Browser and KION. For production, replace individually with permissioned transparent vendor-supplied source logo SVG/PNG, preserving the original aspect ratio and alpha padding.

## Reproduce

```bash
python3 bravia-lab/stage17/generate_assets.py
python3 -m unittest -v bravia-lab/stage17/test_assets.py
make -C bravia-lab/native_core test adapter-test
```

The *conversation artifact* `BRAVIA_HOME_STAGE17_LOGO_BACKPLATES.zip` also contains generated native-command 720p/1080p/4K previews and `BRAVIA_HOME_STAGE17_INTERACTIVE.html` with all base64-embedded PNGs and keyboard navigation, no network use. The browser preview is only a **visual presentation of C99 commands**; it is not a Sony app or a native Sony DirectFB renderer. Demo Netflix READY and KION UNAVAILABLE are deliberately synthetic, not a reading from physical Sony.

## Isolation / safety

No network calls in the C core, no Sony IPC writer, no changes to DRM, tuner, channels, remote key reservation or firmware update path. **No installable Sony package**. Native ready state remains verified only by a future authorized app manager; visual color must not imply verified playback.
