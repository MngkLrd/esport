# Stage 6 — True native HOME and installation gate (Sony KD-55XG7096, original v8.931-1000)

**Read-only original firmware audit. Not a flashable build. No TV modification.**

## Critical architecture correction

- The original TV-context remote keymap `root:/basic/keymap_tv.ini` explicitly maps `ROOT_MENU=dockui(stop)[start]`.
- The Sony app manager (`root:/basic/am_config`) registers `sony_dockui` as `/3rd/sony/sony_dockui/launcher.bin`.
- The **actual DockUI executable** from `3rdp:/sony/sony_dockui/launcher.bin` is a native **32-bit ARM EABI DirectFB application**, importing `libdirectfb.so`, `libapp_client.so`, `libexpat.so.1`, `libfreetype.so.6`, `libpng12.so.0`, etc. A genuine `readelf -d` inspection of the extracted owner image validated the library dependencies.
- The separate Cobalt `html5ui` starts from `file:///html5ui/index.html`. **Replacing that page is NOT evidence of replacing the physical HOME button's native DockUI.** Active runtime focus/owner needs real hardware verification.

## Hard installation constraints

| Candidate | Evidence-based outcome |
|---|---|
| Flash unsigned modified Sony OTA | **BLOCKED:** dm-verity/NFSB and no verified update acceptance or recovery |
| Write `/3rd_rw/service_list/dockui` as ordinary app | **Not proven and blocked by stock initial permissions:** `root:system`, mode 0770; actual live-device status unknown |
| Persistent `/3rd_rw/cobalt/url.ini` override | **BLOCKED:** boot mount script deletes the file |
| Conditional `/3rd/run.sh` | No such file is supplied in original protected sections |
| Use Sony Professional BRAVIA HTML5 USB installer instructions | Different platform; no evidence consumer KD-55XG7096 supports them |
| Port to native DirectFB + app_client | **Technically appropriate target**, but requires authorized loader, ABI details and full rollback first |

The original system keymap routes TV functions through `dtv_app_mtk`. Stock `browser_base` autostarts and owns browser, YouTube and HbbTV. **Do not remove it as 'bloat'**. `globoplay` autostarts, but a running-process CPU/RAM profile is still missing. Stock Cobalt HTML5UI has `--disable_csp` and `enablewebsecurity=0`, so external web content must not run inside this privileged HOME environment.

## Actual development in this stage

Added `native_core/home_core.h`, `native_core/home_core.c`, `native_core/test_home_core.c`: no-heap, no-background-task C99 TV-first state machine for ten services, 5x2 remote navigation and **intents** for native TV/settings/channel list/HDMI as well as pass-through of 16 dedicated Sony system key classes. The code compiles on host and its deterministic behavior tests pass, also with ASan/UBSan.

The **DirectFB renderer and Sony libapp_client adapter have NOT yet been written or tested**. Physical TV buttons and service launches are untested. Thus this is not an ARM firmware image.

Local separate audit: **22/22 static checks against owner-extracted original root/3rd2/3rdp** plus **18/18 offline Python tests**, and native C99 host/sanitizer tests passed. Research source, report and tests are downloadable in conversation artifact `BRAVIA_STAGE6_NATIVE_INSTALL_GATE.zip` (excludes all Sony binaries/keys/DRM).

## Decision: installation NO-GO, research native renderer next

To deploy, first identify the actual TV's active HOME process, obtain an authorized loader and verified full-device backup/recovery, then compile the ARM DirectFB + app_client integration and bench-test native menus/keys. A modified Sony USB ZIP must not be presented as ready-to-flash without those gates.

Reference (manufacturer restriction): https://www.sony.com/electronics/support/televisions-projectors-lcd-tvs-android-/xbr-75x850c/articles/00351426
