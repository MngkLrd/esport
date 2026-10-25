# Stage 14 — BRAVIA HOME product upgrade (2026-10-25)

**Target:** Sony KD-55XG7096 (non-Android Linux). This is an author-owned, **off-device** native C99/DirectFB-ready HOME source update. It does **not** install on Sony, modify v8.931, remove system services or ship any manufacturer firmware/DRM/binaries.

## Product implementation

1. **Redesigned TV-first screen**, authored in `native_core/render.c`: 10 apps in a responsive 5×2 grid; tasteful flat dark/tinted surfaces; high-contrast two-stroke focus; TV-return card; native Channels/GUIDE, Inputs and Settings dock. Physical volume, channels, INPUT, OPTIONS, GUIDE, power, TV video and OSD remain Sony's responsibility.
2. **Actual app states**, in `native_core/home_core.[ch]`: each of 10 apps is `APP_UNKNOWN` (default), `APP_READY` (reported only by a trusted host), or `APP_UNAVAILABLE`. Unavailable services do not dispatch a launch. Unknown services may be offered to a future authorized host but do not pretend to be installed.
3. **Honest feedback** for not registered / host absent / refused launch, displayed in the native C renderer. `last_dispatched_app` is updated only after host returns accepted — this is *not* proof of actually launching, playing DRM video or opening an external URL. Successful native handoff avoids immediate redraw/focus theft; failed system handoff reverts state.
4. **Performance**: 94 deterministic drawing commands in the base 1280×720 HOME, zero drawing commands while the television view owns the screen; no heap allocations, timers, network traffic, UI image decoding or background tasks in the core.
5. **Safe UX checks**: five viewport sizes (1280×720, 1920×1080, 1366×768, 1024×768, 640×360), independent app status/recent state testing and 10,000 synthetic key events. One-pixel separators no longer become zero-size at fractional screen scales.

## Build and preview

[Native C99 sources and test Makefile](native_core) · [Stage14 build and visual source](stage14).

On a PC, from `bravia-lab`:
```bash
cd native_core && make test adapter-test
cd ../stage14 && ./run_tests.sh
```

The Stage14 script builds an **ARM32 v7 EABI5 ET_REL** core using Clang+LLD. Its ~15KB object has no undefined global imports but is **NOT a runnable Sony ELF**, does not link a real DirectFB ABI, and is not signed for Sony updates.

An interactive offline HTML *simulator* is generated from **26 snapshots of the compiled C renderer**. The JavaScript keyboard navigation is a simulation; system menus/TV streams/DRM are not simulated as real media. Netflix-present, KION-absent, and "last dispatch" are explicitly **fictional demo data**, not measurements of this TV. Use the bundled `BRAVIA_HOME_v14_INTERACTIVE_PREVIEW.html` or generate it locally with `stage14/build_preview.py` (requires Pillow).

## Checks completed on the authoring machine

- `make test adapter-test`: five standalone native test programs pass (TV-first navigation, rendering, host fallback, 10k-event product stress, mock DirectFB API). **The DirectFB adapter uses a test header, not Sony's binary API.**
- `python test_artifacts.py`: **10/10** checks passed.
- Native host tests with AddressSanitizer and UBSan: PASS.
- Clang 17 + LLD ARMv7 ET_REL: PASS; `readelf` verifies 32-bit ARM EABI5 and zero unresolved global symbols.
- Interactive Chromium test: keyboard focus, detail/back/home transitions, zero JavaScript errors.
- ZIP archive `BRAVIA_HOME_STAGE14_NATIVE_PRODUCT.zip` was created and CRC-checked (34 files, 431,846 bytes, SHA256 `0a0281c17e89e54a5021b85c09981151a6b17542f50ee6f323a9deccbefb4d68`).

The full downloadable conversation ZIP is self-contained and includes native source, tests, ARM object, visual frames, preview, report and SHA-256 manifest.

**Blockers remain unchanged:** no confirmed authorized Sony native app loader, no exact real DirectFB/libapp_client integration, no physically tested TV remote/menu handoff, no device recovery, no signed Sony USB installer. **Do not flash this archive.**
