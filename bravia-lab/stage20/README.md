# Stage 20 — native catalogue replacement bridge (no browser shell)

**Purpose:** replace the application choices of Sony DockUI, retaining the
native TV engine, channel guide, sound/picture/input settings and Sony remote.
The original OLED/DirectFB TV screen is not repurposed as HTML.

## Implemented source, built and host-tested

- `native_core/native_catalog.[ch]` is a separate desired-catalog table:
  Kinopoisk, IVI, START, Netflix, YouTube, RUTUBE, Media Station X, Al(co)pac,
  stock browser, KION. These are **new user-selected entries**, even if a name
  coincides with a built-in Sony entry.
- `native_core/catalog_host.[ch]` connects `FX_OPEN_APP` intents from
  `home_core.c` to a **unique host-verified service ID**, not to a hard-coded
  app index or guessed Sony IPC command.
- An unknown/unported app stays UNKNOWN and cannot launch. Duplicate service
  names, unregistered entries, and IDs not verified by the host fail closed.
  Installed stock Sony services may be reused *after* compatibility and native
  service lookup are verified, rather than gratuitously discarding their DRM.
- The other existing `BraviaHost` actions and 16 reserved Sony key classes
  retain their native pass-through. UI tracking and network access are not
  introduced.
- No heap allocations and no libc dependency in the catalog core; both
  C99 source files cross-compile as ARM32 ELF EABI5 **relocatable objects**
  on a standard Clang ARM target.
- `stage20/test_catalog_host.c` tests the complete HOME -> app-route
  callback with synthetic host service records and volume/source pass-through.

## Crucial limits

**This is NOT an installable Sony launcher** and does not contain
`libapp_client.so`, OEM proprietary code, verified Sony service IDs,
Sony launcher signing data, or a valid USB update. The test's `host_verified`
flag is manually set in a mock and **does not mean a real TV has reported a
service**. Browser-based launcher Stage19 from the earlier exploratory test is
not used here.

The menu's old Sony app entries can disappear in the future custom HOME as
specified by `stage19/stock_dockui_target.json`. Deleting installed Amazon,
Netflix, YouTube or browser binaries is a **different** operation, requires a
verified dependency map and is not included. There is currently no evidence
that any of the obsolete service binaries consumes CPU while idle.

## Native firmware ABI blockers

1. Confirm the **running** firmware version before using original v8.931
   symbol offsets (Sony also distributed v8.933).
2. Resolve the real `app_man` registration, ID mapping, lifecycle callbacks
   and DirectFB surface ownership from matching original binaries. Static
   reverse engineering in Stages 10–12 is partial.
3. Obtain a legitimate or otherwise actually functioning ARM executable
   launch/install path. FAT32 USB media browsing **does not** grant
   code execution.
4. The DockUI package is in a read-only dm-verity/NFSB SquashFS partition;
   unsigned OTA images are not accepted merely because they look like Sony ZIP.
5. Before modifying the only working consumer TV, establish a full device
   image and an independently tested board-specific recovery method. The
   official Sony OTA is not a backup and factory reset is not firmware recovery.

## De-bloat and privacy are separate from removing HOME shortcuts

Read-only Sony v8.931 inspection confirmed Samba/ACR components and Mixpanel
code packaged with a Samba consent page; factory
`/3rd/samba/default_setting.xml` says `enabled=false`. **No claim is made
about the user's active settings or real CPU usage.**

The only currently practical direct change without custom execution is
**disable Samba Interactive TV** in stock TV settings if enabled (typically
Settings → System Preferences → Samba Interactive TV; varies by region).
Sony documents that opt-out separately from disabling the entire Smart TV
platform. This should be verified on this particular set.

Do not disable `browser_base`, `dtv_svc`, tuner, Cobalt, DRM/auth, app
manager, firmware recovery or system network because they may be required by
the *desired* services. `globoplay` has `start_self=true` in the **original
static** `am_start.ini`, and deserves measured dependency review before any
disabling. A complete source-name list cannot establish what is running.

## Local reproduction

```sh
make -C bravia-lab/native_core test adapter-test
clang -target armv7-linux-gnueabi -mfpu=vfpv4 -mfloat-abi=softfp \
  -std=c99 -O2 -ffreestanding -fno-builtin -Wall -Wextra -Werror -Wconversion \
  -pedantic -c bravia-lab/native_core/native_catalog.c -o catalog_arm.o
```

The current revision is prepared for **offline/CI testing only**; no file from
this stage should be placed into the Sony USB software update workflow.
