# Tasks: add-ci-pipeline

Strict-TDD analog (D7/D8): one YAML file, no unit-testable code, harness N/A; RED/GREEN: author→green at HEAD→red on throwaway PR→cleanup + fresh green. Fences (change commit, byte-unchanged): `package.json`, `src/`, `convex/` (R4; no test touched); `src/ci-proof.ts` lives only on `ci/red-proof`, never merges. `gh` v2.99.0 authenticated (Neoucab): D7 PR leg executable; `gh` failure→STOP, never fake proof.

## Review Workload Forecast

| Field | Value |
|---|---|
| Changed lines | ~25 (1 file) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | direct push to `main` (D7) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

Work units (harness N/A — Actions runs are the proof):
- WU1 `.github/workflows/ci.yml`→one change commit on `main`; proof: push run green (`gh run watch`/`gh run view --log`); rollback: `git revert`.
- WU2 `ci/red-proof` (`src/ci-proof.ts`)→proof PR, never merges; proof: PR run red at typecheck; rollback: `gh pr close --delete-branch`.

## Phase 1: Workflow authoring (structural)

- [x] 1.1 Create `.github/workflows/ci.yml` per design sketch, verbatim (D1–D6): triggers push→`main` + `pull_request`; `permissions: contents: read`; `concurrency` group `ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`; job `ci`: `ubuntu-latest`, `timeout-minutes: 15`; steps `checkout@v4`→`setup-node@v4` (`node-version: '22'`, `cache: npm`)→`npm ci`→`npm run typecheck`→`npm test`→`npm run build`. — Evidence: authored verbatim (22 lines); D9 amendment after run 1 adds one step (`npm install -g npm@12`); committed 8c9f4da.
- [x] 1.2 Structural review vs 5 requirements (D8: Actions runs are the real validator): fail-fast gate order (R1), Node 22 + npm cache (R2), per-ref concurrency (R3); `git status`: only `.github/workflows/ci.yml` new. — Evidence: R1 steps sequential (fail-fast native); R2 `node-version: '22'` + `cache: npm`; R3 group keyed `ci-${{ github.workflow }}-${{ github.ref }}`; status showed only `.github/` + openspec change dir untracked.
- [x] 2.1 Commit ONLY `.github/workflows/ci.yml` (Spanish conventional message, `ci: …`); `git show --stat` lists only that path; push to `main`. — Evidence: 585a8e7 (openspec planning artifacts, separate docs commit) + 8c9f4da (`git show --stat`: only `.github/workflows/ci.yml`, +22); pushed `c7150dc..8c9f4da`.
- [x] 2.2 Observe push run green (`gh run watch`/`gh run view --log`): Node 22.x, npm-cache line, four gates green in order, `npm ci` lockfile untouched; record run URL. — Evidence: first run 34997378001 RED at `npm ci` (runner npm 10 demanded esbuild@0.28.2 peer entries npm 12 never wrote — real env defect, root-caused and fixed as design D9, commit fe26b64). Re-run 34999634454 GREEN in 35 s: gates in order `npm ci` (279 pkgs) → typecheck → test → build; log `Found in cache @ /opt/hostedtoolcache/node/22.23.2/x64` (Node 22.23.2), `npm cache is not found` → `Cache saved with the key: node-cache-Linux-x64-npm-51f1afa0…` (cold-first); tree clean after (lockfile untouched). URL: https://github.com/Neoucab/Termuxtienda/actions/runs/34999634454
- [x] 3.1 From `main`: branch `ci/red-proof`; one commit adding `src/ci-proof.ts` (`const proof: string = 42;`); `gh pr create`. — Evidence: 9424d85 (+5, only that file); PR #1 https://github.com/Neoucab/Termuxtienda/pull/1 (user-approved throwaway, never merges).
- [x] 3.2 Observe PR run red: typecheck fails, test+build skipped (R1 fail-fast); capture run URL. — Evidence: run 34999864220 RED in 18 s; only gate failed = typecheck (`src/ci-proof.ts(3,7): error TS2322: Type 'number' is not assignable to type 'string'`); test/build did not execute.
- [x] 3.3 `gh pr close --delete-branch`; verify `git log main` holds no proof commit. — Evidence: PR #1 closed, `ci/red-proof` deleted remote+local; main at fe26b64 → 8c9f4da → 585a8e7 (no proof commit); only local branch `main`.
- [x] 4.1 Footprint (R4): `git diff <change-commit>^ --name-only`→only `.github/workflows/ci.yml`; `package.json`/`src/`/`convex/` byte-unchanged; no test touched. — Evidence: `git diff c7150dc..fe26b64 --name-only` → `.github/workflows/ci.yml` + the 4 openspec docs only; `--stat -- package.json package-lock.json src convex` → empty (fences byte-unchanged, no test touched).
- [x] 4.2 Fresh `main` run green (R5; next push, e.g. archive commit, triggers it; record URL); 12/12 rows verified. — Evidence: run 35000122513 GREEN in 35 s (evidence-commit push f511e56): all four gates; `Cache restored from key: node-cache-Linux-x64-npm-51f1afa0…` (scenario 5 restore half); URL https://github.com/Neoucab/Termuxtienda/actions/runs/35000122513. All 12 mapping rows verified: 1→2.2 (34999634454), 2+3+11→3.2 (34999864220), 4→2.2 (Node 22.23.2), 5→2.2+4.2 (cold+restore), 6→1.1/1.2 (authored per-ref), 7→2.2+3.2 (main+PR runs coexisted, no cross-cancel), 8+9→4.1, 10→2.2 (green at HEAD), 12→3.3+4.2 (main clean + fresh green).

## Scenario → task/verification mapping

# | Task | Scenario (proof)
1 | 2.2 | push main: 4 gates green in order
2 | 3.2 | PR: failed gate = failed PR check
3 | 3.2 | typecheck red, test/build skipped
4 | 2.2 | log reports Node 22.x
5 | 2.2, 4.2 | cold first, restore later
6 | 1.1, 1.2 | per-ref concurrency authored (file inspection)
7 | 2.2, 3.2 | main+PR runs, no cross-cancel
8 | 4.1 | diff: only workflow path
9 | 2.2, 4.1 | clean install, no lockfile diff
10 | 2.2 | green run at clean HEAD
11 | 3.2 | PR red at typecheck
12 | 3.3, 4.2 | main clean; fresh run green
