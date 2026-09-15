# Proposal: add-error-boundaries

## Intent

Audit gap #1 (CRITICAL): no `ErrorBoundary` exists in `src/` — verified 2026-09-15 (grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` → 0 matches). A render error in any of the 9 pages white-screens the app, losing the operator's context mid-sale.

## Scope

### In Scope
- One `ErrorBoundary` class component with a Spanish fallback reusing `Card`, `Button`, `--c-*` tokens.
- Minimal wiring in `src/App.tsx`; no duplicated boundary machinery.
- Component-test infra: devDeps `jsdom` + `@testing-library/react` + `@testing-library/dom`, jsdom env for component tests only (`src/test/setup.ts` stays node-only).

### Out of Scope
- Error reporting, retry queues, per-page boundaries (#14); CI/CD (#7), lint (#8), code splitting (#6), Convex (#2/#3), validation (#9).

## Capabilities

### New Capabilities
- `error-resilience`: a caught render error shows a Spanish fallback with a recovery action instead of a white screen. UI test tooling belongs to this capability.

### Modified Capabilities
- None — `openspec/specs/` is empty.

## Approach

Class boundary (React requires a class) implementing `getDerivedStateFromError` + `componentDidCatch`, plus a reset action. Fallback: `Card` + Spanish copy ("Algo salió mal" / "Reintentar"); no new runtime dependency. One boundary high in `App.tsx` covers the `LockScreen` branch and `<Routes>`. Reset semantics and config placement (`vite.config.ts` vs new `vitest.config.ts`) are design decisions.

**Test Strategy (strict_tdd — tests first, red → green):**
1. `ErrorBoundary.test.tsx` (RTL + jsdom): throwing child renders the fallback; reset restores children.
2. The 7 existing `src/lib/*.test.ts` stay green.
3. Gate: `npm test` + `npm run typecheck`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ErrorBoundary.tsx` | New | Class boundary + Spanish fallback |
| `src/components/ErrorBoundary.test.tsx` | New | RTL/jsdom tests |
| `src/App.tsx` | Modified | Wrap protected subtree |
| `vite.config.ts`/`vitest.config.ts` | Modified/New | jsdom env for component tests |
| `package.json` | Modified | 3 devDependencies |
| `src/test/setup.ts` | Untouched | Node polyfill for lib tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| jsdom breaks node-only lib tests | Med | Keep `node` default; run full `npm test` |
| Errors swallowed silently | Med | Visible fallback; dev-gated logging decided in design |
| LockScreen needs its own boundary | Low | One top-level boundary; covered by test |

## Rollback Plan

`git revert` the change's commits: removes the boundary and its test, restores `App.tsx`, config and `package.json`. No persisted state or schema is touched.

## Dependencies

- New devDeps: `jsdom`, `@testing-library/react`, `@testing-library/dom`; no runtime dependency.

## Success Criteria

- [ ] A throwing page renders the Spanish fallback, not a white screen.
- [ ] Boundary tests + existing 7 test files pass via `npm test`; `npm run typecheck` clean.
- [ ] No reporting service, retry queue, extra boundary, or `convex/` change.
