# KD-55XG7096 v8.931 — Offline reverse engineering, Stage 1

**State as of 2026-10-25:** exact model and reported v8.931, but ORIGINAL ZIP IS NOT YET IN THE WORKSPACE. No authentic service/process inventory exists. Sony's download uses a terms-acceptance Download flow; no verified direct URL was obtained. Everything below is non-destructive tooling and synthetic-fixture validation.

## Authoritative firmware evidence

- Device: Sony KD-55XG7096, original Linux Smart TV, existing software v8.931 (user-reported; final build suffix unknown).
- Sony RU official support: https://www.sony.ru/electronics/support/televisions-projectors-lcd-tvs/kd-55xg7096
- Official 8.931 file: `sony_tvupdate_2017_8931_eff_auth.zip`, exactly **289,426,738 bytes**, dated **2023-02-15**. Applicable model per Sony official support; download access is via Sony's agreement screen.
- Official Sony EU 8.933 is newer but region compatibility of the exact TV is unverified. No firmware update or downgrade is authorized.
- Sony release notes explicitly say Photo Sharing Plus was removed in previous releases; they also mention improvements in remote control, channel switching, HEVC tuner, subtitles, meaning system responsibilities are tightly integrated and must be preserved.

## Procedure once official archive is obtained

Copy the ZIP to your PC; **do not copy it to the TV's USB update folder**. Run on a desktop Python 3.9+ environment:

```bash
python3 firmware_triage.py /path/to/sony_tvupdate_2017_8931_eff_auth.zip --output reports/8931_zip_triage.json
python3 firmware_lab.py zip /path/to/sony_tvupdate_2017_8931_eff_auth.zip --output reports/8931_zip_members.json
```

This reports member names, header magic/entropy (diagnostic only), member sizes, hashes, and suspicious paths. It **does not** decrypt a proprietary MediaTek package, verify Sony's signature, write USB update files, or make images flashable.

If package structure and compatibility permit safe extraction, first extract using a known, version-appropriate tool such as `unixtract`, in a sandbox on the PC. Confirm extraction validity independently. Never make ad-hoc keys or write a modified archive to the TV.

For a previously extracted directory that contains a root filesystem:

```bash
python3 rootfs_inventory.py /path/to/unpacked_rootfs --output reports/rootfs_inventory.json
python3 audit_bloat.py reports/rootfs_inventory.json --output reports/debloat_assessment.json
```

The `rootfs_inventory` output includes detected startup scripts, rc symlinks, systemd unit dependencies, candidate app catalogs, and *unclassified* domains. Names/strings **are not proof of a live process or of tracking**. The dependency map is partial and must be verified. Every newly discovered component is classified as `unknown`; `audit_bloat` therefore protects it until independent verification. No removal instructions are generated.

## Debloat triage / evidence gates

1. Identify the precise board revision, full software version, and update partition structure.
2. Compare system files and WebApp catalog entries against original HOME behavior and dedicated remote keys.
3. Measure **actual** process CPU/RSS and DNS/network requests on the device under normal viewing, HOME, standby/resume; static firmware analysis does not measure live resource use.
4. Map process parents, open files, library dependencies, middleware and watchdog chains. Resolve processes used by tuner, channel list/EPG, HDMI, analog/digital, video decoder, sound and volume overlays, virtual keyboard, Sony Settings, OPTIONS, Netflix/DRM and recovery.
5. Hide superfluous vendor tiles first; disable independent background services only with an eMMC/SPI backup, rollback and on-TV A/B regression test. Do not delete based solely on a name such as analytics, diag, update, Vewd or Sony.
6. **Never remove OTA/recovery, native key handlers, critical middleware, device DRM, tuner or HDMI/CEC, network services needed for apps, nor original language/virtual-keyboard input.**

## Acceptance / tests

- 50 new offline firmware/rootfs pipeline tests passed, including ZIP-slip, oversized archives, symlink, missing unit, dependency, host extraction, and no shell execution.
- Full local project tests after this change: **81 Node navigation + 103 Python firmware/audit tests + 50 Chromium UI tests = 234/234 PASS**.
- These are **not hardware tests**. No actual firmware binary unpacked or flashing performed. No actual vendor app, tracker, process, CPU or RAM finding may be stated until real evidence is collected.