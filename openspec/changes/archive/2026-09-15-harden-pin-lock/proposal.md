# Proposal: harden-pin-lock

## Intent

Audit gap #4 (CRITICAL): PIN is cosmetic. `pin.ts` uses unsalted cyrb53 on 4–6 digits, `LockScreen.tsx` compares unthrottled, `App.tsx` gates on a forgeable `sessionStorage` flag that FAILS OPEN without storage. `settings.pinHash` sits in the store blob beside financial data and rides through export/`importData`: a shared backup installs a known PIN or locks the owner out.

**Threat model (honest):** removes the trivial bypass; still a casual-access barrier, NOT protection against DevTools; encryption at rest is out.

## Scope

### In Scope
1. Unlock state in memory; reload re-locks.
2. PBKDF2-SHA256 (`crypto.subtle`), random per-store salt, fixed documented iterations, format `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`.
3. Legacy cyrb53 verify (deprecated), auto re-hash.
4. Throttle: 1s→2s→4s… cap 30s, success-reset, disabled submit, Spanish countdown.
5. Fail closed without storage.
6. Export and `importData` exclude `pinHash`/salt, nothing else.

### Out of Scope
localStorage encryption, Convex auth, full `importData` validation, CI, PIN-length.

## Capabilities

### New Capabilities
- `access-lock`: unlock state, reload re-lock, fail-closed storage, throttle.
- `pin-credential`: PBKDF2 format/salt, migration, backup exclusion.

### Modified Capabilities
- None.

## Approach

Design decides iteration count and the WebCrypto seam: jsdom 27.4.0 exposes `crypto.getRandomValues` but NOT `crypto.subtle` (measured), so inject a seam or expose Node webcrypto in-harness.

**Tests (strict_tdd, red → green):** `pin.test.ts`: salt determinism, verify, format, migration. `LockScreen.test.tsx` (jsdom docblock, `setup.dom` first, fake timers): escalation, countdown, disabled submit, reset. App: reload re-locks, forged flag ignored. store/Ajustes: export/import exclude `pinHash`. Gate: `npm test` + typecheck; 56 green.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/pin.ts` + test | Modified | PBKDF2/legacy verify |
| `src/components/LockScreen.tsx` + test | Modified/New | Throttle, countdown |
| `src/App.tsx` + `App.test.tsx` | Modified | Memory unlock |
| `src/pages/Ajustes.tsx`, `lib/store.ts` | Modified | Async PIN; drop pinHash |
| `src/test/setup.dom.ts` | Maybe | WebCrypto seam |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| jsdom lacks `crypto.subtle` | High | Seam in design |
| PBKDF2 cost on tablets | Med | Benchmark, fixed iterations |
| Rollback: migrated hash unreadable | Med | Clear `settings.pinHash` |
| Throttle resets on reload | Med | Documented limitation |

## Rollback Plan

`git revert` restores cyrb53, the session flag and leaky export. On migrated devices, clear `settings.pinHash` in the `termuxtienda-store` blob before relaunching the reverted build.

## Dependencies

- None (WebCrypto built in).

## Success Criteria

- [ ] Reload exposes nothing without the PIN, even without storage (`grep sessionStorage src` → 0).
- [ ] `pinHash` is PBKDF2 + salt, migrates on first unlock, never exported/imported.
- [ ] Failures escalate a Spanish countdown; success resets it.
- [ ] `npm test` (≥56) + typecheck green; no new runtime dep; zero `console.*`.
