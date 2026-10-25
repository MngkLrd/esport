# Stage 15 — complete project migration + real Linux ELF CI

**Target branch:** [MngkLrd/esport/feature/bravia-home-stage15](https://github.com/MngkLrd/esport/tree/feature/bravia-home-stage15/bravia-lab)

**Source:** `MngkLrd/game@bravia-firmware-lab`, HEAD `9418fe38df51b84708170d35de0948985612b65a`.

## Migration integrity

- **99/99 `bravia-lab/` tracked original Git blobs have identical SHA** between the source branch and `esport` branch, verified using both GitHub Git Trees API endpoints after importing.
- The existing `esport/main` is unaffected; the new feature branch is based on `main` and adds BRAVIA content only.
- Original game experiment files outside `bravia-lab/` were **not** copied because they belong to a different project.
- `bravia-lab/package.json` with `"type":"commonjs"` isolates the original HOME JavaScript and Node tests from esport root's ES module settings. No root package or scripts were edited.

## Actual Stage 15 work

- `stage15/demo_core.c` runs the **actual native v14 HOME state machine, host dispatch and C renderer** under simulated TV remote input.
- `stage15/host_posix.c` builds a usable **native Linux host ELF** for integration testing.
- `stage15/arm_linux_io.c` builds a separate **ELF32 ARMv7 EABI5 ET_EXEC**, statically linked with only Linux `read`, `write` and `exit` syscalls. This is **not** the proprietary Sony runtime and not compatible with Sony's native application registration without an additional verified loader/ABI.
- `stage15/build.sh` reproducibly compiles both actual executables from source. `stage15/test_demo.py` defines 22 checks including malformed/unhandled Sony inputs, 10k input stress, binary type, static link, and actual optional QEMU ARM execution.

## Verified CI on the target repository

**Actual green run:** [BRAVIA HOME Stage 15 — GitHub Actions #40232939836](https://github.com/MngkLrd/esport/actions/runs/40232939836) at commit `1dbdcad63fe0ba214e35717e1622654f2b22a9e2`.

All **three jobs passed**:

1. `Build and execute ARMv7 Linux ELF`: compiled real ARM ELF and **executed it with qemu-arm**, verified HOME input navigation, fail-closed app launch, Sony keys; passed Stage15 22/22 Python tests (qemu installed), C99/DirectFB mocks, Stage10–12 native model checks and regenerated Stage14 previews.
2. `Sony mock adapter and D-pad regression`: 121/121 Node.js tests passed (after CJS scope correction).
3. `Offline firmware test tools (no OEM files)`: passed tests that can run without proprietary Sony binaries.

The general e-sports repository `CI` pipeline also passed multiple initial import commits; the last general CI on the final SHA should be checked separately, and is not necessary to claim the dedicated BRAVIA workflow green.

## Hardware / release status

**Offline executable milestone: COMPLETE. Real Sony replacement: NOT COMPLETE.** No verified Sony authorized loader, native DirectFB surface, `libapp_client` callback/IPC integration, ten working proprietary streaming apps, license/DRM compatibility, full recovery or physically tested TV installation. Do **not** flash or overwrite the original Sony DockUI with these standalone Linux test executables.

No original manufacturer firmware, private keys, DRM material, or OEM binaries were committed to esport.
