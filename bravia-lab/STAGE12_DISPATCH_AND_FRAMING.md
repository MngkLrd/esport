# Stage 12 — Sony v8.931 IPC relay, real callback registers and framing (2026-10-25)

This work is **read-only offline research against the owner-supplied original** Sony KD-55XG7096 v8.931-1000. Nothing installed on the TV, no firmware modified and no Sony-proprietary ELF redistributed.

## Corrections to Stage 11 based on verified ARM machine instructions

- `libapp_client.so:0x1d20` is a **read/relay helper**, not itself the event decoder. It zeros 128 bytes, calls `read(fd_in, buf, 127)`, then—if positive and permitted—calls `strlen(buf)`, `write(fd_out,buf,len)`, `close(fd_out)`, and unlocks a mutex. This does not demonstrate preserved records across short reads.
- Two separate worker branches invoke this relay at ELF `0x2ddc` and `0x2ec0`, with different file-descriptor members.
- Actual event dispatcher is `libapp_client.so:0x1e58`; the worker invokes it at `0x28a0` and `0x28c4` **after** preparing messages. It compares event strings using `strncmp(..., 20)`, then invokes registered callbacks.
- **ARM callback arguments:** ordinary event branches pass their two original arguments through r0/r1 and force r2=0 immediately before indirect `blx`. A generic/fallback callback path at `0x2458–0x2464` passes all three original r0/r1/r2 values. **These are observed register values, not a proven C prototype or callback lifetime.**
- The event decoder has a special path reading a pointer at offset `+56` (`0x22e0`), followed by an indirect call at `0x2308`. The prior native DockUI registration is only **60 bytes** and its name starts at offset `+36`. **If it is the same underlying object, +56 would fall inside the name field.** Pointer ownership or special-case semantics remain unresolved. Never wire this path up by guessing.

## Real artifacts

- `stage12/audit_dispatch.py`: **20/20 SHA256-pinned read-only original ARM checks** for exact OEM binary assembly and two relay paths; rejects a different/altered firmware build. Owner's original ELF files are required separately.
- `stage12/ipc_frame_observer.[ch]`: a **no-transport, read-only** C99 incremental parser for the already-proven **outbound** `am_send_cmd` template `\n:<process>,am,<command>:<value>\n`. It supports arbitrarily split/concatenated synthetic test chunks, validates bounds and fails closed on malformed frames. **The original *inbound* framing is NOT verified, and this parser is not claimed to match it.**
- Offline C99 tests, **30 fragmentation variants**, AddressSanitizer/UBSan and freestanding cross-compile to **ELF32 ARM ET_REL** passed. The object is not a Sony executable.
- **17/17 Python tests** passed, including real original ELF checks and three altered/truncated binary rejection cases.

A complete standalone downloadable source bundle **BRAVIA_STAGE12_DISPATCH_FRAMING.zip** was generated in the conversation, including all Python/C source, tests, report, ELF ARM object and sha256 manifest. It **excludes proprietary Sony binaries, signed firmware and keys**. Python real-ELF tests require `BRAVIA_SONY_OEM_ELF_DIR` containing privately extracted `libapp_client.so`, `launcher.bin`, `app_man`.

## Status: not installable

Hardware IPC reply semantics, decoded inbound message boundaries, precise callback pointer/C types, Sony DirectFB surface acquisition, authorized loader and full recovery are **not established**. No USB flashable update or on-device executable is provided. Original Sony NFSB/dm-verity filesystems remain untouched.
