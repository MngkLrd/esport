# BRAVIA Firmware Lab (read-only alpha)

Investigation workspace for Sony BRAVIA non-Android Linux TVs. Goal: TV-first HOME menu with eight user-selected services and real D-pad/OK/BACK support while preserving the native tuner, picture, HDMI and audio stack.

**No custom TV firmware or flashing instructions are available yet.** The **model KD-55XG7096, year 2019, Sony Linux, and reported firmware v8.931** are known. Board revision of this individual set, firmware image internals, signature policy and recovery route are unverified. Never flash a firmware intended for a different board.

## Requested HOME apps

Target app order: Кинопоиск, Иви, START, Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac, Браузер. These are a **wish list**, not a report of successful installations or working playback. Keep D-pad, OK and BACK native to the launcher, preserve all TV remote keys, and keep playback failures from interfering with TV functions. MEDIAX has not been uniquely identified; do not silently substitute Media Station X or another unrelated product.

## REAL v8.931 FIRMWARE ANALYSIS — 2026-10-25

**Verified against the Sony official ZIP supplied by the TV owner.** Complete details: [REAL_FIRMWARE_AUDIT.md](REAL_FIRMWARE_AUDIT.md).

- Sony/MediaTek `#DH@FiRm` OTA, exact version `v8.931-1000`, 11 package partitions; three NFSB-wrapped SquashFS/LZO filesystems (`root`, `3rd2`, `3rdp`).
- Indexed 2,511 root files, 5,857 `3rd2` files and 6,522 `3rdp` files.
- Confirmed native HOME binary `/3rd/sony/sony_dockui/launcher.bin`, root `app_man`, keymap `ROOT_MENU=dockui`, and `dtv_svc`.
- Confirmed actual Samba TV ACR integration and Mixpanel library in bundled files; **ACR default config is disabled**. Running-device state and CPU/RAM use remain unknown.
- `globoplay` and `browser_base` have `start_self=true` in `am_start.ini`; actual runtime activation not proven.
- **40/40 static firmware checks passed**; not TV hardware tests.
- No changes to proprietary firmware, device flash, keys or DRM. No native launcher integration/repacking/recovery path has yet been proven.

Keep `dtv_svc`, remote/system keymaps, settings, HDMI, EPG, Dolby/audio and the DRM/browser stacks intact. Do not disable real Sony services before measuring dependencies and verifying rollback.

## Grounded leads

- Sony Estonia officially lists 2024-07-17 v8.933 for the exact KD-55XG7096 model, named sony_tvupdate_2017_8933_eff_auth.zip, 289,402,286 bytes; Sony Russia lists 2023-02-15 v8.931 for the same model. **Do NOT cross-region flash based solely on these pages.** The original v8.931 package has NOW been supplied and inspected. The cross-region v8.933 image remains untested.
- https://github.com/theubusu/unixtract can extract several Sony/MediaTek firmware types. It is **not** a repacker.
- https://github.com/danielcamposramos/sony-bravia-linux documents app catalog restoration on 2011-2012 Sony Linux models. Its results are NOT directly established for 2018-2019 sets.
- Android ADB pm uninstall scripts do not apply to this **confirmed Linux** Sony TV.

## Offline tools (Python 3.9+, standard library only)

From the bravia-lab directory:

    python3 firmware_lab.py inspect /path/to/update.pkg --output reports/header.json
    python3 firmware_lab.py zip /path/to/sony_tvupdate.zip --output reports/zip.json
    python3 firmware_lab.py scan /path/to/unpacked-rootfs --output reports/apps.json
    python3 -m unittest discover -s tests -v

Inspect reads the file header, size and SHA256. Zip reports member names and flags unsafe paths without extracting. Scan searches a previously extracted directory for WebApp catalogs, launcher references, manifest files and URLs. This does not bypass signature verification or change a TV.

## Hardware-first procedure before modifying anything

