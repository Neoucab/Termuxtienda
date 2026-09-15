# Archive Report: harden-pin-lock

**Status**: success (archived)
**Change**: `harden-pin-lock`
**Capabilities**: `access-lock`, `pin-credential` (both NEW)
**Archived**: 2026-09-15
**Persistence mode**: hybrid — OpenSpec files + Engram
**Archive folder**: `openspec/changes/archive/2026-09-15-harden-pin-lock/`
**Canonical specs (source of truth)**: `openspec/specs/access-lock/spec.md` and `openspec/specs/pin-credential/spec.md` (both created by this phase)

## 1. Archive Readiness

- **Task Completion Gate**: `tasks.md` showed 13/13 implementation tasks checked (`- [x]`) and 0 unchecked before the move; re-verified on the archived copy (`unchecked=0`, `checked=13`). No stale-checkbox reconciliation was needed or performed.
- **CRITICAL gate**: `verify-report.md` records `critical_findings: 0`, `blockers: 0`, verdict `pass_with_warnings` → archive permitted. Attestation: the persisted report hashes to `sha256:966fd90db3790f5355157e217ac0829485abac0a4acfa35986ee9acdc82b8042`, matching the value reported by the verify phase.
- No intentional partial archive: all six change artifacts were present (proposal, delta specs ×2, design, tasks, verify-report).
- Process note: the `sdd-archive` sub-agent was launched first and stopped early by a tool-permission denial after creating only a scratchpad skeleton (no repository writes). The orchestrator completed this phase directly; nothing the sub-agent produced reached the tree.

## 2. Spec Promotion (delta → canonical)

Both capabilities did not exist in `openspec/specs/` (the directory held only `.gitkeep` and `error-resilience`), so there was no existing canonical requirement set to compose against. The phase followed the "Main Spec Does NOT Exist" branch: a **mechanical header transform** with every other byte copied verbatim. No requirement or scenario text was rewritten.

The transform touched exactly two header locations per file:

