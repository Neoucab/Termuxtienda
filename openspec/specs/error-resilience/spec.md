# error-resilience Specification

## Purpose

Render-failure containment: a caught render error shows a Spanish fallback with a recovery action instead of a white screen. Component test tooling belongs to this capability.

## Requirements

### Requirement: Render-failure containment

The app MUST contain render-time failures anywhere in the protected UI and MUST show a Spanish fallback instead of a blank screen. The fallback MUST state the failure in Spanish (for example, "Algo salió mal") and MUST keep an exit reachable.

#### Scenario: Throwing subtree shows the fallback, not a white screen

- GIVEN a UI subtree inside the containment point throws during render
- WHEN that subtree renders
- THEN the fallback UI is displayed with the Spanish failure message
- AND the document body is not left blank

#### Scenario: An exit stays reachable with the fallback shown

- GIVEN the fallback UI is displayed after a render failure
- WHEN the user inspects the visible interface
- THEN app shell navigation or an equivalent exit affordance is available
- AND the user can leave the failed view without reloading manually

#### Scenario: Failure in the lock entry branch is contained

- GIVEN the user is locked out and the lock/unlock branch throws during render
- WHEN that branch renders
- THEN the fallback UI is displayed in place of the lock UI
- AND the same recovery action is offered

### Requirement: Failure recovery

The fallback MUST offer a recovery action labeled "Reintentar" that resets the contained failure state and re-renders the previously failed subtree.

#### Scenario: Recovery re-renders the failed subtree

- GIVEN the fallback UI is displayed after a render failure
- WHEN the user activates "Reintentar" and the subtree no longer throws
- THEN the previously failed content is rendered again
- AND the fallback UI is no longer displayed

#### Scenario: Repeated failure keeps the fallback available

- GIVEN the fallback UI is displayed after a render failure
- WHEN the user activates "Reintentar" and the subtree throws again
- THEN the fallback is displayed again
- AND the recovery action remains available

### Requirement: Single containment integration point

Containment MUST come from one integration point covering both the routed pages and the lock/unlock entry branch; duplicated or per-page boundary machinery MUST NOT be introduced.

#### Scenario: Both entry branches share one containment point

- GIVEN the protected UI entry point is inspected
- WHEN either a routed page or the lock/unlock branch throws during render
- THEN the same fallback UI and recovery behavior are observed in both cases
- AND no page-level boundary is required to produce that behavior

### Requirement: Component test environment

Component tests MUST run under `npm test` in a jsdom environment through `@testing-library/react`; existing node-environment library tests MUST keep passing unchanged.

#### Scenario: Component test runs in jsdom with Testing Library

- GIVEN the test suite runs via `npm test`
- WHEN a React component test executes
- THEN it renders and queries components through `@testing-library/react` in a jsdom environment

#### Scenario: Existing library tests stay green and untouched

- GIVEN the 7 existing node-environment library test files are unchanged
- WHEN `npm test` runs
- THEN all 7 files pass and the node test setup module is not modified

### Requirement: Production-safe failure handling

Containment MUST NOT add a runtime (non-development) dependency, and error capture MUST NOT emit console output in production builds.

#### Scenario: No runtime dependency is added

- GIVEN the dependency manifest after the change
- WHEN runtime dependencies are inspected
- THEN no new runtime dependency beyond the existing set is present
- AND the new test libraries are declared as development dependencies

#### Scenario: Captured errors produce no console output in production

- GIVEN a production build
- WHEN a render failure is captured
- THEN the capture path produces no console output
- AND the Spanish fallback UI is still displayed
