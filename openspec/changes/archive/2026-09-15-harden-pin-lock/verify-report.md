```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:22b6878a4dc2240cbb2d43848f7f7c8540c8e67425a7602fde53fd439b1168d2
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 18/18
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:9b15797a24f8b22891e34f7d5400c7f87f46528562a8a30ff6272b0030cf978c
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:8b7f5ce57bc7cbc809aaeb5aa98cc7236f96dcaff25052eaeb946e66c608dffc
```

## Verification Report

**Change**: harden-pin-lock
**Version**: N/A (no spec version recorded in deltas)
**Mode**: Strict TDD
**Verified at commit**: `bf1fed2ff6f10aead19e1de71b035edd65774230` ("feat: endurecer el candado de PIN…", 18 files, working tree clean)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build (typecheck)**: ✅ Passed — `npm run typecheck` → `tsc --noEmit` exit 0 (run twice by verify; second run captured to file and hashed).

**Tests**: ✅ 94 passed / 0 failed / 0 skipped — `npm test` (`vitest run`) → `Test Files 12 passed (12)`, `Tests 94 passed (94)`, duration 13.76 s. The `Error: fallo simulado …` stderr traces are the documented intentional crash-test noise (App.test.tsx LockScreen/Dashboard mocks and ErrorBoundary.test.tsx), not failures.

**Gates re-run by verify**:
- `grep sessionStorage src` → 0 hits; `grep termuxtienda-unlocked src` → 0 hits; `grep console\. src` → 0 hits.
- `git diff --name-only 792ef9f bf1fed2` → exactly the 18 expected files (5 openspec + 13 src); fence paths (`src/test/setup.ts`, `vite.config.ts`, `src/components/ErrorBoundary.tsx`, `convex/`, `package.json`) absent from the commit and from `git status` (clean tree).
- Baseline arithmetic for scenario 18 verified against parent commit `792ef9f`: pre-existing tests in changed files = pin 5 + App 4 + store 13 = 22; untouched baseline files = 34; 22 + 34 = 56 baseline → 56 + 10 (pin) + 5 (App) + 5 (store) + 11 (LockScreen new) + 4 (backup new) + 3 (Ajustes new) = 94. Consistent.

