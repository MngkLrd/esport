# BRAVIA — re-audit of GitHub branch and source artifacts
**Date:** 2026-10-25 · **Branch:** `bravia-firmware-lab` · **Repo:** `MngkLrd/game`

## Verdict

**GitHub Actions CI: NOT GREEN; automated run blocked before any job steps.** Do **not** call these failed CI runs passing tests.

The branch previously had **no `.github/workflows/`**. A new `.github/workflows/bravia-offline-ci.yml` has been added. It covers native C99/DirectFB mock, cross-compiled ARMv7 EABI5 object, Stage8-12 offline logic, Node.js Sony bridge/navigation, Python offline firmware tooling, and mock-only Chromium Playwright. The workflow deliberately excludes physical Sony TV, real Sony keys/binaries, signed installer, and actual USB flashing.

GitHub run evidence:
- [Initial hosted CI attempt](https://github.com/MngkLrd/game/actions/runs/40230138766): failure before steps.
- [Runner-label retry](https://github.com/MngkLrd/game/actions/runs/40230378825): failure before steps.
- [Expanded full test workflow](https://github.com/MngkLrd/game/actions/runs/40230719821): failure before steps.

Each observed job reported `runner_id=0`, `steps=[]`, and no downloadable logs (job log redirect returned BlobNotFound). So these failures **do not prove the source tests failed**; they also **do not prove the code passed on GitHub**. Why a GitHub-hosted runner was not assigned is undetermined from the available API; investigate repository Actions settings, plan/billing/usage availability and GitHub workflow job annotations in the GitHub UI.

## Repairs committed to the branch

1. `stage14/build_arm.sh`: fixed source path from nonexistent `stage14/native_core` to actual `../native_core`.
2. `stage14/build_preview.py`: creates missing `previews` output directory before saving PNGs, allowing fresh checkout.
3. `stage14/run_tests.sh`: invokes `sh build_arm.sh` rather than assuming GitHub Content API stored executable file mode.
4. `stage9/test_lifecycle.c`: added previously untracked lifecycle negative-test module to GitHub source tree.
5. Added full `bravia-offline-ci.yml` workflow, including mock-only browser integration tests, 8/9 native ABI and lifecycle checks, 10/11/12 C tests, build and static Python checks.

## Independently repeated tests in isolated local environment

**These were run from the project's *locally supplied source ZIP archives*, not by GitHub-hosted runners.** Most Stage14 production core sources were previously uploaded to GitHub; some historical test-file variations mean artifact parity must not be represented as a full GitHub clean checkout.

| Source package | Offline tests executed | Outcome |
|---|---|---|
| Firmware Stage1 (archived sources) | 103 nonbrowser Python tests | **103 pass** |
| Firmware Stage1 browser tests | 50 Chromium tests | **50 pass** |
| Stage5 registered Sony catalog | 121 Node.js tests | **121 pass** |
| Stage5 browser integrations | 7 Chromium tests | **7 pass** |
| Stage8 ARM ABI metadata | 15 Python tests | **15 pass** |
| Stage10 original Sony ELF callbacks | 15 Python tests with owner originals supplied privately | **15 pass**, 0 skipped |
| Stage11 real original Sony IPC | 22 Python tests | **22 pass** |
| Stage12 original ARM dispatcher | 17 Python tests | **17 pass** |
| Stage13 original Sony OTA installer checks | 30 Python tests | **30 pass** |
| Stage14 product/ARM assets | 10 Python tests | **10 pass** |
| **Total independent Python + Node + Chromium** | **390 test cases** | **390 pass** |

**Extra C/ARM tests (not included in 390):** Stage9 C lifecycle + ASan/UBSan, Stage11 C observer, Stage12 C observer and 30 synthetic fragmentation patterns, Stage14 native C/DirectFB mock, Stage8 native C/DirectFB mock and Stage14 ARM EABI5 ET_REL compilation pass. Stage14 C remote-control stress validates 10,000 synthetic key events. No real Sony physical-device testing.

## Remaining correctness/release gates

- GitHub CI is currently **RED / UNEXECUTED**, since hosted jobs do not reach first step. Need fix repository Actions runner allocation, then require an actual green run.
- Real original Sony firmware OTA and derived OEM binary checks were executed locally only; by design they are absent from private GitHub and cannot run on a hosted runner unless a separate user-authorized secure, nonredistributable test environment is provided.
- The current ARM EABI5 file is **ET_REL, not an executable**, and mocked DirectFB is **not Sony's real DirectFB SDK**.
- No verified Sony `libapp_client` full callback ABI, on-device native HOME installation, ten real media clients, recovery, DRM playback or memory benchmarks.
- **Flash/install verdict: NO-GO.** Do not modify dm-verity / NFSB partition images or write them to the television.

**Recommendation:** resolve GitHub Actions runner allocation; require green CI on current branch; only then work on authorized on-device launch and recovery. Do not conflate green offline CI with Sony hardware support.