1. COMPLETE: KD-55XG7096, reported v8.931 (full build suffix not yet recorded); see targets/KD-55XG7096.json.
2. Confirm chassis/board/SoC from service documentation or board markings.
3. DONE for original v8.931: supplied by TV owner, SHA-256 and component structure verified. Keep backups and unique device material out of Git. Keep firmware and unique device material out of Git.
4. Determine whether USB updates are encrypted/signed, whether rootfs can be inspected, and whether menus are local files, remote catalogs or both.
5. Find full eMMC/SPI backup route and **verified recovery** before any write to flash; official update package alone is not a full flash dump.
6. If catalog/portal customization works without flashing, validate it first. D-pad input in stock browser must be tested: an HTML app cannot force the built-in pointer layer to release directional keys.
7. Design only reversible changes and test on matching spare hardware before production use.

## References

- Sony exact-model EU support: https://www.sony.ee/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096/downloads
- Sony exact-model RU support: https://www.sony.ru/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096
- Exact-model manufacturer specifications: https://www.sony.ru/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096/specifications
- Third-party repair report (unverified individual board): https://remont-aud.net/dump/lcd_pdp_tv/sony/sony_kd_55xg7096_shassi_main_board_1_983_119_22/302-1-0-150727
- Firmware extractor: https://github.com/theubusu/unixtract
- Pre-Android BRAVIA research: https://github.com/danielcamposramos/sony-bravia-linux

## HOME v2 UI (October 2026)

Runnable offline UI is under `ui/index.html`, `ui/style.css`, `ui/app-data.js`, `ui/launcher.js`. Open `ui/index.html` locally in Chrome/Chromium. Keyboard demo: H = HOME, arrows = D-pad, Enter = OK, Escape = BACK, T = TV. The TV view and service launch statuses are simulated: this is **not a flashable firmware** and does **not** install streaming services.

Visual approach: webOS-like D-pad focus and system dock with dark minimal tiles, compact TV return hero (no cinematic ads), nine brand-tinted app cards (5 + 4), three-layer focus states. Al(co)pac is a backend server which can be paired with MSX/Lampa, not a native Sony executable. For browser reuse stock Vewd; do not ship random Android APKs.

Run automated checks from the `bravia-lab` root: `node --test tests/test_navigation.cjs` and `python -m unittest -v tests/test_firmware_lab.py tests/test_firmware_extended.py tests/test_ui_v2_browser.py`. Python browser tests require Playwright Chromium, locally the suite was run with system `/usr/bin/chromium`. `QA_V2_REPORT.md` has the 141-test result. Chromium is not a substitute for testing the actual Vewd browser and tuner.

## HOME v2.1 — KION

Added КИОН as the tenth app tile, resulting in two complete 5-column rows. Standalone HTML mockup and downloadable ZIP are attached to the conversation. **147/147 local automated checks passed** (69 navigation, 78 Python inspector/browser). Physical Sony remote control, firmware integration and KION playback have not been tested. See QA_KION_UPDATE.md.

## Native Sony system menus (mandatory)

The existing launcher layout remains unchanged. Its SETTINGS, CHANNELS/EPG and INPUTS dock buttons are **native system intents**, not HTML menu replacements. Dedicated Sony remote keys (Settings, Options, Guide, Source, Power, Volume, Channel, Menu, etc.) must be passed to stock firmware unchanged. The current prototype's detail screen is merely an explicit "integration pending" notice if no adapter exists.

`BraviaNativeBridge.openNative('settings' | 'channels' | 'inputs')` is **our proposed adapter contract**, not a documented Sony API. A real implementation and native focus handoff are required before firmware release; the app may not display fake Sony settings. Physical button/overlay validation remains untested and blocking.

**Navigation regression:** after introducing 12 native-intent and remote-key tests, 81/81 navigation/state checks pass in an isolated JS test runner on 2026-10-25. This does not update or replace the earlier browser/firmware suite results.

## Lightweight HOME + safe debloat (v2.2)