- line 1 `# Delta for <capability>` → `# <capability> Specification` + blank + `## Purpose` (the delta's descriptive paragraph is kept verbatim under `## Purpose`)
- `## ADDED Requirements` → `## Requirements`

### Verbatim evidence — `git diff --no-index` delta vs canonical (only the intentional header lines differ)

```
$ git diff --no-index -- openspec/changes/harden-pin-lock/specs/access-lock/spec.md openspec/specs/access-lock/spec.md
-# Delta for access-lock
+# access-lock Specification
+
+## Purpose
-## ADDED Requirements
+## Requirements
[hunks limited to @@ -1,8 +1,10 @@ ; body identical]

$ git diff --no-index -- openspec/changes/harden-pin-lock/specs/pin-credential/spec.md openspec/specs/pin-credential/spec.md
-# Delta for pin-credential
+# pin-credential Specification
+
+## Purpose
-## ADDED Requirements
+## Requirements
[hunks limited to @@ -1,8 +1,10 @@ ; body identical]
```

(`diff.exe` is unavailable on this machine's cmd.exe shell; `git diff --no-index` served as the byte-identity proof, per the stopped sub-agent's own tooling note that `fc.exe`/`git diff --no-index` are the available equivalents.)

### Structural readback

| Check | access-lock | pin-credential |
|-------|-------------|----------------|
| `### Requirement:` headings | 3 | 5 |
| `#### Scenario:` blocks | 7 | 11 |
| Delta markers (`## ADDED/MODIFIED/REMOVED/RENAMED`) | 0 | 0 |
| `## Requirements` heading | 1 | 1 |

Totals match the verify report: 8/8 requirements, 18/18 scenarios.

## 3. Archive Move (mechanical, `git mv`)

Unlike the previously archived change, the `openspec/` tree is now tracked (committed in `bf1fed2`), so the guarded fallback was not needed:

```
$ git mv openspec/changes/harden-pin-lock openspec/changes/archive/2026-09-15-harden-pin-lock
[exit 0]
```

- No file inside the archived change was modified after the move; this `archive-report.md` is created after the move (additive only, mirroring the `add-error-boundaries` precedent).
- Active changes directory now contains only `archive/` (plus its `.gitkeep`).

## 4. Post-Archive Verification Checklist

- [x] Main specs updated correctly — `openspec/specs/access-lock/spec.md` (3 requirements / 7 scenarios) and `openspec/specs/pin-credential/spec.md` (5 requirements / 11 scenarios) created
- [x] Change folder moved to archive — `openspec/changes/archive/2026-09-15-harden-pin-lock/`
- [x] Archive contains all artifacts — proposal.md, specs/{access-lock,pin-credential}/spec.md, design.md, tasks.md, verify-report.md (+ this report)
- [x] Archived `tasks.md` has no unchecked implementation tasks — 13/13 checked, 0 unchecked
- [x] Active changes directory no longer has this change — `openspec/changes/` contains only `archive/`
- [x] Byte-identity readback included above (header-only hunks)
- [x] `openspec/config.yaml` untouched — no deltas needed this phase (both `test_layers` flags were already true; all `phase_rules` unchanged)

## 5. Final State of the Change at Close

| Fact | Value | Source |
|------|-------|--------|
| Verification verdict | `pass_with_warnings` | `verify-report.md` (evidence revision `sha256:22b6878a…`, report `sha256:966fd90d…`) |
| Blockers / CRITICAL findings | 0 / 0 | `verify-report.md` |
| Spec coverage | 8/8 requirements, 18/18 scenarios compliant | `verify-report.md` |
| Tasks | 13/13 complete | archived `tasks.md` |
| `npm test` | exit 0 — 12 test files, 94 tests | `verify-report.md`; re-run independently by verify |
| `npm run typecheck` | exit 0 | `verify-report.md`; re-run independently by verify |
| Feature commit | `bf1fed2ff6f10aead19e1de71b035edd65774230` (18 files, +1995/−88) | git log |

### Warnings carried into the archive (none blocking)

1. **Phase 4 RED evidence reconstructed** (tasks 4.1, 4.3) — the original RED run was lost with an unplanned PC shutdown; reconstructed by stashing the 6 changed source files and hiding `backup.ts`, then running the new tests against HEAD code (failures: `Cannot find module './backup'`; `isStorageAvailable is not a function` ×3; both importData credential cases). Accepted by verify as valid RED-equivalent; residual limitation: chronological test-first discipline for Phase 4 is unprovable — a process-integrity caveat, not a correctness gap.
2. **No standalone apply-progress artifact** — TDD cycle evidence lives in the per-task evidence lines of `tasks.md` (same documentation shape accepted for `add-error-boundaries`).
3. **Intentional behaviors recorded for reviewers** — legacy-upgrade under an unavailable crypto primitive unlocks without rewriting the credential (legacy MUST stay verifiable); scenario 5's test seeds `localStorage` flags rather than `sessionStorage` by design (keeps the grep gate at 0).

## 6. Verify Follow-ups — Resolution at Archive

| Verify follow-up | Resolution |
|------------------|------------|
| Attest the exact verify-report bytes | **DONE** — `certutil -hashfile` → `sha256:966fd90d…` matches the verify phase's report hash; bytes untouched |
| Merge deltas into `openspec/specs/{access-lock,pin-credential}/spec.md`; move change to archive | **DONE** (§2, §3) |
| Carry the two design Open Questions forward as future change candidates | **PRESERVED** in archived `design.md` §"Open Questions" (lines 302–305): require the current PIN to change/remove it; throttle counter surviving a reload. Both remain unchecked candidates for future changes |
| Keep the out-of-scope Convex risk visible | **PRESERVED** in archived `design.md` (Non-goals line 24 and risk table line 298: `convex/lib.ts:123`, `mutations.ts:370` still accept `settings.pinHash` unauthenticated — audit gap #2) |
| Preserve the rollback note | **PRESERVED** in archived `design.md` line 248: after `git revert`, clear `settings.pinHash` inside the `termuxtienda-store` blob before relaunching the reverted build |

## 7. Lineage (Engram observations, project `termuxtienda`)

| Phase | Observation | Topic key |
|-------|-------------|-----------|
| propose | persisted pre-recovery session | `sdd/termuxtienda/proposal/harden-pin-lock` |
| spec | persisted pre-recovery session | `sdd/termuxtienda/spec/harden-pin-lock` |
| design | persisted pre-recovery session | `sdd/termuxtienda/design/harden-pin-lock` |
| tasks | #241 | `sdd/termuxtienda/tasks/harden-pin-lock` |
| apply | #245 (completion after shutdown recovery, #243) | `sdd/termuxtienda/apply/harden-pin-lock` |
| verify | #247 (persisted by the verify agent) | — (report + file) |
| archive | this phase | this file |

Pre-recovery observation IDs were not re-fetched at archive time; topic keys are recorded above and resolvable via `mem_search`.

## 8. SDD Cycle Complete

propose → spec → design → tasks → apply → verify → **archive** are all done for `harden-pin-lock`. The capabilities `access-lock` and `pin-credential` are now the source of truth at `openspec/specs/`, and the change is retired to `openspec/changes/archive/2026-09-15-harden-pin-lock/`. The open items are the two design Open Questions, the Convex server-side gap (audit #2), and the rollback note — all recorded above and in the archived design.
