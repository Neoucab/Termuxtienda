# Design: add-ci-pipeline

## Context

Gap #7 (`docs/audit-pre-dev.md`): nothing gates a push — no `.github/` directory exists (re-verified 2026-09-15 at HEAD `c7150dc`), no deploy target is configured in-repo (the audit's `netlify.toml` never existed in tree or history), and the only build command is `npm run build`. `typecheck` and `test` exist and pass locally (12 files / 94 tests, ~95 s on this machine — dominated by PBKDF2 210k-iteration derivations in jsdom), but nothing invokes them on push, so broken commits reach `main` directly.

The local machine cannot execute GitHub Actions; verification of this change is necessarily behavioral: push, then observe the real run outcomes (green at HEAD; red on the approved throwaway broken-typecheck PR — user-approved 2026-09-15, never touching `main`). The spec's observability rule means every scenario resolves through Actions run outcomes, run-log reports, or git/file inspection — no scenario requires reading the YAML's intent.

## Goals / Non-goals

**Goals.** One workflow gating every push to `main` and every PR with the fail-fast chain `npm ci` → `typecheck` → `test` → `build` on pinned Node 22 with an npm cache; superseded same-ref runs cancelled; zero new dependencies; the change's diff touches only `.github/workflows/ci.yml`; gates proven both green (clean HEAD) and red (deliberate type error) with the proof reverted from `main`.