Stock HOME redesign is intended to replace its visual app catalog, not Sony's broadcast, tuner or system OSD functions. Ten requested apps remain as tiles. Default body class `performance-lite` removes expensive decorative glow/blur and zoom transitions while retaining matte brand backgrounds and D-pad focus. Original settings, INPUT/SOURCE, OPTIONS, GUIDE, channel lists, analog/digital TV, symbols keyboard, volume OSD, boot/recovery must remain fully native.

Service pruning policy: `PERFORMANCE_AND_DEBLOAT.md`. Offline, **read-only** risk assessment: `python3 audit_bloat.py inventory.json --output reports/service_assessment.json`. Inventory MUST come from verified service/firmware analysis, not guesses. No specific Sony background tracker has been identified or deleted; removing a menu tile does not imply saving RAM.

Offline test run (2026-10-25): **81/81 navigation + 103/103 Python/Chromium = 184/184 PASS**, documented in `QA_LITE_DEBLOAT.md`. Source HTML/CSS/JS/catalog approximately 23.2 KiB, NOT measured device RSS. Signed image, physical TV performance and recovery remain untested. Do not flash.

## Sony v8.931 firmware triage (Stage 1, 2026-10-25)

**Not a custom firmware or real debloat:** the Sony update ZIP has NOT been downloaded here (Sony uses terms-acceptance Download). Current target is KD-55XG7096 / user-reported v8.931; the official file is `sony_tvupdate_2017_8931_eff_auth.zip` (289,426,738 bytes, 2023-02-15).

Tools:
- `python3 firmware_triage.py path/to/sony_tvupdate_2017_8931_eff_auth.zip --output reports/8931_zip_triage.json`: read-only package/header analysis. Does NOT verify firmware signatures or produce a flashable file.
- `python3 rootfs_inventory.py /path/to/unpacked_rootfs --output reports/rootfs_inventory.json`: conservative search for startup scripts, unit dependencies, Sony WebApp catalog candidates and **unclassified** URLs.
- `python3 audit_bloat.py reports/rootfs_inventory.json --output reports/debloat_assessment.json`: keep unknown/native components protected by default, no deletion instructions.

**234/234 local checks passed** = 81 Node D-pad tests + 53 old Python firmware/debloat tests + 50 new Python Sony package/rootfs tests + 50 Chromium UI tests. Full regression command: `bash run_tests.sh`; see `QA_FIRMWARE_STAGE1.md` and `OFFLINE_FIRMWARE_ANALYSIS.md`.

Pending: actual Sony ZIP, valid rootfs extraction, firmware signing/rollback research, device process CPU/RSS/telemetry evidence and physical native-button/TV testing. **Do not flash, sign, disable or remove system services based on this source-only analysis.**

## Native HOME integration — Stage 2 (2026-10-25)

New report: [NATIVE_HOME_STAGE2.md](NATIVE_HOME_STAGE2.md). Verified from the actual owner-supplied v8.931 package: the factory HOME contains Cobalt HTML5UI and a real native `HomeuiInterface` bridge. There is ALSO a separate Sony DockUI binary; physical HOME ownership still needs identification. The stock JS proves the native settings and channels menu action names. It does not provide a confirmed direct HDMI input-selector command.

Added `ui/sony_native_bridge.js` for **offline testing only**, a fail-closed whitelist to invoke the original settings and programme-list menus only when running in a trusted Sony Cobalt HOME context. `ui/index.html` includes the new bridge before `launcher.js`, which avoids re-focusing HTML after native handoff. On a PC, the bridge does not activate: the native Sony object does not exist. This is not a general Vewd/browser app API.

Tests on this iteration: 40 real-firmware static checks, 81 launcher navigation checks, 15 native bridge unit checks, 6 browser checks using a **mocked** HomeuiInterface. **142/142 off-device PASS**, no real hardware tests. No external URL launching, OS commands, file modifications, image re-signing or flashable update.

