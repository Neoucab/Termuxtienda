```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:135c0fe3edccfe6bb7387d9b893adf71b6f30d0656bf6e2d03bbf9e7a40ba59f
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 30/30
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:4d152a8e06701db4373a39f70cbbbe3f0e82beee2f95eb6f555d2637de410b25
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:8b7f5ce57bc7cbc809aaeb5aa98cc7236f96dcaff25052eaeb946e66c608dffc
```

## Verification Report

**Change**: add-tienda-cliente
**Version**: N/A (no spec version recorded in deltas)
**Mode**: Strict TDD
**Verified state**: working tree at HEAD `c3a7c1f` carrying the change uncommitted (per tasks.md chain-strategy note: "commits pending explicit request"); `git status` lists only expected files (see Gates).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 25 |
| Tasks complete | 25 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build (typecheck)**: ✅ Passed — `npm run typecheck` (`tsc --noEmit`) exit 0, re-run twice by verify (second run captured to `build-evidence.txt` and hashed; tsc is silent on success, output is the two `npm notice run` lines only).

**Tests**: ✅ 137 passed / 0 failed / 0 skipped — `npm test` (`vitest run` v4.1.11) → `Test Files 19 passed (19)`, `Tests 137 passed (137)`, duration 20.10 s, re-run in full by verify. The `Error: fallo simulado …` stderr traces are the documented intentional crash-test noise (App.test.tsx LockScreen/Dashboard mocks and ErrorBoundary.test.tsx), not failures.

