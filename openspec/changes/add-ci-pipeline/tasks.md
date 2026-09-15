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

- [ ] 1.1 Create `.github/workflows/ci.yml` per design sketch, verbatim (D1–D6): triggers push→`main` + `pull_request`; `permissions: contents: read`; `concurrency` group `ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`; job `ci`: `ubuntu-latest`, `timeout-minutes: 15`; steps `checkout@v4`→`setup-node@v4` (`node-version: '22'`, `cache: npm`)→`npm ci`→`npm run typecheck`→`npm test`→`npm run build`.
- [ ] 1.2 Structural review vs 5 requirements (D8: Actions runs are the real validator): fail-fast gate order (R1), Node 22 + npm cache (R2), per-ref concurrency (R3); `git status`: only `.github/workflows/ci.yml` new.

## Phase 2: Commit, push, green gate

- [ ] 2.1 Commit ONLY `.github/workflows/ci.yml` (Spanish conventional message, `ci: …`); `git show --stat` lists only that path; push to `main`.
- [ ] 2.2 Observe push run green (`gh run watch`/`gh run view --log`): Node 22.x, npm-cache line, four gates green in order, `npm ci` lockfile untouched; record run URL.

## Phase 3: Red proof (D7)

- [ ] 3.1 From `main`: branch `ci/red-proof`; one commit adding `src/ci-proof.ts` (`const proof: string = 42;`); `gh pr create`.
- [ ] 3.2 Observe PR run red: typecheck fails, test+build skipped (R1 fail-fast); capture run URL.
- [ ] 3.3 `gh pr close --delete-branch`; verify `git log main` holds no proof commit.

## Phase 4: Final gates

- [ ] 4.1 Footprint (R4): `git diff <change-commit>^ --name-only`→only `.github/workflows/ci.yml`; `package.json`/`src/`/`convex/` byte-unchanged; no test touched.
- [ ] 4.2 Fresh `main` run green (R5; next push, e.g. archive commit, triggers it; record URL); 12/12 rows verified.

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