**Coverage**: ➖ Not available — no coverage tool configured (`coverage_command: null` in openspec/config.yaml). Coverage analysis skipped, not a failure.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| access-lock R1: Lock-gated startup | Configured PIN gates protected content at startup | `src/App.test.tsx` > "muestra el bloqueo y oculta el contenido cuando hay una credencial configurada" | ✅ COMPLIANT |
| access-lock R1 | Successful verification reveals protected content | `src/components/LockScreen.test.tsx` > "desbloquea con el PIN correcto y retira la pantalla de bloqueo" | ✅ COMPLIANT |
| access-lock R1 | No credential configured opens normally | `src/App.test.tsx` > "abre directamente cuando no hay credencial configurada" | ✅ COMPLIANT |
| access-lock R2: Unlock state does not outlive the page session | Reload locks the app again | `src/App.test.tsx` > "vuelve a bloquear tras desmontar y montar de nuevo (recarga)" | ✅ COMPLIANT |
| access-lock R2 | Pre-seeded stored flags do not unlock | `src/App.test.tsx` > "ignora los valores almacenados que parecen marcar la app como desbloqueada" (seeds `localStorage` flag + persisted blob `unlocked: true`; `sessionStorage` deliberately unused to keep the grep gate at 0, per design D5) | ✅ COMPLIANT |
| access-lock R3: Fail closed without storage | Unavailable storage shows the lock screen | `src/App.test.tsx` > "muestra el bloqueo cuando el almacenamiento no está disponible" (`vi.stubGlobal("localStorage", undefined)`) + `src/lib/store.test.ts` > `isStorageAvailable` ×3 + `src/components/LockScreen.test.tsx` > storageBlocked notice case | ✅ COMPLIANT |
| access-lock R3 | A failed verification keeps protected content hidden | `src/components/LockScreen.test.tsx` > "mantiene el contenido oculto y avisa en español cuando el PIN es incorrecto" | ✅ COMPLIANT |
| pin-credential R1: Derived, salted, self-describing credential | Setting a PIN stores a derived, self-describing credential | `src/pages/Ajustes.test.tsx` > "guarda una credencial derivada y autocontenida al configurar el PIN" (`^pbkdf2$210000$`, 4 segments, PIN absent) + `src/lib/pin.test.ts` > "deriva una credencial autocontenida y no guarda el PIN en claro" | ✅ COMPLIANT |
| pin-credential R1 | Each store gets its own salt | `src/lib/pin.test.ts` > "usa una sal nueva en cada credencial y respeta la sal inyectada" + "cada credencial verifica solo su propio PIN" | ✅ COMPLIANT |
| pin-credential R1 | Verification accepts the right PIN only | `src/lib/pin.test.ts` > "acepta el PIN correcto y rechaza cualquier otro" | ✅ COMPLIANT |
| pin-credential R2: Transparent legacy upgrade | Successful legacy verification upgrades the credential | `src/lib/pin.test.ts` > "mejora la credencial heredada al verificar el PIN correcto" + `src/components/LockScreen.test.tsx` > "desbloquea y guarda la credencial derivada al verificar el PIN correcto" (write before `onUnlock`) | ✅ COMPLIANT |
| pin-credential R2 | Failed legacy verification leaves it untouched | `src/lib/pin.test.ts` > "no toca la credencial heredada cuando el PIN es incorrecto" + `src/components/LockScreen.test.tsx` > same-named case (stored value byte-identical) | ✅ COMPLIANT |
| pin-credential R3: Throttled verification with visible countdown | Repeated failures escalate the wait with a Spanish countdown | `src/components/LockScreen.test.tsx` > "escala la espera con una cuenta atrás en español y deshabilita el envío" (1 s → 2 s → 4 s, `role="status"`, disabled submit) + `src/lib/pin.test.ts` > `lockoutDelayMs` table (…cap 30000, NaN→0) | ✅ COMPLIANT |
| pin-credential R3 | Successful verification clears the penalty | `src/components/LockScreen.test.tsx` > "limpia la penalización al desbloquear y el siguiente fallo vuelve a 1 s" | ✅ COMPLIANT |
| pin-credential R4: Credential containment in backups | Export omits credential material | `src/lib/backup.test.ts` > "no incluye la credencial del PIN ni su sal" (no key at runtime, no `pinHash`/`pbkdf2`/credential/salt in serialized JSON) + "mantiene sin cambios el resto de los ajustes y los datos" | ✅ COMPLIANT |
| pin-credential R4 | Import never replaces the local credential | `src/lib/store.test.ts` > "conserva la credencial local y descarta la que traiga el respaldo" + "no instala una credencial desde el respaldo si el dispositivo no tiene ninguna" (imported legacy `'1pekp8kgg2q'` dropped; other imported settings applied) | ✅ COMPLIANT |
| pin-credential R5: Derivation and lock flows verifiable in the existing test setup | Derivation is exercised in the jsdom environment | `src/components/LockScreen.test.tsx` > "verifica a través de la primitiva inyectada" (counting wrapper) + "se queda bloqueado con el aviso de criptografía cuando la primitiva falla" + `src/lib/pin.test.ts` > "usa las primitivas de la plataforma cuando no se inyecta ninguna" (production default path proven) | ✅ COMPLIANT |
| pin-credential R5 | Pre-existing suite stays green, configuration untouched | `src/components/LockScreen.test.tsx` > "no modifica el arnés compartido ni la configuración del runner" (`setup.ts?raw` + `vite.config.ts?raw` contain no crypto/pbkdf2/pin) + `npm test` 94/94 with 56-baseline arithmetic verified above | ✅ COMPLIANT |

