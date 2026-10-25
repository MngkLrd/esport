# Stage 10 — real Sony v8.931 native IPC/callback reconstruction

**2026-10-25 · Original owner-supplied `sony_tvupdate_2017_8931_eff_auth.zip` · Offline read-only.** Re-extracted actual Sony MTK package, decoded root + 3rdp (NFSB/SquashFS/LZO), and recovered three original ARM32 binaries. No physical Sony accessed or changed.

| Original file | SHA-256 |
|---|---|
| ZIP | `9fedce4521bb3b9d2fc0d8e8a19d31a795752026d1a17249b1ccf712c25b606c` |
| `/basic/libapp_client.so` | `bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636` |
| `/basic/app_man` | `29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702` |
| `/3rd/sony/sony_dockui/launcher.bin` | `1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480` |

## Registration record — recovered from real ARM instructions

The original DockUI passes `am_client_init` a 60-byte structure with `dockui` name at offset `0x24`. Using the actual `movw/movt/str` callback assignments and ELF `R_ARM_JUMP_SLOT` relocations, its seven handler slots have now been identified **by code, not by names guessed from strings**:

| Offset | Callback ELF address | Imported function / observation |
|---|---|---|
| 0x00 | 0x963c | `am_resumed` |
| 0x04 | 0x96a0 | `am_paused` |
| 0x08 | 0x9704 | `am_stopped` |
| 0x0c | 0x9734 | `am_shutdowned` |
| 0x10 | 0x9764 | `am_suspended` |
| 0x14 | 0x9798 | `am_wakeuped` |
| 0x18 | 0x97c4 | Empty/no external call |

Wrappers save incoming r0/r1/r2 and forward r0/r1 into imported `am_*` lifecycle functions. **C pointer types, r2 meaning, callback threading and lifetime, IPC responses and runtime focus remain unknown.** `am_started` is exposed by Sony but not directly called from these seven callbacks. `am_client_init` stores the original registration pointer; copying / duration of its ownership is unproven.

## Outbound command text — partial protocol recovered

At `libapp_client.so:0x438c`, `am_send_cmd` calls `snprintf@PLT` using a real rodata format at `0x77ac`:

```text
\n:%s,%s,%s:%s\n
```

Observed argument order is registration process name, constant `am`, first function argument (or empty string), second mandatory function argument. This suggests **`\n:<process>,am,<command>:<value>\n`** for that function on this exact build. Other helpers have other formats; this does not establish a complete send/receive protocol.

Static `app_man` strings include `/tmp/%s_read`, `/tmp/%s_write`, `/tmp/fifo_am_read` and `/tmp/fifo_am_write`. Do NOT assume that their actual runtime permissions, endpoints, message framing or response behavior are verified from strings alone.

## Developed and tested

- Exact-build, SHA-256-pinned original-ELF callback/IPC auditor (user-download ZIP).
- New [metadata-only C99 callback layout](stage10/verified_callback_layout.h), with [implementation](stage10/verified_callback_layout.c). **No callable Sony SDK, native IPC send, firmware writer, or API spoofing.**
- ARMv7 EABI5 relocatable object, host C99 test and **15/15 Python tests** (11 synthetic, four against the private original binaries including tamper rejection) passed. No real hardware tests.
- Full source, test results, auditor, JSON evidence and ARM object: conversation artifact `BRAVIA_STAGE10_REAL_IPC_ABI.zip`. **No Sony binaries, package, keys, DRM or fonts included.**

**Release state: BLOCKED.** We still need verified callback prototypes, app-manager IPC responses, Sony surface/focus ownership, authorized application loading and proven full-device recovery before installing or flashing. Never edit or flash Sony's signed SquashFS based on these static findings alone.
