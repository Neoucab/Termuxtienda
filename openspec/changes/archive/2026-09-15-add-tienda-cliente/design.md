# Design: add-tienda-cliente

## Context

The app is a single-device PWA: 100% localStorage (`termuxtienda-store` v2), no backend imports anywhere in `src/` (verified: zero Convex imports), and the PIN gate (`App.tsx:40-46`, memory-only `unlocked`, fail-closed) wraps the ENTIRE router — there is no public surface. The owner already shares product captions (text + photo via Web Share API, `src/components/PublishModal.tsx`) on WhatsApp/Instagram, but clients have nowhere to browse.

Approved product model (plan `~/.commandcode/plans/catalogo-publico-prepedido-whatsapp.md`): public client storefront at `/#/tienda` with a cart that sends an itemized pre-order ("presupuesto") to the owner's WhatsApp — no stock reservation, no payments, the transaction is chat. Cloud: the existing Cloudflare Worker `termuxtienda` gains a script + KV `CATALOGO` (namespace id `8da0e35e739d484c91877a43d8fc1f52`, already created) + secret `PUBLISH_SECRET` (already set). Convex stays deferred (audit gaps #2/#3 need interactive login); KV free tier (100k reads/day, 1k writes/day) is orders of magnitude above this workload (one publish = 1 write; client visits = 1 read each).

Measured facts this design relies on: `Product = {id, name, category, size?, color?, sku?, cost, price, stock, minStock, image?, published?, createdAt}` — `cost` is the margin and must never leave the device; `Settings = {storeName, currency, bcvRate?, pinHash?, themeColor, darkMode}`; `migrateState` already merges `DEFAULT_SETTINGS` (new optional Settings fields need no persist version bump); `waNumber` (whatsapp.ts) normalizes DR +1 (8xx) and VE +58 (leading 0); PublishModal builds the caption via `productCaption(product, currency, storeName)`; suite baseline 12 files / 94 tests green.

## Goals / Non-goals

**Goals.** Public storefront (`#/tienda`, `#/tienda/carrito`) rendered outside the PIN gate; owner publishes a sanitized catalog snapshot to KV; clients browse (photo, name, price $ + Bs, size/color, category, Agotado badge), keep a cart, and send an itemized wa.me pre-order to the owner; publish authenticated by an opaque device secret; owner POS routes and lock semantics unchanged.

**Non-goals.** Real transactions, payments, stock reservation or decrement from orders, client accounts/identity, order history server-side, per-product visibility toggles (deferred — all catalog-eligible products ship), Convex migration, CORS (same origin), SW caching of `/api/*`, multi-catalog/versioned catalogs.

## Decisions

### D1 — Routing: public routes outside the gate, owner routes untouched

**Choice.** `AppContent` renders a small route switch BEFORE the gate: when the hash path is `/tienda` or `/tienda/carrito`, the public storefront renders regardless of `locked`/`unlocked` (no LockScreen, no owner store dependency). Every other path behaves exactly as today (gate → LockScreen → owner router). LockScreen gains a "Ver catálogo" link (`#/tienda`); Ajustes shows the shareable link with a copy button.

**Alternatives.** Moving the owner app to `/dueno/*` with the catalog at root — rejected: every `navigate()` call inside the 9 owner pages, both hardcoded NAV arrays, and App tests would migrate, a wide mechanical diff with zero functional gain. Keeping root as catalog and moving only the lock — rejected for the same reason.

**Rationale.** Smallest change satisfying "two views"; the owner shares the explicit catalog link (copied from Ajustes or appended to captions), and a stray visitor at the root sees the owner lock — the secure default.

### D2 — Projection: pure, sanitized, all products

**Choice.** `buildCatalogo(products, settings, publishedAt)` in new `src/lib/catalogo.ts` returns `{publishedAt, storeName, currency, bcvRate, whatsappNumber, products: [{id, name, category, size, color, price, image, stock}]}` — `cost`, `minStock`, `sku`, `published`, `createdAt` stripped at the type level (`Omit`-based `ProductoPublico`); ALL products included, `stock ≤ 0` renders as "Agotado" client-side (pre-order model: clients ask anyway).

**Alternatives.** Per-product `catalogVisible` toggle — deferred (owner said "todos los productos"; the toggle is a cheap future addition). Stock > 0 only — rejected: contradicts "pueda ver todos los productos y pregunte por ellos".

**Rationale.** Type-level omission makes leaking `cost` a compile error; the projection is a pure function → trivially unit-testable (TDD: cost exclusion, public fields carried).

