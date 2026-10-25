# Firmware Stage 1 QA · KD-55XG7096 · 2026-10-25

## Actual work performed

New tools: `firmware_triage.py` for safe read-only inspection of Sony update ZIP members, their headers, size caps and sample entropy; `rootfs_inventory.py` for **previously extracted** Linux filesystem: systemd unit dependencies, init.d startup commands, rc symlinks, inittab, potential app catalogs, URLs (unclassified). Both use Python stdlib only.

## Executed local checks

| Suite | Passed | Status |
|---|---:|---|
| HOME / remote state-machine | 81 | Passed (Node.js) |
| Existing firmware, safe debloat & analysis | 53 | Passed (Python) |
| New Sony archive / rootfs pipeline | 50 | Passed (Python) |
| HOME UI layout / D-pad browser tests | 50 | Passed (Chromium) |
| **All local tests** | **234 / 234** | **Passed** |

New 50 tests include malicious ZIP member paths, symlinks, decompression-size limit, harmless header detection, unknown category protection, unit dependency extraction, domain strings as non-tracker evidence, no firmware writes, no subprocess execution.

## Hardware status — blocking

- Firmware ZIP v8.931 NOT downloaded or unpacked; official Sony site requires acceptance and no verified direct link was accessible here.
- No authentic TV rootfs, `ps/top` sample, service inventory, networking trace, boot time measurement or CPU/RAM figures.
- No actual system components removed. The presence of Photo Sharing Plus in earlier Sony release notes is evidence of an **official removal by Sony**, not our own debloat.
- No firmware image assembled, signed or installed.
- No preserved native TV functions verified on modified firmware, no USB reflash performed.

**Decision: NO FLASH / NO SERVICE DISABLE.** Next gate: obtain official ZIP file with confirmed size; run triage and extraction assessment, then verify physical backup/recovery before making changes.
