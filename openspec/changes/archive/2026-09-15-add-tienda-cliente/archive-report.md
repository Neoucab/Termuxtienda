# Archive Report: add-tienda-cliente

**Status**: success (archived)
**Change**: `add-tienda-cliente`
**Capabilities**: `catalog-publishing` (NEW), `client-storefront` (NEW), `access-lock` (MODIFIED — "Lock-gated startup" narrowed + Purpose updated)
**Archived**: 2026-09-15
**Persistence mode**: hybrid — OpenSpec files + Engram
**Archive folder**: `openspec/changes/archive/2026-09-15-add-tienda-cliente/`
**Canonical specs**: `openspec/specs/catalog-publishing/spec.md` and `openspec/specs/client-storefront/spec.md` (created by this phase); `openspec/specs/access-lock/spec.md` (updated by this phase — "Lock-gated startup" replaced with the narrowed MODIFIED version, 3→5 scenarios, and Purpose reworded to owner-only gating; the delta's "(Previously: …)" historical note was intentionally not carried into the canonical text)

## 1. Archive Readiness

- **Task Completion Gate**: `tasks.md` showed 25/25 tasks checked and 0 unchecked before the move.
- **CRITICAL gate**: `verify-report.md` records `critical_findings: 0`, `blockers: 0`, verdict `pass_with_warnings` → archive permitted. Attestation: report hashes to `sha256:14173ff3b6cc6bcdb30b85890616df33e8e26285bd637f951199b102baade86c` (Engram obs #281).
- All six change artifacts present (proposal, 3 delta specs, design, tasks, verify-report).
- Process notes: sdd-design and sdd-archive sub-agents were stopped early by tool-permission denials (zero repository writes); both phases completed directly by the orchestrator per the user's standing fallback. Verify persisted its own report + Engram #281 before an end-of-run transport error — artifacts confirmed complete.

## 2. Spec Promotion

**NEW capabilities** (`catalog-publishing` 6 req / 12 scen; `client-storefront` 4 req / 13 scen): mechanical header transform, body byte-verbatim (`git diff --no-index` proof: hunks limited to @@ -1,8 +1,10 @@ — header lines only).

**MODIFIED capability** (`access-lock`): the canonical spec's "Lock-gated startup" requirement block (requirement + 3 scenarios) was REPLACED by the MODIFIED version (requirement + 5 scenarios) from the delta, and the Purpose paragraph was reworded (owner-only gating). The other two requirements ("Unlock state does not outlive the page session", "Fail closed without storage") were untouched.

### Structural readback

| Check | catalog-publishing | client-storefront | access-lock (post-merge) |
|-------|--------------------|--------------------|--------------------------|
| `### Requirement:` headings | 6 | 4 | 3 |
| `#### Scenario:` blocks | 12 | 13 | 5+3+2 = 10 |
| Delta markers | 0 | 0 | 0 |

Verify coverage: 11/11 requirements, 30/30 scenarios compliant.

## 3. Archive Move (plain `move` fallback)

```
$ git mv openspec/changes/add-tienda-cliente openspec/changes/archive/2026-09-15-add-tienda-cliente
fatal: source directory is empty
```

The change folder was untracked (never committed — commits are pending explicit user request per the chain-strategy note), so `git mv` saw it as empty (same quirk as the 2026-09-15-add-error-boundaries archive). Guarded fallback used: plain `move`, then a full recursive listing confirmed every artifact at the destination (above). `git fetch --prune` ran clean (no stale refs).

## 4. Post-Archive Verification Checklist

- [x] Main specs updated — catalog-publishing (6/12), client-storefront (4/13) created; access-lock "Lock-gated startup" replaced (now 5 scenarios; spec totals 3 req / 10 scen)
- [x] Change folder moved to archive with all artifacts (+ this report)
- [x] Archived `tasks.md` has 25/25 checked, 0 unchecked
- [x] Active changes directory contains only `archive/`
- [x] Byte-identity readback for both NEW capabilities included (§2)
- [x] `openspec/config.yaml` untouched
- [x] `.wrangler/` added to `.gitignore` (verify SUGGESTION 1) before committing

## 5. Final State of the Change at Close

| Fact | Value | Source |
|------|-------|--------|
| Verification verdict | `pass_with_warnings` | `verify-report.md` (report `sha256:14173ff3…`) |
| Blockers / CRITICAL | 0 / 0 | `verify-report.md` |
| Spec coverage | 11/11 requirements, 30/30 scenarios | `verify-report.md` |
| Tasks | 25/25 complete | archived `tasks.md` |
| Suite at close | 19 files / **140 tests** green; typecheck exit 0 | re-run after verify follow-up 2 (see below) |
| Live deployment | Worker version df9dfe6d at `https://termuxtienda.neoucab.workers.dev`; KV `CATALOGO` binding; `PUBLISH_SECRET` provisioned | deploy log; live curl gates: `/` 200 html · GET `/api/catalogo` 404 `{catalogo:null}` · POST without secret 401 |

### Verify warnings carried into the archive (none blocking)

1. **Ajustes tests replacement → RESTORED (follow-up 2, DONE)**: the apply had replaced 3 pre-existing Ajustes tests (PIN save, crypto-unavailable notice, backup delegation) with catalog tests. All 3 were restored from HEAD and pass alongside the 3 new catalog tests (Ajustes.test.tsx 6/6); tasks.md 5.1 evidence line corrected (94 pre-existing survive; 3 restored + 3 added → 140 total). The only uncovered behaviors identified by verify are now covered again.
2. **Local write gates recorded-only** — the wrangler dev server was stopped after the apply; the write-path gates (201/200/400) rest on the apply transcript, corroborated by the 9 worker unit tests over the same handlers and verify's live read-only trio. The owner's first real publish (below) retires this residue.
3. **Two-device E2E owner-owned** — accepted as post-verify closing evidence: publish from the owner device (Inventario → "Publicar catálogo" with WhatsApp + clave configured) and browse/order from a second device via `#/tienda`.
4. **Verify SUGGESTION 3** — `handleGetCatalogo` JSON.parse unguarded (500 on out-of-band KV corruption; only validated payloads are stored). Not applied — hardening note for a future change. SUGGESTION 2 (timing-safe compare) likewise noted: 24-byte random secret, negligible practical risk.

### Verify Follow-ups — Resolution at Archive

| Follow-up | Resolution |
|-----------|------------|
| 1. Owner two-device E2E as closing evidence | **OWNER ACTION** — the app is deployed and provisioned; see "Setup for the owner" below. To be recorded as the change's closing receipt |
| 2. Restore 3 Ajustes tests + correct tasks.md 5.1 | **DONE** (restored, 6/6 pass; evidence line corrected; full suite re-run 140/140) |
| 3. `.wrangler/` to `.gitignore` | **DONE** |
| 4. Merge 3 deltas into canonical specs; move change to archive | **DONE** (§2, §3); SUGGESTION 4 wording (D2 "Omit-based") recorded as a nuance, implementation functionally equivalent |
| 5. Open Questions as future candidates | **PRESERVED** in archived design.md: per-product catalog visibility toggle; Bs display without bcvRate |
| 6. Rotation procedure visible | **PRESERVED**: regenerate in Ajustes + `wrangler secret put PUBLISH_SECRET --name termuxtienda` |

### Setup for the owner (closing evidence steps)

1. Open the owner app → Ajustes → "Catálogo público": paste the publish secret (provided by the orchestrator at deploy time: stored in the Worker as PUBLISH_SECRET), set "WhatsApp del dueño", save.
2. Inventario → "Publicar catálogo" → expect "Catálogo publicado ✓".
3. From a second device (or incognito): open `https://termuxtienda.neoucab.workers.dev/#/tienda` → browse, add to cart, "Enviar pedido por WhatsApp" → the owner's WhatsApp receives the itemized pre-order.

## 6. SDD Cycle Complete

propose → spec → design → tasks → apply → verify → **archive** are all done for `add-tienda-cliente`. Canonical capabilities: `catalog-publishing`, `client-storefront` (new) and `access-lock` (narrowed) at `openspec/specs/`. Open items: the owner's two-device E2E receipt, the per-product visibility toggle and Bs-without-BCV questions, the timing-safe compare / JSON.parse guard hardening notes, and the deferred Convex audit gaps (#2/#3).
