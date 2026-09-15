# Proposal: add-tienda-cliente

## Intent

Termuxtienda is a 100% localStorage POS: all data lives on the owner's device, so customers arriving from WhatsApp/Instagram posts have no public surface. This adds a client view: a public catalog published to the Worker, browsed at `#/tienda`, carted, ordered via wa.me; the real transaction stays in chat.

## Scope

### In Scope
1. Public `#/tienda` and `#/tienda/carrito` render outside the PIN gate; owner routes unchanged.
2. `buildCatalogo` publishes a sanitized projection (never `cost`): POST `/api/catalogo` + `X-Catalogo-Secret`, public GET; Worker `main`, KV `CATALOGO`, `PUBLISH_SECRET`; opaque `Settings.publishSecret`, mismatch 401.
3. Owner UX: Inventario publish button; Ajustes: WhatsApp del dueño, Clave de catálogo, Enlace copy, última publicación; LockScreen "Ver catálogo"; `productCaption` line.
4. Storefront: prices $ + Bs, size/color, category, "Agotado" at stock ≤ 0 (all products); cart `termuxtienda-cart`; `orderMessage` opens wa.me: itemized $/Bs totals, "pre-pedido" disclaimer.
5. Settings `whatsappNumber?`, `publishSecret?` via migrateState, no bump.

### Out of Scope
Real transactions, stock reservation, client accounts, payments, Convex, CORS.

## Capabilities

### New Capabilities
- `catalog-publishing`: sanitized projection to Worker KV; secret-gated POST, public GET; publish UI.
- `client-storefront`: public catalog, client cart, WhatsApp pre-order.

### Modified Capabilities
- `access-lock`: gate narrows to the owner subtree; public routes render while locked; lock screen gains a catalog link.

## Approach

`AppContent` always mounts the router; the gate wraps only the owner subtree. `src/lib/catalogo.ts` holds `buildCatalogo` and `orderMessage`. Strict TDD: unit tests prove `cost` exclusion, message format, 401 mismatch; jsdom proves public routes render while locked; then two-device E2E and curl gates.

## Affected Areas

| Area | Change |
|---|---|
| `src/App.tsx` | Router always mounts; gate wraps owner subtree |
| `src/lib/catalogo.ts`, `Tienda.tsx`, `Carrito.tsx`, `worker/`, `wrangler.jsonc` | New: projection, order message, public routes, `main`, KV `CATALOGO` |
| `lib/store.ts`, `types.ts`, `publish.ts`; Inventario, Ajustes, LockScreen, PublishModal | Modified: settings, publish UI, link copy, caption |

Fences: `convex/`, `src/test/setup.ts`, `vite.config.ts` untouched; no new dependencies.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Public price exposure | — | Intended; retail only; `cost` exclusion unit-tested |
| Stale prices/stock after edits | Med | "Presupuesto" model: owner confirms in chat; one-tap republish |
| Publish secret leakage | Low | Regenerate in Ajustes; old key 401s post-rotation |

## Rollback Plan

Revert the commit: no public routes, gate restored, Worker assets-only, KV inert; new Settings fields optional.

## Dependencies

- Deployed Worker via existing CI deploy job; KV + `PUBLISH_SECRET` ready.

## Success Criteria

- [ ] `#/tienda` browsable on a second device while the owner app stays locked.
- [ ] Projection excludes `cost`; missing/wrong secret gives 401.
- [ ] 94 pre-existing tests stay green; new unit and jsdom tests; Worker passes curl gates.