**Release remains BLOCKED:** NFSB/dm-verity protects the original read-only SquashFS partitions; the separate `3rd_rw` data partition is not evidence of a supported HOME override. Sony documents no firmware downgrade. Recovery, actual HOME ownership and remote-system-menu focus must be validated on matching hardware before any writing.

## Stage 3: Real writable-HOME feasibility and safe debugger probe

[STAGE3_HOME_ROUTE.md](STAGE3_HOME_ROUTE.md) records source-by-source findings from the actual v8.931 owner image. **No writable HOME override was found**; `/3rd_rw/cobalt` is user data, and the boot script **deletes** `/3rd_rw/cobalt/url.ini`. Protected SquashFS mounts use dm-verity, so no modified USB update or production flashing is available.

The stock Cobalt HTML5UI startup includes remote debugging port **9224**. Its TV profile disables the mouse (`enablemouse=0`) and default spatial navigation (`disableSpatialNav=1`). Port reachability depends on binding/firewall/hardware and remains untested.

A non-invasive single-IP tool `cobalt_probe.py` performs three **GET-only** requests on a **private RFC1918** LAN, redacts page titles/URLs, and never sends JS or uses WebSockets. Usage: `python cobalt_probe.py 192.168.1.20` with the **actual** TV LAN IP. Use on trusted networks only and do not port-forward port 9224.

**52/52 tests PASS offline:** 25 owner-firmware file-content assertions and 27 isolated diagnostic-probe tests. Full reproducibility tests and report are in the attached `BRAVIA_STAGE3_HOME_ROUTE.zip`. No TV hardware tests, no signing/repacking/flash tests. The main app/TV integration remains BLOCKED.

## Stage 4 · Installation feasibility (2026-10-25)

Read [STAGE4_INSTALLATION_FEASIBILITY.md](STAGE4_INSTALLATION_FEASIBILITY.md) and [candidate manifest](config/stage4_candidate_manifest.json).

On the real owner-supplied Sony v8.931-1000 image, `/basic/autorun.sh` starts app_man using **am_config and am_start.ini together**. The native DockUI and Cobalt HTML5UI are distinct; original HOME key routing names `dockui`, but static images cannot identify the active runtime display stack. DockUI has a live-code reference to `/3rd_rw/service_list/dockui`; Cobalt HTML5UI has a service_list symlink to `/3rd_rw/service_list`. That is a promising *catalog data* lead, **not evidence that custom HOME can be loaded or apps installed**.

A 10-tile **user-authored Cobalt resource candidate** was packaged for offline research and tested (25 firmware assertions + 16 candidate checks, **41/41 passed**). The full `boot_route_audit.py`, candidate resource pack and tests are downloadable in the user conversation as `BRAVIA_STAGE4_INSTALL_RESEARCH.zip`; the GitHub manifest supplies size/hash verification. No stock Sony assets redistributed.

**Firmware flashing remains blocked.** NFSB/dm-verity protects read-only partitions and no working manufacturer-signed custom update or full-device recovery route has been demonstrated. No physical TV has been modified or subjected to a signing/install test.

## Stage 5: Real BIVL catalog and native application dispatch (2026-10-25)

Read [STAGE5_CATALOG_RESEARCH.md](STAGE5_CATALOG_RESEARCH.md).

**Correction to earlier research:** The `/3rd_rw/service_list/dockui` string in Sony's ARM DockUI launcher is used by an `access(path,R_OK)` check. This proves a readability check, **not** an editable HOME/app catalog. The official OTA does not contain writable `/3rd_rw` partition data. Cobalt `HomeuiInterface.bivlservicelist` offers the more reliable native *registered service list* API.

**Code added:** `ui/sony_catalog_bridge.js`, integrated into `ui/launcher.js` and `ui/index.html`. When a **unique, already-registered** native app is present in genuine Sony HTML5UI context, it passes its real metadata and ID into `HomeuiInterface.LaunchApp()`. Otherwise the app tile shows integration pending. Nothing is installed, no IDs are guessed, and no background requests are made. This does NOT prove all ten media services can run on non-Android Sony Linux.

