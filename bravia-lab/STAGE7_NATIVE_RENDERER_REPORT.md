# Stage 7 — C99 / DirectFB-native HOME renderer (2026-10-25)

Target: Sony KD-55XG7096, original Linux v8.931-1000. **This is NOT a flashable firmware, Sony native ARM binary, or a tested TV runtime.**

## New implementation

- `native_core/render.[ch]`: portable no-heap drawing interface and HOME renderer. Flat color tiles for 10 apps (5x2), TV-return hero, native settings/channel/input dock, high-contrast focused selection, Cyrillic UI strings. No HTML, timers, background network operations or image decode.
- `native_core/directfb_backend.[ch]`: DirectFB 1.x adapter using caller-provided `IDirectFBSurface` and six-font regular/bold caches. No fullscreen/exclusive surface creation, no Sony TV layer acquisition, no font binaries shipped. Full render is **61 draw commands**: 18 rectangles, 7 strokes, 36 text calls at 1280x720.
- `native_core/host_dispatch.[ch]`: fail-closed bridge to user-defined host callbacks; `FX_PASS_TO_SYSTEM` is never silently consumed in absence of a valid host callback. Successful Sony native overlay/app dispatch avoids immediate re-render/focus theft; failed TV/settings/source actions roll back state.
- `native_core/render_dump.c` + conversation bundle `render_preview.py`: command stream from native C renderer rasterized off-device with local Pillow/OS fonts. **Screenshots are NOT DirectFB captures or Sony hardware test evidence.**
- Existing Stage 6 `native_core/home_core.[ch]` retained for native TV-first navigation.

## Verified offline

- Host compiler: gcc C99 with `-Wall -Wextra -Werror -Wconversion -pedantic`, all tests PASS.
- Five tested geometries: 1280x720, 1920x1080, 1366x768, 1024x768, 640x360. All emitted commands bounded to screen area.
- TV view: **0 draw commands**, avoiding a fake player over the real tuner.
- DirectFB mock adapter tests verify call forwarding to `SetColor/FillRectangle/DrawRectangle/DrawString/SetClip`, explicit opt-in `Flip`, rejection of missing fonts, and no rendering in TV view. The test-only `tests/directfb_stub/directfb.h` is not a proprietary or real DirectFB header.
- AddressSanitizer + UndefinedBehaviorSanitizer on native renderer and host dispatch tests: PASS.
- No actual DirectFB 1.x development headers installed here, so **real DirectFB compilation/linking has not happened**. There is no ARM cross-build or Sony `libapp_client` implementation.

## Blockers

1. Verified Sony native loader and authorized mapping to its REAL DirectFB render surface.
2. Matched 32-bit ARM ABI, DirectFB 1.x and `libapp_client` headers/library for this exact firmware.
3. Native action and key passthrough implementation against Sony IPC, plus real hardware testing.
4. Recovery and signed firmware installation problem (NFSB/dm-verity). No modified OEM package should be flashed.

Full standalone native source + tests + 720p/1080p screenshots: **BRAVIA_STAGE7_NATIVE_DIRECTFB_SOURCE.zip** attached in the original conversation. All authored code; no bundled Sony binaries/firmware/DRM/secrets/fonts.

Standard DirectFB primitives reference: https://www.directfb.org/ ; community API sample: https://wiki.gumstix.com/index.php/How_to_get_started_with_DirectFB.