### D3 — Publish auth: opaque device secret vs Worker secret

**Choice.** `Settings.publishSecret` (generated on demand in Ajustes via `crypto.getRandomValues`, shown/regenerated) must equal the Worker's `PUBLISH_SECRET` (set once via `wrangler secret put`); the Worker compares the `X-Catalogo-Secret` header. Rotation = regenerate in Ajustes + re-put the Worker secret.

**Alternatives.** No auth — rejected: anyone could overwrite the public catalog. PIN as credential — impossible: the PIN never leaves the device and the PBKDF2 credential cannot be verified server-side without shipping the hash. OAuth/an account system — rejected: overkill for one owner. A second admin secret for self-service rotation — deferred: rotation is rare; the re-put is a one-command step documented in Ajustes copy.

**Rationale.** An opaque shared secret is the minimal credential that makes the public write endpoint owner-only; nothing sensitive is derivable from it, and leak rotation is two steps.

### D4 — Worker: assets-first routing, pure handlers, strict shape validation

**Choice.** `wrangler.jsonc` gains `"main": "worker/index.ts"` + `kv_namespaces: [{binding: "CATALOGO", id: "8da0e35e…"}]`. With `main` + `assets`, Cloudflare serves matching assets first and runs the Worker for the rest (documented default; `run_worker_first` unused). `worker/index.ts` is a thin router: `/api/catalogo` GET/POST → handlers in `worker/catalogo.ts`; other unmatched paths → 404 JSON. Handlers are pure functions taking a KV-like interface (`get`/`put`) and the request secret — unit-testable without Miniflare or new dev dependencies. POST validates the payload server-side: required fields present, correct types, and `cost` ABSENT → 400 otherwise (defense in depth against a compromised client lib).

