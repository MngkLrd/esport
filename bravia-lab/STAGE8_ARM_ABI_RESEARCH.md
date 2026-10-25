# Stage 8 — Sony native app-client ABI, 2026-10-25

Target: consumer Sony BRAVIA KD-55XG7096; owner-supplied original v8.931-1000.
**READ-ONLY ORIGINAL OTA AUDIT. NEVER FLASH THIS WORK.**

## Verified native binary facts

Read from decrypted (privately held) root and 3rdp SquashFS:
- `/basic/libapp_client.so`: ELF32 ARMv7-A EABI5 shared library (VFPv4), 34,540 bytes.
- `/3rd/sony/sony_dockui/launcher.bin`: ELF32 ARMv7-A EABI5 executable (VFPv4), 125,080 bytes, dynamic loader `/lib/ld-linux.so.3`.
- Launcher imports `libdirectfb.so` and `libapp_client.so`, plus older 32-bit Sony platform dependencies.
- Confirmed from `readelf --dyn-syms`: `am_client_init`, `am_client_uninit`, `am_started`, `am_stopped`, `am_send_cmd`, `am_send_cmd_to_remote`, `am_send_raw_cmd`, `am_get_focus_process_name` are true exported library functions, **not assumed external APIs**.
- The original launcher imports initialization and lifecycle event functions; `am_send_cmd` is **not** directly imported by that original launcher.
- Original ARM instructions at launcher `0xa0ac` zero-initialize 60 bytes; subsequent stores populate **seven callback pointer slots**; a seven-character process name `dockui` is written at offset **0x24/36**; it calls `am_client_init` through PLT `0x9298`.
- Library `am_client_init` at ELF address `0x3394` receives the pointer in r0, reads name via +36 and appears to store the pointer for later use. Callback signatures and lifetime semantics require more static investigation.

## New build

The existing C99 HOME core, renderer and native-intent model were made freestanding, removing `memset` and 64-bit division helper calls. Successfully cross-compiled via **Clang 17 + LLD** to `armv7-linux-gnueabi` with `-mfpu=vfpv4 -mfloat-abi=softfp`.

- `stage8/bravia_home_armv7_relocatable.o` is ET_REL / EM_ARM / EABI5.
- `readelf -Ws` confirmed **zero undefined global external symbols** in the object.
- Linked ARM object: ~16 KB uncompressed. This is **not** an ARM executable, not linked to Sony proprietary libraries, not installable and **does not implement callback transport**.
- Scripts: [stage8/arm_build.sh](stage8/arm_build.sh), [stage8/sony_appclient_abi.h](stage8/sony_appclient_abi.h), [stage8/audit_sony_abi.py](stage8/audit_sony_abi.py).
- Full reproducible package, host tests, actual ARM object and original-OTA metadata-only JSON available to the user as `BRAVIA_STAGE8_ARM_ABI_RESEARCH.zip` (no proprietary Sony binaries).

## Verification

- **15/15 ABI checks** against original library/launcher and ARM object.
- **15/15** additional safe layout/source/packaging checks.
- All `make test adapter-test` host renderer/nav/DirectFB-mock tests pass after refactor.
- No real DirectFB headers or Sony system SDK available; **no actual DirectFB link or Sony live test**.
- No physical television changes, service deletions, DRM operations, unsigned flashing, loader takeover or app installation.

## Critical release gates

Need reliable real-device rollback and a supported loader; callback prototypes and app-manager IPC must be confirmed before ever invoking `am_client_init`; exact DirectFB interface and key ownership must be tested on a matching Sony TV. Existing TV, SETTINGS, OPTIONS, GUIDE, HDMI, channels, remote OSD, DRM stay stock. Pending confirmation, **DO NOT attempt USB flash or install the relocatable object on TV.**
