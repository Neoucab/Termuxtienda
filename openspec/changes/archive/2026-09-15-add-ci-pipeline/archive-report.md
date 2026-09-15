# Archive Report: add-ci-pipeline

**Status**: success (archived)
**Change**: `add-ci-pipeline`
**Capability**: `ci-pipeline` (NEW)
**Archived**: 2026-09-15
**Persistence mode**: hybrid — OpenSpec files + Engram
**Archive folder**: `openspec/changes/archive/2026-09-15-add-ci-pipeline/`
**Canonical spec (source of truth)**: `openspec/specs/ci-pipeline/spec.md` (created by this phase)

## 1. Archive Readiness

- **Task Completion Gate**: `tasks.md` showed 9/9 implementation tasks checked (`- [x]`) and 0 unchecked before the move; re-verified on the archived copy (`unchecked=0`, `checked=9`).
- **CRITICAL gate**: `verify-report.md` records `critical_findings: 0`, `blockers: 0`, verdict `pass_with_warnings` → archive permitted. Attestation: the persisted report hashes to `sha256:d5ee57fb6cfd366864f1a2fdb1a4828a048779a395da80075de7a17d86c8b483`, matching Engram observation #262 (`sdd/add-ci-pipeline/verify-report`).
- No intentional partial archive: all six change artifacts present (proposal, delta spec, design, tasks, verify-report, + this report).
- Process notes (honest): the sdd-design and sdd-archive sub-agents were stopped early by tool-permission denials (zero repository writes in both cases); those phases were completed directly by the orchestrator per the user's standing directive. sdd-propose, sdd-spec, sdd-tasks and sdd-verify ran as sub-agents (verify persisted its own report + Engram #262 before an end-of-run transport error — both artifacts were confirmed complete and uncorrupted).

## 2. Spec Promotion (delta → canonical)

The capability `ci-pipeline` did not exist in `openspec/specs/`; the "Main Spec Does NOT Exist" branch applied: mechanical header transform with every other byte verbatim (same method as the two previously archived changes; `diff.exe` unavailable on cmd.exe, `git diff --no-index` used as the byte-identity proof).

Transform locations: line 1 `# Delta for ci-pipeline` → `# ci-pipeline Specification` + blank + `## Purpose` (descriptive paragraph verbatim); `## ADDED Requirements` → `## Requirements`.

### Verbatim evidence — `git diff --no-index` (only the intentional header hunks differ)

```
$ git diff --no-index -- openspec/changes/add-ci-pipeline/specs/ci-pipeline/spec.md openspec/specs/ci-pipeline/spec.md
-# Delta for ci-pipeline
+# ci-pipeline Specification
+
+## Purpose
-## ADDED Requirements
+## Requirements
[hunks limited to @@ -1,8 +1,10 @@ ; body identical]
```

### Structural readback

| Check | Value |
|-------|-------|
| `### Requirement:` headings | 5 |
| `#### Scenario:` blocks | 12 |
| Delta markers (`## ADDED/MODIFIED/REMOVED/RENAMED`) | 0 |
| `## Requirements` heading | 1 |

Matches the verify report: 5/5 requirements, 12/12 scenarios. The verify SUGGESTION 4/5 merge-time rewordings ("only path" / "test gate" wording) were **not applied** — accepted as authored; the archive is an immutable audit trail and the suggestions are preserved in the verify report (§Suggestions).

## 3. Archive Move (mechanical, `git mv`)

```
$ git mv openspec/changes/add-ci-pipeline openspec/changes/archive/2026-09-15-add-ci-pipeline
[exit 0]
$ git fetch --prune
- [deleted]  (none) -> origin/ci/red-proof   (stale tracking ref dropped, per verify follow-up 1)
```

- No file inside the archived change was modified after the move; this `archive-report.md` is created after the move (additive only).
- Active changes directory now contains only `archive/` (plus its `.gitkeep`).

## 4. Post-Archive Verification Checklist

- [x] Main spec updated correctly — `openspec/specs/ci-pipeline/spec.md` created (5 requirements / 12 scenarios)
- [x] Change folder moved to archive — `openspec/changes/archive/2026-09-15-add-ci-pipeline/`
- [x] Archive contains all artifacts — proposal.md, specs/ci-pipeline/spec.md, design.md (D1–D9), tasks.md (9/9), verify-report.md (+ this report)
- [x] Archived `tasks.md` has no unchecked implementation tasks — 9/9 checked, 0 unchecked
- [x] Active changes directory no longer has this change
- [x] Byte-identity readback included above (header-only hunks)
- [x] `openspec/config.yaml` untouched — no deltas needed this phase
- [x] Stale remote-tracking ref pruned (`origin/ci/red-proof`)

