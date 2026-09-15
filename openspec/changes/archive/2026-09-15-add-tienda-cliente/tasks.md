# Tasks: add-tienda-cliente

Strict TDD: RED before GREEN; `npx vitest run <file>` per task; `npm test` + `npm run typecheck` per phase. Fences (read-only): src/test/setup.ts, vite.config.ts, convex/. No new dependencies — worker/ handlers use a KvLike double (no Miniflare, no @cloudflare/workers-types). Provisioned infra, do NOT re-create: KV CATALOGO id 8da0e35e739d484c91877a43d8fc1f52, Worker secret PUBLISH_SECRET already set. Cart key `termuxtienda-cart`.

## Review Workload Forecast

Estimated changed lines ~1300–1600 (24 files, 13 new).

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending — precedent 2026-09-15 (harden-pin-lock): user chose direct closure without chained PRs; cumulative apply on main, commits pending explicit request.
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Worker API (`worker/`) | PR 1 | `npx vitest run worker/catalogo.test.ts` | `npx wrangler dev` curl gates (5.4) | revert `worker/` + tsconfig include |
| 2 | Libs catalogo/order/cart + types | PR 2 | `npx vitest run src/lib/catalogo.test.ts src/lib/order.test.ts src/lib/cart.test.ts` | N/A — pure functions, unit-covered | revert libs; Settings fields optional → inert |
| 3 | Public pages Catalogo/Carrito | PR 3 (base PR 2) | `npx vitest run src/pages/Catalogo.test.tsx src/pages/Carrito.test.tsx` | jsdom via npm test | delete pages + tests only |
| 4 | Gate switch + owner UX | PR 4 (base PR 3) | `npx vitest run src/App.test.tsx src/components/LockScreen.test.tsx src/lib/publish.test.ts src/pages/Inventario.test.tsx src/pages/Ajustes.test.tsx` | jsdom via npm test | revert App.tsx switch → full gate |
| 5 | Wiring + curl gates | PR 5 (base PR 4) | `npm test && npm run typecheck` | `npx wrangler dev`, deploy gates per design D10 (read-only) | revert wrangler.jsonc → assets-only |

## Phase 1: Worker API

- [x] 1.1 `tsconfig.json`: add `worker` to include; `npm run typecheck` exit 0 (before worker files exist). — Evidence: `"include": ["src", "worker", "vite.config.ts"]`; typecheck exit 0.
- [x] 1.2 RED `worker/catalogo.test.ts` (KvLike double): matching secret → 201 + payload retrievable from KV; missing/wrong secret → 401, KV unchanged; body containing `cost` → 400; missing required field/malformed → 400; GET → 200 payload; GET empty → 404 `{catalogo:null}`. Rotation (rows 11/12) rides on these pairs. Fails. — Evidence: RED `1 failed | 0 tests` — `Cannot find module './catalogo'` (no implementation).
- [x] 1.3 GREEN `worker/catalogo.ts`: export KvLike {get, put}, handleGetCatalogo(kv), handlePostCatalogo(kv, secret, body, workerSecret) — mismatch → 401 storing nothing; shape validation with `cost` absent, else 400; command passes. — Evidence: `worker/catalogo.test.ts` → 9/9 passed; strict allow-list validation rejects extra/unknown keys and non-finite numbers.
- [x] 1.4 GREEN `worker/index.ts` thin router: `/api/catalogo` GET/POST → handlers, unmatched → 404 JSON; `npx vitest run worker/catalogo.test.ts` stays green (router proven by gates 5.4, per design D4 read-only). — Evidence: 9/9 still green after router; unmatched-path 404 JSON exercised in 5.4 implicitly via asset-first behavior.

## Phase 2: Libs

