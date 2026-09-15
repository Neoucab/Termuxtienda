# Delta for client-storefront

Public client view: catalog browsing at `#/tienda`, client cart at `#/tienda/carrito`, and WhatsApp pre-order — all outside the owner's PIN gate.

## ADDED Requirements

### Requirement: Public storefront rendering

The storefront at `#/tienda` MUST render for any visitor without PIN verification, including while the owner's app is locked, and MUST fetch `/api/catalogo` on visit. Each product card MUST show the photo (or a placeholder when absent), the name, the price in $ and in Bs converted at the published `bcvRate`, the size/color, and the category. Every catalog product MUST be listed, including out-of-stock ones, which MUST carry an "Agotado" badge.

#### Scenario: Storefront renders while the owner app is locked

- GIVEN a PIN credential is configured and the owner app is locked
- WHEN a visitor opens #/tienda
- THEN the catalog page renders without any unlock step
- AND the lock screen is not shown for this route

#### Scenario: Product card shows the published fields

- GIVEN a published catalog with products
- WHEN the storefront renders after fetching /api/catalogo
- THEN each card shows image or placeholder, name, price in $ and in Bs, size/color, and category

#### Scenario: Out-of-stock product is listed with Agotado

- GIVEN the catalog contains a product with stock of zero or less
- WHEN the storefront renders
- THEN that product's card is listed and carries the "Agotado" badge
- AND cards of products with stock above zero carry no "Agotado" badge

### Requirement: Distinct empty and error states

When the catalog is not published, the storefront MUST show a friendly Spanish empty state, distinct from a failure. When fetching `/api/catalogo` fails, the storefront MUST show a Spanish error state offering retry, which re-fetches on activation.

#### Scenario: No catalog published shows the empty state

- GIVEN GET /api/catalogo returns the not-published response, 404 with { "catalogo": null }
- WHEN the storefront renders
- THEN a Spanish empty state is displayed
- AND it is presented as no catalog published, not as an error

#### Scenario: Network failure shows the error state with retry

- GIVEN the request to /api/catalogo fails
- WHEN the storefront renders
- THEN a Spanish error state with a retry control is displayed
- AND after a successful retry the catalog renders in place of the error

### Requirement: Client cart independent of the owner credential

The cart at `#/tienda/carrito` MUST support adding, removing, and adjusting product quantity, and MUST render without PIN verification even when a PIN is configured. The cart MUST persist on the client device across visits under the localStorage key `termuxtienda-cart`, separate from the owner store key `termuxtienda-store`. On each visit the cart MUST be resolved against the freshly fetched catalog: entries whose product is no longer present MUST be dropped and a notice displayed.

#### Scenario: Cart operations update the visible cart

- GIVEN the storefront shows a product
- WHEN the client adds it, raises its quantity, lowers it, and removes it
- THEN the cart view reflects each change in order

#### Scenario: Cart persists across visits in its own key

- GIVEN a cart holding items
- WHEN the page is reloaded
- THEN the same items are visible again
- AND they are stored under termuxtienda-cart, with nothing written under termuxtienda-store

#### Scenario: Entries missing from the fresh catalog are dropped

- GIVEN a stored cart references a product absent from the freshly fetched catalog
- WHEN the cart resolves against that catalog
- THEN the stale entry is removed
- AND a notice is displayed

#### Scenario: Cart renders while locked

- GIVEN a PIN credential is configured and the owner app is locked
- WHEN a visitor opens #/tienda/carrito
- THEN the cart renders without any unlock step

### Requirement: WhatsApp pre-order

The "Enviar pedido" action MUST build an itemized message — one line per item: quantity × name (size/color), unit price, and line total — followed by totals in $ and in Bs and the disclaimer "pre-pedido sin reserva de stock, sujeto a disponibilidad", and MUST open `wa.me` addressed to the catalog's `whatsappNumber` in international digits only (for example "+58 412 1234567" becomes 584121234567). An optional client name MUST be included in the message when filled. When the catalog has no `whatsappNumber`, the send action MUST be hidden or replaced with a Spanish notice.

#### Scenario: Itemized message with totals and disclaimer

- GIVEN a cart with two products and a published bcvRate
- WHEN the order message is built
- THEN each line shows quantity × name (size/color), unit price, and line total
- AND the message closes with totals in $ and in Bs and the disclaimer sentence

#### Scenario: Message opens wa.me to the owner's number

- GIVEN the catalog whatsappNumber is set
- WHEN the client activates Enviar pedido
- THEN a wa.me link carrying the message is opened to the owner's number digits only

#### Scenario: Client name is optional

- GIVEN the client name field on the order view
- WHEN the message is built once with a name filled and once empty
- THEN the first message includes the name and the second omits it

#### Scenario: Catalog without WhatsApp number disables sending

- GIVEN the published catalog has no whatsappNumber
- WHEN the order view renders
- THEN the send action is hidden or replaced with a Spanish notice
