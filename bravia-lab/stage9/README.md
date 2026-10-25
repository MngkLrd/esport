# Stage 9: Sony IPC research gate (2026-10-25)

An **offline-only C99 lifecycle model** was built and tested for ARMv7 EABI5. It includes states STARTING, FOREGROUND, BACKGROUND, SUSPENDED, EXITING and STOPPED with strictly allowed transitions. An attempt to call unknown Sony IPC functions is *always denied*.

Previous original Sony v8.931 findings (Stage8): `libapp_client.so` has known dynamic symbol exports; native DockUI registers a 60-byte record with seven callback slots and its name at offset 36. **The callback prototypes, ordering, threading, lifetime and IPC packet structure are still unknown.** Stage9 does not claim to have recovered these.

Verified host C99 test: PASS. ASan/UBSan: PASS. Clang ARMv7 EABI5 relocatable object: PASS. Does not link to Sony proprietary libraries, replace HOME or flash firmware.

Source files and independent tests available in `BRAVIA_STAGE9_IPC_GATES.zip`. No proprietary Sony binaries, DRM or credentials.
