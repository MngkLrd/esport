# KD-55XG7096 v8.931 — Native HOME Stage 2

**OFF-DEVICE AUDIT, NOT FLASHABLE FIRMWARE.** Evidence: owner-supplied unmodified Sony OTA, its decoded read-only root/3rd2/3rdp partitions, and Sony's original Cobalt HOME scripts. No device keys, licensed assets, binaries or DRM contents are included.

## Boot / HOME chain

- /basic/autorun.sh invokes /basic/app_man with am_config and am_start.ini.
- dtv_app_mtk is /basic/dtv_svc. It owns television, native key routing, OSD, audio and tuner functions.
- html5ui runs via the stock Cobalt process with file:///html5ui/index.html, not Vewd's ordinary pointer browser.
- Cobalt HTML5 HOME is stored in 3rd2 under cobalt/apps/html5ui/ui; duplicated under cobalt/content/web/html5ui. Five core HTML/JS files match byte-for-byte across those paths.
- /3rd/sony/sony_dockui/launcher.bin is a separate native launcher, and ROOT_MENU routes via keymap_tv.ini and keymap.ini. Which exact runtime HOME path the physical TV uses is NOT yet verified.

## Native API evidence

Sony HOME JS exposes window.HomeuiInterface; verified invocation names include LaunchMenu, LaunchApp, TuneToChannel, LaunchNetflix and GetExtInputs. This object is specific to the stock Cobalt HTML5 context, **not available to arbitrary web pages**.

- SettingsModule uses LaunchMenu with menu title **System Settings**.
- ChannelsModule uses LaunchMenu with menu title **Programme List**, subject to region/UI menus.
- GetExtInputs lists inputs but does **not** prove how to open the stock HDMI selector. Inputs remain blocked.
- Cobalt keymap.ini explicitly passes essential buttons to dtv_app_mtk; never intercept volume, channel, INPUT, OPTIONS, source, sleep, numeric keys, or record in a way that prevents stock handling.

**Research adapter added**: ui/sony_native_bridge.js with whitelisted openNative('settings' | 'channels') and fail-closed 'inputs'. The wrapper only reports a native function call dispatched; does not claim a Sony menu was shown. Launcher avoids re-rendering immediately after dispatch, preventing HTML from reclaiming native focus.

## Signed partition / recovery limits

- Original root/3rd2/3rdp use NFSB-wrapped SquashFS.
- Actual Sony dmverity_mount_emmc_3rd_ro.sh mounts the 3rd party read-only volume through dm-verity.
- ext4_mount_3rd.sh mounts an independent 3rd_rw app-data volume. This is NOT proof of a writable HOME override.
- Sony official update docs state **downgrades unsupported**. An update ZIP alone is not full eMMC backup/recovery.
- No signed installer/repacker, unrestricted developer runtime, or tested recovery path exists; **never flash modifications**.

## Test evidence

- 40/40 live-image **static audit checks** (real uploaded firmware file).
- 81/81 TV-first navigation tests.
- 15/15 simulated Sony bridge unit tests.
- 6/6 Chromium UI integration tests using an explicitly mocked HomeuiInterface.
- **142/142 off-device checks passed**. No live Sony hardware key, menu, tuner, RAM/CPU, DRM playback or recovery test.

## Next gates (no flash)

1. On real hardware identify active HOME renderer: DockUI, Cobalt HTML5UI, or layered sequence.
2. Establish official or bench-validated full device recovery before experiments.
3. Verify whether vendor-supported runtime development can supply alternate Cobalt HOME assets without modifying signed SquashFS.
4. Test all remote keys, native settings and EPG focus transitions on spare matching hardware.
5. Measure real service CPU/RSS; never disable optional telemetry merely due to names in read-only firmware.

**Status: firmware integration BLOCKED; offline native menu dispatch prototype READY FOR CONTINUED RESEARCH.**

References: https://www.sony.ru/electronics/support/lcd-tvs-xg70xx_x70xxg-series/kd-65xg7096/software/00287627 and https://github.com/chaosmaster/android_kernel_amazon_mantis/blob/master/include/linux/nfsb.h