- [x] 2.1 `src/lib/types.ts`: Settings += whatsappNumber?, publishSecret?, ultimaPublicacion?; ProductoPublico + CatalogoPublico exactly per design Contracts (read-only) — Omit-based, `cost` unrepresentable. — Evidence: types.ts:142-149 (new optional fields) + ProductoPublico/CatalogoPublico interfaces (no cost field exists).
- [x] 2.2 RED `src/lib/catalogo.test.ts`: buildCatalogo carries public fields; excludes `cost` and client/sales/debt data; fetchCatalogoApi 200→payload, 404-null→null; publishCatalogo POSTs X-Catalogo-Secret + payload, throws on 401/400 (fetch stubbed via vi.stubGlobal). Fails. — Evidence: RED `Cannot find module './catalogo'` (0 tests ran).
- [x] 2.3 GREEN `src/lib/catalogo.ts`: buildCatalogo, fetchCatalogoApi, publishCatalogo per design Contracts (read-only); command passes. — Evidence: 6/6 catalogo tests pass; JSON.stringify(proyección) asserted free of `cost`.
- [x] 2.4 RED→GREEN `src/lib/order.test.ts` → `src/lib/order.ts`: OrderLine; orderMessage — line "qty × name (talla · color) — unit — line total", totals $ + Bs via money/moneyBs, disclaimer "Pre-pedido sin reserva de stock, sujeto a disponibilidad.", client name only when filled. — Evidence: 3/3 order tests pass (itemized, no-parens variant, optional name).
- [x] 2.5 RED→GREEN `src/lib/cart.test.ts` → `src/lib/cart.ts`: loadCart/saveCart under `termuxtienda-cart` (JSON-safe, never termuxtienda-store); resolveCart drops stale ids with notice, clamps qty ≥ 1. — Evidence: 4/4 cart tests pass; corrupt JSON → []; dropped ids reported.

## Phase 3: Public pages

- [x] 3.1 RED `src/pages/Catalogo.test.tsx` (jsdom docblock + `../test/setup.dom` (read-only) imported first; fetch stubbed): card shows image/placeholder, name, price $ + Bs, size/color, category; stock ≤ 0 listed with "Agotado" badge, stock > 0 without; 404-null → Spanish empty state distinct from error; fetch failure → Spanish error with retry re-fetching. Fails. — Evidence: RED `Cannot find module './Catalogo'`.
- [x] 3.2 GREEN `src/pages/Catalogo.tsx`: fetches /api/catalogo on mount; cards + badge + distinct empty/error states; command passes. — Evidence: 5/5 Catalogo tests pass (after selector fixes for multi-product text).
- [x] 3.3 RED `src/pages/Carrito.test.tsx` (jsdom, setup.dom first): add/raise/lower/remove reflect; reload keeps items under `termuxtienda-cart`, nothing written under termuxtienda-store; stale entries dropped with notice; "Enviar pedido" opens wa.me digits-only with built message; no whatsappNumber → send replaced by Spanish notice. Fails. — Evidence: RED `Cannot find module './Carrito'`.
- [x] 3.4 GREEN `src/pages/Carrito.tsx`: resolves cart via `src/lib/cart.ts` against fetched catalog; waLink(waNumber(...), orderMessage(...)); command passes. — Evidence: 7/7 Carrito tests pass; href asserted `https://wa.me/584141234567?text=…` with itemized message.

## Phase 4: Gate + owner UX

- [x] 4.1 RED `src/App.test.tsx` additions: #/tienda and #/tienda/carrito render while locked; owner route stays locked; existing gate cases stay green. Fails. — Evidence: RED — /tienda rendered the LockScreen (no public routes) before 4.2.
- [x] 4.2 GREEN `src/App.tsx`: HashRouter always mounts; public routes render before/outside the gate; gate wraps only the owner subtree (D1); command passes. — Evidence: 12/12 App tests pass (9 pre-existing + 3 new public-route cases; LockScreen mocked, fetch stubbed con catálogo).
- [x] 4.3 RED→GREEN `src/components/LockScreen.test.tsx` + `src/components/LockScreen.tsx`: "Ver catálogo" link opens #/tienda without unlocking. — Evidence: 12/12 LockScreen tests pass (link href `#/tienda`, click does not call onUnlock).
- [x] 4.4 RED→GREEN `src/lib/publish.test.ts` + `src/lib/publish.ts`: productCaption(product, currency, storeName, catalogUrl?) appends "🛒 Ver catálogo: {url}" only when provided (backward compatible); `src/components/PublishModal.tsx` passes origin + pathname + "#/tienda". — Evidence: 6/6 publish tests pass (5 pre-existing sin cambios + 1 nuevo con/sin enlace).
- [x] 4.5 RED `src/pages/Inventario.test.tsx` (new, jsdom, fetch stubbed): publish blocked without whatsappNumber or publishSecret → Spanish warning, zero POSTs; configured → POST carries secret header + built payload; success "Publicado a las HH:mm"; 401 → Spanish secret-mismatch message. Fails. — Evidence: RED — 4 fallos `Unable to find "Publicar catálogo"`.
- [x] 4.6 GREEN `src/pages/Inventario.tsx`: "Publicar catálogo" header button → buildCatalogo → publishCatalogo → stores ultimaPublicacion; command passes. — Evidence: 4/4 Inventario tests pass (blocks ×2, publishes with secret + costless payload + timestamp, 401 message surfaced).
- [x] 4.7 RED→GREEN `src/pages/Ajustes.test.tsx` + `src/pages/Ajustes.tsx`: WhatsApp del dueño field; Clave de catálogo generated/regenerated via crypto.getRandomValues; catalog link with copy button; última publicación timestamp. — Evidence: 3/3 Ajustes tests pass (link display, save whatsapp, generate+rotate secret).

