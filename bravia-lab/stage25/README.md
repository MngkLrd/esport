# Stage 25 — Original v8.931 firmware recovered, static DockUI path experiment

The owner re-uploaded the exact Sony `sony_tvupdate_2017_8931_eff_auth.zip` on 26 October 2026. Its original SHA-256 matches previous research byte-for-byte. Unlike earlier source-only stages, the present session extracted `root`, `3rdp`, `3rd2` NFSB/SquashFS 4.0 LZO contents from the MediaTek PKG and verified all three original vendor ARM ELF SHA-256 pins.

See [VERIFIED_OEM_FACTS.json](VERIFIED_OEM_FACTS.json) for checked sizes, hashes, version, DockUI paths, autostart, and explicit installation caveats.

**Key conclusion:** real native HOME is `/3rd/sony/sony_dockui/launcher.bin`; `ROOT_MENU` routes to `dockui(stop)[start]`. The original `DockUI.xml` contains only eight legacy entries, so it cannot be treated as the complete modern HOME catalogue. The launcher reads/checks `/3rd_rw/service_list/dockui` using `access(path,R_OK)`; that is not a proven writable installation API.

A **private-only offline binary experiment** replaced the exact string `/basic/DockUI.xml` with `/3rd_rw/home.xml` in an SHA256-pinned copy of the original ARM32 launcher. Only 16 bytes changed; original ELF size and all `.text` bytes remain identical. The changed ELF does **not** preserve NFSB/dm-verity integrity, is not a trusted Sony update, and has not been run on any television. The hypothesis that this XML controls the actual visible launcher is unproven.

A reproducible source kit `BRAVIA_STAGE25_REAL_SONY_8931_OFFLINE_PATCH_RESEARCH.zip` has been attached to the user conversation. It contains source-only owner PKG extraction using environment-provided keys, an independent read-only LZO SquashFS 4.0 selected-file reader, exact OEM config audit, offline patch experiment, 11 passing local Python tests, SHA manifest, and our pre-existing authored ARM32 HOME research binaries. **No Sony binaries, vendor proprietary files, keys, DRM or original OTA are distributed.**

**The Sony consumer USB installer remains unavailable.** The original signed/verity-protected update and missing Sony native executable loader cannot be replaced by placing an ELF on FAT32 USB. This is not an installable update; do not flash it. Existing native television, HDMI, audio, EPG, channel, options, settings, Sony browser/DRM, and firmware recovery are never altered.

Other supported observations: `browser_base` and `globoplay` have `start_self=true` in original configurations; Samba ACR factory default is `enabled=false`. No active-device network traffic, consent state, CPU consumption or savings were measured.