**Gates re-run by verify (read-only)**:
- Live deployment `termuxtienda.neoucab.workers.dev` (version df9dfe6d): `GET /` → `200` `text/html` (assets-first serving works with `main` + KV binding); `GET /api/catalogo` → `404` with body `{"catalogo":null}` (proves the Worker answered from the real KV `CATALOGO` binding — an asset fallback could not produce this JSON); `POST /api/catalogo` without secret → `401` `{"error":"Clave de catálogo inválida."}` (auth gate path; no payload sent, nothing stored — the exact worker copy is returned).
- Fences: `git diff --stat -- src/test/setup.ts vite.config.ts convex package.json package-lock.json` → empty; `git diff -- package.json package-lock.json` → empty (no new dependencies; node_modules populated, no install run). `git status` shows only expected paths (`.gitignore`, `tsconfig.json`, `wrangler.jsonc`, `src/App.tsx`, `src/App.test.tsx`, `src/components/LockScreen.{tsx,test.tsx}`, `src/components/PublishModal.tsx`, `src/lib/publish.{ts,test.ts}`, `src/lib/types.ts`, `src/pages/Ajustes.{tsx,test.tsx}`, `src/pages/Inventario.tsx`, new `src/lib/{cart,catalog,order}*', `src/pages/{Catalogo,Carrito,Inventario.test}.tsx`, `worker/`, `openspec/changes/add-tienda-cliente/`) plus untracked `.wrangler/` (local dev cache, see SUGGESTION 1).
- `.gitignore` delta is exactly one line: `+.dev.vars` (local publish secret for dev gates stays out of version control; file contents deliberately not read by verify).
- `tsconfig.json` `include` is `["src", "worker", "vite.config.ts"]` (task 1.1) and `npm run typecheck` covers `worker/`.
- Suite arithmetic: 19 files / 137 tests = 91 surviving pre-existing tests (12 pre-existing files; 3 pre-existing tests removed from `Ajustes.test.tsx`, see WARNING 1) + 46 new tests (worker 9, catalogo 6, order 3, cart 4, Catalogo 5, Carrito 7, Inventario 4, Ajustes 3 new, App +3, LockScreen +1, publish +1). `git diff` confirms App.test.tsx (+56/−0), LockScreen.test.tsx (+14/−0), publish.test.ts (+6/−0) are insertion-only; Ajustes.test.tsx is a rewrite (99 lines changed: +20/−79).

**Local wrangler dev gates (tasks 5.4)**: recorded apply-phase evidence, not re-runnable by verify (dev server stopped) — audited as documented: `/` 200; GET 404 `{"catalogo":null}`; POST without secret 401; POST wrong secret 401; valid POST 201 `{ok:true}`; GET 200 payload; POST with `cost` 400. The two 401s and the 404-null are independently corroborated by verify's live re-runs; the 201/200-payload/400-cost paths are corroborated by `worker/catalogo.test.ts` (9/9) against the same handler code. See WARNING 2.

**Coverage**: ➖ Not available — no coverage tool configured (`coverage_command: null` in openspec/config.yaml). Coverage analysis skipped, not a failure.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| catalog-publishing R1: Sanitized catalog projection | Projection carries the public fields | `src/lib/catalogo.test.ts` > "arma la proyección con los campos públicos y datos de la tienda" (full `toEqual` on payload + product) | ✅ COMPLIANT |
| catalog-publishing R1 | Projection excludes cost and private data | `src/lib/catalogo.test.ts` > "nunca incluye cost ni datos privados del inventario" (`in` key checks ×5 + serialized payload free of `cost`) | ✅ COMPLIANT |
| catalog-publishing R2: Secret-gated publish endpoint | Matching secret stores the payload | `worker/catalogo.test.ts` > "guarda el catálogo con el secret correcto y responde 201" (201 + payload retrievable from KV double) | ✅ COMPLIANT |
| catalog-publishing R2 | Missing or wrong secret is rejected | `worker/catalogo.test.ts` > "rechaza 401 cuando falta el secret…" + "…el secret es incorrecto…" (401 + KV unchanged) + live re-run: POST without secret → 401 | ✅ COMPLIANT |
| catalog-publishing R3: Publish requires the owner's WhatsApp number | Publish blocked without WhatsApp number | `src/pages/Inventario.test.tsx` > "bloquea la publicación sin WhatsApp del dueño y no hace ninguna petición" (Spanish warning + `fetchMock` not called) | ✅ COMPLIANT |
| catalog-publishing R3 | Publish proceeds with the number configured | `src/pages/Inventario.test.tsx` > "publica con el secret y un payload sin costos" (POST URL/method, `X-Catalogo-Secret` header, payload without `cost`, `ultimaPublicacion` stored) | ✅ COMPLIANT |
| catalog-publishing R4: Public read of the published catalog | Published catalog is publicly readable | `worker/catalogo.test.ts` > "devuelve 200 con el payload publicado" | ✅ COMPLIANT |
| catalog-publishing R4 | Nothing published is an explicit response | `worker/catalogo.test.ts` > "devuelve 404 {catalogo:null} cuando no hay nada publicado" + live re-run: GET → 404 `{"catalogo":null}` | ✅ COMPLIANT |
| catalog-publishing R5: Server-side shape validation | Payload containing cost is rejected | `worker/catalogo.test.ts` > "rechaza 400 un payload que incluye cost y no guarda nada" (allow-list also rejects any unknown product key) | ✅ COMPLIANT |
| catalog-publishing R5 | Incomplete or malformed payload is rejected | `worker/catalogo.test.ts` > "rechaza 400 un payload con campos faltantes o desconocidos" + "…con tipos incorrectos" (missing fields, unknown top-level key, wrong types; KV unchanged) | ✅ COMPLIANT |
| catalog-publishing R6: Secret rotation invalidates stale publishes | Publish fails after device rotation | `worker/catalogo.test.ts` > "rechaza 401 el secret viejo y acepta 201 tras actualizar el secret del worker" (first half: header/worker mismatch → 401, nothing stored; comparison is symmetric equality, so header-new/worker-old fails identically) | ✅ COMPLIANT |
| catalog-publishing R6 | Publish recovers once the Worker secret is updated | same test (second half: both sides new → 201 + payload stored and retrievable) | ✅ COMPLIANT |
| client-storefront R1: Public storefront rendering | Storefront renders while the owner app is locked | `src/App.test.tsx` > "muestra el catálogo del cliente sin desbloquear el POS cuando hay un PIN" (catalog renders; mocked lock content and owner panel absent) | ✅ COMPLIANT |
| client-storefront R1 | Product card shows the published fields | `src/pages/Catalogo.test.tsx` > "muestra los productos publicados con precio en $ y Bs" (name ×2, $20.00, Bs 800,00, T.32, Azul, Ropa ×2, exactly 1 `<img>` — the card without image renders the placeholder div, asserted by absence of a second img role) | ✅ COMPLIANT |
| client-storefront R1 | Out-of-stock product is listed with Agotado | `src/pages/Catalogo.test.tsx` > "marca Agotado solo a los productos sin stock" (single "Agotado" match — stock-0 card badged, in-stock cards badge-free; both cards listed) | ✅ COMPLIANT |
| client-storefront R2: Distinct empty and error states | No catalog published shows the empty state | `src/pages/Catalogo.test.tsx` > "muestra un estado vacío distinguible cuando no hay catálogo publicado" (404-null stub → Spanish empty state, no product actions) | ✅ COMPLIANT |
| client-storefront R2 | Network failure shows the error state with retry | `src/pages/Catalogo.test.tsx` > "muestra error en español con reintento que vuelve a consultar" (reject-once stub → error state; retry re-fetches, fetch called 2×, catalog renders in place) | ✅ COMPLIANT |
| client-storefront R3: Client cart independent of the owner credential | Cart operations update the visible cart | `src/pages/Catalogo.test.tsx` > "agrega al carrito…" (add + counter) + `src/pages/Carrito.test.tsx` > "suma, resta y quita líneas" (+/−/remove reflected, localStorage emptied) + `src/lib/cart.test.ts` | ✅ COMPLIANT |
| client-storefront R3 | Cart persists across visits in its own key | `src/pages/Carrito.test.tsx` > "mantiene el carrito en termuxtienda-cart tras interactuar y nunca escribe termuxtienda-store" + `src/lib/cart.test.ts` > "ignora datos corruptos y nunca toca termuxtienda-store" (`termuxtienda-cart` written, `termuxtienda-store` null) | ✅ COMPLIANT |
| client-storefront R3 | Entries missing from the fresh catalog are dropped | `src/pages/Carrito.test.tsx` > "descarta con aviso las entradas cuyo producto ya no está publicado" (Spanish notice + entry gone from view and storage) + `src/lib/cart.test.ts` > "descarga las entradas…"/"avisa con los nombres…" | ✅ COMPLIANT |
| client-storefront R3 | Cart renders while locked | `src/App.test.tsx` > "muestra el carrito del cliente sin desbloquear el POS" (cart renders at #/tienda/carrito with PIN configured; no lock/owner content) | ✅ COMPLIANT |
| client-storefront R4: WhatsApp pre-order | Itemized message with totals and disclaimer | `src/lib/order.test.ts` > "arma el presupuesto itemizado con total en $ y Bs" (line "2× Jean Azul (T.32 · Azul) — $20.00 c/u — $40.00", total $ + Bs, exact disclaimer) | ✅ COMPLIANT |
| client-storefront R4 | Message opens wa.me to the owner's number | `src/pages/Carrito.test.tsx` > "arma el enlace wa.me con el mensaje del pre-pedido (solo dígitos)" (href `https://wa.me/584141234567?text=…` with itemized message + name + disclaimer decoded) | ✅ COMPLIANT |
| client-storefront R4 | Client name is optional | `src/lib/order.test.ts` > "incluye el nombre del cliente solo cuando se indica" (filled → "Nombre: Juan"; absent and whitespace-only → omitted) | ✅ COMPLIANT |
| client-storefront R4 | Catalog without WhatsApp number disables sending | `src/pages/Carrito.test.tsx` > "reemplaza el envío por un aviso cuando el catálogo no tiene WhatsApp" (send link absent, Spanish notice shown) | ✅ COMPLIANT |
| access-lock R1: Lock-gated startup | Configured PIN gates owner content at startup | `src/App.test.tsx` > "muestra el bloqueo y oculta el contenido cuando hay una credencial configurada" (existing case, kept insertion-only) | ✅ COMPLIANT |
| access-lock R1 | Successful verification reveals protected content | `src/App.test.tsx` > "vuelve a bloquear tras desmontar y montar de nuevo (recarga)" (gate-level unlock → owner content) + `src/components/LockScreen.test.tsx` > "desbloquea con el PIN correcto y retira la pantalla de bloqueo" (real PIN verification, pre-existing) | ✅ COMPLIANT |
| access-lock R1 | No credential configured opens normally | `src/App.test.tsx` > "abre directamente cuando no hay credencial configurada" (existing case) | ✅ COMPLIANT |
| access-lock R1 | Client routes render without unlock while locked | `src/App.test.tsx` > "muestra el catálogo del cliente…" + "muestra el carrito del cliente…" (both #/tienda and #/tienda/carrito render with PIN configured; no unlock step; owner content absent) | ✅ COMPLIANT |
| access-lock R1 | Lock screen links to the public catalog | `src/components/LockScreen.test.tsx` > "ofrece el catálogo público sin desbloquear el POS" (href `#/tienda`, `onUnlock` not called, PIN form still shown) + `src/App.test.tsx` > "el enlace Ver catálogo de la pantalla de bloqueo navega sin desbloquear" (click → storefront renders, owner panel absent) | ✅ COMPLIANT |

**Compliance summary**: 30/30 scenarios compliant; 11/11 requirements implemented and covered (catalog-publishing 6 req / 12 scen, client-storefront 4 req / 13 scen, access-lock 1 req / 5 scen — counts taken from the retrieved delta specs).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| catalog-publishing R1 Sanitized projection | ✅ Implemented | `src/lib/catalogo.ts` `proyectar()` copies exactly `id/name/category/size/color/price/image/stock` (spread-guarded optionals); `buildCatalogo` adds `publishedAt/storeName/currency/bcvRate?/whatsappNumber?`; `cost`, `minStock`, `sku`, `published`, `createdAt` unrepresentable in `ProductoPublico` (`src/lib/types.ts:153-162`) and absent from the builder. |
| catalog-publishing R2 Secret-gated publish | ✅ Implemented | `worker/catalogo.ts` `handlePostCatalogo` rejects non-string/empty/mismatched `X-Catalogo-Secret` → 401 **before** any KV access; only a full validation pass reaches `kv.put`. |
| catalog-publishing R3 Publish requires WhatsApp number | ✅ Implemented | `src/pages/Inventario.tsx:36-45` blocks with Spanish warnings ("Configura primero el WhatsApp del dueño…"/"…la clave del catálogo…") before any request; Ajustes provides both fields (whatsapp input + `crypto.getRandomValues` 24-byte base64url secret). |
| catalog-publishing R4 Public read | ✅ Implemented | `handleGetCatalogo` → 200 payload or 404 `{catalogo:null}`; re-verified live (404-null observed in production). |
| catalog-publishing R5 Server-side shape validation | ✅ Implemented | `esCatalogoValido`/`esProductoValido`: allow-list keys (unknown key → 400), required fields, string/number/finite checks, integer `stock ≥ 0`, and `"cost" in o → false` (line 34); malformed JSON body → 400 via `request.json().catch(() => null)`. |
| catalog-publishing R6 Rotation | ✅ Implemented | Secret equality is symmetric; stale secret 401s until the Worker `PUBLISH_SECRET` is re-put (rotation steps documented in Ajustes hint copy); proven by the rotation test pair. |
| client-storefront R1 Public storefront | ✅ Implemented | `src/pages/Catalogo.tsx` fetches `/api/catalogo` on mount; cards show image/👕 placeholder, name, `$` + Bs (Bs only when `bcvRate` present — documented V1 behavior), T./color chips, category; every product listed, `stock <= 0` → `Agotado` badge. |
| client-storefront R2 Empty/error states | ✅ Implemented | Distinct Spanish empty state ("Aún no hay catálogo publicado") vs error state with Reintentar button re-triggering the fetch (`recarga` counter). |
| client-storefront R3 Cart isolation | ✅ Implemented | `src/lib/cart.ts` uses only `termuxtienda-cart`; `loadCart` discards malformed entries, `resolveCart` drops unknown ids (reported) and clamps `qty ≥ 1`; `Carrito.tsx` shows the drop notice; tests assert `termuxtienda-store` is never written. |
| client-storefront R4 WhatsApp pre-order | ✅ Implemented | `src/lib/order.ts` `orderMessage` (itemized lines, $ + Bs totals, exact disclaimer, optional trimmed name); `Carrito.tsx` opens `waLink(waNumber(...))` — digits-only normalization reuses the tested `waNumber`; missing `whatsappNumber` replaces send with a Spanish notice. |
| access-lock R1 Lock-gated startup (MODIFIED) | ✅ Implemented | `src/App.tsx:42-57` — gate formula unchanged (`locked = !storageOk \|\| (hasCredential && !unlocked)`, unlock memory-only, fail-closed); `/tienda` + `/tienda/carrito` matched before the `*` owner subtree; LockScreen gains "¿Eres cliente? Ver catálogo" → `#/tienda`. Owner routes stay behind the lock. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Public routes outside the gate | ✅ Yes | `App.tsx` route switch matches D1 verbatim; owner routes untouched (`*` subtree behind the gate); Ajustes/LockScreen links to `#/tienda`. |
| D2 Pure sanitized projection, all products | ✅ Yes | Pure `buildCatalogo`; no per-product toggle; stock ≤ 0 client-side "Agotado". Note: `ProductoPublico` is a hand-written interface exactly matching the Contracts block; D2's prose says "Omit-based" — functionally equivalent (`cost` unrepresentable), see SUGGESTION 4. |
| D3 Opaque device secret vs Worker secret | ✅ Yes | `Settings.publishSecret` generated in Ajustes via `crypto.getRandomValues` (24 bytes, base64url), compared against Worker `PUBLISH_SECRET` via `X-Catalogo-Secret`; rotation = regenerate + `wrangler secret put`. |
| D4 Assets-first Worker, pure handlers, strict validation | ✅ Yes | `wrangler.jsonc` `main: "worker/index.ts"` + `kv_namespaces [{binding: "CATALOGO", id: 8da0e35e…}]`; thin router (`/api/catalogo` GET/POST, else 404 JSON, 405 for other methods); handlers pure over `KvLike` (no Miniflare, no new dev deps); server-side validation rejects `cost` with 400. Live `/` 200 html proves assets-first. |
| D5 Cart on its own key | ✅ Yes | `termuxtienda-cart`; plain hook (no Zustand for the cart); stale entries dropped with notice; qty ≥ 1. Public pages never read `termuxtienda-store` (the `AppContent` wrapper subscribes to theme/pinHash only and renders no owner data into public routes). |
| D6 Pre-order message via reused primitives | ✅ Yes | `money`/`moneyBs`/`usdToBs` reused; `waLink`/`waNumber` reused; `receiptMessage` untouched. |
| D7 Settings additions without persist bump | ✅ Yes | `types.ts:142-147` optional `whatsappNumber?/publishSecret?/ultimaPublicacion?`; `DEFAULT_SETTINGS` unchanged; `migrateState` merges `{...DEFAULT_SETTINGS, ...(s.settings ?? {})}` (`store.ts:122`). |
| D8 Catalog link in captions and Ajustes | ✅ Yes | `productCaption(product, currency, storeName, catalogUrl?)` appends `🛒 Ver catálogo: {url}` only when provided (backward compatible, publish.test +5 pre-existing kept); PublishModal passes `origin + pathname + "#/tienda"`. |
| D9 Publishing UX and state | ✅ Yes | Inventario header button, double precondition block, `ultimaPublicacion` stored on success, worker error message surfaced on 401, no auto-publish. |
| D10 Verification strategy | ✅ Yes / ⚠️ residue | (1) Strict TDD per task with RED/GREEN evidence — confirmed; (2) local `wrangler dev` gates — recorded apply evidence, audited (WARNING 2); (3) deploy + live gates — 3 read-only gates re-run by verify; (4) two-device E2E — owner-owned, judged acceptable post-verify (see Issues); (5) CI untouched (no `.github/` changes in `git status`). |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Per-task RED/GREEN evidence lines in `tasks.md` (this project's apply-progress carrier; no separate artifact exists — same mode as the 2026-09-15 precedent). |
| All tasks have tests | ✅ | Every test-bearing task maps to an existing passing file; infra tasks (1.1, 2.1, 5.3) carry non-test evidence (typecheck, types, wiring). All 11 touched/created test files exist and pass. |
| RED confirmed (tests exist) | ✅ | 6 RED-bearing tasks (1.2, 2.2, 3.1, 3.3, 4.1, 4.5) hold original RED evidence captured during apply: `Cannot find module './catalogo'` ×2, `'./Catalogo'`, `'./Carrito'`, `/tienda` rendered LockScreen, 4× `Unable to find "Publicar catálogo"`. All structurally credible (each imports/queries code that now exists and could not pass before it). Unlike the 2026-09-15 precedent, **no RED evidence needed reconstruction**. |
| GREEN confirmed (tests pass) | ✅ | Verify re-ran the full suite: 137/137 green, exit 0; per-file counts match every evidence line (worker 9, catalogo 6, order 3, cart 4, Catalogo 5, Carrito 7, Inventario 4, Ajustes 3, publish 6, App 12, LockScreen 12). |
| Triangulation adequate | ✅ | `cost` exclusion proven at 3 layers (builder unit, worker 400, Inventario payload assertion); 401 at 3 variants (missing/wrong/rotated) + live; cart isolation in 2 files; gate narrowing over 2 routes in 2 files; order message 3 cases incl. whitespace name; worker validation covers missing/unknown/mistyped keys. |
| Safety Net for modified files | ⚠️ | `App.test.tsx`, `LockScreen.test.tsx`, `publish.test.ts`: pre-existing cases preserved (insertion-only diffs). `Ajustes.test.tsx`: 3 pre-existing tests **removed** and replaced by 3 new ones (see WARNING 1) — the only safety-net breach, and it is a scope-of-file rewrite, not a failure. |

**TDD Compliance**: 5/6 checks clean, 1 with the warning below — 25/25 tasks carry evidence.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (node env) | 87 | 12 (incl. new `worker/catalogo` 9, `catalogo` 6, `order` 3, `cart` 4) | Vitest 4.1.11 |
| Integration (jsdom + Testing Library) | 50 | 7 (new `Catalogo` 5, `Carrito` 7, `Inventario` 4; modified `App` 12, `LockScreen` 12, `Ajustes` 3; pre-existing `ErrorBoundary` 7) | @testing-library/react, jsdom docblock + `setup.dom` first |
| E2E | 0 | 0 | not installed (per config `e2e: false`; two-device E2E is owner-owned per D10) |
| **Total (suite)** | **137** | **19** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`coverage_command: null`). Not a failure; runtime evidence is complete via the 137-test suite plus live gates.

### Assertion Quality
✅ All assertions verify real behavior. Audited all 11 new/changed test files: no tautologies; no orphan empty checks (every empty-state assertion has a companion populated-render test); no ghost loops (no assertions inside loops over query results); no smoke-only tests (every render asserts specific content/behavior); no mock-heavy files (fetch stubs always accompany behavioral assertions on DOM, KV-double state, or localStorage). Implementation-detail assertions are absent — the Inventario/App tests assert on URL, header, payload, storage keys, and rendered text, not CSS. Two deliberate nuances, both sound: `catalogo.test.ts` combines `in` key-absence checks with `JSON.stringify` containment (the `in` checks carry the load); `App.test.tsx` mocks LockScreen/Dashboard — the established crash-test harness pattern, with the real LockScreen link behavior covered in its own file. The `body.textContent !== ""` check in App.test.tsx is not load-bearing.

**Assertion quality**: 0 CRITICAL, 0 WARNING

### Quality Metrics
**Linter**: ➖ Not available (no `lint_command` configured)
**Type Checker**: ✅ No errors (`npm run typecheck` → `tsc --noEmit` exit 0, re-run by verify)

### Issues Found
**CRITICAL**: None.
**BLOCKER**: None.
**WARNING**:
1. **Three pre-existing Ajustes tests were removed, and the tasks.md 5.1 evidence overstates preservation.** `git diff` shows `src/pages/Ajustes.test.tsx` was rewritten: the pre-existing tests "guarda una credencial derivada y autocontenida al configurar el PIN", "avisa en español y no guarda nada cuando la primitiva no está disponible" (PinModal crypto-unavailable path) and "construye el respaldo con `buildBackupPayload` en lugar de armarlo en el componente" were deleted and replaced by 3 catalog-settings tests. Consequently tasks.md 5.1's parenthetical "(12/94 pre-existing unchanged …)" is inaccurate as written (naively summed it would yield 140, not 137): the true delta is 94 − 3 removed + 46 new = 137, and the proposal success criterion "94 pre-existing tests stay green" holds only as "91 of 94 survive green; 3 were consciously or unconsciously replaced". All three removed behaviors remain substantially covered at other layers (pin.test.ts derivation ×15, LockScreen.test.tsx verify path ×12, backup.test.ts ×4), and none of this change's delta-spec scenarios lost coverage — but the PinModal save-error copy ("No se pudo guardar el PIN en este dispositivo.", `Ajustes.tsx:488`) and the Ajustes→`buildBackupPayload` delegation now have **no** covering test. All three removed tests would still pass against current code, so their removal was unnecessary; restoring them (or at least the PinModal one) is recommended. Judged a WARNING, not CRITICAL: no failing test, no regression in behavior, no delta-spec scenario uncovered — but an evidence-accuracy defect that must be corrected at archive time.
2. **Valid-publish local gates are recorded evidence only (server stopped).** The 5.4 gates that write (valid POST → 201, GET → 200 payload, POST with `cost` → 400) could not be re-run by verify and rest on apply's recorded transcript. Audit found them consistent with the handler source, the 9 worker unit tests that exercise identical paths over the same code, and verify's independent live re-runs of the read-only trio (which also prove the production Worker+KV binding and secret gate are wired). Residual risk is limited to "production write path never exercised end-to-end", which is exactly what follow-up (a) below retires.
3. **Two-device E2E is deferred to the owner (D10 step 4) — judged acceptable as a post-verify follow-up.** The owner-only E2E would uniquely prove real-network publish, a real wa.me handoff, and two physical devices. Verify considers the deferral sound because every production integration point is already exercised read-only: assets-first serving (`/` 200 html), the Worker answering from the real KV `CATALOGO` binding (GET 404 `{"catalogo":null}` can only come from `handleGetCatalogo` hitting KV), the publish auth gate (401 with the exact worker copy; secret provisioned per deploy df9dfe6d), the full write path proven over the same handler code in unit + local gates, and the client flow proven in jsdom with the real `waNumber`/`orderMessage`/`waLink` primitives. The first real publish by the owner (then browsing `#/tienda` from a second device) should be recorded as the closing evidence for this follow-up; it does not gate this change's verdict because the change's own specs do not require E2E and the project declares `e2e: false`.

**SUGGESTION**:
1. `.wrangler/` (local wrangler dev state, including local KV data generated during the 5.4 gates) is untracked but **not** gitignored — add `.wrangler/` to `.gitignore` before committing so dev state and any local KV snapshot cannot be committed accidentally.
2. `handlePostCatalogo` compares secrets with `!==` (non-constant-time). With a 24-byte `crypto.getRandomValues` secret the practical risk is negligible; a timing-safe compare would be a cheap hardening.
3. `handleGetCatalogo` does `JSON.parse(raw)` unguarded; if the KV value were ever corrupted out-of-band the route 500s. Only validated payloads are stored, so risk is minimal — consider try/catch → 404-null for symmetry with the empty case.
4. D2 prose calls `ProductoPublico` "Omit-based" while the implementation (and the design's own Contracts block) uses a hand-written interface. Functionally equivalent (`cost` unrepresentable; the builder's return type forces field presence); either align the wording at archive time or switch to `Omit<Product, "cost" | "minStock" | …>` so future `Product` fields are opted in explicitly.

### Verdict
**PASS WITH WARNINGS** — All 25 tasks complete with evidence; 11/11 requirements and 30/30 scenarios have real, passing covering tests (137/137 suite green at exit 0, typecheck exit 0, both re-run by verify); the security-relevant claims hold under audit (cost excluded at type, builder, and server layers with 400 enforcement; secret-gated publish with 401 corroborated live; access-lock narrowing exactly as specified with owner routes still gated and memory-only unlock preserved; cart isolated in `termuxtienda-cart` and proven never to touch `termuxtienda-store`); the three warnings concern evidence accuracy and residual unexercised paths (Ajustes test replacement, recorded-only local write gates, owner-owned two-device E2E), none of which breaks a spec scenario.

### Recommended follow-ups for the archive phase
1. Owner two-device E2E (D10 step 4): publish real catalog data from the owner device and browse/order from a second device; record the result as the closing evidence for WARNING 3 (first publish also retires the "production write path unexercised" residue of WARNING 2).
2. Restore the 3 removed pre-existing Ajustes tests (or at minimum the PinModal crypto-unavailable case) in a small follow-up, and correct the tasks.md 5.1 evidence line to "91 of 94 pre-existing survive; 3 replaced in Ajustes.test.tsx" before archiving, so the archived change does not carry an inaccurate success-criterion claim (WARNING 1).
3. Add `.wrangler/` to `.gitignore` and commit the change (commits are pending explicit user request per the chain-strategy note) — `.gitignore` should not carry the `.wrangler/` gap into history.
4. Merge the three delta specs into `openspec/specs/catalog-publishing/spec.md`, `openspec/specs/client-storefront/spec.md`, and `openspec/specs/access-lock/spec.md` (access-lock REPLACES the previous "Lock-gated startup" requirement text with the narrowed wording), then move `openspec/changes/add-tienda-cliente/` to `openspec/changes/archive/` per `config.yaml` phase_rules.archive, carrying these exact report bytes.
5. Record design Open Questions as future change candidates: per-product catalog visibility toggle; Bs display when `bcvRate` is unset (currently `$`-only by design).
6. Keep the risk visible post-archive: rotation requires the two-step regenerate + `wrangler secret put` documented in Ajustes; consider adding the rotation procedure to the archived change's README notes if the owner self-serves it.
