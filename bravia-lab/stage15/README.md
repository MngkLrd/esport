# Stage 15 — BRAVIA HOME runnable Linux ELF research build

**Target:** experimental Sony KD-55XG7096 native HOME development. This is **not a Sony-installable ELF** and no manufacturer firmware is included.

This branch imports **all 99 files** from `MngkLrd/game` / `bravia-firmware-lab` under `bravia-lab/` into **`MngkLrd/esport` / `feature/bravia-home-stage15`**, preserving the existing e-sports code outside the new directory.

## Genuine progress

- Desktop host: a **runnable Linux ELF** built from v14's exact HOME state machine, renderer and host dispatcher.
- ARM target: actual **ELF32 ARMv7 EABI5 ET_EXEC** (not an ET_REL `.o`). Static Linux syscalls: stdin read, stdout write, process exit. **No Sony DirectFB, app-manager IPC, DRM, tuner or on-device loader.** Its Linux syscall semantics are *not* guaranteed by Sony's firmware.
- `home_init`, `host_dispatch` and `ui_render` are executed for every simulated remote input. The state text prints the renderer's **real native draw-call count**: 0 for TV, 94 for HOME.
- All native app launch attempts and physical Sony keys fail closed without an actual host. An attempt to open an unknown service produces a transparent detail error, not fake playback.
- 22 Python test cases: 21 run on host; one optional QEMU ARM test skips locally if qemu-arm absent. The dedicated GitHub CI installs `qemu-user` and checks actual ARM execution.

## Reproduce

From `bravia-lab` on a Linux PC with gcc, clang, LLD, readelf, Python 3.11+:

```bash
sh stage15/build.sh
printf 'hsdo+bq' | stage15/build/bravia-home-linux-x86_64
python3 -m unittest -v stage15/test_demo.py
# with qemu-user installed (ARMv7 Linux user-mode):
printf 'hsdo+bq' | qemu-arm stage15/build/bravia-home-armv7-linux-elf
make -C native_core test adapter-test
```

Controls: `h` HOME, `w/a/s/d` D-pad, `o` OK, `b` BACK, `t` simulated TV return, `+/-` volume passthrough, `i` source, `g` GUIDE, `q` quit. These are **test keyboard inputs**; there is no Sony remote interception.

**Important hardware blockers:** stock Sony DockUI HOME runs as a protected 32-bit ARM DirectFB app with proprietary Sony app-manager integration; we have no verified authorized native app loader, device-recovery procedure, secure native DirectFB ABI, or working installers for third-party services. **Never copy or flash the Linux demo ELF over Sony's real launcher.**