**Offline checks:** 121/121 Node tests + 7/7 mocked Chromium tests + 11/11 owner-OTA static assertions = **139/139 passed**. Read-only inspector `inspect_catalog_route.py`, its test output and complete source bundle are attached in the conversation as `BRAVIA_STAGE5_NATIVE_CATALOG_RESEARCH.zip`. TV hardware, signed HOME replacement, remote behavior and streaming playback remain **UNTESTED / BLOCKED**.

## Stage 6 (2026-10-25): DockUI is native DirectFB, not Cobalt HTML

**Important correction to the earlier HTML-only implementation approach.** The stock TV HOME key routes to `dockui` in `basic/keymap_tv.ini`. Its ELF `sony/sony_dockui/launcher.bin` is a 32-bit ARM DirectFB application using `libapp_client.so` and `libdirectfb.so`. Cobalt HTML5UI also exists, but replacing its HTML file alone is not a verified replacement for the real TV HOME.

Full report: [STAGE6_NATIVE_INSTALL_GATE.md](STAGE6_NATIVE_INSTALL_GATE.md). A new [portable C99 HOME core](native_core/home_core.c) supports all ten app tiles, D-pad controls, TV-first boot and native action intents with Sony system keys passed through. It was built and host-tested (including ASan/UBSan); it is **not** linked to the Sony native renderer or app manager, and no TV code has been flashed.

Stock service-list permissions are root:system 0770 **during initial permission setup** (not necessarily reset every boot). `/3rd_rw/cobalt/url.ini` is deleted at boot. Browser_base autostart also supplies YouTube/HbbTV and must be protected.

Stage 6 offline evidence: 22/22 live-image static checks, 18/18 Python tests, passing C native test. Full reproducible scanner and source are in conversation download `BRAVIA_STAGE6_NATIVE_INSTALL_GATE.zip` without Sony-proprietary binaries. An installable custom firmware remains **BLOCKED by boot chain, app-loader authorization and unproven recovery**. Sony's Professional BRAVIA HTML5 USB method is not verified for this consumer Linux TV.

## Stage 7: Native C99 renderer + DirectFB adapter (2026-10-25)

**Implemented, committed and tested off-device.** Full evidence: [STAGE7_NATIVE_RENDERER_REPORT.md](STAGE7_NATIVE_RENDERER_REPORT.md).

The [native_core](native_core) folder now includes the first true native drawing implementation: `render.c` draws the 10 service tiles, TV-return hero and dock at five tested screen sizes using 61 deterministic draw commands on HOME and **0 draw commands on TV**. No HTML, no image decoding, no timers, no network, no heap. `directfb_backend.c` maps those commands to **standard DirectFB 1.x** drawing methods using a supplied surface and cached fonts; it does not grab the Sony screen or native tuner layer. `host_dispatch.c` models safe handoff to native Sony system menus and remote keys, with failure rollback and no fake success.

Run `cd native_core && make test adapter-test`. All checks passed locally with C99 `-Wall -Wextra -Werror` and sanitizer checks. The DirectFB test uses a **mock header**, not real Sony libraries, since compatible DirectFB headers are unavailable here. A real 32-bit ARM build, Sony libapp_client integration, signed loader and recovery are still **BLOCKED / UNTESTED**.

The user-visible `BRAVIA_STAGE7_NATIVE_DIRECTFB_SOURCE.zip` contains reproducible source, mock tests, report, local-preview rasterizer and actual 720p/1080p PNGs generated from the compiled C command renderer. No fonts or proprietary OEM binaries are shared.

## Stage 8 — real Sony libapp_client ABI + freestanding ARM core (2026-10-25)

