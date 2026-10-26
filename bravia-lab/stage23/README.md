# Stage 23 — native ARM32 HOME and installer feasibility

**Target:** Sony BRAVIA KD-55XG7096, user-reported firmware 8.931-1000-4.000-0000. **Not an installable Sony update.**

## Significant new native milestone

Stages 14–22 previously provided a C99 HOME and ARM32 relocatable object. Stage 23 now links the UI/state machine, real C renderer and ten-app catalogue into one **ELF32 ARM EABI5 ET_DYN shared object**, `libbravia_home_armv7.so`.

Sources: `native_core/bravia_plugin.[ch]`, `stage23/exports.map`. Build: `sh stage23/test_native_plugin.sh` from `bravia-lab/`. The linker script exports only the versioned `bravia_plugin_*` API (`BRAVIA_1.0`) and hides internal entry points. The binary is freestanding, contains no `DT_NEEDED` external runtime libraries and does not perform network requests, telemetry, or Sony IPC.

Its host callback contract includes:
- ABI version negotiation and caller-owned memory;
- real host registry of already registered applications (unknown app stays UNKNOWN);
- launched service ID only after unique verified host match;
- original Sony-system action callback and reserved key pass-through;
- renderer callback producing HOME draw commands; TV view emits zero draw calls.

The native host test `stage23/test_native_plugin.c` checks 94 UI commands, TV safety, the new routing layer, OPTIONS and system keys, unknown applications, registry removal, bad ABI and object reset. This test is **synthetic**; host callback API belongs to our project and is NOT Sony's `libapp_client` ABI.

## Installer path — exact remaining blockers

`stage23/installer_gate.py` accepts the owner-held exact Sony v8.931 ZIP and extracted reference ARM ELF files and verifies original SHA-256 pins, ARM32 ELF class, linked libraries, path traversal, archive integrity limits. No bytes are ever written back into the OTA. Its outcome deliberately remains `NO_INSTALLER` even when original reference files match.

Why:
1. Stock Sony `sony_dockui/launcher.bin` lives on a read-only NFSB/dm-verity-protected SquashFS.
2. No verified customer USB workflow loads user-built ELF modules, and Sony's official USB process expects its own authorized update.
3. `libapp_client.so` registration/framing/callback lifetime and graphics focus are only partly reconstructed.
4. No validated full eMMC backup and board-specific restoration procedure.
5. Streaming services absent on this Linux device require separate native clients; relabeling a tile or repacking a launcher does not install them.

`stage23/service_policy.py` identifies legacy tiles to hide separately from the background services requiring review. It always preserves tuner, HDMI, sound, `dtv_svc`, `app_man`, `browser_base`, DRM and OTA. It does not delete services or claim CPU benefits without measurement.

## Development commands

```sh
cd bravia-lab
sh stage23/test_native_plugin.sh
python3 -m unittest -v stage23/test_tools.py
python3 stage23/installer_gate.py
python3 stage23/service_policy.py
```

The linked ARM32 library is a genuine forward step toward a Sony native host adapter, not a finished, signed USB installer. Never submit the Stage23 library or research ZIP to Sony Software Update.

A fully assembled development-only ZIP with prebuilt ARM32 shared library, Linux dlopen smoke test, scripts, integrity manifest, offline OTA/ELF analyzer, and nine Python regression tests is available as `BRAVIA_STAGE23_NATIVE_INTEGRATION_KIT.zip` in the conversation download, not in the GitHub repository. The ZIP includes **no** OEM Sony firmware, signatures or DRM keys.

**Next milestone:** obtain matching original Sony ELF files privately, complete `app_man`/DirectFB host binding, and determine a real recoverable installation route. The feature branch isolates all development from `main`.
