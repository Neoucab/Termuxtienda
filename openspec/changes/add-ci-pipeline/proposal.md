# Proposal: add-ci-pipeline

## Intent

Audit gap #7 (`docs/audit-pre-dev.md`, 2026-09-14; recommended 5th; promoted because gaps #2/#3 need interactive Convex login). Nothing gates pushes. Re-verified today (2026-09-15): no `.github/`; the audit's `netlify.toml` claim is stale (never committed), and `npm run build` is the only deploy command. `typecheck`/`test` exist (12 files, 94 tests, ~95 s) but nothing invokes them on push. Broken builds reach `main` directly (HEAD `c7150dc`).

## Scope

### In Scope
1. One workflow: `.github/workflows/ci.yml`.
2. Triggers: push to `main` + `pull_request`s.
3. Runner: ubuntu-latest, Node 22 pinned (below).
4. Fail-fast gates: `npm ci` → `typecheck` → `test` → `build`.
5. npm cache via `setup-node`; `concurrency` cancels superseded runs.

### Out of Scope
Deploy step, branch protection, artifact uploads, lint/format (gap #8), matrix, Convex codegen (#2/#3), local git hooks.

## Capabilities

### New Capabilities
- `ci-pipeline`: push/PR gated on typecheck, full test suite, production build; failure blocks merge.

### Modified Capabilities
- None.

## Approach

Single YAML file, zero new dependencies. **Node 22, not 20:** Node 20 hit EOL 2026-04-30 (no patches since); Node 22 is LTS to 2027-04-30; Vite 5 + Vitest 4.1 run on it. Pin `node-version: '22'` via `actions/setup-node@v4` (`cache: npm`); `npm ci` keeps the lockfile authoritative. Runners install devDependencies normally; the local `npm omit=dev` quirk gets no workaround.

**Verification (strict_tdd analog):** no unit-testable code; red/green proof is behavioral. After push (authorized this session), the first run must be green at HEAD; a throwaway PR commit breaking typecheck must go red, then revert. Observing the real Actions run is part of verification; this machine cannot execute it.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `.github/workflows/ci.yml` | New | Single gating workflow; the only file touched |

Fences: `package.json` (zero new deps), `src/`, `convex/` — untouched.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Flaky jsdom/PBKDF2 tests block merges | Med | 94/94 green locally today; failures visible per-run |
| First run fails for runner-only reasons | Low | Steps mirror local scripts; Node 22 matches stack |
| ~95 s test suite delays pushes | Low | Concurrency cancel; free-tier minutes ample |

## Rollback Plan

`git revert` of the change commit deletes the workflow, stopping gating immediately. No app code, `package.json`, or deploy-path changes; zero-risk.

## Dependencies

- GitHub-hosted runners (~4 min/run, free tier).
- Push access to `origin/main` (authorized this session).

## Success Criteria

- [ ] Triggers on push and PR; superseded runs cancel.
- [ ] Run at HEAD green: typecheck + 94 tests + build pass on Node 22.
- [ ] Broken typecheck turns a run red (gate proven), then reverted.
- [ ] Zero new dependencies; `src/`, `convex/`, `package.json` unchanged.