[Full Stage8 report](STAGE8_ARM_ABI_RESEARCH.md). The owner-supplied original v8.931-1000 was inspected **read-only**. Verified 32-bit ARMv7 EABI5 ELF dependencies and real dynamic symbols in `/basic/libapp_client.so`; native DockUI builds a **60-byte** `am_client_init` registration record with seven callback slots and name offset +36.

The exact callback signatures and app-manager IPC are **still unknown**. It is not safe to call them by guessing, and the code does **not** call into the proprietary library. Added [Stage8 source](stage8): ABI layout documentation, 15-check read-only ELF auditor and Clang+LLD ARM object build script. Refactored `native_core/render.c` to remove libc and 64-bit division runtime helper; generated a ~16 KB **ARM32 ET_REL object** with zero undefined external function symbols, **not a Sony executable or OTA update**.

Offline verification: **15/15 original-library ABI assertions + 15/15 additional unit checks + passing C99 renderer/nav/DirectFB-mock test suite**. The portable archive `BRAVIA_STAGE8_ARM_ABI_RESEARCH.zip` contains source/tests/report and an actual ARM relocatable object; no original Sony binary/DRM material. Sony hardware, callbacks, real DirectFB ABI, installer and recovery remain **blocked/untested**.

## Stage 9 — real Sony app_man IPC and native lifecycle (2026-10-25)

Read [STAGE9_SONY_IPC_REPORT.md](STAGE9_SONY_IPC_REPORT.md). In the **real owner-supplied v8.931** binaries, native `app_man` has FIFO/pipe functions; `libapp_client.so` uses local pipe/read/write/select/threads and stores the native registration pointer; original DockUI contains seven callback wrappers and registration data. The client exposes the format string `\\n:%s,%s,%s:%s\\n`; the exact field semantics and manager parsing are **still unverified**. There is no active IPC sender and no fake Sony app registration.

Implemented [safe standalone lifecycle state machine](native_core/sony_lifecycle_model.c) which models started, paused, resumed, stopped, shutdowned and wakeuped events and blocks rendering when Sony's native OSD owns focus. Host lifecycle and sanitizer tests passed. **21/21 real-ELF static checks plus 24/24 offline Python tests** passed. The experimental ARMv7 EABI5 relocatable lifecycle object is ~2.5 KiB and has no external runtime calls. User-download `BRAVIA_STAGE9_SONY_IPC_NATIVE_LIFECYCLE.zip` includes complete analyzers, tests and the object, **excluding original proprietary binaries**.

**NO-GO for flashing.** Full native callback C ABI, transport framing/authorization, Sony app-client host and device recovery still require independent verification on matching hardware. Native TV, volume, guide, settings, options, HDMI, tuner and analog/digital remote functions remain protected.

## Stage 10 — owner-OTA original ARM callbacks and partial IPC reconstructed

**Real original binaries were re-extracted** from the owner-supplied Sony v8.931-1000 ZIP in this stage. [Detailed evidence](STAGE10_ORIGINAL_IPC_ABI.md).

ARM disassembly of original `launcher.bin` callback slot assignments and real `libapp_client.so` PLT imports proves seven registration slots: `am_resumed`, `am_paused`, `am_stopped`, `am_shutdowned`, `am_suspended`, `am_wakeuped`, plus a no-op callback. Their offsets are 0..24 in the 60-byte record, name `dockui` at offset 36. The command constructor `am_send_cmd` also uses a proven newline-delimited `\n:%s,%s,%s:%s\n` format with process name and literal `am`. This is only *partial* IPC evidence, not a verified end-to-end protocol.

Added [Stage10 callback ABI documentation and source](stage10), with offline SHA-pinned original-ELF verifier, C99 descriptive callback layout and test program. Full reproducible analyzer, JSON metadata, **15/15 Python tests** (including 4 real-image tests and tamper rejection), C test and ARMv7 EABI5 object are available in the conversation artifact `BRAVIA_STAGE10_REAL_IPC_ABI.zip`. Original Sony executables, firmware, protected code, keys and DRM are excluded.