**Compliance summary**: 18/18 scenarios compliant; 8/8 requirements implemented and covered.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| access-lock R1 Lock-gated startup | ✅ Implemented | `src/App.tsx:40-46` — `locked = !storageOk \|\| (hasCredential && !unlocked)`; LockScreen replaces the router when locked; no credential ⇒ direct render. |
| access-lock R2 Unlock state memory-only | ✅ Implemented | `src/App.tsx:32` `useState(false)`; no `sessionStorage` anywhere in `src` (grep 0); pre-seeded values unread by construction. |
| access-lock R3 Fail closed without storage | ✅ Implemented | `src/lib/store.ts:95-104` `isStorageAvailable()` probe (missing/throwing storage → false); `App.tsx` computes once per mount and gates; `LockScreen` storageBlocked variant renders notice + disabled button, no PIN form. |
| pin-credential R1 Derived salted credential | ✅ Implemented | `src/lib/pin.ts` — `PIN_KDF` 210000/SHA-256/16-byte salt/256-bit; format `pbkdf2$<iter>$<saltB64>$<hashB64>`; strict parse (4 segments, 1 ≤ iter ≤ 10⁷, no leading zeros, 16/32-byte base64, else `malformed`); constant-time XOR compare; legacy cyrb53 verify-only (`@deprecated`). |
| pin-credential R2 Transparent legacy upgrade | ✅ Implemented | `verifyPin` returns `upgraded` for verified legacy credentials; `LockScreen.tsx:62` writes it via `updateSettings` before `onUnlock`; wrong PIN leaves the value untouched. |
| pin-credential R3 Throttled verification | ✅ Implemented | `lockoutDelayMs` pure function (1 s→2 s→4 s→…→30 s cap); `LockScreen` 250 ms tick effect keyed on `blockedUntil` with cleanup, `role="status"` Spanish countdown, disabled submit/input, success resets counter and penalty. |
| pin-credential R4 Backup containment | ✅ Implemented | `src/lib/backup.ts` `ExportableSettings = Omit<Settings,"pinHash">` + explicit rest-omit in `buildBackupPayload`; `src/lib/store.ts:317-332` `importData` drops the imported credential and restores the local one; `types.ts:137-141` documents the exclusion. |
| pin-credential R5 Testable seam | ✅ Implemented | `PinSubtle = Pick<SubtleCrypto,"importKey"\|"deriveBits">` injectable on `hashPin`/`verifyPin`/`LockScreen`; `PinCryptoUnavailableError` fail-closed; `src/test/setup.ts` and `vite.config.ts` untouched (guard test enforces); `src/test/webcrypto.ts` correctly not created (D9). |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 WebCrypto seam in `pin.ts` (option a) | ✅ Yes | Optional `subtle` param, default `globalThis.crypto?.subtle`; production path byte-identical; no harness bridge, no `vi.mock`, no hand-rolled KDF. |
| D2 PBKDF2 210 000 iterations | ✅ Yes | `PIN_KDF.iterations = 210_000`; per-credential count stored, so raising later is safe; fast iterations only injected in tests. |
| D3 Async rework of every caller | ✅ Yes | `LockScreen.attempt` async with `Comprobando…`; `Ajustes.savePin` async; `PinModal.onSave: (pin) => Promise<void>` with `saving` state and error copy "No se pudo guardar el PIN en este dispositivo."; remove-PIN unchanged sync. |
| D4 Legacy migration on successful verify | ✅ Yes | Prefix detection; unparseable `pbkdf2$` values ⇒ `malformed` ⇒ locked; `verifyLegacyPin` `@deprecated` with Spanish removal note; baseline legacy cases rewritten, not deleted. |
| D5 Unlock state in memory only | ✅ Yes | `useState(false)`; both `sessionStorage` reads and the write deleted; grep gate 0; scenario-5 test seeds `localStorage` flags only (documented in tasks 3.2 to keep the grep at zero). |
| D6 Escalating throttle with Spanish countdown | ✅ Yes | Formula, 250 ms tick effect, `failuresRef`, `penaltySeconds = ceil(remaining/1000)`, per-mount reset documented as a limitation. |
| D7 Export/import containment | ✅ Yes | `src/lib/backup.ts` created with `Omit<Settings,"pinHash">` (no casts); `importData` drops imported + restores local credential exactly as specified. |
| D8 Fail closed without storage and without crypto | ✅ Yes | `isStorageAvailable` probe; gate formula matches design verbatim; storage-blocked and crypto-blocked Spanish notices with disabled button and no PIN form; `hashPin` throws `PinCryptoUnavailableError` so no degraded credential is ever written. |
| D9 Harness untouched; no speculative helper | ✅ Yes | `setup.ts`/`vite.config.ts` unmodified (guard test + commit file list); `src/test/webcrypto.ts` absent. |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Per-task RED/GREEN evidence lines in `tasks.md` (this project's apply-progress carrier; no separate artifact exists — see Issues). |
| All tasks have tests | ✅ | 13/13 tasks map to test files; all 6 changed/created test files exist and pass. |
| RED confirmed (tests exist) | ⚠️ | 5/6 RED-bearing tasks have original RED evidence (1.1: `15 tests \| 13 failed`; 1.3: `lockoutDelayMs is not a function` inside the 1.1 run; 2.1: `11 tests \| 8 failed`; 3.1: `9 tests \| 3 failed` exposing the real sessionStorage leak; 4.3 RED reconstructed). 4.1/4.3 RED reconstructed post-shutdown (see Issues) — files exist and were proven to fail against pre-change code. |
| GREEN confirmed (tests pass) | ✅ | 13/13 — verify re-ran the full suite: 94/94 green, exit 0; per-file counts match every GREEN evidence line (pin 15, LockScreen 11, App 9, store 18, backup 4, Ajustes 3). |
| Triangulation adequate | ✅ | Multi-case coverage per behavior: escalation table + component escalation; format + UI-format; salt ×2; legacy ×2 layers; malformed ×10; storage-blocked ×3 layers. |
| Safety Net for modified files | ✅ | Baseline preserved: 56 → 94 arithmetic verified against parent commit; App's 4 boundary cases kept in intent (documented in D5); store.test.ts pre-existing 13 kept (now 18). |

**TDD Compliance**: 5/6 checks clean, 1 with the documented warning below — 13/13 tasks carry evidence.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (node env) | 37 | 3 changed (`pin` 15, `backup` 4, `store` 18) | Vitest 4.1.11 |
| Integration (jsdom + Testing Library) | 30 | 4 (`LockScreen` 11, `App` 9, `Ajustes` 3, plus pre-existing `ErrorBoundary` 7) | @testing-library/react, jsdom docblock + `setup.dom` first |
| E2E | 0 | 0 | not installed (per config `e2e: false`) |
| **Total (suite)** | **94** | **12** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`coverage_command: null`). Not a failure; runtime evidence is complete via the 94-test suite.