## 5. Final State of the Change at Close

| Fact | Value | Source |
|------|-------|--------|
| Verification verdict | `pass_with_warnings` | `verify-report.md` (evidence revision `sha256:cee3fb74…`, report `sha256:d5ee57fb…`) |
| Blockers / CRITICAL findings | 0 / 0 | `verify-report.md` |
| Spec coverage | 5/5 requirements, 12/12 scenarios compliant | `verify-report.md` |
| Tasks | 9/9 complete | archived `tasks.md` |
| Local suite (re-run by verify) | 94/94 tests, typecheck exit 0 | `verify-report.md` |
| Actions runs (the receipts) | 34997378001 RED (real env defect, root-caused) · 34999634454 GREEN 35 s · 34999864220 RED (approved proof, typecheck-only) · 35000122513 GREEN + cache restored | `verify-report.md` §Pipeline receipts |
| Change commits | 585a8e7 (planning docs) · 8c9f4da (workflow, +22) · fe26b64 (D9 amendment) · f511e56 (apply evidence) | git log |
| Fences | `package.json`, `package-lock.json`, `src/`, `convex/` byte-unchanged across the change range | `verify-report.md` R4 rows |

### Warnings carried into the archive (none blocking)

1. **R3/S6 supersession runtime-unexercised** — the superseded-run cancellation was proven via its declared file-inspection channel (concurrency block authored per D5) plus runtime proof of per-ref non-interference (S7); the literal cancellation outcome never occurred because no same-ref run was ever superseded. Process-completeness caveat, accepted as authored.
2. **D9 honesty audit passed** — the first-run RED (npm 10 auto-resolving the vite-8 peer `esbuild ^0.27.0 || ^0.28.0` to 0.28.2, absent from the lockfile) was root-caused from real logs; `--omit=peer`/`--legacy-peer-deps` were genuinely tested and rejected (drop `react-is`, break `recharts`); lockfile regeneration rejected (npm 12 no-op / R4). The `npm@12` pin keeps `package-lock.json` byte-identical.
3. **Verify SUGGESTION 3 nuance** — the satisfying esbuild@0.27.0 lives at `node_modules/convex/node_modules/esbuild` (nested), not "hoisted" (the hoisted copy is 0.21.5 from the vite-5 tree); one-word wording nuance in D9, mechanism unaffected.
4. **Cosmetic runner annotation** — "Node.js 20 is deprecated" refers to the actions' own runtime (forced to Node 24), not the workflow's Node 22 toolchain; bump action majors opportunistically.

### Verify Follow-ups — Resolution at Archive

| Verify follow-up | Resolution |
|------------------|------------|
| Commit tasks.md (9/9) + verify-report together; `git fetch --prune` | **DONE** — this archive commit includes both; prune executed (§3) |
| Merge delta into `openspec/specs/ci-pipeline/spec.md`; move change to archive | **DONE** (§2, §3); SUGGESTION 4/5 rewordings not applied (accepted as authored) |
| Carry Open Questions forward | **PRESERVED** in archived `design.md` §Open Questions: (a) `engines`/`packageManager` field (touches the package.json fence); (b) GitHub branch protection on `main` requiring the CI check (settings-side) |
| Keep the npm@12 revisit trigger visible | **PRESERVED** here and in design D9: revisit on the next Node base bump or any npm 13 release; exact pin (`npm@12.0.2`) if determinism is ever required |
| Preserve the rollback note | **PRESERVED**: `git revert` of 8c9f4da/fe26b64 deletes the workflow and stops gating immediately; no app code, `package.json`, or deploy-path changes |

## 7. Lineage (Engram observations, project `termuxtienda`)

| Phase | Observation | Topic key |
|-------|-------------|-----------|
| propose | sub-agent persisted | `sdd/add-ci-pipeline/proposal` |
| spec | #256 | `sdd/add-ci-pipeline/spec` |
| design | #257 (written directly by the orchestrator) | `sdd/termuxtienda/design/add-ci-pipeline` |
| tasks | #259 | `sdd/add-ci-pipeline/tasks` |
| apply | #260 | `sdd/termuxtienda/apply/add-ci-pipeline` |
| verify | #262 | `sdd/add-ci-pipeline/verify-report` |
| archive | this phase | this file |

## 8. SDD Cycle Complete

propose → spec → design → tasks → apply → verify → **archive** are all done for `add-ci-pipeline`. The capability `ci-pipeline` is now the source of truth at `openspec/specs/ci-pipeline/spec.md`, and the change is retired to `openspec/changes/archive/2026-09-15-add-ci-pipeline/`. Open items: the two design Open Questions, the npm@12 revisit trigger, and optional action-major bumps — all recorded above.
