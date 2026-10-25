# Stage 16 — native Sony-like app-manager simulator (offline only)

Experimental HOME for Sony BRAVIA KD-55XG7096 (non-Android Linux). This is **not** firmware and doesn't install on Sony.

## Implemented
- `sim.[ch]`: deterministic simulated host using **the existing real C99 HOME state machine**, host dispatch, and `ui_render`.
- Screen ownership: TV, HOME, app, native menu. No drawing over mock TV, a running app or a native menu. Mock-only service registry defaults to all UNKNOWN. `--demo` artificially marks Netflix READY, KION UNAVAILABLE — these are NOT observed TV apps.
- Unknown service: simulated host refuses; unavailable service: core blocks it before dispatch. Native input/channel/settings buttons stay host-owned. System keys (INPUT/GUIDE/OPTIONS/volume) only forward to the **simulated** operating system.
- Dirty-frame cache: redraw only when UI state changes, failed draw retains the dirty flag. DirectFB adapter remains tested **with a mock surface**, not Sony OEM SDK.
- Runnable Linux CLI `console.c`, 100,000-input benchmark, C99 owner/focus/test failure regression and **ARMv7 EABI5 ELF32 ET_EXEC** simulated host built with Clang/LLD. ARM ELF uses ordinary Linux syscalls. No Sony proprietary binaries or APIs linked.

## Build and run
From repository `bravia-lab/`:
```bash
make -C stage16 test sanitize arm bench
sh stage16/build_arm.sh
python3 -m unittest -v stage16/test_cli.py
./stage16/console --demo --script 'hsdddobhsssddob'
printf 'hsdddobq' | qemu-arm stage16/build/bravia-stage16-simulator-armv7-linux-elf
```
Controls: h HOME; w/a/s/d direction; o OK; b BACK; +/- volume; i INPUT; g GUIDE; p OPTIONS.

## Scope of measurements
`console --benchmark 100000` measures CPU-only event processing/draw-call emission on the Linux host. It is **not** real Sony ARM runtime, DirectFB GPU/render time, TV RAM, DRM, streaming or remote input latency.

## Verified on GitHub
[BRAVIA HOME Stage 16 CI](https://github.com/MngkLrd/esport/actions/runs/40235337281) — three jobs passed including ARM Linux ELF in QEMU and sanitizers. [General esport CI](https://github.com/MngkLrd/esport/actions/runs/40235337308) also passed. Original Sony firmware, physical TV, real `libapp_client` full ABI and native loader remain unverified; **do not flash**.