**Important:** C callback prototypes/r2 role, IPC responses, native render/remote focus, supported loader and full recovery are **NOT verified**. No `am_client_init` call, IPC send, app installation, flash or modification of the TV.

## Stage 11 — Real Sony app-manager IPC transport, beyond callback names

See [STAGE11_IPC_TRANSPORT_AUDIT.md](STAGE11_IPC_TRANSPORT_AUDIT.md). Original owner-supplied v8.931-1000 ELF files were re-extracted and verified against their exact SHA256 digests. The `libapp_client.so` initializer has **five** `pipe()` calls (not three: earlier partial research counted only the first three) and `am_client_init` starts two threads.

The three real outbound helpers `am_send_cmd`, `am_send_cmd_to_remote`, and `am_send_raw_cmd` use `snprintf`, `pthread_mutex_lock`, `write`, `pthread_mutex_unlock`. Their text templates are now verified; the senders don't wait for a synchronous application-level ACK. A successful helper return is **NOT** evidence Sony executed the requested command. A separate 127-byte bounded read and event dispatcher route the input tokens `pause`, `resume`, `stop`, `shutdown`, `suspend`, `wakeup`, `foregm`, and `backgm` to exact registration offsets. The latter two are **outside the seven populated callbacks observed in native DockUI**.

**Code**: [stage11/ipc_observer.c](stage11/ipc_observer.c) is a read-only no-transport token observer, not a Sony IPC driver. Offline tests: **22/22 Python checks against original OEM binaries**, passing C99 host test and AddressSanitizer/UBSan; a small ARMv7 EABI5 relocatable object was built. The standalone `BRAVIA_STAGE11_IPC_TRANSPORT.zip` contains the full read-only SHA-pinned `audit_transport.py`, source, tests, report, metadata JSON and ARM object. The ZIP includes **no Sony binaries, signed update, DRM or keys**.

**DO NOT FLASH**: Real callback argument types, stream framing, native display/input permissions, authorized loader, full-device recovery and true end-to-end IPC behavior remain unknown.

## Stage 12 — real Sony IPC relay and callback argument registers (2026-10-25)

[Full Stage12 findings](STAGE12_DISPATCH_AND_FRAMING.md) from the **original owner-supplied v8.931-1000**, inspected read-only.

**Correction:** `libapp_client.so:0x1d20` reads up to 127 bytes and relays them to a second descriptor (calls `read`, `strlen`, `write`, `close`); it is **not** the actual event-token decoder. The decoder at `0x1e58` is called separately by the worker and uses `strncmp(...,20)`. Direct ARM callback call sites show ordinary events receive r0/r1 from the dispatcher plus r2=0, while one fallback path forwards all three values. This is *not* proof of their C pointer types, lifetimes or acceptance semantics.

A special decoder path reads a potential handler at offset +56. The stock DockUI registration was measured as 60 bytes with process name starting at +36. Their structural relationship remains unknown; **do not invoke the +56 branch or guess a larger registration record**.

Implemented [stage12](stage12): SHA-pinned read-only 20-check ARM analyzer plus a freestanding C99 **outbound-only** `am_send_cmd` formatted-text observer resilient to partial and combined chunks, with no network/device IPC transmit. Locally verified **20/20 true ARM binary assertions**, **17/17 Python tests** and **30 synthetic fragmentation modes**, C99 tests and ASan/UBSan PASS, and ARMv7 ELF32 ET_REL build PASS. Full original-ELF audit tests and the compiled ARM object are in the user downloadable `BRAVIA_STAGE12_DISPATCH_FRAMING.zip` (excludes Sony firmware, executables, keys, DRM).

**Still BLOCKED:** actual *inbound* IPC framing, callback prototypes and application acknowledgements; authorized native DirectFB Sony launcher, flash verification and full TV recovery. No hardware test or installable firmware has been produced.

## Stage 13 — actual Sony installer/recovery gate (2026-10-25)