**Non-goals.** Deploy step (no target configured in-repo); branch protection rules (a GitHub settings change, not a file — see Risks for the honest consequence); lint/format (gap #8, separate change); build matrix; artifact uploads; Dependabot/Renovate; Convex codegen or auth (gaps #2/#3, deferred: need interactive Convex login); local git hooks.

## Decisions

### D1 — Single job with sequential steps (fail-fast by construction)

**Choice.** One job `ci` on `ubuntu-latest`; the four gates are steps in order. GitHub Actions steps run sequentially and a failed step skips the rest, so "a failed gate fails the run and later gates MUST NOT execute" (spec R1) holds natively.

**Alternatives.** Parallel jobs per gate — rejected: each job pays its own checkout + install (~1 min each), total wall-clock equal or worse, and with default job continuation a failing typecheck would still let test/build run — violating R1. `needs:` chains — rejected: same cost, more YAML, no benefit at this scale.

### D2 — Least-privilege actions, pinned versions

**Choice.** Top-level `permissions: contents: read` (the pipeline only reads the repo); `actions/checkout@v4` then `actions/setup-node@v4`.

**Alternatives.** Default token permissions — rejected: grants write scopes a read-only pipeline never uses. Pinned SHAs instead of version tags — rejected: unpinned-by-SHA is the common tradeoff for a private-ish workflow with zero secrets; SHA pinning is a hardening follow-up, not a spec requirement.

### D3 — Node 22, floating minor, npm cache

**Choice.** `setup-node` with `node-version: '22'` (resolves to the latest 22.x on the runner) and `cache: npm`.

**Alternatives.** Node 20 — rejected: EOL 2026-04-30, no security patches since; shipping an unsupported runtime on day one. Exact pin (e.g. `22.11.0`) — rejected: freezes away security patches; the spec's observable is "Node 22.x", satisfied by the floating major. `cache: npm` keys on `package-lock.json`, so the first run is cold (R2 scenario covers it) and later runs restore — observable in the run log.

**Rationale.** Local dev runs Node 24.17; CI pins 22 because that is the supported-LTS intersection with Vite 5/Vitest 4. The minor drift between local and CI is accepted and recorded in Risks; an `engines` field would close it but touches the `package.json` fence (see Open Questions).

### D4 — `npm ci`, never `npm install`

**Choice.** The install gate is `npm ci`: removes `node_modules`, installs strictly from `package-lock.json`, fails on manifest/lockfile drift.

**Alternatives.** `npm install --frozen-lockfile` — rejected: redundant; `npm ci` already refuses to mutate the lockfile (covers spec R4's "No lockfile drift" scenario). Running `npm ci` twice for cache evidence — rejected: the cache-restore line in the setup-node step's log is the observable.

### D5 — Concurrency group per ref

**Choice.** `concurrency: { group: ci-${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`.

**Rationale.** `github.ref` is `refs/heads/main` for pushes to main and `refs/pull/<n>/merge` for PR runs, so different refs land in different groups (spec R3: neither cancels the other) while successive commits to the same PR or repeated pushes to main supersede the stale run (spec R3: same-ref cancellation). `github.workflow` is redundant today (one workflow) but keeps the group namespaced if a second workflow ever lands.

### D6 — Bounded runtime

**Choice.** `timeout-minutes: 15` on the job.

**Rationale.** The chain takes ~2–4 min on a runner (cold install ≈1 min, suite faster than the 95 s local figure, `vite build` seconds). 15 is ample headroom while bounding a hung run's free-tier cost; the default (360 min) could burn hours on a stuck process.

### D7 — Red/green proof mechanics (user-approved)

**Choice.** Two-phase proof, both observable as Actions outcomes:

1. **Green**: push the change commit to `main` → the push run must end green with all four gates passed (spec R5 scenario 1).
2. **Red**: from `main`, create throwaway branch `ci/red-proof` with one commit adding a single new file `src/ci-proof.ts` containing a deliberate type error (`const proof: string = 42;`) — one new file, no existing file touched. Open a PR from it → the `pull_request` run must fail at the **typecheck** gate with test and build skipped (R1 fail-fast + R5 scenario 2). Capture the run URL. Close the PR and delete the branch — no proof commit ever merges (R5 scenario 3: verify `git log main` holds none and a fresh run at main is green; the post-archive commit naturally triggers that fresh run).

**Execution dependency.** Opening the PR requires `gh` CLI authenticated as the repo owner (`gh pr create`). If `gh` is unavailable or unauthenticated at apply time: STOP, push nothing beyond the branch, and report exact manual PR-creation instructions — the red proof must not be faked or skipped silently.

**Alternatives.** Breaking an existing `src/` file — rejected: a new file is trivially reversible and touches nothing. `workflow_dispatch` dry-run — rejected: it would not exercise the push/PR triggers the spec requires. Committing the break to `main` — forbidden by the approved scope (never on `main`, never merged).

### D8 — Verification strategy for the change

No local execution of Actions exists and no YAML validator is installed (adding one would violate the zero-dependency fence). Validation order:

1. Authoring review against the spec's five requirements (structural).
2. Push to `main` → observe green run (real validator; also the only way to prove Node 22 and cache restore from run logs).
3. Red proof per D7.
4. Post-proof cleanup + fresh green run at `main` (the next push, e.g. the archive commit, triggers it).
5. `npm ci` non-mutation of the lockfile is observable in the run log and in `git status` afterwards.

Observing runs: `gh run list` / `gh run view --log` if `gh` is available; otherwise the run summary must be captured from the Actions tab before archiving (evidence requirement for verify — same discipline as the reconstructed RED evidence in `harden-pin-lock`, but here the runs themselves are the receipts).

## File Changes

| File | Action | Description |
|---|---|---|
| `.github/workflows/ci.yml` | Create | Single gating workflow: triggers, permissions, concurrency, one job with the four gates |

Fences (byte-unchanged by the change commit): `package.json`, `src/`, `convex/`. The red-proof file `src/ci-proof.ts` lives only on the throwaway branch and is deleted with it — it is not part of the change.

## Workflow sketch

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

## Risks / Mitigations

| Risk | Mitigation |
|---|---|
| Transient red X on the repo during the approved proof | Approved by the user; confined to `ci/red-proof`; closed immediately after capture; documented in tasks/verify |
| Runner-only first-run failure (network, cache cold) | Steps mirror local scripts that pass 94/94; re-run on flake; gates are idempotent |
| Local (Node 24.17) vs CI (Node 22) drift hides a version-specific failure | Accepted: 22 is the supported-LTS target; `engines` field recorded as an Open Question (touches the `package.json` fence) |
| "Blocks merge" overclaim — a red check does not physically stop the owner pushing to `main` | Honest scoping: gating + visible failed checks is what this change delivers; branch protection is a GitHub settings follow-up (non-goal) |
| Repo visibility affects free-tier minutes | ~4 min/run is negligible against either the public-repo unlimited or the private 2000 min/month quota |
| `gh` CLI absent/unauthenticated blocks the PR leg of the proof | STOP-and-report fallback specified in D7; proof never faked |

## Open Questions

- [ ] Add `engines: { node: ">=22 <25" }` to `package.json`? Closes the local/CI drift signal but touches the `package.json` fence; defer to a follow-up change.
- [ ] Enable GitHub branch protection for `main` (require the `CI` check)? Settings-side, not codifiable in this repo; recommended once the pipeline is green.
