# Stage 19 — keep stock native Sony HOME appearance; replace its contents

Target: Sony BRAVIA KD-55XG7096 (non-Android Linux; original firmware v8.931-1000 research).
Status: **OFFLINE REQUIREMENTS AND FAIL-CLOSED TESTS ONLY**. Do **not** install/flash the JSON.

## Decision from owner's photo and requirements

Owner is satisfied with the visual appearance of the original four-column Sony menu.
Do not replace stock HOME with a browser page; prefer retaining Sony's native
menu appearance **if** it can be safely reconfigured. The earlier custom C99 UI
is preserved as a fallback/standalone native renderer, not the compulsory design.

The stock Apps row and all existing vendor shortcuts are removed from the
**new menu**, including icons whose names happen to match the desired catalog.
The **new** row has the owner's ten selected services: Кинопоиск, Иви, START,
Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac, Браузер, КИОН.
This is a desired catalog, **not a claim that ten compatible binaries exist**.
Where an existing Sony installed app is usable, the user-defined new tile can
dispatch to that existing application. Otherwise a genuinely compatible Sony
Linux native app or supported web/service client must be developed/verified
first. Android APKs do not become Sony Linux applications by copying them.

Preserve / expose:
- **Каналы:** Sony's real programme list and Guide plus *actual* recent or
  frequent channels only when the native host provides reliable data. No
  fabricated view frequency, tuner or EPG.
- **Носитель:** photo/video/audio preview from USB through Sony's original
  decoders, presented from our HOME. The media decoding capability is not
  removed when obsolete HOME shortcuts are hidden.
- **Настройки:** Sony's system settings, network configuration, customer
  support and help manual, plus untouched OPTIONS, RETURN/BACK, audio/video,
  source input and volume controls.
- **Записи:** remove the UI row for title/timer/error lists and manual recording
  timer. This is **visual removal only**, not deletion of tuner, drivers,
  storage, schedule or operating-system recording facilities.

Hide old app row, unnecessary vendor marketing tiles, radio and clock
shortcuts. Do **not** interpret this as deleting the old vendor binaries:
`browser_base`, authentication, device key store and DRM can be dependencies
of desired streaming apps. Remove optional background jobs only after live
resource/network measurements and proven independence.

This is encoded by `stock_dockui_target.json` and validated by
`test_stock_dockui_target.py`.

## What original firmware analysis actually proves

- `root:/basic/keymap_tv.ini` maps ROOT_MENU to Sony DockUI;
- `root:/basic/am_config` registers
  `/3rd/sony/sony_dockui/launcher.bin`;
- launcher is native ARM32 EABI DirectFB, imports `libapp_client.so`.
- Stock `/basic/DockUI.xml/DockUI.xml` contains legacy action definitions,
  but **does not prove all tile/row data are XML-configurable**.
- `/3rd_rw/service_list` is permission controlled and is **not a verified
  writable third-party install/catalog interface**.
- DockUI app binaries are held in a verity-protected read-only 3rdp SquashFS.
  Modified unsigned Sony OTA, protected partition writes, bootloader flags,
  or replacement of `launcher.bin` are **NOT authorized/validated on this TV**.

Consequently: **we cannot currently claim we can replace the original menu
by simply deleting icons or copying our files to FAT32 USB.**

## Next reproducible native investigation, in priority order

1. Compare original `launcher.bin` string/data references to
   `DockUI.xml` and `service_list` (privately held original OEM files).
   Distinguish *compiled menu structure* from *dynamic service list*. The
   existing read-only Stage10–13 auditors are a starting point; no Sony ELF
   or keys are committed to GitHub.
2. Recover the app tile binding table (symbolic service ID -> native launch
   route), and the callback interactions used for native Guide, channel list,
   USB media and settings. Map buttons without sending unverified IPC.
3. Decide based on actual evidence: **configuration-based catalog change**
   if Sony exposes a supported write interface, otherwise a separately built
   native DockUI-compatible binary requiring an approved loader and recovery.
4. Map each requested app to a working Sony-native client or plan a port.
   Record not supported separately from not installed and from playback failure.
5. For privacy, disable Samba/ACR using built-in opt-out if currently enabled,
   then passively measure system traffic; no blind service deletion.
6. Only start live native integration when the original SDK/ABI, legal launch
   mechanism and board-level recovery are independently verified.

## Hardware observations so far

- FAT32 media USB recognizes and opens JPGs.
- Stage17 renderer JPGs display in Sony's native photo viewer with legible text.
- This is **not** successful installation, ABI linking, live HOME takeover or
  remote input in our executable.

**Release gate:** HOME replacement **NO-GO** until supported reversible
execution and recovery exists; offline layout/service mapping **GO**.