**[Read the Stage13 findings](STAGE13_INSTALL_RECOVERY_GATE.md)**. The real, owner-supplied v8.931 Sony ZIP and extracted partitions were checked: **19/19 original-firmware checks** and **30/30 Python tests**. Full read-only auditor, LZO SquashFS reader, tests, manifest, test log and Russian-language report are in the conversation archive `BRAVIA_STAGE13_INSTALL_RECOVERY.zip` (not in this GitHub repo because no proprietary image or keys are distributed).

New evidence: Sony's OTA `ixml` names **two target partitions for kernel (9/10) and rootfs (11/12)**, but only single targets for the two application images (15/16). These are metadata fields, **not proof of an automatic rescue bank**. `/etc/checker.sh` is gated on `file_upgrading` kernel parameter and handles `download.xml` + `*.tgz`, not normal custom-app installation. `manual_launch` is a boot-argument-oriented tool and the UART console is boot-parameter gated. None is a safe user installer. Existing Sony HOME uses a fixed native DockUI binary inside read-only dm-verity SquashFS; `/3rd_rw` does not establish a writable HOME override.

Sony now lists firmware **v8.933** (2024-07-17) for KD-55XG7096. Official v8.931 USB update instructions explicitly disallow installing older software. A factory reset restores settings, **not a damaged boot partition**. The stock USB ZIP is not a full eMMC dump. Consequently **DO NOT attempt modified ZIP flashing**. Native application loading, OEM authorization and physical full-device recovery remain unverified.

**Release decision remains NO-GO** for changing the working TV. Future research requires an authorized loader and independently recoverable spare hardware. We will not try unsafe boot flags or pretend the compiled ARM ET_REL object is a deployable Sony HOME.

## Stage 14: Native HOME product iteration (2026-10-25)

**Actual product changes, not further firmware reverse-engineering.** The [Stage14 release report](STAGE14_NATIVE_PRODUCT_UPGRADE.md) documents a refreshed lightweight dark TV UI with a ten-tile 5×2 app layout, improved D-pad focus, no fake TV video, and per-service states (`UNKNOWN`, `READY`, `UNAVAILABLE`) determined only by a future authorized native host. Missing native services fail closed rather than launching guessed applications. "Last dispatch" means the host accepted a request, **not proven playback**.

All updated C99 source and tests are in [native_core](native_core), with a reproducible ARMv7 ET_REL build, visual preview generator and auxiliary checks in [stage14](stage14). Off-device: all five C test programs pass, 10/10 artifact checks, 10,000 synthetic remote events, ASan/UBSan pass and a ~15 KB ARM EABI5 ET_REL with no unresolved global imports. C render command previews exist at 720p/1080p and 26 native-command snapshots power the interactive HTML simulator bundled in the user-visible ZIP `BRAVIA_HOME_STAGE14_NATIVE_PRODUCT.zip`.

**No TV installation claim.** Sony proprietary DirectFB/app_manager integration, on-device tests, recovery and signed native loading remain unresolved. Do not flash the ZIP.

## Re-audit / real GitHub CI status (2026-10-25)

**Read the [GitHub CI re-audit report](CI_REAUDIT_2026-10-25.md)** before quoting any test numbers. The branch now has a real GitHub Actions workflow [BRAVIA Offline CI](../../.github/workflows/bravia-offline-ci.yml). Hosted runs **failed before runner assignment**, with `runner_id=0` and no executed job steps. **GitHub CI is NOT green**. Independently, **390 archived-source Python/JS/Chromium tests passed locally** along with native C99, mock DirectFB, Stage9-12 IPC, ARM ET_REL builds and sanitizer checks; these are not equivalent to a passed GitHub-hosted CI or actual Sony TV hardware support.

Fixed Stage14 clean-checkout paths, absent preview output directory, non-executable shell invocation; restored Stage9 lifecycle regression test. The original manufacturer firmware and private Sony binaries remain outside GitHub.
