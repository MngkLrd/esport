# Stage 18.1 — repository audit and Sony native feasibility gate

**Date:** 2026-10-26. **Repo:** `MngkLrd/esport`. **Branch:** `feature/bravia-home-stage15`.
Target is Sony BRAVIA KD-55XG7096, original firmware version v8.931-1000.
This is a **repository/source audit and read-only feasibility plan**. No TV device access, executable deployment, real Sony ABI invocation, firmware repack or flash occurred.

## 1. Migration inventory: source not lost

The origin branch `MngkLrd/game@bravia-firmware-lab` (commit
`9418fe38df51b84708170d35de0948985612b65a`) contains **99 BRAVIA files**.
All 99 relative file paths are present in the `esport` feature branch. The source-path
snapshot is committed as `stage18/source_inventory.json`, and
`stage18/test_repo_integrity.py` now guards future clean checkouts.

Path equivalence is **not** a claim that all old blob SHA-1s are still equal:
`render.c`, `directfb_backend.c` and some documents were intentionally modified in
Stages 14–17. `home_core.c`, `host_dispatch.c`, the original JS launcher,
catalog and core legacy Sony bridge files were spot-checked against the origin
by fetching GitHub blob SHA values. The Stage15 migration report documented 99/99
equal Git blobs **at initial import**, not after these intentional changes.

The origin's single `.github/workflows/bravia-offline-ci.yml` was **not**
copied under the same filename, because `esport` uses
`.github/workflows/bravia-home-ci.yml`. An audit found that the new CI omitted
original Chromium/Playwright browser integration tests and standalone Stage8
ABI and Stage9 lifecycle checks. Stage18 restores these checks, adds a fourth
`browser` CI job, and adds the 99-file guard to the Python CI job.

**The post-patch GitHub-hosted CI has not been marked PASS without an observed
green run.** Original `game` hosted CI ran into unallocated runners in 2026-10-25;
later dedicated `esport` Stage15–17 CI links in the repository documentation
report successful earlier runs, but do not validate this new Stage18 commit.

## 2. Source-based architecture and blockers

| Component | Evidence in repository | Current confidence | Required next proof |
|---|---|---|---|
| ARM execution | Original `launcher.bin` is ELF32 ARMv7 EABI5, dynamically linked to `/lib/ld-linux.so.3` | Confirmed only from owner-image static analysis | Authorized on-device process launch |
| Physical HOME ownership | `keymap_tv.ini` ROOT_MENU maps to native `dockui`; `am_config` names `/3rd/sony/sony_dockui/launcher.bin` | Static mapping; active owner unobserved | Read-only live process/focus observation |
| Cobalt UI | Separate HTML5UI and stock `HomeuiInterface` bridge | Real firmware static symbols; offline browser mocks | Test real TV, no assumption HTML overrides native HOME |
| Sony client ABI | `libapp_client.so` callbacks and 60-byte registration, process name at +36 | Partial, based on disassembly | Exact prototypes, object lifetime, callback threading and focus |
| Sony IPC | Outbound templates and some dispatcher call sites | Partially understood, **inbound framing unresolved** | Passive offline analysis, no guessed calls/writes |
| Graphics | C99 94-command HOME and DirectFB adapter; Stage17 30 cached ARGB logo loader | Off-device renderer/mock tested only | Real host-provided DirectFB surface / PNG provider / ownership |
| Remote and TV video | Native intent/pass-through implemented in simulated host | Simulated only | Verify DPAD/OK/BACK and full Sony system controls on spare hardware |
| App availability | Ready/unknown/unavailable, catalog mock, 10 tiles | Off-device behavior, no live service registry | Stock installed service list and verified host dispatch responses |
| Installation | dm-verity/NFSB protected original SquashFS; limited writable `3rd_rw` not a loader | Original-package static proof against easy replacement | Supported or authorized non-destructive native app route |
| Recovery | Original Sony OTA is **not** a full eMMC backup; downgrade unsupported | Definitive **NO-GO** for consumer TV write | Full board-specific backup and independently tested restore |

### Important source caveats

- Do **not** derive callable Sony C signatures from the Stage9 early callback
  tables. Stage10/11/12 contain later corrections and still explicitly leave
  pointer lifetime, argument types and special +56 dispatch unresolved.
- The Sony v8.931 OEM ZIP and extracted ELF are intentionally **not stored
  in GitHub**, so public CI cannot repeat private original-firmware SHA-pinned
  disassembly checks.
- Several *developer-authored audit scripts* are also referenced as being
  packaged in prior conversation ZIPs rather than the Git repository.
  Examples: Stage11 `audit_transport.py`, Stage13
  `source/install_gate_audit.py`. They are absent from **both** GitHub trees;
  this is an archive/reproducibility gap rather than failed Stage15 migration.
  Restore only from verified original project archives, not reconstructed
  synthetic evidence.
- The Stage17 visually matched fallback image pipeline does not make a Sony
  UI executable. Actual PNG provider, compositor, host lifecycle and DRM are
  unverified.

## 3. Stage18.1 exit gates before a physical TV attempt

1. **CI gate:** observe a completed green GitHub run on the current head:
   native/ARM/QEMU, JS, firmware source-only, restored Playwright, 99-path
   integrity, DirectFB mock loader/failure-path tests.
2. **ABI gate:** compile an adapter against matching Sony DirectFB/app-client
   headers and verify ABI without sending privileged IPC. Until then,
   host mock type layouts are research stand-ins.
3. **Boot route gate:** obtain a documented legitimate, reversible way to
   run an independent native executable. No replacement of `launcher.bin`,
   protected partitions, signature checks or bootargs experiments.
4. **Hardware gate:** identify exact board revision, obtain a separate
   recoverable test board and validate complete backup/recovery before any
   write. Stock consumer TV remains untouched.
5. **Input gate:** first integration is TV-first, system-key/pass-through
   checked in a controlled test. Service launch/DRM comes **later**.

**Current verdict: OFFLINE DEVELOPMENT GO; DIRECT SONY INSTALL/FLASH NO-GO.**
If an authorized native loader never exists for this consumer platform, a
separate HDMI Linux host is the technically viable deployment alternative.
