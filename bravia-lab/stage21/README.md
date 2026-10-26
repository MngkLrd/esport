# Stage 21 — matching the actual TV firmware

**Reported on Sony KD-55XG7096:** `8.931-1000-4.000-0000`.

**What matches our research:** primary `8.931-1000` branch from the
privately owner-supplied `sony_tvupdate_2017_8931_eff_auth.zip`.
The original Sony reference was the OTA and three extracted v8.931 ELF
files; their SHA-256 checks are pinned in Stage10/Stage13.

**What does not yet match by evidence:** the on-device `4.000-0000`
fields are not linked to any specific binary hash, regional package,
board revision, active system partition or memory layout. A UI-reported
version is *not* proof that the live process bytes match an offline OTA.

The new `firmware_preflight.py` accepts the **full TV version**, checks
only the research version family, optionally hashes the original user-held
OTA and three ELF artifacts and reports static string indicators from
a pinned `launcher.bin`. It does not read a live TV, run an ELF or write
firmware. All outputs are bounded and omit source paths and raw strings.

## How to use on a development PC (no USB needed)

```sh
python3 bravia-lab/stage21/firmware_preflight.py \
  --tv-version 8.931-1000-4.000-0000
```

When the *original exact offline files* are privately available (never
commit to GitHub or distribute them):

```sh
python3 bravia-lab/stage21/firmware_preflight.py \
  --tv-version 8.931-1000-4.000-0000 \
  --ota-zip /PRIVATE/sony_tvupdate_2017_8931_eff_auth.zip \
  --app-man /PRIVATE/root/basic/app_man \
  --libapp-client /PRIVATE/root/basic/libapp_client.so \
  --launcher /PRIVATE/3rdp/sony/sony_dockui/launcher.bin
```

Expected outcomes:
- **RESEARCH_VERSION_FAMILY_MATCH_ONLY** — our original v8.931 methods are
  relevant to further research; *not* authorization for patching.
- **OFFLINE_OEM_REFERENCE_MATCH_ONLY** — only if all four provided private
  artifacts match their original SHA-256 values; still no live device
  binary match or recovery proof.
- **STOP_WRONG_FIRMWARE** — different major/build family; do not use
  hard-coded addresses from v8.931.
- Any mismatched supplied OEM artifact fails the CLI status check. This
  prevents accidentally basing future analysis on other files.

## Next work on the real stock DockUI

1. Use the pinned `launcher.bin` offline to map **actual** widget and
   tile-construction call sites, not infer the whole menu from the presence
   of `DockUI.xml` strings.
2. Compare application entries with Sony's original read-only
   `am_config`, `am_start.ini` and `DockUI.xml`; distinguish menu-only
   hiding from removal of operating-system services.
3. Complete Sony ABI research for real input focus and app launch.
   The Stage20 catalog host is **only our interface**, not Sony IPC.
4. Preserve built-in tuner, HDMI, volume, GUIDE, OPTIONS, RETURN, network,
   updates, DRM and USB media regardless of menu-removal decisions.
5. Audit Samba ACR / optional background services independently; no
   blanket dependency deletion. Measure active traffic and CPU/memory
   before claiming performance gains.

**Important:** no consumer USB installer, signed DockUI update, native
launcher replacement or tested full-device recovery exists yet.
Uploading the offline package to FAT32 USB is *not* installation.