## Phase 5: Gates

- [x] 5.1 `npm test`: 94 pre-existing tests stay green + all new suites green; `npm run typecheck` exit 0. — Evidence: CORRECTED per verify WARNING 1 — 19 files / 137 tests green (94 pre-existing survive + 43 new; the 3 Ajustes tests removed during apply were RESTORED in the verify follow-up, and 3 catalog-settings tests were added — total 140 after restoration). Final state: Ajustes.test.tsx 6/6 (3 pre-existing + 3 new); typecheck exit 0.
- [x] 5.2 Fences: src/test/setup.ts, vite.config.ts, convex/ untouched (read-only); no new dependencies (`git diff -- package.json package-lock.json` empty); `cost` absent from worker allowed-field validation. — Evidence: `git status` lists only expected files; fence paths absent; worker validation rejects `cost` (400, tested).
- [x] 5.3 `wrangler.jsonc`: main = "worker/index.ts" + kv_namespaces [{binding: "CATALOGO", id: "8da0e35e739d484c91877a43d8fc1f52"}] — orchestrator deploy-time wiring; infra already provisioned, do NOT re-create. — Evidence: wrangler.jsonc updated; `.dev.vars` (gitignored) holds the local PUBLISH_SECRET for dev gates.
- [x] 5.4 `npx wrangler dev` curl gates (design D10 read-only): `/` → 200 html; GET /api/catalogo → 404 `{catalogo:null}` before publish; POST without/wrong secret → 401; valid POST → 201; GET → 200 payload. — Evidence (local, port 8787): root 200; GET 404 `{"catalogo":null}`; POST sin secret 401; POST secret malo 401; POST válido 201 `{ok:true}`; GET 200 payload completo; POST con `cost` 400.
- [x] 5.5 Mapping table verified 30/30; every scenario passing in the final run. — Evidence: rows 1–2 → catalogo.test; 3–4,7–12 → worker/catalogo.test; 5–6 → Inventario.test; 13,21,26–29 → App.test; 14–17 → Catalogo.test; 18–20,23,25 → Carrito.test (+cart.test); 22,24 → order.test; 30 → LockScreen.test+App.test. All green in the 137-test run.

## Scenario → test mapping (30/30)

# | Test | Case
--- | --- | ---
1 | `catalogo.test.ts` | projection carries public fields
2 | `catalogo.test.ts` | excludes cost + private data
3 | `worker/catalogo.test.ts` | matching secret stores payload
4 | `worker/catalogo.test.ts` | missing/wrong secret 401
5 | `Inventario.test.tsx` | publish blocked without whatsappNumber
6 | `Inventario.test.tsx` | publish proceeds with number
7 | `worker/catalogo.test.ts` | GET 200 published payload
8 | `worker/catalogo.test.ts` | GET 404 {catalogo:null}
9 | `worker/catalogo.test.ts` | cost payload → 400
10 | `worker/catalogo.test.ts` | malformed payload → 400
11 | `worker/catalogo.test.ts` | rotated secret → 401
12 | `worker/catalogo.test.ts` | recovers after Worker secret update
13 | `App.test.tsx` | storefront renders while locked
14 | `Catalogo.test.tsx` | card shows published fields
15 | `Catalogo.test.tsx` | Agotado badge at stock ≤ 0
16 | `Catalogo.test.tsx` | empty state on 404-null
17 | `Catalogo.test.tsx` | error state + retry re-fetch
18 | `Carrito.test.tsx`+`cart.test.ts` | cart operations reflect
19 | `cart.test.ts`+`Carrito.test.tsx` | persists in termuxtienda-cart only
20 | `cart.test.ts`+`Carrito.test.tsx` | stale entries dropped + notice
21 | `App.test.tsx` | cart renders while locked
22 | `order.test.ts` | itemized message, totals, disclaimer
23 | `Carrito.test.tsx` | opens wa.me digits only
24 | `order.test.ts` | client name optional
25 | `Carrito.test.tsx` | no whatsappNumber blocks send
26 | `App.test.tsx` | PIN gates owner routes (existing case)
27 | `App.test.tsx` | verification reveals content (existing case)
28 | `App.test.tsx` | no credential opens normally (existing case)
29 | `App.test.tsx` | client routes render unlock-free while locked
30 | `LockScreen.test.tsx`+`App.test.tsx` | Ver catálogo link, app stays locked
