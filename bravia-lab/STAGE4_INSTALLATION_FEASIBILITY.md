# KD-55XG7096 Stage 4 — installation feasibility (2026-10-25)

**Original owner-supplied firmware analysed:** v8.931-1000, read-only. **No modified firmware, USB installer or flashing.**

## New verified boot and HOME paths

- `root:/basic/autorun.sh` runs `/basic/app_man -c /basic/am_config -s /basic/am_start.ini -input_fifo`. **Both configs are used together**.
- `root:/basic/am_config` contains `sony_dockui` invoking `/3rd/sony/sony_dockui/launcher.bin`; `root:/basic/am_start.ini` contains Cobalt `html5ui` with fixed `file:///html5ui/index.html`.
- `root:/basic/keymap_tv.ini` has `ROOT_MENU=dockui(stop)[start]` in TV/menu contexts. Actual owner of physical HOME and real runtime process state remain **unknown**.
- `root:/basic/DockUI.xml/DockUI.xml` contains native menu, Opera, YouTube and Netflix launcher commands; `3rdp:/bin/dockuirc` includes the 1280x720 DockUI layout.
- `root:/etc/rc.d/rc.local` conditionally executes `/3rd/run.sh`, but no `/run.sh` appears in supplied 3rd2/3rdp files. This is **not** a verified writable installation route.
- `root:/etc/scripts/ext4_mount_3rd.sh` mounts `/3rd_rw`, but **deletes** `/3rd_rw/cobalt/url.ini` on startup.
- `root:/etc/scripts/dmverity_mount_emmc_3rd_ro.sh` mounts protected SquashFS through dm-verity. Decryption of the update does not grant permission to sign a modified OTA.
- **New possible catalog lead:** `3rd2:/cobalt/content/web/html5ui/service_list` is a symlink to `/3rd_rw/service_list`. The proprietary Sony DockUI launcher binary contains the string `/3rd_rw/service_list/dockui`. This is **not evidence** that owner access, write permissions or the catalog format are available.

## Engineering decision

| Approach | Disposition |
|---|---|
| Replace list of service tiles via `/3rd_rw/service_list` | RESEARCHABLE, format and access unknown |
| Replace Cobalt HOME with our own ten-tile HTML5 resource pack | OFFLINE CANDIDATE READY, native loader/actual active HOME not proven |
| Repack original SquashFS and install via Sony USB update | BLOCKED by integrity/signing and no proven recovery |
| Preserve stock TV, `dtv_svc`, keymaps, GUIDE, HDMI, MENU, OPTIONS, remote/DRM | MANDATORY |

## Evidence and deliverables

On the owner's original extracted firmware, **25/25 static path/configuration checks passed**, and **16/16** checks passed against an authored, no-OEM-asset, **non-flashable** Cobalt HOME resource candidate. **41/41 total**; no physical-TV test.

Reproducible offline source, manifest, SHA256 asset list and test results are in the user-visible `BRAVIA_STAGE4_INSTALL_RESEARCH.zip`. No Sony binaries, original OTA, DRM or unique keys are distributed. The candidate's television screen is a **simulation**, not real broadcast video.

**BLOCKERS:** ascertain active HOME renderer on the actual unit; characterize contents of writable `/3rd_rw/service_list/dockui`; verify a supported way to supply UI resources without editing protected sections; confirm recovery before any flash. This stage deliberately does not claim a working installer.

Reference: https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/verity.html

