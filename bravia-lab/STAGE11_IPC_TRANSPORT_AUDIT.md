# Stage 11 — IPC transport/receiver analysis, actual Sony v8.931 (2026-10-25)

**Source:** owner-supplied `sony_tvupdate_2017_8931_eff_auth.zip`, re-extracted original `libapp_client.so`, `app_man`, `launcher.bin`. Original ELF SHA-256 pins are in conversation ZIP metadata. Offline static analysis only, zero TV connections/writes, no flashing.

## Real ARM findings

- `libapp_client.so:am_client_init` at ELF 0x3394 invokes initializer code at 0x1620. That initializer calls `pipe()` **five times**, exactly at 0x1720, 0x1754, 0x1788, 0x17bc, 0x17f0 (PLT 0x1440). Initial report suggested three, but **five is the correct full count**. `am_client_init` itself also invokes `pthread_create()` twice (PLT 0x1458).
- `am_send_cmd` at 0x424c, `am_send_cmd_to_remote` at 0x4484, `am_send_raw_cmd` at 0x46b0 all invoke `snprintf` (PLT 0x13ec), `pthread_mutex_lock` (0x132c), `write` (0x1410), `pthread_mutex_unlock` (0x129c). Exact PLT symbol identities confirmed from original `readelf -r`. The functions do **not** synchronously read acknowledgements; the `write()` return value is not used as proof of a remote action.
- String templates in original ELF `libapp_client.so`: `am_send_cmd` and `am_send_cmd_to_remote` use `\\n:%s,%s,%s:%s\\n` (but supply different arguments). `am_send_raw_cmd` uses `\\n%s\\n`. For `am_send_cmd` the fields are registered process name, `am`, first arg or empty string, second required arg.
- Inbound handler at `0x1d20` calls `read(fd, buffer, 127)` (PLT 0x1308); event dispatcher at `0x1e58` tests distinct strings via `strncmp` and dispatches through registration pointer slots.

| Original input token | Callback slot byte offset |
|---|---:|
| `pause` | 4 |
| `resume` | 0 |
| `stop` | 8 |
| `shutdown` | 12 |
| `suspend` | 16 |
| `wakeup` | 20 |
| `foregm` | 32 |
| `backgm` | 28 |

**Subtlety:** Stage10 DockUI was observed populating seven callback pointers through offset 24. The original library can also dispatch `foregm/backgm` at offsets 32/28. Their availability in *this exact DockUI registration* is unproven and must not be fabricated.

- `app_man` includes `/tmp/%s_read` and `/tmp/%s_write` string templates. These are not evidence that a third-party process can open the runtime endpoints, and no accepted-response format has been verified.
- POSIX `read()` boundaries do not imply message boundaries, and a zero return from `am_send_cmd` is **not confirmation of successful settings, HOME, or app launch**.

## Actual new code and tests

- SHA-pinned **read-only ELF auditor** `audit_transport.py` performs PC-relative string-reference verification, ARM call-site checks, opcode-defined callback slot mapping, transport call counts, false-ACK checks. Full source is inside the user-visible `BRAVIA_STAGE11_IPC_TRANSPORT.zip`; no OEM binaries embedded.
- C99 offline token observer (`ipc_observer.[ch]` in this repo and source ZIP) recognizes the 8 exact verified event words and rejects malformed, unknown, long/empty input. **No Sony IPC writer, socket client, libapp_client call or host-side privileged functionality.**
- **22/22 Python tests on actual original binaries** passed; C99 host tests and ASan/UBSan passed; ARMv7 EABI5 relocatable object built. Its standalone object is **not a working TV program**.

## Blockers

Complete inbound frame splitting, callback argument types, process focus transactions, DirectFB integration, authorized launcher and full recovery remain unknown. **No custom firmware or working Sony installer exists.** Continue work as an offline reverse-engineering/prototyping project; don't flash unsigned edits to NFSB/dm-verity protected partitions.
