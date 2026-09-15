# Delta for access-lock

The PIN gate narrows to the owner subtree: public client routes render while locked, and the lock screen links to the public catalog. The session-scoped memory-only unlock and fail-closed storage requirements are unchanged.

## MODIFIED Requirements

### Requirement: Lock-gated startup

The app MUST render owner content only after a successful PIN verification when a PIN credential is configured; when no credential is configured, the app MUST open without asking for one. The gate MUST apply to the owner routes (`/`, `/ventas`, …) only: the client routes `#/tienda` and `#/tienda/carrito` MUST render without unlock even when a PIN is configured, and the lock screen MUST offer a "Ver catálogo" link that opens the public catalog without unlocking the app.
(Previously: every route was gated behind the PIN and the lock screen offered no catalog link.)

#### Scenario: Configured PIN gates owner content at startup

- GIVEN a PIN credential is configured on this device
- WHEN the app loads on an owner route such as / or /ventas
- THEN the lock screen is displayed instead of owner content
- AND no financial data is rendered until verification succeeds

#### Scenario: Successful verification reveals protected content

- GIVEN the lock screen is displayed and the correct PIN is known
- WHEN the user submits the correct PIN
- THEN protected content is rendered
- AND the lock screen is no longer displayed

#### Scenario: No credential configured opens normally

- GIVEN no PIN credential is configured on this device
- WHEN the app loads
- THEN protected content is rendered directly
- AND no lock screen is displayed

#### Scenario: Client routes render without unlock while locked

- GIVEN a PIN credential is configured and the app is locked
- WHEN the client route #/tienda or #/tienda/carrito is opened
- THEN that client route renders without any PIN verification
- AND owner routes stay hidden behind the lock screen

#### Scenario: Lock screen links to the public catalog

- GIVEN the lock screen is displayed with a PIN configured
- WHEN the "Ver catálogo" link is activated
- THEN the storefront renders at #/tienda
- AND the app remains locked for owner routes
