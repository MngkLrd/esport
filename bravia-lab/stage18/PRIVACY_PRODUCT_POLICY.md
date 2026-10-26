# Stage 18.2 — Privacy-first BRAVIA HOME, before any TV installation

Date: 2026-10-26. Hardware: Sony BRAVIA KD-55XG7096, original Sony non-Android Linux v8.931-1000. This is an **offline source hardening and privacy analysis**, not a firmware patch.

## What we can and cannot assert

### Original Sony v8.931 (verified in previous owner-firmware report)

- `/3rd/samba/default_setting.xml` has `enabled=false` **as a factory default**. The current TV's `/3rd_rw/samba/acrsetting.xml` lives outside the supplied official OTA, so its live consent state remains **unknown**. A default does not prove that the TV never opted in.
- Samba ACR binaries include `/3rd/samba/cidclient`, `start_samba` and `enable_samba.sh`; their existence does not prove active transmission.
- A Samba consent page includes a `mixpanel.init` reference. This is evidence of analytic code packaged with the OEM image, **not evidence of runtime Mixpanel calls**.
- `globoplay` has `start_self=true` in `am_start.ini` but shares `coexist_set` dependencies. The current process and traffic state is unknown, and its name alone does not prove tracking.
- Cobalt/browser, Sony DRM and application catalog share functions needed by video services. **Do not remove** `browser_base`, `dtv_svc`, original HOME/system IPC, DRM, app manager, network or OTA by guessing their purposes.

Source: `REAL_FIRMWARE_AUDIT.md`, `STAGE6_NATIVE_INSTALL_GATE.md`, `PERFORMANCE_AND_DEBLOAT.md` and `STAGE13_INSTALL_RECOVERY_GATE.md` in this repository. These are historical read-only original OTA audits, not a live TV network recording.

### Our authored BRAVIA HOME (work completed in Stage18.2)

- `stage18/privacy_audit.py` statically scans 11 authored JS/C runtime source files for common network and analytics calls; missing files are a test failure. It reports both findings **and** explicit limits of coverage. It does not silently classify Sony system daemons as spyware.
- `ui/index.html` declares `connect-src 'none'`, `frame-src 'none'`, no referrer and no external runtime assets. This is **defense in depth only for the browser prototype where CSP is honored**. Sony firmware may launch its Cobalt HTML5UI with `--disable_csp`, so never call this an enforced OS-wide network firewall.
- The native C99 renderer already contains no telemetry pipeline, network polling or forced vendor app launches. User-initiated vendor apps may, by necessity, contact their own DRM/account/content/CDN endpoints.
- `stage18/test_privacy_audit.py` ensures the expected indicators remain absent and checks the policy cannot claim the actual TV is clean.
- CI now fails if these first-party sources acquire a recognized network/analytics call. **This is not a complete dynamic security analysis** and cannot detect arbitrary C++/binary vendors, indirect calls, encrypted destinations, native Sony traffic or DNS from launched applications.

### Immediate privacy controls — no USB, no custom firmware

1. Check **Settings → System Settings → Setup → Network → Samba Interactive TV** (path published by Samba for some non-Android Sony sets, exact labels vary by model/region). Set Samba **Disabled / Off** if the menu is present and currently enabled. Alternative paths listed by Sony: System Preferences → Samba Interactive TV, or Initial Setup → Samba Interactive TV. Do not use a hidden service/engineer menu to do this.
2. If Samba's privacy page offers **Reset device advertising ID**, it can unlink the old Samba ID; this does **not** by itself erase historical records held by Samba. Use their published privacy request channels for deletion where applicable.
3. Check stock Sony **Settings → System Settings → Setup → Privacy Policy** for discretionary data processing controls. Read the consequences before declining *Sony Smart TV* in general: the Sony Visual Products policy states refusal may disable Smart TV services and provision of DRM keys. Distinguish ACR/recommendation/marketing preferences from basic app access.
4. Optional, if you do not need network services right now: turn off the television's Internet access in ordinary network settings or on your own router. This immediately limits remote traffic but also disables all online apps and updates. Do not do this while updating firmware or if remote/network functions are required.
5. When convenient, review router DNS/outbound logs **for this TV only** (no packet modifications) to identify actual destinations, segregating boot, idle broadcast TV, HOME and each explicitly opened app. Do not block guessed domain strings from OEM binaries; shared CDN endpoints can also be DRM, firmware updates, clock synchronization or app authentication.

Official reference: https://help.samba.tv/hc/en-us/articles/360013056171-How-do-I-enable-or-disable-Samba-TV-on-my-Sony-Smart-TV
Sony Samba FAQ: https://www.sony.co.uk/electronics/support/articles/00182856
Sony privacy policy (Smart TV services/DRM tradeoff): https://www.sony.com/articleimage/servlet/servlet.FileDownload?file=0155F000007WDghQAG
Samba TV privacy rights: https://samba.tv/privacy-center/your-privacy-handbook

## Privacy acceptance gates for any future HOME release

| Gate | Required evidence | Until verified |
|---|---|---|
| First-party launcher no telemetry | Static source check and network-isolated browser run on the exact new commit | Build fails CI |
| No unsolicited app launches | Existing native/HTML input regressions + explicit user intent | Dispatch blocked |
| OEM Samba/ACR disabled | Actual TV consent setting, optionally network observation | **UNKNOWN** |
| OEM partner telemetry absent | Real traffic baseline with TV online, privacy settings documented | **UNKNOWN** |
| DRM/network service unaffected | Native HDMI/TV, authorized streaming tests on spare board | No firmware changes |
| Install and rollback safe | Verified full-device recovery + supported launch path | **NO-GO** |

## What is explicitly NOT done

- No actual Sony component was removed, stopped, patched or disabled.
- No fabricated Sony firmware, unsigned update, root script, privileged IPC sender, NFSB/verity bypass or flash instructions.
- No promise of stopping Netflix, YouTube, IVI or other vendor services from using necessary network resources when a person elects to use them.
- No claim that the expired Sony warranty changes data sharing contracts or privacy controls.
- No claim of verified protection of all OEM firmware or hardware traffic.

**Verdict:** privacy-hardening of **our code** can be prepared completely offline. The physical Sony remains in its original state until an authorized, reversible on-device control is changed or future compatible hardware integration has been tested.
