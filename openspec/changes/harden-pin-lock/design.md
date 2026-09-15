# Design: harden-pin-lock

## Context

Gap #4 (`docs/audit-pre-dev.md`) says the PIN is cosmetic: `src/lib/pin.ts` hashes with unsalted cyrb53 over 4–6 digits, `LockScreen.tsx` compares synchronously with no throttle, and `App.tsx` gates on `sessionStorage.getItem("termuxtienda-unlocked") === "1"` while failing **open** when `sessionStorage` is missing. `settings.pinHash` rides along inside the persisted store blob and inside the export/`importData` payload, so a shared backup hands over a known PIN.

Measured facts this design relies on (Vitest 4.1.11, Node 24.17, jsdom 27.4.0, this machine):

| Measurement | Result |
|---|---|
| Raw jsdom `window.crypto` | `getRandomValues` ✅, `subtle` ❌ (undefined) |
| Vitest jsdom env `globalThis.crypto` | `getRandomValues` ✅ **and `subtle` ✅** (Vitest keeps Node's webcrypto — the harness gap assumed in the proposal does not reproduce under `npm test`) |
| PBKDF2-SHA256, 100k / 210k / 600k iterations | 104 ms / ~240 ms / 1175 ms (Node/OpenSSL, desktop, single derivation) |
| jsdom | `btoa`/`atob` ✅, `Blob.prototype.text` ❌, `URL.createObjectURL` ✅, `sessionStorage` ✅ |
| Baseline suite | 9 files / **56 tests green**; `tsc --noEmit` exit 0 |
| `noUnusedLocals` + rest-omit (`const { pinHash: _x, ...rest } = s`) | compiles (verified with tsc) |

**Threat model (unchanged, honest):** this removes the trivial bypass (forgeable session flag, unsalted comparable hash, credential export). It is a casual-access barrier on the counter tablet, **not** protection against someone with DevTools, and not encryption at rest.

## Goals / Non-goals

**Goals.** Derived salted self-describing credential; transparent legacy upgrade; escalating Spanish-countdown throttle; in-memory-only unlock that survives no reload and no pre-seeded storage flag; fail closed without storage/crypto; credential excluded from export and never replaced by import; all 18 scenarios covered by tests runnable in the existing Vitest setup with `src/test/setup.ts` and `vite.config.ts` untouched.

**Non-goals.** Encryption at rest; Convex auth (`convex/mutations.ts:370` still accepts `pinHash` server-side — untouched, audited separately); full `importData` validation; PIN length/policy; a throttle counter that survives reload; requiring the old PIN to change the PIN.

## Decisions

### D1 — WebCrypto seam: production seam in `pin.ts` (option a)

**Choice.** `hashPin`/`verifyPin` take an optional `subtle?: PinSubtle` (default `globalThis.crypto?.subtle`) and an optional explicit `salt`/`iterations` for `hashPin`. Tests pass an implementation explicitly; production passes nothing.

**Alternatives.** (b) Harness bridge in `src/test/setup.dom.ts` aliasing `window.crypto.subtle` to Node's — rejected: it mutates a global shared by 8 existing test files (blast radius), it cannot express the *crypto-unavailable* path at all (fail-closed coverage is impossible), it would not reach `pin.test.ts` (node env) so a second mechanism is still needed, and it hides the platform gap instead of documenting it. (c) `vi.mock("../lib/pin")` in component tests — rejected: component tests would then never execute the real derivation, which is exactly "tests passing on a path production never uses". (d) Hand-rolled JS PBKDF2 double — rejected: same objection, and it would validate nothing about the real primitive.

**Rationale.** The injected object is a real `SubtleCrypto`; the code path (importKey → deriveBits → encode) is byte-identical to production, so tests fail if production logic breaks. It also makes salt determinism, cheap iteration counts for component tests, and the error path expressible. Because Vitest's jsdom env already exposes Node's `crypto.subtle` (measured above), the seam is justified by *testability, determinism and error-path realism* — not by bridging a gap that does not exist under the runner.

### D2 — PBKDF2 parameters: 210 000 iterations

**Choice.** PBKDF2-HMAC-**SHA-256**, `iterations = 210_000`, salt 16 bytes from `crypto.getRandomValues`, derived key 256 bits, stored as `pbkdf2$<iterations>$<saltB64>$<hashB64>`.

**Alternatives.** OWASP's 600 000 — rejected for latency: 1175 ms desktop/OpenSSL ⇒ ≈2.4–4.7 s per attempt on a low-power Android tablet (WebCrypto in Chrome/ARM is typically 2–4× slower than desktop OpenSSL), and the owner unlocks this tablet several times a day; 100 000 (the floor) — rejected as needlessly low when the budget allows 2×; a device-calibrated value — rejected: non-deterministic, untestable, unbounded unlock time.

**Rationale.** The credential protects a 4–6 digit PIN, i.e. ≤20 bits of entropy: 10⁶ candidates fall to offline brute force at *any* feasible iteration count, so buying 3–5 s of unlock latency per attempt buys no real security. 210 000 ≈ 0.24 s desktop / ≈0.5–1.0 s tablet: it clears the floor of 100 000 with headroom while keeping the counter device usable. The floor is a design constraint: **never below 100 000**. Raising the value later is safe because `verifyPin` always derives with the count stored in the credential; only new credentials and legacy-upgrade writes use the constant.

### D3 — Async rework and every caller

**Choice.** `hashPin` and `verifyPin` become `async`. Callers:

| Caller | Change |
|---|---|
| `LockScreen.submit` (`LockScreen.tsx:14-22`) | becomes `async attempt()`; `submitting` state disables the submit button (label `Comprobando…`); on `ok` → optional upgrade write + `onUnlock()`; on failure → Spanish error + throttle |
| `Ajustes.savePin` (`Ajustes.tsx:74`) | `async`; `const credential = await hashPin(pin)` then `updateSettings({ pinHash: credential })` then close the modal |
| `Ajustes` remove PIN (`Ajustes.tsx:314`) | **unchanged** (synchronous `updateSettings({ pinHash: undefined })`; nothing to derive) |
| `Ajustes` change PIN | same path as set (modal title differs only) |
| `PinModal.onSave` | now `(pin: string) => Promise<void>`; local `saving` state disables `Guardar PIN`; a rejected promise shows `No se pudo guardar el PIN en este dispositivo.` and keeps the modal open |
| `App` gate (`App.tsx:29-46`) | no hashing; keeps reading `settings.pinHash` presence, plus the new memory/storage logic (D5, D8) |
| `pin.test.ts` | rewritten to `await` (legacy `hashPin` determinism cases become derived-credential cases) |

**Rationale.** One async boundary at the UI, no floating promises in event handlers (handlers call `void attempt()`), and no `useEffect`-driven verification.

### D4 — Legacy migration

**Choice.** Detection by prefix: a stored value that does **not** start with `pbkdf2$` is a legacy cyrb53 credential. Anything that *does* start with the prefix but fails to parse is `reason: "malformed"` → locked (never silently downgraded to the legacy path). `verifyPin` returns `upgraded?: string` when a legacy credential verified; `LockScreen` persists it with `updateSettings({ pinHash: upgraded })` before `onUnlock()` — no extra user step. The cyrb53 implementation moves to `verifyLegacyPin` (verify-only, `@deprecated`, Spanish comment naming the removal condition: "se elimina cuando ninguna tienda conserve credenciales heredados" ); `hashPin` no longer produces it.

**Alternatives.** Migrating inside `migrateState` (zustand `version: 3`) — rejected: it cannot derive without the PIN, and a version bump would touch every persisted blob for no data-shape change. Deleting cyrb53 outright — rejected: every existing device would be locked out of its own data.

**Rationale.** Upgrade-on-success is the only moment the plaintext PIN is available. `pin.test.ts` legacy cases are **rewritten, not deleted** (they now assert "verifies + reports the derived credential" and "wrong PIN leaves the stored value byte-identical").

### D5 — Unlock state in memory only

**Choice.** `const [unlocked, setUnlocked] = useState(false)` in `AppContent`. Delete both `sessionStorage` reads (`App.tsx:31-32`) and the write (`App.tsx:44`). `grep -r sessionStorage src` must return 0.

**Alternatives.** A zustand field — rejected: `persist` writes the whole state, so an `unlocked` field would be persisted unless special-cased, i.e. the fail-open bug returns by another route. A module-level variable — rejected: less React-idiomatic, no test hook.

**Rationale.** Keeping the bit outside the only persisted surface makes "unlock does not outlive the page session" true by construction; a pre-seeded `termuxtienda-unlocked` value cannot be read because nothing reads it.

**`App.test.tsx` changes.** `renderLockedBranch`/`renderRoutedBranch` replace `sessionStorage.clear()` with a shared `resetGate()` helper (`localStorage.clear()` + `useApp.setState({ settings: { ...DEFAULT_SETTINGS, pinHash: … } })`); the four existing error-boundary cases keep their intent (they still need a configured `pinHash` to reach the lock branch). New cases: reload re-locks (unmount → remount → lock screen), pre-seeded storage flag ignored, storage unavailable → lock screen, no credential → direct render. `sessionStorage` is only ever *written* by tests to prove it is ignored. No other reader exists — verified by grep (only `App.tsx` and `App.test.tsx` matched `sessionStorage`).

### D6 — Throttle: in-memory counter, escalating delay, Spanish countdown

Pure part lives in `pin.ts` so it is unit-testable without timers:

```
lockoutDelayMs(n) = n < 1 ? 0 : min(1000 * 2^(n-1), 30000)      // 1s, 2s, 4s, 8s, 16s, 30s, 30s…
```

Component part in `LockScreen`:

```
on failure  : failuresRef.current += 1 ; now = Date.now()
              setNow(now) ; setBlockedUntil(now + lockoutDelayMs(failuresRef.current))
on success  : failuresRef.current = 0 ; setBlockedUntil(null)          // next failure starts at 1s
tick effect : blockedUntil !== null → setInterval(250 ms) { setNow(Date.now());
              if (Date.now() >= blockedUntil) setBlockedUntil(null) } ; return clearInterval
display     : penaltySeconds = ceil(max(0, blockedUntil - now) / 1000)
```

The interval is created/cleared inside a single `useEffect` keyed on `blockedUntil`, so unmount cleanup is guaranteed. While `penaltySeconds > 0` or `submitting`, the submit button and the PIN input are `disabled` and the handler returns early if it is somehow invoked. `failuresRef` (not state) avoids nested `setState` inside an updater; `blockedUntil`/`now` state drives rendering. Tests use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(...)` (Vitest fakes `Date` too, keeping the countdown deterministic).

Spanish copy: penalty `Demasiados intentos. Espera {n} s para volver a intentarlo.` (rendered with `role="status"` so it is announced and easy to query), submit while deriving `Comprobando…`, unchanged mismatch copy `PIN incorrecto. Inténtalo de nuevo.`

**Scope note (documented limitation).** The counter is per-mount: a page reload resets it. That is acceptable because a reload also re-locks the app (D5), each attempt still costs a full PBKDF2 derivation, the search space is ≤10⁶ and the attack this defends against is casual tapping — a persistent counter would require writing failure state, which contradicts "unlock state does not outlive the page session".

### D7 — Export/import containment

**Choice.** Extract payload construction into `src/lib/backup.ts` as a pure function typed `Omit<Settings, "pinHash">`, and have `importData` both **drop** the imported credential and **restore** the local one.

```
Export (Ajustes.exportData)   buildBackupPayload(state)          → type has no pinHash field
Import (store.importData)     const { pinHash: _imported, ...importedSettings } = rawSettings;
                              settings: { ...DEFAULT_SETTINGS, ...importedSettings, themeColor,
                                          ...(localPinHash !== undefined ? { pinHash: localPinHash } : {}) }
```

**Alternatives.** Testing export through `Ajustes` + jsdom Blob — rejected: `Blob.prototype.text` is **undefined** in jsdom (measured), so the payload could not be read back without stubbing half the download path. Deleting the key with `delete out.pinHash` (with a cast) — workable but needs a cast; the rest-omit pattern typechecks cleanly (verified with tsc) and makes the omission explicit in the type. An allowlist of exported settings — rejected: silently drops future non-credential settings, breaking the "other exported settings are unchanged" clause.

**Rationale.** `pinHash` is the **only** credential field (salt/count/algorithm are embedded in the string), so a single omission point covers every requirement, and `bcvRate`, `storeName`, `currency`, `themeColor`, `darkMode` keep flowing untouched. Import must also *keep* the device's own credential: dropping the imported value alone would delete the local lock (the `settings` object is replaced wholesale). Full `importData` validation stays out of scope.

### D8 — Fail closed without storage, and without crypto

**Choice.** `isStorageAvailable(): boolean` in `src/lib/store.ts` probes `localStorage` write+remove inside `try/catch` (missing, blocked, Safari-private, quota). `AppContent` computes it once per mount (`useState(isStorageAvailable)`) and gates:

```
locked = !storageOk || (hasCredential && !unlocked)
hasCredential = typeof pinHash === "string" && pinHash.length > 0
```

`LockScreen` receives `storageBlocked?: boolean`; in that state it renders the store name plus a Spanish notice (`No se puede acceder al almacenamiento de este dispositivo…`) and a disabled `Entrar` button — **no PIN form**, because there is no readable credential to verify against. `verifyPin` returning `reason: "crypto-unavailable"` (platform primitive absent, e.g. a non-secure `http://` context, where `crypto.subtle` is undefined) is treated the same way, with its own notice (`Este dispositivo no permite verificar el PIN. Abre la app en un contexto seguro (HTTPS)…`); `hashPin` throws `PinCryptoUnavailableError` so a credential is never written under a degraded primitive.

**Alternatives.** Treating "no storage" as "no credential configured" (today's behavior) — rejected: that is precisely the fail-open bypass the spec closes. Letting verification succeed without a credential — rejected by the spec scenario.

**Rationale.** Nothing sensitive renders in either degraded state, and no code path can reach the router without an in-memory `unlocked === true`.

### D9 — Test-to-scenario mapping and harness impact

See the mapping table below. **No changes to `src/test/setup.ts` or `vite.config.ts`** — the seam lives in the code's structure, so the harness needs no bridge. Tests obtain a real primitive directly (`globalThis.crypto.subtle`, present in both Vitest environments, measured) and pass it explicitly; `crypto-unavailable` cases pass a fake `{ importKey, deriveBits }` that rejects. Fallback if a future Vitest drops Node's crypto in jsdom: a documented test-only helper `src/test/webcrypto.ts` resolving Node's webcrypto through a runtime-computed specifier (`const id = "node:" + "crypto"; await import(id)`), required because `@types/node` is not installed — **not needed today, do not create it speculatively**.

## Interfaces / Contracts

```ts
// src/lib/pin.ts
export const PIN_KDF = {
  algorithm: "PBKDF2", hash: "SHA-256",
  iterations: 210_000, derivedBits: 256, saltBytes: 16,
} as const;

/** Subconjunto de WebCrypto que necesita el PIN (inyectable en pruebas). */
export type PinSubtle = Pick<SubtleCrypto, "importKey" | "deriveBits">;

export interface DerivePinOptions {
  salt?: Uint8Array;      // por defecto 16 bytes aleatorios
  iterations?: number;    // por defecto PIN_KDF.iterations
  subtle?: PinSubtle;     // por defecto globalThis.crypto.subtle
}

export type PinVerifyResult =
  | { readonly ok: true; readonly upgraded?: string }
  | { readonly ok: false; readonly reason: "mismatch" | "malformed" | "crypto-unavailable" };

export class PinCryptoUnavailableError extends Error {}

export async function hashPin(pin: string, options?: DerivePinOptions): Promise<string>;
export async function verifyPin(
  pin: string,
  stored: string,
  options?: { subtle?: PinSubtle }
): Promise<PinVerifyResult>;

export function isLegacyPinCredential(stored: string): boolean;
/** @deprecated Solo verificación de credenciales heredados (formato cyrb53). */
export function verifyLegacyPin(pin: string, stored: string): boolean;
export function lockoutDelayMs(failures: number): number;
export function isValidPin(pin: string): boolean;   // sin cambios
```

```ts
// src/lib/backup.ts
export type ExportableSettings = Omit<Settings, "pinHash">;
export interface BackupPayload { products; clients; sales; payments; purchases; returns; cajaCierres;
  settings: ExportableSettings; exportedAt: string; }
/** Construye el respaldo exportable: nunca incluye el credencial del PIN. */
export function buildBackupPayload(state: PersistedData, exportedAt?: string): BackupPayload;

// src/lib/store.ts
/** Comprueba que localStorage sea legible y escribible (modo privado, permisos, cuota). */
export function isStorageAvailable(): boolean;

// src/components/LockScreen.tsx
interface LockScreenProps {
  onUnlock: () => void;
  /** Almacenamiento no disponible: no hay credencial verificable (fail closed). */
  storageBlocked?: boolean;
  /** Seam de pruebas: en producción se omite y se usa la primitiva de la plataforma. */
  subtle?: PinSubtle;
}
```

## Credential format spec

```
pbkdf2$<iterations>$<saltBase64>$<hashBase64>
```

* `pbkdf2` — literal tag; implies PBKDF2-HMAC-SHA-256 with a 256-bit derived key.
* `<iterations>` — decimal positive integer, no leading zeros, `1 ≤ n ≤ 10_000_000`; production value `PIN_KDF.iterations` (210000).
* `<saltBase64>` — RFC 4648 base64 (standard alphabet with `=`, so never `$`) of the 16-byte salt.
* `<hashBase64>` — base64 of the 32-byte derived key.
* Parse: exactly four `$`-separated segments, `pbkdf2` tag first, salt decodes to 16 bytes, hash decodes to 32 bytes, base64 strict; any deviation ⇒ `malformed` ⇒ locked.
* The PIN never appears in the value and is not recoverable from it (one-way derivation).
* Anything not starting with `pbkdf2$` is a legacy cyrb53 credential (verify-only); comparison of the derived bytes uses a non-short-circuiting XOR loop.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/pin.ts` | Modify | PBKDF2 derivation + format parse, legacy verify-only cyrb53, `lockoutDelayMs`, seam types |
| `src/lib/pin.test.ts` | Modify | Rewritten for async derivations; legacy cases rewritten, not deleted |
| `src/lib/backup.ts` | Create | `buildBackupPayload` + `Omit<Settings,"pinHash">` contract |
| `src/lib/backup.test.ts` | Create | Export containment (scenario 15) |
| `src/lib/store.ts` | Modify | `isStorageAvailable`, `importData` drops imported credential and restores the local one |
| `src/lib/store.test.ts` | Modify | Import containment (16), `isStorageAvailable` cases |
| `src/components/LockScreen.tsx` | Modify | Async verify, throttle + countdown, blocked variants, `subtle` seam, legacy upgrade write |
| `src/components/LockScreen.test.tsx` | Create | 2, 7, 11, 12, 13, 14, 17, 18 |
| `src/App.tsx` | Modify | In-memory unlock, fail-closed gate, `sessionStorage` removed |
| `src/App.test.tsx` | Modify | 1, 3, 4, 5, 6 (four existing cases preserved) |
| `src/pages/Ajustes.tsx` | Modify | Async `savePin`, async `PinModal`, `buildBackupPayload` in export |
| `src/pages/Ajustes.test.tsx` | Create | 8 at UI level + async error copy |
| `src/lib/types.ts` | Modify | Comment on `Settings.pinHash` describing the credential value (shape unchanged) |

## Data flow

```
load ──▶ AppContent ──▶ isStorageAvailable()? ──no──▶ LockScreen{storageBlocked}   (nothing else mounts)
                          │yes
                          ├─ hasCredential? ──no──▶ HashRouter + Routes
                          └─yes─▶ LockScreen{onUnlock} ──submit──▶ verifyPin(pin, settings.pinHash, {subtle})
                                     │                                   │
                                     │                       ok+upgraded └─▶ updateSettings({pinHash: new})
                                     │                       ok ─────────└─▶ onUnlock() → setUnlocked(true) [memoria]
                                     └── fail ──▶ failures++ ──▶ blockedUntil = now + lockoutDelayMs(n)
                                                                  └─ 250 ms tick ──▶ "Espera {n} s"
Ajustes ──▶ hashPin(pin) ──▶ updateSettings({pinHash: "pbkdf2$…"})
        └─▶ buildBackupPayload(state)  ──▶ JSON sin pinHash
Import  ──▶ importData(json) ──▶ drop imported pinHash, keep local pinHash
```

## Migration / Rollout

No store schema migration and no persist `version` bump: the credential stays a single string in `settings.pinHash`, and `migrateState` is untouched. Legacy credentials keep working and are upgraded on the next successful unlock. Rollback (`git revert`) re-locks out any device already upgraded, so the documented procedure is to clear `settings.pinHash` inside the `termuxtienda-store` blob before relaunching the reverted build.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit (`src/lib/*.test.ts`, node env) | Format, salt, verify, legacy upgrade, malformed, crypto-unavailable, `lockoutDelayMs` table, export containment, import containment, `isStorageAvailable` | Real derivations through the seam; low-iteration credentials where speed matters; no timers |
| Integration (`*.test.tsx`, jsdom docblock + `setup.dom` first) | Lock gating, lock screen states, countdown, disabled submit, upgrade write on unlock, PIN set through the dialog | Testing Library; `vi.useFakeTimers()` for the penalty; injected `subtle` |
| E2E | none | No e2e layer in this project |

Expected suite cost: default-path derivations are ≈180–240 ms each; component tests use low-iteration credentials, so the wall-clock increase should stay in the low seconds (baseline 9.6 s / 56 tests).

## Test → Scenario mapping

| # | Scenario (spec) | Test file | Case |
|---|---|---|---|
| 1 | Configured PIN gates protected content at startup | `src/App.test.tsx` | `pinHash` configured, LockScreen mock renders a probe → Dashboard mock absent, no financial text |
| 2 | Successful verification reveals protected content | `src/components/LockScreen.test.tsx` | correct PIN → `onUnlock` called once, lock screen gone (store credential from a low-iteration `hashPin`) |
| 3 | No credential configured opens normally | `src/App.test.tsx` | `DEFAULT_SETTINGS` (no `pinHash`) → routed branch rendered, lock screen never shown |
| 4 | Reload locks the app again | `src/App.test.tsx` | unlock → unmount → remount → lock screen shown again |
| 5 | Pre-seeded stored flags do not unlock | `src/App.test.tsx` | `sessionStorage`/`localStorage` pre-seeded with `termuxtienda-unlocked=1` → still locked (and `grep sessionStorage src` = 0) |
| 6 | Unavailable storage shows the lock screen | `src/App.test.tsx` | `vi.stubGlobal("localStorage", undefined)` (fallback: `defineProperty`) → lock screen shown with **no** credential configured, dashboard absent |
| 7 | A failed verification keeps protected content hidden | `src/components/LockScreen.test.tsx` | wrong PIN → Spanish error, input cleared, `onUnlock` not called, form still available |
| 8 | Setting a PIN stores a derived, self-describing credential | `src/pages/Ajustes.test.tsx` (+ `src/lib/pin.test.ts` format case) | dialog → `settings.pinHash` matches `^pbkdf2$210000$`; PIN text absent from the stored value |
| 9 | Each store gets its own salt | `src/lib/pin.test.ts` | two saltless `hashPin("1234")` calls differ; same injected salt+iterations ⇒ identical; cross-verify of store A's credential fails on store B |
| 10 | Verification accepts the right PIN only | `src/lib/pin.test.ts` | `verifyPin` → `ok: true` for the right PIN, `ok: false` (`mismatch`) for another |
| 11 | Successful legacy verification upgrades the credential | `src/lib/pin.test.ts` + `src/components/LockScreen.test.tsx` | legacy cyrb53 stored → `{ ok: true, upgraded: "pbkdf2$…" }`; component writes it via `updateSettings` before unlocking |
| 12 | Failed legacy verification leaves it untouched | `src/lib/pin.test.ts` + `src/components/LockScreen.test.tsx` | wrong PIN against a legacy credential → denied, stored value byte-identical |
| 13 | Repeated failures escalate with a Spanish countdown | `src/components/LockScreen.test.tsx` (+ `lockoutDelayMs` table in `src/lib/pin.test.ts`) | 1s→2s→4s escalation, `role="status"` text `Demasiados intentos. Espera N s…`, submit disabled during the wait |
| 14 | Successful verification clears the penalty | `src/components/LockScreen.test.tsx` | after the penalty elapses, correct PIN unlocks; a later failure starts again at 1 s |
| 15 | Export omits credential material | `src/lib/backup.test.ts` | payload `settings` has no `pinHash` key (runtime) and the type has no such field; `storeName`/`currency`/`bcvRate`/`themeColor`/`darkMode` unchanged |
| 16 | Import never replaces the local credential | `src/lib/store.test.ts` | backup carrying `pinHash` → device keeps its own value; device without one gains none; other imported settings applied |
| 17 | Derivation is exercised in the jsdom environment | `src/components/LockScreen.test.tsx` | verification runs through the explicitly injected `subtle` (fake primitive asserted as called; rejecting primitive → locked with the crypto notice); default-path format assertion in `src/lib/pin.test.ts` proves production uses the platform primitive |
| 18 | Pre-existing suite stays green, configuration untouched | `src/components/LockScreen.test.tsx` | guard case importing `../test/setup.ts?raw` and `vite.config.ts?raw` and asserting neither mentions the seam (`crypto`/`pbkdf2`/`pin`), plus the suite gate (`npm test` ≥56, `tsc --noEmit`) recorded in tasks/verify |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification or process-integration boundary in this change.

## Risks / Mitigations

| Risk | Mitigation |
|---|---|
| PBKDF2 latency on low-power tablets (600k ≈ 2.4–4.7 s extrapolated) | 210 000 chosen (≈0.24 s desktop, ≈0.5–1.0 s tablet); documented floor of 100 000; the count is stored per credential so it can be re-tuned in one constant without invalidating credentials |
| `crypto.subtle` missing in a non-secure context (`npm run dev --host` over LAN `http://`, old WebView) | Verification returns `crypto-unavailable` → fail closed with a Spanish notice; HTTPS (Netlify) or `localhost` required; called out in the tasks/verify notes |
| jsdom/Vitest crypto coupling (raw jsdom has no `subtle`, Vitest keeps Node's) | Tests never rely on it: the primitive is injected through the seam. Only the two default-path assertions touch `globalThis.crypto.subtle`; if a future Vitest drops it, add the documented `src/test/webcrypto.ts` helper |
| Throttle resets on reload | Accepted and documented (D6): reload re-locks, each attempt costs a full derivation, the space is ≤10⁶, and persisting the counter would violate "unlock state does not outlive the page session" |
| Rollback after migration locks the owner out of the reverted build | Documented rollback clears `settings.pinHash` in the `termuxtienda-store` blob first |
| Imported credential dropped while the device has none | Intended (a backup never installs a lock); recorded as a UX consequence in the design, out of scope to change |
| `resetData` ("Borrar todos los datos") clears the credential, removing the lock | Existing behavior preserved; the action sits behind the lock and destroys all data, so it is not a usable bypass |
| Convex still exposes `settings.pinHash` (`convex/lib.ts:123`, `mutations.ts:370`) unauthenticated | Out of scope; the client does not sync settings, and audit #2 covers server auth |
| Suite runtime growth from 210 000-iteration derivations | Component tests use low-iteration self-describing credentials; only format/default assertions pay the full cost |
| `@types/node` absent, so tests must not import `node:crypto` | Seam typed over DOM `SubtleCrypto`; tests use `globalThis.crypto.subtle` (measured present in both environments) |

## Open Questions

- [ ] Should `Ajustes` require the current PIN to change/remove it? Not required by the spec; without it, anyone past the lock can rebind the credential. Deferred (casual-access model).
- [ ] Should the throttle counter survive a reload (e.g. a non-credential counter written under a separate key)? Deliberately out of scope; revisit only if field abuse is observed.