### Assertion Quality
✅ All assertions verify real behavior. Audited all 6 changed/created test files: no tautologies, no orphan empty checks, no ghost loops (the two in-test loops iterate statically non-empty literals of 10 malformed credentials and 11 lockout-table pairs), no smoke-only tests, no mock-heavy files (stubs always accompany behavioral assertions on DOM/store state). The `App.test.tsx` `document.body.textContent !== ""` check is accompanied by specific assertions and is not load-bearing alone. The type-level `HasPinHash = false` assertion in `backup.test.ts` is a deliberate compile-time guard paired with runtime absence assertions.

**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: ➖ Not available (no `lint_command` configured)
**Type Checker**: ✅ No errors (`npm run typecheck` → `tsc --noEmit` exit 0)

### Issues Found
**CRITICAL**: None.
**BLOCKER**: None.
**WARNING**:
1. **Phase 4 RED evidence reconstructed post-shutdown (tasks 4.1 and 4.3).** The original RED runs were lost with the unplanned shutdown. The reconstruction (stash the 6 changed source files via `git stash push`, hide `src/lib/backup.ts` with `ren`, run the new tests against HEAD code, then restore) is accepted as valid RED-equivalent evidence and is **not a blocker**, because: (a) the method faithfully restores pre-change production code, so the measured failures (`Cannot find module './backup'`; `store.test.ts` `5 failed | 13 passed` with `isStorageAvailable is not a function` ×3 and both importData credential cases) prove the new tests are genuinely sensitive to the change; (b) the failure modes are specific and exactly the behaviors introduced — not pass-by-accident; (c) the reconstruction is transparently documented in `tasks.md` 4.1/4.3 and in the apply memory record — nothing is fabricated; (d) original RED evidence survives for the other RED-bearing tasks (1.1, 1.3, 2.1, 3.1). Residual limitation: reconstructed RED cannot prove tests were written chronologically before the Phase 4 implementation, so strict test-first discipline for Phase 4 is unprovable — a process-integrity caveat, not a correctness gap.
2. **(informational-warning) No standalone `apply-progress` artifact / formal "TDD Cycle Evidence" table exists** in this project's persistence mode; TDD evidence lives in per-task evidence lines in `tasks.md`. All 13 tasks carry RED/GREEN evidence, so the substance of the requirement is met; flagged only because the strict-TDD module expects a dedicated table.

**SUGGESTION**:
1. Legacy-upgrade path under an unavailable crypto primitive intentionally unlocks without rewriting the credential (legacy credentials "MUST stay verifiable"; no degraded credential is ever written). Documented in code comments and tested (`pin.test.ts` crypto-unavailable case). Consider surfacing this best-effort nuance in the archived spec if the team wants it explicit.
2. Scenario 5's covering test seeds `localStorage` (persisted blob + `termuxtienda-session`) rather than `sessionStorage` — deliberate per design D5 to keep `grep sessionStorage src` at 0; the spec text ("stored values that appear to mark the app as already unlocked") is satisfied. No action needed; noted for archive reviewers.

### Verdict
**PASS WITH WARNINGS** — All 13 tasks complete with evidence; 8/8 requirements and 18/18 scenarios have real, passing covering tests (94/94 suite green at exit 0, typecheck exit 0); all fences and grep gates confirmed at commit `bf1fed2`; the single warning concerns the honestly documented post-shutdown reconstruction of Phase 4 RED evidence, judged non-blocking.

### Recommended follow-ups for the archive phase
1. Persist/attest these exact report bytes as `openspec/changes/harden-pin-lock/verify-report.md` (done as part of this verify phase) and carry the same bytes into settlement attestation.
2. Merge the two delta specs into `openspec/specs/access-lock/spec.md` and `openspec/specs/pin-credential/spec.md`, then move `openspec/changes/harden-pin-lock/` to `openspec/changes/archive/` per `config.yaml` phase_rules.archive.
3. Record design Open Questions as future change candidates: (a) require the current PIN to change/remove the PIN; (b) persistent throttle counter across reloads.
4. Keep the out-of-scope risk visible: `convex/` still accepts `settings.pinHash` server-side (`lib.ts`, `mutations.ts`) — tracked under audit gap #2 (server auth), not this change.
5. Preserve the rollback note in the archived change: after `git revert`, clear `settings.pinHash` inside the `termuxtienda-store` blob before relaunching the reverted build.
