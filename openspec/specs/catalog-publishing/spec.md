# catalog-publishing Specification

## Purpose

Owner-side publication of a sanitized catalog projection to the Worker (`POST`/`GET /api/catalogo`, KV `CATALOGO`): secret-gated write, public read, shape validation, rotation.

## Requirements

### Requirement: Sanitized catalog projection

The publish payload built from store state MUST contain `storeName`, `currency`, `bcvRate`, `whatsappNumber`, `publishedAt`, and `products`, and each product entry MUST contain exactly `id`, `name`, `category`, `size`, `color`, `price`, `image`, and `stock`. The payload MUST NOT contain `cost` or any client, sales, or debt data.

#### Scenario: Projection carries the public fields

- GIVEN an inventory whose products carry cost along with the public fields
- WHEN the publish payload is built
- THEN it contains storeName, currency, bcvRate, whatsappNumber, publishedAt, and per product id, name, category, size, color, price, image, and stock

#### Scenario: Projection excludes cost and private data

- GIVEN products with cost values and a store holding client, sales, and debt records
- WHEN the publish payload is built
- THEN no `cost` key appears anywhere in the payload
- AND no client, sales, or debt record is present

### Requirement: Secret-gated publish endpoint

The Worker MUST store a `POST /api/catalogo` payload only when the header `X-Catalogo-Secret` equals the Worker's `PUBLISH_SECRET` and the payload passes shape validation. A request with a missing or wrong secret MUST be answered with status 401 and MUST store nothing.

#### Scenario: Matching secret stores the payload

- GIVEN the Worker runs with PUBLISH_SECRET set to S and a valid payload is prepared
- WHEN POST /api/catalogo arrives with X-Catalogo-Secret set to S
- THEN the response is a success status
- AND the payload is retrievable from the catalog KV storage

#### Scenario: Missing or wrong secret is rejected

- GIVEN the Worker runs with PUBLISH_SECRET set to S
- WHEN POST /api/catalogo arrives without the header, or with a value other than S
- THEN the response status is 401
- AND the catalog KV storage is unchanged

### Requirement: Publish requires the owner's WhatsApp number

The device MUST block publishing while `Settings.whatsappNumber` is absent: the owner sees a Spanish warning and no publish request is sent. The device settings MUST let the owner set the WhatsApp number and the catalog publish secret.

#### Scenario: Publish blocked without WhatsApp number

- GIVEN no whatsappNumber is configured in settings
- WHEN the owner triggers publish from the inventory view
- THEN a Spanish warning is shown and publishing is blocked
- AND no POST /api/catalogo request is issued

#### Scenario: Publish proceeds with the number configured

- GIVEN whatsappNumber is configured in settings
- WHEN the owner triggers publish
- THEN POST /api/catalogo is sent carrying the secret header and the built payload

### Requirement: Public read of the published catalog

The Worker MUST serve the latest stored payload to any unauthenticated caller at `GET /api/catalogo` with status 200. With nothing published, GET MUST return an explicit not-published response: status 404 with body `{ "catalogo": null }`.

#### Scenario: Published catalog is publicly readable

- GIVEN a payload was stored by a successful publish
- WHEN GET /api/catalogo is requested without credentials
- THEN the response status is 200 with that payload as JSON

#### Scenario: Nothing published is an explicit response

- GIVEN the catalog KV storage is empty
- WHEN GET /api/catalogo is requested
- THEN the response status is 404 with body { "catalogo": null }

### Requirement: Server-side shape validation

The Worker MUST validate the POSTed payload against the projection shape before storing. A payload missing a required field, containing `cost`, or not matching the projection shape MUST be rejected with status 400 and MUST store nothing.

#### Scenario: Payload containing cost is rejected

- GIVEN a valid X-Catalogo-Secret
- WHEN a payload containing a `cost` key is POSTed
- THEN the response status is 400
- AND the catalog KV storage remains unchanged

#### Scenario: Incomplete or malformed payload is rejected

- GIVEN a valid X-Catalogo-Secret
- WHEN a payload missing a required field, for example `products`, or of an unexpected shape is POSTed
- THEN the response status is 400
- AND nothing is stored

### Requirement: Secret rotation invalidates stale publishes

Changing the device publish secret MUST make publish attempts fail with 401 — the old secret no longer matches, and the new one does not either — until the Worker's `PUBLISH_SECRET` is updated to the new value.

#### Scenario: Publish fails after device rotation

- GIVEN the device secret and the Worker PUBLISH_SECRET are both A
- WHEN the device secret is rotated to B and a publish is attempted before the Worker is updated
- THEN the response status is 401
- AND nothing is stored

#### Scenario: Publish recovers once the Worker secret is updated

- GIVEN the device secret is B and the Worker PUBLISH_SECRET has been updated to B
- WHEN a publish signed with B is sent
- THEN the response is a success status
- AND the payload is stored and publicly readable
