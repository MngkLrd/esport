# BRAVIA KD-55XG7096 — Stage 3, real firmware v8.931-1000

**Result:** No proven writable HOME override; confirmed possibility to check the stock Cobalt debugging frontend **without flashing**. These are offline findings from the owner's real Sony OTA, not assumptions about current TV runtime.

## Evidence found in the real firmware

| File in decrypted read-only filesystem | Verified evidence | Meaning |
|---|---|---|
| `root:/basic/am_start.ini` | `/_3rd/cobalt/cobalt --app_type=html5ui --url=file:///html5ui/index.html --remote_debugging_port=9224` | Original HOME has a fixed file URL and a configured debugger, but LAN access isn't proven |
| `3rd2:/cobalt/apps/html5ui/cobalt_profile.ini` | `enablemouse=0`, `disableSpatialNav=1`, 1920x1080 | Dedicated remote-friendly Cobalt profile; custom JS must control focus |
| `root:/basic/3rd_ini/cobalt/global_env_setup.ini` | `COBALT_DATA=/3rd_rw/cobalt` | Persistent data directory; does **not** establish HTML source override |
| `root:/etc/scripts/ext4_mount_3rd.sh` | ext4 writable /3rd_rw, plus `rm /3rd_rw/cobalt/url.ini` on mount | A possible URL-override candidate is explicitly deleted on startup |
| `root:/etc/scripts/dmverity_mount_emmc_3rd_ro.sh` | dm-verity mapper mounted SquashFS read-only at /3rd | Protected filesystem cannot be safely patched and flashed by simple ZIP rebuilding |
| `root:/basic/keymap.ini` | volume, channel, source, analog/digital and native key actions route to dtv_app_mtk | Preserve Sony's system UI and TV handlers |
| `root:/basic/am_config` | Separate sony_dockui and html5ui components | On-device active HOME owner still requires verification |

The profile specifies `cpu_memory_limit=250` and `gpu_memory_limit=150`; no units or real RAM usage have been verified. The same Sony config sets `#userjs_path=` (commented), **not an enabled injection route**.

## Disposition

- **Flash/update:** BLOCKED. No verified alternative asset loader, signing/recovery chain, or device backup exists.
- **Writable HOME from /3rd_rw:** NOT DEMONSTRATED. Do not assume a writable partition implies override.
- **Read-only inspection:** Candidate available. The stock service may expose the Cobalt web debug frontend on TCP **9224** (if bound to local LAN). Cobalt's own documentation describes the frontend, separate from Chrome's native remote debugging.
- **Next real-device test:** On a *trusted private LAN only*, while stock Sony HOME is open, visit `http://<TV_LAN_IP>:9224` from a computer. If available, inspect the current page/actual key routing without modifying runtime state. Do not port-forward it or expose the debugger externally. The service may be unreachable; that is inconclusive.
- All user-requested apps, settings, GUIDE, inputs, audio, channel list, and analog/digital key functions remain under the TV-first preservation contract.

## Tests

**52/52 offline PASS:** 25 checks of decoded *real original* root/3rd2 settings and keymap + 27 isolated mock tests of a single-IP, GET-only diagnostics probe. Zero physical-TV tests, zero firmware writes. No Sony firmware binaries or DRM material in this repo.

A runnable, local-only probe and full test suite are available as the conversation artifact `BRAVIA_STAGE3_HOME_ROUTE.zip`. The probe limits its requests to exactly one RFC1918 IP on port 9224 and redacts any TV page titles or URLs from output.

Sources: uploaded v8.931 Sony OTA (primary); [Cobalt developer documentation](https://cobalt.googlesource.com/cobalt/+/2a7ca251b51753bba8afabd57b295758170d1fd3/src/cobalt/doc/web_debugging.md) (debugger background).
