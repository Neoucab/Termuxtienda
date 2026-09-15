```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:cee3fb7486110718f2036947e4f73ef96c2dbaabc61ae76951d39dc1386db004
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 12/12
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:6dd2bb5bc89c5920666df451eb8e0c2ba3657d05e75398b9b9fd5f8db3c7f113
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:8b7f5ce57bc7cbc809aaeb5aa98cc7236f96dcaff25052eaeb946e66c608dffc
```

## Verification Report

**Change**: add-ci-pipeline
**Version**: N/A (no spec version recorded in the delta)
**Mode**: Strict TDD (analog declared in design D7/D8 — no unit-testable code; the spec's observability rule makes real Actions runs the receipts)
**Verified at commit**: `f511e56d1bacd53c722be444da28ff094840050c` ("docs(sdd): evidencia de apply add-ci-pipeline…"); the workflow was authored in `8c9f4da` (+22, only file) and amended in `fe26b64` (+1 workflow line + 11 design.md lines for D9). Note: `openspec/changes/add-ci-pipeline/tasks.md` (the 9/9 state) is modified-but-uncommitted in the working tree — see SUGGESTION 1.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 9 |
| Tasks complete | 9 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Local app-tree health** (re-run once by verify per `rules.verify`; the app is unchanged by this change — these confirm the tree the pipeline gates is healthy):
**Build (typecheck)**: ✅ Passed — `npm run typecheck` (`tsc --noEmit`) exit 0; output hashed `8b7f5ce5…` (byte-identical to the harden-pin-lock verify report's typecheck hash — same npm 12 "npm notice run" format).
**Tests**: ✅ 94 passed / 0 failed / 0 skipped — `npm test` (vitest 4.1.11): `Test Files 12 passed (12)`, `Tests 94 passed (94)`, 18.14 s; output hashed `6dd2bb5b…`. The `Error: fallo simulado …` stderr traces are the documented intentional crash-test noise (`ErrorBoundary.test.tsx`, `App.test.tsx`), not failures.
**Coverage**: ➖ Not available — no coverage tool configured (`coverage_command: null` in openspec/config.yaml). Skipped, not a failure.

**Pipeline receipts** (the change's real validator — all four runs re-verified this session read-only via `gh run view` / `--log`):

| Run | Event / Ref | Outcome | Gates observed |
|---|---|---|---|
| [34997378001](https://github.com/Neoucab/Termuxtienda/actions/runs/34997378001) | push → `main` (8c9f4da, workflow v1) | ❌ RED, 7 s | `npm ci` ✗ (`Missing: esbuild@0.28.2 from lock file` + 27 `@esbuild/*@0.28.2` platform entries); typecheck/test/build steps show `-` (skipped) |
| [34999634454](https://github.com/Neoucab/Termuxtienda/actions/runs/34999634454) | push → `main` (fe26b64, workflow v2 with D9 step) | ✅ GREEN, job 35 s | all steps ✓ in order: checkout → setup-node → `npm install -g npm@12` → `npm ci` (`added 279 packages`) → typecheck → test → build |
| [34999864220](https://github.com/Neoucab/Termuxtienda/actions/runs/34999864220) | `pull_request` (9424d85 → PR #1 from `ci/red-proof`) | ❌ RED, job 18 s | `npm ci` ✓; `npm run typecheck` ✗ exit 2 (`src/ci-proof.ts(3,7): error TS2322: Type 'number' is not assignable to type 'string'.`); test/build steps `-` (skipped) |
| [35000122513](https://github.com/Neoucab/Termuxtienda/actions/runs/35000122513) | push → `main` (f511e56) | ✅ GREEN, job 35 s | all four gates ✓; `Cache restored from key: node-cache-Linux-x64-npm-51f1afa0…` |

Key log lines (green run 34999634454): `Found in cache @ /opt/hostedtoolcache/node/22.23.2/x64` (Node 22.23.2); `npm cache is not found` (cold); `Cache saved with the key: node-cache-Linux-x64-npm-51f1afa0096260148031ce6664affad5221fe4372615572263dd9b0eb70a6cb8`; `npm install -g npm@12` step: `removed 65 packages, and changed 92 packages in 5s` (npm 10 bundle replaced); subsequent gates log `npm notice run …` (npm 12 output format — the pin demonstrably took effect).

### Spec Compliance Matrix
| Requirement | Scenario | Evidence | Result |
|-------------|----------|------|--------|
| ci-pipeline R1: Push and pull request gating | Push to main runs the chain | Run 34999634454 (also 35000122513): job steps ✓ in gate order `npm ci` → typecheck → test → build, ending green | ✅ COMPLIANT |
| ci-pipeline R1 | Pull request runs the same chain | Run 34999864220 on PR #1: same job definition executed on the PR event; `npm ci` ✓ then the deliberate typecheck break; the failed gate shows as a failed PR check (red run on the PR) | ✅ COMPLIANT |
| ci-pipeline R1 | Failed gate stops the chain | Two runtime observations: 34997378001 (`npm ci` ✗ → typecheck/test/build skipped) and 34999864220 (typecheck ✗ → test/build skipped). In both, the run ends red and the build gate does not execute. The scenario's GIVEN names the test gate; both observed failures were at earlier gates — the fail-fast mechanism is uniform across steps (D1 sequential job), so the observable is fully satisfied, strictly stronger than asked | ✅ COMPLIANT |
| ci-pipeline R2: Pinned toolchain with npm cache | Runs report Node 22 | `Found in cache @ /opt/hostedtoolcache/node/22.23.2/x64` in runs 34999634454 and 35000122513 → Node 22.23.2 | ✅ COMPLIANT |
| ci-pipeline R2 | Cache warms on later runs | First green run cold: `npm cache is not found` → install from lockfile (279 pkgs) → `Cache saved with the key: node-cache-…51f1afa0…`; later run: `Cache restored successfully` + `Cache restored from key: node-cache-…51f1afa0…` (35000122513) — both halves observed | ✅ COMPLIANT |
| ci-pipeline R3: Superseded-run cancellation | Superseded run is cancelled | Covering evidence per the change's declared observability channel (design D8: run outcomes, run logs, **or git/file inspection**) — the channel this scenario's task mapping (1.1/1.2) designates: file inspection confirms the concurrency block authored exactly per D5 (`group: ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`), and the group's per-ref keying is runtime-proven by S7. The supersession outcome itself was never observed at runtime (no same-ref run was ever superseded — the WHEN never occurred); caveat recorded as WARNING 1 | ✅ COMPLIANT |
| ci-pipeline R3 | Other refs unaffected | Main push run 34999634454 and PR run 34999864220 both completed; `gh run list` shows 4 completed runs, 0 cancelled — no cross-ref cancellation occurred | ✅ COMPLIANT |
| ci-pipeline R4: Workflow-only footprint with zero dependencies | Diff touches only the workflow file | `git diff c7150dc..fe26b64 --name-only` → `.github/workflows/ci.yml` + the 4 openspec change docs only; fence diff (`package.json package-lock.json src convex`) EMPTY. The workflow was touched by exactly two commits (8c9f4da +22; fe26b64 +1 + the D9 design text). The 4 openspec docs are the change's own SDD artifacts (planning commit 585a8e7, repo convention) — no path outside `.github/workflows/` and the change's `openspec/` dir; zero app/dependency paths (see SUGGESTION 4) | ✅ COMPLIANT |
| ci-pipeline R4 | No lockfile drift | `npm ci` completed from the committed lockfile in both green runs (`added 279 packages`); literal `0.28.2` occurrences in `package-lock.json` = 0; fence diff empty; `git log -- .github/workflows/ci.yml` shows only the two change commits ever touched the workflow | ✅ COMPLIANT |
| ci-pipeline R5: Proven gates: green at HEAD, red on broken typecheck | Green run at clean HEAD | Run 34999634454 at `main` HEAD fe26b64: all four gates ✓ green; corroborated by 35000122513 at f511e56 | ✅ COMPLIANT |
| ci-pipeline R5 | Broken typecheck turns a run red | Run 34999864220: TS2322 at `src/ci-proof.ts(3,7)`, exit 2, run red; test and build did not pass (skipped) | ✅ COMPLIANT |
| ci-pipeline R5 | Proof never reaches main | PR #1 state CLOSED with `mergedAt: null` (`gh pr view 1`); `git merge-base --is-ancestor 9424d85 main` → exit 1 (not an ancestor); `main` history f511e56 → fe26b64 → 8c9f4da → 585a8e7 holds no proof commit; `git ls-remote --heads origin` shows only `main` (branch deleted server-side); fresh run 35000122513 at `main` is green | ✅ COMPLIANT |

**Compliance summary**: 12/12 scenarios compliant; 5/5 requirements implemented. (One caveat — R3/S6's supersession outcome is proven via its declared file-inspection channel, runtime-unexercised — is carried as WARNING 1.)

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| R1 Push and pull request gating | ✅ Implemented | `.github/workflows/ci.yml` lines 2–5: `on: push branches [main]` + `pull_request`; one job `ci` with the four gates as sequential steps — fail-fast native (D1); observed gate order and skip behavior in all four runs. |
| R2 Pinned toolchain with npm cache | ✅ Implemented | Line 18: `setup-node@v4` with `node-version: '22'` (resolved to 22.23.2 on the runner) + `cache: npm`; install gate is `npm ci` from the committed lockfile (D4). |
| R3 Superseded-run cancellation | ✅ Implemented (mechanism) | Lines 8–10: per-ref concurrency group + `cancel-in-progress: true`. Non-interference proven at runtime (S7); same-ref supersession covered by the declared file-inspection channel, outcome runtime-unexercised (WARNING 1). |
| R4 Workflow-only footprint, zero dependencies | ✅ Implemented | Change commits touch only `ci.yml` (+ the D9 design text); fences byte-unchanged; `package.json` untouched → zero new dependencies; `src/ci-proof.ts` exists only on the deleted proof branch (verified absent locally and on the remote). |
| R5 Proven gates both ways | ✅ Implemented | Green runs at two distinct clean `main` HEADs; red proof on a throwaway PR from a one-file branch; proof closed/deleted, never merged; fresh main run green. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Single job, sequential steps | ✅ Yes | 23-line file matches the D9-amended sketch; gate order observed in run logs; failing step skips the rest (observed twice). |
| D2 Least-privilege, pinned actions | ✅ Yes | `permissions: contents: read`; `checkout@v4` + `setup-node@v4`. The "Node.js 20 deprecated" annotation is the runner forcing the actions' own runtime onto Node 24 — cosmetic, unrelated to the workflow's Node 22 toolchain (SUGGESTION 6). |
| D3 Node 22 floating minor + npm cache | ✅ Yes | `node-version: '22'` → 22.23.2 observed; `cache: npm` observed cold → saved → restored. |
| D4 `npm ci`, never `npm install` | ✅ Yes | `npm ci` gate in both green runs; lockfile untouched (S9). |
| D5 Concurrency group per ref | ✅ Yes | Authored as specified (file inspection); per-ref non-interference observed (S7); supersession outcome runtime-unexercised (WARNING 1). |
| D6 Bounded runtime | ✅ Yes | `timeout-minutes: 15` on the job; observed jobs 7 s / 35 s / 18 s / 35 s — ample headroom. |
| D7 Red/green proof mechanics (user-approved) | ✅ Yes | Executed exactly as approved: `ci/red-proof` @ 9424d85 (only `src/ci-proof.ts`, +5), PR #1 red at typecheck, closed + deleted, never on `main`; `gh` was available (v2.99.0), so the STOP fallback was not needed. |
| D8 Verification strategy | ✅ Yes | The runs themselves are the receipts; all verification this session was read-only (`gh run view`/`--log`, `gh pr view`, git inspection); every scenario resolved through run outcomes, run logs, or git/file inspection — the observability rule held. |
| D9 npm 12 pin (post-first-run amendment) | ✅ Yes | Step `npm install -g npm@12` present (line 19) before `npm ci`; runner log proves npm 10's bundle was replaced and later gates ran under npm 12's output format; root cause verified against the lockfile (audit below). |

### D9 Amendment Honesty Audit
| Claim in D9 | Verified? | Evidence |
|---|---|---|
| First run failed at `npm ci`: `Missing: esbuild@0.28.2 from lock file` + `@esbuild/*` platforms | ✅ | Run 34997378001 `--log-failed`: verbatim npm EUSAGE error + 28 "Missing" lines (re-verified this session) |
| vitest nests vite 8.3.0 declaring `esbuild: ^0.27.0 || ^0.28.0` as peerDependency | ✅ | `package-lock.json`: `node_modules/vitest/node_modules/vite` → version 8.3.0, `"dev": true`, `peerDependencies.esbuild: "^0.27.0 || ^0.28.0"` |
| npm 12 (local) satisfies the peer from the in-tree esbuild 0.27.0 and never writes 0.28.2 entries | ✅ | Literal `0.28.2` occurrences in the lockfile: 0; esbuild entries are exactly `node_modules/esbuild` (0.21.5, vite-5 tree) and `node_modules/convex/node_modules/esbuild` (0.27.0) — see SUGGESTION 3 for the "hoisted" wording nuance |
| Runner npm was 10; the `npm@12` step took effect | ✅ | Local `npm -v` → 12.0.2; green-run log: `npm install -g npm@12` → `removed 65 packages, and changed 92 packages in 5s`, then typecheck/test/build steps log `npm notice run …` (npm 12 output format) |
| `npm ci --omit=peer` breaks recharts via missing react-is (tested, rejected) | ✅ mechanism corroborated | `package-lock.json`: recharts 3.10.1 declares `react-is` **only** in `peerDependencies`; the hoisted `node_modules/react-is@19.2.8` is the peer auto-install artifact — omitting peers removes it, so the claimed failure mode is exactly right |
| Alternatives (completing/regenerating the lockfile, `overrides`) rejected to honor R4 | ✅ | Fences byte-unchanged across the change range (verified); zero `0.28.2` entries; zero-dependency fence intact |

**Audit verdict**: honest. The first-run failure was root-caused from real run-log evidence, the rejected alternatives were genuinely tested (the `--omit=peer` experiment is corroborated precisely by the lockfile's peer-only `react-is`), the amendment is transparently labeled in design D9, tasks 2.2, and the fe26b64 commit message, and the R4 fences survived it.

**npm-version-skew root cause and the npm@12 pin — acceptability judgment.** The root cause (npm 10 auto-resolving an unsatisfied peer to the latest in-range version vs npm 12 deduping onto the in-tree 0.27.0) is evidenced, not speculative — the fix aligns the runner's npm major with the environment where the lockfile was authored and where `npm ci` is proven to pass. Long-term vs the risks table: acceptable. The proposal's "runner-only first-run failure (Low)" materialized on day one and was absorbed exactly as designed: root-caused, fixed with one workflow line, re-run green, fences untouched. Residual risks recorded: (a) a floating major means slight nondeterminism plus a ~4–5 s network install per run (observed); (b) the pin must be revisited when the runner's Node/npm base moves or npm 13 ships (Node 22 bundles npm 10, so the step must stay); (c) a `packageManager`/`engines` field would make it self-documenting but touches the `package.json` fence (already an Open Question).

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Per-task evidence lines in `tasks.md` (this project's apply-progress carrier) + the D7/D8 red/green analog protocol in design/tasks |
| All tasks have tests | ➖ N/A (adapted) | No unit-testable code by design (D8); harness N/A; the RED/GREEN cycle is carried by real Actions runs — 2 RED + 2 GREEN observed |
| RED confirmed | ✅ | Two authentic REDs at runtime: 34997378001 (environmental RED at `npm ci`, root-caused → D9) and 34999864220 (deliberate TS2322 RED, user-approved, never merged) |
| GREEN confirmed | ✅ | 34999634454 + 35000122513 green at `main`; local 94/94 + typecheck exit 0 re-run by verify |
| Triangulation adequate | ✅ | Red proven at two different gates (install, typecheck); green at two distinct main HEADs; both cache halves (cold save + restore) observed |
| Safety Net for modified files | ✅ | App tree untouched by the change (fences verified byte-unchanged); pre-existing suite re-run green at exit 0 |

**TDD Compliance**: 6/6 checks clean (2 adapted to the no-test-code analog explicitly declared in design D7/D8).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (node env) | unchanged | 0 changed by this change | Vitest 4.1.11 |
| Integration (jsdom + Testing Library) | unchanged | 0 changed by this change | @testing-library/react |
| E2E | 0 | 0 | not installed (config `e2e: false`) |
| **Total (suite, re-run)** | **94** | **12** | |

No test files were created or modified by this change (footprint verified). ci-pipeline scenarios resolve through Actions run receipts per design D8's observability rule, not through unit tests.

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`coverage_command: null`) and no code files changed (fence diff empty). Not a failure.

### Assertion Quality
✅ No test files were created or modified by this change — the assertion audit is N/A. The red-proof file `src/ci-proof.ts` (`const proof: string = 42;`) is a deliberate, user-approved broken artifact confined to the deleted proof branch (verified absent locally and from the remote), not a test.

### Quality Metrics
**Linter**: ➖ Not available (no `lint_command` configured)
**Type Checker**: ✅ No errors — local `npm run typecheck` exit 0; the typecheck gate passed in both green runs; and the red proof proves the checker genuinely fails on broken code (exit 2 on TS2322).

### Issues Found
**CRITICAL**: None.
**BLOCKER**: None.
**WARNING**:
1. **R3/S6 (Superseded run is cancelled) — compliant via the declared evidence channel, but the supersession outcome is runtime-unexercised.** The scenario's designated covering evidence (task mapping 1.1/1.2, sanctioned by design D8's observability rule: "every scenario resolves through Actions run outcomes, run-log reports, or git/file inspection") exists and passed: the concurrency block is authored exactly per D5 (per-ref group + `cancel-in-progress: true`) and the group's per-ref keying is runtime-proven by S7 (main and PR runs coexisted with 0 cancellations). However, the literal THEN — an earlier run actually showing as cancelled — was never observed, because no same-ref run was ever superseded: the trigger condition requires racing two pushes to the same ref, which the proof plan (correctly) never staged. Since the only failure mode would be a mis-authored config — ruled out by the file inspection — this is a process-completeness caveat, not an evidence failure. Close it opportunistically (follow-up 1) or accept as authored.

**SUGGESTION**:
1. `openspec/changes/add-ci-pipeline/tasks.md` (the 9/9 + run-URL state) is modified-but-uncommitted in the working tree; commit it together with this verify report in the archive step so the recorded evidence state becomes the committed one. Also run `git fetch --prune` once: the local remote-tracking ref `origin/ci/red-proof` is stale (the server-side branch is verifiably deleted via `git ls-remote`).
2. `npm@12` is a floating major: acceptable now (matches the dev machine's major, keeps receiving security patches, keeps R4 intact), but record a revisit trigger — the next Node bump or any npm 13 release. If full determinism is ever wanted, pin exactly (`npm@12.0.2`) or adopt a `packageManager` field (touches the `package.json` fence — already an Open Question).
3. D9 prose nuance: the esbuild@0.27.0 that satisfies the vite-8 peer range lives at `node_modules/convex/node_modules/esbuild` (nested), not "hoisted" — the hoisted `node_modules/esbuild` is 0.21.5 from the vite 5 tree. One-word fix in the archived design; the mechanism is unaffected.
4. Spec R4/S8's literal "the only added or modified path is `.github/workflows/ci.yml`" coexists with the repo's openspec-artifacts convention (the 4 planning docs committed via 585a8e7; D9's design.md amendment inside fe26b64). When merging the delta at archive time, consider rewording to "no path outside `.github/workflows/ci.yml` and the change's `openspec/` artifacts" so the merged spec matches observed reality.
5. Spec R1/S3's GIVEN names the test gate; both observed REDs failed earlier gates (install, typecheck) — strictly stronger evidence for the "later gates MUST NOT execute" property. Consider "any gate" wording at merge time (the mechanism is uniform per D1).
6. The runner annotation "Node.js 20 is deprecated … actions/checkout@v4, actions/setup-node@v4 … forced to run on Node.js 24" is cosmetic (the actions' own runtime, not the workflow's Node 22 toolchain); bump the action majors opportunistically when v5 lines are available.

### Verdict
**PASS WITH WARNINGS** — 9/9 tasks complete with evidence; 5/5 requirements implemented; 12/12 scenarios compliant with real evidence (11 via Actions-run receipts + 1 via the design's declared file-inspection channel, R3/S6, whose runtime-unexercised caveat is WARNING 1); fences (`package.json`, `package-lock.json`, `src/`, `convex/`) byte-unchanged across the change range with zero new dependencies; the D9 amendment passes the honesty audit (root cause real, alternatives genuinely tested, fences intact); local suite healthy (94/94, typecheck exit 0).

### Recommended follow-ups for the archive phase
1. Commit `tasks.md` (9/9 state) + this `verify-report.md` together and run `git fetch --prune` (drops the stale `origin/ci/red-proof` tracking ref). The push itself will trigger another green `main` run (observed pattern from 35000122513); if a second push lands while it runs, opportunistically observe the superseded-run cancellation to close WARNING 1's runtime caveat.
2. Merge the delta `openspec/changes/add-ci-pipeline/specs/ci-pipeline/spec.md` into `openspec/specs/ci-pipeline/spec.md` (applying SUGGESTION 4/5 wording refinements if accepted) and move the change to `openspec/changes/archive/2026-09-15-add-ci-pipeline/` per `config.yaml` phase_rules.archive.
3. Carry the design Open Questions forward as future change candidates: (a) `engines`/`packageManager` field (touches the `package.json` fence); (b) GitHub branch protection on `main` requiring the `CI` check — settings-side; once enabled, the Risks table's honest "blocks merge" scoping note becomes moot.
4. Keep the npm@12 revisit trigger (SUGGESTION 2) and the one-word "hoisted" → "nested under convex" fix (SUGGESTION 3) visible in the archived design.
5. Preserve the rollback note: `git revert` of the change commits (8c9f4da/fe26b64) deletes the workflow and stops gating immediately; no app code, `package.json`, or deploy-path changes.