**Alternatives.** `@cloudflare/vitest-pool-workers` for integration testing — rejected: new dev dependency + new harness for logic that is pure behind an interface (the repo's TDD harness stays untouched). Pages — rejected: the skill and the existing deployment are Workers. Storing per-product keys — rejected: one snapshot key (`catalogo`) matches the publish/rollback model.

**Rationale.** Assets-first keeps the PWA serving identically; pure handlers keep strict-TDD in the existing runner; server-side validation means the public data shape is enforced where attackers operate, not only in the builder.

### D5 — Cart: client-device state, independent of the owner store

**Choice.** `termuxtienda-cart` in localStorage (separate key — the client device may also hold an empty `termuxtienda-store`; never touched): `{productId, qty}[]`. The cart page resolves entries against the freshly fetched catalog; entries whose product disappeared are dropped with a Spanish notice; qty clamps to ≥ 1.

**Alternatives.** In-memory only — rejected: a client building an order across visits loses it. Zustand store — rejected: the public pages must not read/write `termuxtienda-store` (owner credential semantics); a plain helper + `useState`/`useSyncExternalStore`-style hook is enough.

### D6 — Pre-order message: pure builder, reused primitives

**Choice.** `orderMessage(storeName, items, currency, bcvRate, clientName?)` (new `src/lib/order.ts`) formats exactly per spec (itemized lines with qty × name (size · color) — unit price — line total; total $ and Bs via `money`/`moneyBs`; disclaimer "Pre-pedido sin reserva de stock, sujeto a disponibilidad."). Carrito opens `waLink(waNumber(settings.whatsappNumber), message)`; without a catalog `whatsappNumber` the send button is replaced by a Spanish notice.

**Alternatives.** Reusing `receiptMessage` — rejected: different audience/format (debt receipt vs itemized order). Server-side message building — rejected: the message is a client concern; the Worker never sees it.

### D7 — Settings additions without a persist bump

**Choice.** `Settings.whatsappNumber?: string` and `Settings.publishSecret?: string`; `DEFAULT_SETTINGS` gains no values (undefined = unset). No `version` bump: `migrateState` merges `DEFAULT_SETTINGS` into stored settings, and optional new fields need no migration.

**Rationale.** Backward compatible with every deployed device blob (v2 persists); Ajustes edits them like `storeName`.

### D8 — Catalog link in captions and Ajustes

**Choice.** `productCaption(product, currency, storeName, catalogUrl?)` gains a trailing `🛒 Ver catálogo: {url}` line when a URL is provided (PublishModal passes `location.origin + location.pathname + "#/tienda"`); Ajustes shows the same URL with a copy button. Existing caption tests updated for the optional parameter (absent → no line, backward compatible).

### D9 — Publishing UX and state

**Choice.** Inventario header button "Publicar catálogo" → builds projection → POST with the device secret → success feedback ("Publicado a las HH:mm"); failure 401 → Spanish message pointing at the catalog secret mismatch; missing `whatsappNumber` or `publishSecret` → publish blocked with a Spanish warning (bound decision from propose). Ajustes keeps `ultimaPublicacion?: number` in Settings for the timestamp display.

**Alternatives.** Auto-publish on every product edit — rejected: surprise public writes + KV write quota churn; explicit publish matches the "pre-pedido/presupuesto" mental model (prices are a snapshot).

### D10 — Verification strategy

**Choice.** (1) Strict TDD per task: worker handlers (KV double), projection, order message, then jsdom pages via the existing harness; `npm test` (≥ 94) + `npm run typecheck` per phase. (2) `npx wrangler dev` locally: curl gates — `/` 200 html, `/api/catalogo` 404-null before publish, POST without/with wrong secret 401, valid POST 201, GET 200 with payload. (3) `npx wrangler deploy` → same curl gates against `termuxtienda.neoucab.workers.dev`. (4) Real two-device E2E by the owner (publish from one phone, order from another). (5) CI gates unchanged; deploy job publishes the Worker+assets.

**Rationale.** The spec's observability rule maps to pure functions (worker handlers, builders), rendered UI (jsdom), and network status codes — no scenario depends on implementation intent; the deployed Worker is a receipt, same discipline as add-ci-pipeline.

## Interfaces / Contracts

```ts
// src/lib/types.ts (additions)
interface Settings {
  /* …existing… */
  whatsappNumber?: string;
  publishSecret?: string;
  ultimaPublicacion?: number;
}
interface ProductoPublico { id: ID; name: string; category: string; size?: string; color?: string; price: number; image?: string; stock: number; }
interface CatalogoPublico { publishedAt: number; storeName: string; currency: string; bcvRate?: number; whatsappNumber?: string; products: ProductoPublico[]; }

// src/lib/catalogo.ts
export function buildCatalogo(products: Product[], settings: Settings, publishedAt: number): CatalogoPublico;
export async function fetchCatalogoApi(): Promise<CatalogoPublico | null>;      // null = no publicado (404-null)
export async function publishCatalogo(payload: CatalogoPublico, secret: string): Promise<void>; // throws on 401/400/network

// worker/catalogo.ts
export interface KvLike { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void>; }
export async function handleGetCatalogo(kv: KvLike): Promise<Response>;                       // 200 payload | 404 {catalogo:null}
export async function handlePostCatalogo(kv: KvLike, secret: string | undefined, body: unknown, workerSecret: string): Promise<Response>; // 401 | 400 | 201

// src/lib/order.ts
export interface OrderLine { name: string; qty: number; unitPrice: number; size?: string; color?: string; }
export function orderMessage(storeName: string, lines: OrderLine[], currency: string, bcvRate: number | undefined, clientName?: string): string;
```

## Risks / Mitigations

| Risk | Mitigation |
|---|---|
| Public price exposure (prices, not costs, become public) | Intended by the owner; `cost` excluded at type level AND server-side validation rejects payloads containing it |
| Stale catalog (owner changes price after publish) | Snapshot model is the product ("presupuesto"); message says "precio estimado… sujeto a disponibilidad"; publishedAt visible in the storefront footer |
| Publish secret leaks | Rotation: regenerate in Ajustes + `wrangler secret put`; 401 evidence visible in the publish feedback |
| KV quota | 1 write per publish, 1 read per client visit — free tier is 1000× headroom |
| Worker routing breaks the PWA (assets not served) | Assets-first is the documented default with `main` + `assets`; verified with `wrangler dev` curl gates before deploy and after deploy |
| Public pages regress owner-gate security | access-lock delta modifies only "Lock-gated startup"; App tests assert `/tienda` renders while locked AND `/` stays locked |
| jsdom lacks `fetch`/`crypto` randomness used by new libs | Harness provides Node webcrypto (measured in harden-pin-lock D9/Ajustes tests); `fetch` mocked in tests via `vi.stubGlobal` like existing suites |

## Open Questions

- [ ] Per-product catalog visibility toggle (hide individual items) — deferred; all products ship in V1 per the owner's "todos los productos".
- [ ] Client-side price display in Bs when `bcvRate` is unset — V1 shows only `$` until the owner sets the rate (consistent with the POS's own behavior).
