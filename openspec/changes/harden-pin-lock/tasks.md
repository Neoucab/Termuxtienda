# Tasks: harden-pin-lock

Strict TDD: RED before GREEN; `npm test` per task, typecheck per phase. Impossible decision → STOP, document, take closest compliant alternative, report. Fences (read-only): `src/test/setup.ts`, `vite.config.ts`, `src/components/ErrorBoundary.tsx`, `convex/`, `package.json`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800–950 (13 files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending — resolved 2026-09-15 post-shutdown recovery: user chose direct closure without chained PRs; cumulative apply on main, commits pending explicit request.
400-line budget risk: High

Work units (harness N/A):
- WU1 `src/lib/pin.ts`+test → PR1 → `npx vitest run src/lib/pin.test.ts` → revert.
- WU2 `src/components/LockScreen.tsx`+test → PR2 (base PR1) → `npx vitest run src/components/LockScreen.test.tsx` → revert.
- WU3 `src/App.tsx`, `src/lib/backup.ts`, `src/lib/store.ts`+tests → PR3 (base PR2) → `npx vitest run src/App.test.tsx src/lib/store.test.ts` → revert.
- WU4 gates → PR4 (base PR3) → `npm test && npm run typecheck`; harness `npm run dev`: set PIN, reload, unlock → revert guards.

## Phase 1: PIN core

- [x] 1.1 RED `src/lib/pin.test.ts` (async hash/verify, 9/10, malformed, crypto-unavailable, legacy kept); `npx vitest run src/lib/pin.test.ts` fails. — Evidence: RED `15 tests | 13 failed` (`verifyPin is not a function`, `isLegacyPinCredential is not a function`, `expected '1pekp8kgg2q' to match /^pbkdf2\$210000\$/`, `PIN_KDF undefined`); the 2 unchanged `isValidPin` cases passed.
- [x] 1.2 GREEN `src/lib/pin.ts`: `PIN_KDF` 210000/16-byte salt, `pbkdf2$<iter>$<saltB64>$<hashB64>`, `PinSubtle` seam, `PinCryptoUnavailableError`, `verifyLegacyPin`; command passes. — Evidence: `npx vitest run src/lib/pin.test.ts` → `1 passed / 15 passed` (438 ms). `npm test` → 9 files / 66 tests green. Fix during task: `deriveBits` salt needed an own `ArrayBuffer` copy (`BufferSource` excludes `SharedArrayBuffer`, TS 5.9). Ripple: typecheck transiently reports `LockScreen.tsx(16,20)` + `Ajustes.tsx(74,22)` until 2.2 / 4.3 migrate the async callers.
- [x] 1.3 RED→GREEN `lockoutDelayMs` (1s→2s→4s→30s); `npm test` green. — Evidence: RED case `lockoutDelayMs` failed inside the 1.1 run (`is not a function`); GREEN: table 0→0, 1→1000, 2→2000, 3→4000, 4→8000, 5→16000, 6..20→30000, NaN→0 passes; `npm test` → 66 passed.

## Phase 2: Lock screen throttle

- [x] 2.1 RED `src/components/LockScreen.test.tsx` (jsdom docblock, `../test/setup.dom` first, `subtle`, fake timers) for 2/7/11/12/13/14/17/18; fails. — Evidence: RED `11 tests | 8 failed` (`onUnlock` called 0 times, `Unable to find an accessible element with the role "status"`, `expected ' Entrar' to contain 'Comprobando…'`, crypto/storage notices missing); 3 passed (wrong-PIN error already surfaced by the old sync compare, legacy value untouched, guard case).
- [x] 2.2 GREEN `src/components/LockScreen.tsx`: async `attempt()`, `Comprobando…`, `role="status"` countdown, upgrade write, storage/crypto notices; `npm test` green. — Evidence: `npx vitest run src/components/LockScreen.test.tsx` → `1 passed / 11 passed`; `npm test` → 10 files / 77 tests green. Fixture notes: throttle cases drive the seam with stub primitives (pure microtasks, deterministic under fake timers); real derivations cover 2/7/11/12/17 (legacy upgrade pays one 210k derivation ≈240 ms). `npm run typecheck` → only the remaining `Ajustes.tsx(74,22)` async ripple (fixed in 4.3).

## Phase 3: In-memory gate

- [x] 3.1 RED `src/App.test.tsx`: `resetGate()` replaces sessionStorage helper (4 boundary cases kept) + 1/3/4/5/6; fails. — Evidence: RED `9 tests | 3 failed` ("vuelve a bloquear tras desmontar y montar", "ignora los valores almacenados…", "muestra el bloqueo cuando el almacenamiento no está disponible"); the 2nd failure exposed the real leak: the old `App.tsx` wrote `sessionStorage.termuxtienda-unlocked` on unlock and a later test in the same file rendered unlocked because of it. The 4 boundary cases keep their intent (still need a configured credential to reach the lock branch).
- [x] 3.2 GREEN `src/App.tsx`: memory-only `unlocked`, sessionStorage deleted, `isStorageAvailable()` fail-closed; `npm test` + typecheck green. — Evidence: `npx vitest run src/App.test.tsx` → `1 passed / 9 passed`; `npm test` → 10 files / 82 tests green; `grep -r "sessionStorage" src` → 0 hits; `npm run typecheck` → only `Ajustes.tsx(74,22)` (async ripple, fixed in 4.3). `isStorageAvailable()` added to `src/lib/store.ts` (probe write/read/remove in try/catch). Note: scenario 5 seeds plausible stored flags via `localStorage` (`termuxtienda-session=1` + persisted blob with `unlocked: true`), never `sessionStorage`, so the grep gate stays at zero and the legacy flag key no longer exists anywhere in `src`.

## Phase 4: Backups

- [x] 4.1 RED `src/lib/backup.test.ts` (15) + `src/lib/store.test.ts` (16, `isStorageAvailable`); fails. — Evidence: original RED lost with the shutdown; reconstructed post-recovery (6 changed sources stashed + `backup.ts` hidden → new tests vs HEAD code): `backup.test.ts` suite fail `Cannot find module './backup'`; `store.test.ts` `5 failed | 13 passed` — `isStorageAvailable is not a function` ×3, local credential overwritten by the backup's legacy `'1pekp8kgg2q'` (both importData cases).
- [x] 4.2 GREEN `src/lib/backup.ts` `buildBackupPayload` `Omit<Settings,"pinHash">`; `src/lib/store.ts` drops imported credential, keeps local; `src/lib/types.ts` comment; `npm test` green. — Evidence: `ExportableSettings = Omit<Settings,"pinHash">` with explicit `pinHash` omit in `buildBackupPayload`; `types.ts` doc comment on the credential exclusion; restored tree: `npx vitest run backup/store/Ajustes` → 3 files / 25 tests green; `npm test` → 12 files / 94 tests green.
- [x] 4.3 RED→GREEN `src/pages/Ajustes.tsx` async save/error copy, export via `buildBackupPayload`; new `src/pages/Ajustes.test.tsx` (8); `npm test` green. — Evidence: RED `Ajustes.test.tsx` suite fail `Failed to resolve import "../lib/backup"` (same reconstruction run); GREEN 3/3 — derives `^pbkdf2$210000$` credential (scenario 8), crypto-unavailable notice saves nothing, export delegates to `buildBackupPayload` while state keeps the credential.

## Phase 5: Gates

- [x] 5.1 `npm test` ≥56 baseline + new green; `npm run typecheck` exit 0. — Evidence: `npm test` → 12 files / 94 tests green (2026-09-15 10:53, baseline ≥56 met); `npm run typecheck` → exit 0.
- [x] 5.2 Greps: 0 `sessionStorage`/"termuxtienda-unlocked" in `src`; zero `console.*`; `package.json` (read-only) deps unchanged. — Evidence: greps over `src` → 0 hits each; `git diff -- package.json package-lock.json` empty; `git diff --name-only` lists only the 9 expected files, no fence paths.
- [x] 5.3 18/18 rows verified; `src/test/setup.ts`/`vite.config.ts`/`convex/` (read-only) untouched; 18 guard seam-free. — Evidence: rows 1/3/4/5/6 → App gate cases; 2/7/13/14/17/18 → LockScreen (unlock, wrong-PIN notice, countdown, penalty reset, injected primitive, runner guard); 8 → Ajustes asserts `^pbkdf2$210000$`; 9/10 → pin salts/mismatch; 11/12 → legacy upgrade/untouched (pin + LockScreen pair); 15 → backup omits credential; 16 → store keeps local. All passing in the 94-test run; fences absent from `git status`; no seams added to `setup.ts`.

## Scenario → test mapping

# | Test | Case
--- | --- | ---
1 | `App.test.tsx` | configured PIN locks
2 | `LockScreen.test.tsx` | correct PIN unlocks
3 | `App.test.tsx` | no credential → router
4 | `App.test.tsx` | remount re-locks
5 | `App.test.tsx` | seeded flags ignored
6 | `App.test.tsx` | no storage → locked
7 | `LockScreen.test.tsx` | wrong PIN error
8 | `Ajustes.test.tsx` | `^pbkdf2$210000$`
9 | `pin.test.ts` | salts differ
10 | `pin.test.ts` | mismatch rejected
11 | `pin.test.ts` + `LockScreen.test.tsx` | legacy upgrade
12 | `pin.test.ts` + `LockScreen.test.tsx` | legacy untouched
13 | `LockScreen.test.tsx` | escalating countdown
14 | `LockScreen.test.tsx` | penalty cleared
15 | `backup.test.ts` | no `pinHash`
16 | `store.test.ts` | local credential kept
17 | `LockScreen.test.tsx` | injected `subtle`
18 | `LockScreen.test.tsx` | config seam-free
