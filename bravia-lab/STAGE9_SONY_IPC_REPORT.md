# Stage 9 — real Sony app_man IPC and lifecycle audit (2026-10-25)

Target: KD-55XG7096, owner-supplied original Sony v8.931-1000. **Read-only research; no TV hardware or firmware modified.**

## Confirmed from three original ARM32 ELF binaries

- `root:/basic/app_man` (548,240 bytes) imports `mkfifo`, `pipe`, `read`, `write`, `select`, `socket`. The stock boot uses `app_man ... -input_fifo`. This supports a local FIFO transport but exact runtime FD/endpoint mapping is not recovered.
- `root:/basic/libapp_client.so` (34,540 bytes) imports `pipe`, `dup2`, `read`, `write`, `select`, `pthread_create`. There is no `socket` import **in that library**; don't confuse it with the separate DockUI/manager network functions.
- `3rdp:/sony/sony_dockui/launcher.bin` (125,080 bytes) registers seven callback wrapper functions via a **60-byte** record; the process name `dockui` is at +36.

Original callback map: offset +0 → `0x963c am_resumed`; +4 → `0x96a0 am_paused`; +8 → `0x9704 am_started`; +12 → `0x9734 am_stopped`; +16 → `0x9764 am_shutdowned`; +20 → `0x9798 am_wakeuped`; +24 → `0x97c4` an observed no-op wrapper.

The six wrappers save registers `r0`, `r1`, `r2`; the original library's indirect dispatch at `0x1e58` sets `r2=0`. **This is not a proof of C parameter types, security semantics, structure ownership or callback lifetime.** `am_client_init` stores a pointer from r0, and a safe reimplementation cannot use temporary registration storage.

Original library string templates: `\n:%s,%s,%s:%s\n` (`am_send_cmd` at 0x424c, `am_send_cmd_to_remote` at 0x4484) and `\n%s\n` (`am_send_raw_cmd` at 0x46b0). The precise meaning of all string fields and corresponding manager parsing remain unverified. The Stage9 bundle contains **no active sender**.

## Authored Stage9 code and tests

- Read-only `sony_ipc_audit.py`: **21/21 assertions** against original manager, client and DockUI, metadata-only report.
- Bounded offline `sony_ipc_offline.py`: inspects candidate log frames and redacts payloads. Does not connect to TV.
- C99 `sony_lifecycle_model.[ch]`: started, paused, resumed, stopped, shutdowned, wakeuped, focus ownership; renders nothing over native TV/OSD until authorized host gives focus. No Sony callback calls.
- Tests: **24/24 Python**, C99 lifecycle host unit tests with ASan/UBSan **PASS**.
- ARMv7 EABI5 ET_REL object compiled for lifecycle model + HOME core, ~2.5 KB, **not executable or installable**.

Full reproducible offline sources, 21-check JSON, 24 tests, ARM object and report in the user-facing `BRAVIA_STAGE9_SONY_IPC_NATIVE_LIFECYCLE.zip`. **No original Sony binaries, DRM materials or secrets are included.**

## Remaining blockers

Actual IPC field semantics and manager-side parser, callback C prototypes/ownership, real Sony DirectFB and app_client integration, signed install/recovery and physical remote focus tests. All native settings, GUIDE, audio, INPUT, channel lists, digital/analog TV must remain under Sony. **Installation NO-GO.**
