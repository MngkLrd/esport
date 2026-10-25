# BRAVIA HOME Stage 16 — integration and performance research

Target: Sony KD-55XG7096, original Sony v8.931 architecture. **No physical TV modifications or flashing.**

### Delivered code
A deterministic **mock**, not an OEM Sony emulator: `stage16/sim.c` uses the actual native `home_core.c`, `host_dispatch.c` and `render.c`. It models the screen owner as HOME/TV/external app/system-native menu; ready/missing/unknown service behavior; mock dispatch acceptance/failure; native system remote key forwarding; transition-driven drawing and recoverable draw errors. UI commands cannot be emitted while an external mock app/TV/menu owns the display.

`stage16/console.c` produces host-executable Linux CLI, scripted scenarios and benchmark output; `stage16/arm_main.c` + `stage15/arm_linux_io.c` produce a **fully linked, static ARM32 EABI5 ET_EXEC** with no dynamic interpreter, tested in **qemu-arm** on GitHub. It calls Linux read/write/exit only. It is **not compatible with Sony app-manager boot/registration until separately verified**, and must never overwrite Sony `launcher.bin`.

### Tested
- **100,000 synthetic remote events**, TV/HOME/app/menu focus ownership and redraw suppression; native C simulator test passes.
- **20 Python CLI and ARM tests**, including ARM emulator in GitHub CI (the same test is explicitly skipped locally if qemu-arm absent).
- Host GCC ASan/UBSan and C99 `-Wall -Wextra -Werror -pedantic` passes.
- Existing native/DirectFB mock, Stage14, Stage15, Sony JS and firmware source-only tests pass in dedicated three-job CI.
- Real successful GitHub run: [BRAVIA Stage 16 #40235337281](https://github.com/MngkLrd/esport/actions/runs/40235337281).
- General esport build: [CI #40235337308](https://github.com/MngkLrd/esport/actions/runs/40235337308).
- Executable Linux host and ARM research binaries published by workflow artifact `bravia-home-stage16-offline-linux-demo`; no manufacturer binaries or keys included.
- CPU-only sample of 100,000 synthetic events on authoring machine: ~0.05–0.06 s, CPU event handling ~0.5–0.6 us/event; **not Sony, real GPU, video, DRM, browser or RAM measurements**.

### Blockers
Actual DirectFB 1.x SDK/header compatibility, surface ownership, libapp_client callback prototype/IPC data, live physical remote/tuner/HDMI/DRM and a supported native application loader plus full-device recovery are still unknown. Signed firmware updating remains **NO-GO**. The next meaningful step is a controlled authorized test on independently recoverable hardware, not blind USB flashing.
