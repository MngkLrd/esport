# Stage 13 — installation/recovery gate, real Sony v8.931 (25 October 2026)

**Target:** KD-55XG7096, non-Android Linux, original owner-supplied Sony v8.931-1000 ZIP. **No device modified. No flashable patch.** Complete sources and test artifacts are in conversation bundle `BRAVIA_STAGE13_INSTALL_RECOVERY.zip`.

## Original image facts, verified by 19 read-only checks

Original OTA ZIP SHA-256: `9fedce4521bb3b9d2fc0d8e8a19d31a795752026d1a17249b1ccf712c25b606c`.
Actual manufacturer `ixml` for `Unicorn_PAD` and v8.931-1000 shows **two partition targets** for kernel and root, but a single target for each separate 3rd-party app partition:

| Image | PATH | PATH2 |
|---|---:|---:|
| `kern` | 9 | 10 |
| `root` | 11 | 12 |
| `3rd2` | 15 | — |
| `3rdp` | 16 | — |

**Critical:** This alone does NOT prove an A/B fallback, automatic rollback, safe bank switching or recoverability. The real eMMC state, update sequencing and bootloader selection logic were not observed.

- `etc/rc.d/rc.local`: `/etc/checker.sh` executes only when the kernel command line contains `file_upgrading`.
- `etc/checker.sh`: uses `/fw_upgrade/download.xml` and scans `*.tgz` on USB in that gated service mode, distinct from the official user-facing Sony ZIP/PKG updater. It is **not** a demonstrated app installer.
- `etc/scripts/manual_launch.sh` and `auto_launch.sh`: call Sony's `fw_printenv` with special `+/- bootargs manual_launch` arguments. The exact effect of this nonstandard tool is **unverified**. Never instruct users to run it as an installer.
- `etc/scripts/usb_console.sh`: requires `ttyUSB` in boot arguments before starting `getty` on `ttyUSB0`; plugging a USB drive is not an access method.
- `etc/rc.d/rc.local`: conditional `/3rd/run.sh` hook; `run.sh` is missing from the actual original protected 3rdp SquashFS.
- `etc/scripts/ext4_mount_3rd.sh`: app-data partition mounts as `/3rd_rw`; on initial setup `/3rd_rw/service_list` is set to `root:system`, mode `770`; `/3rd_rw/cobalt/url.ini` is explicitly removed.
- `etc/scripts/dmverity_mount_emmc_3rd_ro.sh`: the native DockUI app partition mounts via a `verity` device as read-only SquashFS.
- `basic/autorun.sh` starts `app_man` with both config files. The Sony DockUI binary path is fixed in `basic/am_config` to `/3rd/sony/sony_dockui/launcher.bin`.

The original Sony ZIP does not include a complete dump of the particular television's eMMC, recovery metadata, user partitions or device-specific data. **Do not confuse it with a known-good full backup.**

## Independent manufacturer context

Sony publishes **firmware v8.933 (17 July 2024)** for KD-55XG7096: https://www.sony.ee/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096 . The Sony original v8.931 support instructions explicitly reject software downgrades: https://www.sony.ru/electronics/support/lcd-tvs-xg70xx_x70xxg-series/kd-65xg7096/software/00287627 . Keeping this v8.931 ZIP is **not** a proven path to downgrade from v8.933.

Sony's non-Android factory reset can restore *user settings*, but is not a full boot firmware repair procedure: https://www.sony.co.uk/electronics/support/televisions-projectors-lcd-tvs/kd-55x7053/articles/00032661 .

## Reproducible implementation

Owner-original ZIP and decrypted root/ixml/3rdp were audited with `source/install_gate_audit.py` (read-only SHA256-pinned manifest and SquashFS check) included in the **conversation bundle**. It produces a sanitized JSON report of all installation routes and their statuses.

- **19/19** direct original-OTA/source-config assertions passed.
- **30/30** Python tests passed, including real original files, deliberately wrong digests, bogus ZIP metadata, malformed XML and incomplete partition manifests.
- No Sony proprietary binaries, original update, private keys or DRM are shipped in the tool package or GitHub.

## Install verdict

| Gate | Status |
|---|---|
| Offline C99/ARM HOME development | OPEN |
| Authorized native ARM executable loader on physical XG7096 | NOT VERIFIED |
| Native Sony UI surface/app manager ABI on device | PARTIAL RESEARCH ONLY |
| Modified update signature and verity acceptance | NOT VERIFIED |
| Full eMMC backup and hardware recovery | NOT AVAILABLE |
| User-flashable custom HOME update | **NO-GO** |

**Concrete next action:** find the manufacturer-approved native app loader / qualified service bench procedure, obtain a physically recoverable spare board and full-device backup, and test on spare hardware before ever writing the owner's working TV. Do not enable undocumented boot flags or feed unsigned firmware into Sony's updater.
