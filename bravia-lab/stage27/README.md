# Stage 27 — RUTUBE embedded Sony Cobalt client (local web app)

The owner changed the implementation requirement: streaming services may be TV-hosted HTML5/Cobalt web clients, provided all navigation works from the Sony remote. **No computer, additional backend, locally hosted website, or remote HOME overlay is needed at runtime.**

A complete ZIP source deliverable **BRAVIA_STAGE27_RUTUBE_LOCAL_TV_CLIENT.zip**, SHA256
`7aca67ad5add0f81605ac931bddb5d5160c2a361fedbf587dcf9c5483aa5c0cf`,
was created for the user in the conversation. It contains the entire authored client, integration adapter, tests and original assets; no Sony OEM binaries or DRM keys.

What the client implements:
- ES5-compatible static HTML5/CSS app designed for the *original* Sony Cobalt HTML5UI environment, **not** a replacement HOME page.
- Sony D-pad and OK/BACK, playback/seek keys; system volume, channel and OPTIONS pass through.
- RUTUBE official iframe `https://rutube.ru/play/embed/<id>` and source-verified `postMessage` `player:play`, `player:pause`, `player:relativelySeek`, with ready/error/time events.
- Optional direct HLS HTMLMediaElement path from public `/api/play/options/<id>/` when Cobalt supports HLS and server permits access. No DRM bypass, transcoding, proxy or ad interception.
- Public search via `/api/search/video` (unofficial/unversioned, CORS may deny access), remote on-screen Cyrillic keyboard, 32-hex ID entry, official sample video ID.
- Exact SHA-pinned Sony HTML5UI resource patcher working **offline** against the privately extracted original OEM `index.html` and `allappsmodule.js`; the overlay includes a local TV-side `file:///html5ui/bravia_clients/rutube/index.html` route.
- 13 JavaScript and six Python tests all pass off-device; a private exact-OEM HTML5UI overlay was successfully assembled from owner-provided original Sony 8.931 data.

**Important: NOT a user-installable Sony update.** OEM `HomeuiInterface.LaunchApp({uri:...})` is confirmed as source API, but actual Sony acceptance of this local file URI is unknown; the physical HOME key also uses native DockUI and may not display the Cobalt HTML5UI layer. Physical TV RUTUBE playback is not established. Sony firmware partitions remain read-only dm-verity/NFSB; no authorized persistent deployment route or signature/recovery proven.

The handoff ZIP, not Sony firmware, is the code artifact for this stage. Do not run it through Sony's USB Firmware Update.

Sources:
- Official RUTUBE embed and player command documentation https://rutube.ru/info/embed/
- Sony Cobalt original firmware was supplied privately by the user and is not committed.
