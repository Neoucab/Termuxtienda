# Design: add-error-boundaries

## Context

Gap #1: `src/` has no `ErrorBoundary` (grep-verified), so a render error in the 9 routed pages or the lock branch white-screens a POS session mid-sale. Verified: `App.tsx` returns `<LockScreen/>` (when `settings.pinHash && !unlocked`) or `<HashRouter>` → `AppShell` + 9 routes; `Card`/`Button` render on `--c-*` tokens; zero `console.*` in `src/`; Vitest 4.1.10, `node` default env, 7 lib tests, `test/setup.ts` used only by `store.test.ts`. DevDependencies are absent here, so `npm install` precedes RED work.

## Goals / Non-goals

**Goals**: one containment point for both entry branches; Spanish fallback with a working `Reintentar`; jsdom component tests leaving node tests untouched; no runtime dependency; no production console output.
**Non-goals**: reporting/retry queue (#14), per-page boundaries, code splitting (#6), location-aware reset, jest-dom, lint/CI (#7/#8).

## Decisions

| # | Decision | Alternatives | Choice and why |
|---|---|---|---|
| 1 | Boundary + reset | state-only reset; location-aware remount; `location.reload()` | **State-only.** `getDerivedStateFromError` + `componentDidCatch`; `reset()` clears `state.error`. Location-aware needs `useLocation` — impossible above `<HashRouter>`, and inside it the lock branch would need a second boundary (forbidden). Reload restarts a PWA. Repeated failure holds: the throw is re-caught and the fallback returns. |
| 2 | Integration shape | wrap `<App/>` in `main.tsx`; wrap the returned branches; split `App`/`AppContent` | **Split.** `App` returns `<ErrorBoundary><AppContent/></ErrorBoundary>`; `AppContent` keeps today's hooks and branches verbatim. One point in the proposed file, also covering `App`'s render logic (store selectors, theme effect). Wrapping branches exposes `App`'s body; `main.tsx` moves the concern out of `App`. |
| 3 | Fallback + exit | new `ui/` file; `useNavigate` vs hash | **Private `ErrorFallback`** in `ErrorBoundary.tsx`, reusing `Card`/`Button` and token classes. `Ir al inicio` sets `window.location.hash = "#/"` **then** `reset()`: no react-router import (hooks unreachable above the router), and that order remounts the router on a safe route even if the failed route still throws. |
| 4 | jsdom enablement | per-file docblock; `environmentMatchGlobs`; global `environment: "jsdom"`; `test.projects` | **Per-file `// @vitest-environment jsdom`**, zero config change. `environmentMatchGlobs` was removed in Vitest 4 (repo pins 4.1.10); global jsdom drags the 7 node tests and the `setup.ts` polyfill into a DOM env; `projects` is the official replacement but premature for 2 files. |
| 5 | Error capture | dev-gated `console.error`; `onError` prop | **`onError?.(error, info)` from `componentDidCatch`, no console call at all.** Production silence is structural, the `grep -rn "console\." src` invariant stays green with no exception to document, and the scenario is unit-testable anywhere. React dev-logs caught errors itself; gap #14 plugs into `onError`. |
| 6 | Dev dependencies | jsdom 27 vs 30; add jest-dom | `jsdom@^27.4.0` (what Vitest 4.1.10 dev-tests against; Node ≥24 supported), `@testing-library/react@^16.3.3` + `@testing-library/dom@^10` (RTL 16 requires it as an explicit peer), devDependencies only; no jest-dom. |

## Component / API sketch

```tsx
// src/components/ErrorBoundary.tsx (new)
interface ErrorBoundaryProps { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void; }
interface ErrorBoundaryState { error: Error | null; }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { this.props.onError?.(error, info); }
  private reset = (): void => this.setState({ error: null });
  private goHome = (): void => { window.location.hash = "#/"; this.reset(); };
  render(): ReactNode {
    return this.state.error ? <ErrorFallback onRetry={this.reset} onHome={this.goHome} /> : this.props.children;
  }
}
```

`ErrorFallback` (private, same file): `min-h-screen bg-background` container + centered `Card` (`max-w-md p-6 text-center`); `AlertTriangle` badge (`rounded-2xl bg-primary-soft text-primary`); `<h1 className="text-lg font-bold text-foreground">Algo salió mal</h1>`; muted copy "Ocurrió un error inesperado. Vuelve a intentar o regresa al panel."; actions `<Button onClick={onRetry}>Reintentar</Button>` and `<Button variant="outline" onClick={onHome}>Ir al inicio</Button>`.

```tsx
// src/App.tsx
export default function App() { return (<ErrorBoundary><AppContent /></ErrorBoundary>); }
function AppContent() { /* current hooks, LockScreen branch, HashRouter tree — unchanged */ }
```

## Test-infrastructure changes

- **devDeps added**: `jsdom ^27.4.0`, `@testing-library/react ^16.3.3`, `@testing-library/dom ^10`; `dependencies` unchanged.
- **Environment**: `// @vitest-environment jsdom` as the first line of each `*.test.tsx`; `node` stays default, so the 7 lib tests and `src/test/setup.ts` are untouched; no config file change.
- **`src/test/setup.dom.ts` (new)**, imported explicitly by both component tests (mirrors `store.test.ts` importing `../test/setup`): stub `window.matchMedia` when missing (framer-motion via `AppShell`), and register `afterEach(cleanup)` — Vitest runs `globals: false`, so RTL auto-cleanup never registers.

## Test-to-Scenario mapping

| Spec scenario | Proof |
|---|---|
| Throwing subtree shows fallback | `ErrorBoundary.test.tsx`: throwing child → fallback heading present, body not empty |
| Exit stays reachable | Same file: both actions found by role; `Ir al inicio` sets `location.hash`, clears fallback |
| Lock branch contained | `App.test.tsx`: `useApp.setState` with `pinHash` + throwing `LockScreen` mock → same fallback |
| Recovery re-renders subtree | `ErrorBoundary.test.tsx` (crash flag off → `Reintentar` → child visible); `App.test.tsx` |
| Repeated failure keeps fallback | `ErrorBoundary.test.tsx`: crash flag on → `Reintentar` → fallback again, action present |
| One point for both branches | `App.test.tsx` routed + lock cases identical; `grep -rn ErrorBoundary src/pages src/components/layout` → 0 |
| Component test in jsdom via RTL | Both `*.test.tsx` under `npm test`; first case asserts `typeof document === "object"` |
| 7 lib tests green, untouched | Full `npm test`; `git diff --name-only` lists none of them nor `setup.ts` |
| No runtime dependency added | `git diff package.json` touches only `devDependencies`; `npm ls --omit=dev` unchanged |
| No production console output | Boundary test: capture flows only through the `onError` spy; grep keeps `console.` at zero in `src/` |

React 18 / RTL notes: RTL wraps `render`/`fireEvent` in `act`, so a render throw stays inside the same `act` (no act warnings expected); interactions use `fireEvent` (no `user-event`); React's dev-only logging of caught errors is silenced by a `vi.spyOn(console, "error")` restored in `afterEach`, scoped to component tests; reset `location.hash` between `App.test.tsx` cases so `HashRouter` mounts deterministically.

## Risks / Mitigations

| Risk | Mitigation |
|---|---|
| devDeps missing in this copy | `npm install`, `npx vitest --version`, baseline `npm test` before RED tests |
| Vitest 4.1.10 wants vite ≥6, app builds with vite ^5.4 (lockfile nests vite 8); `vite.config.ts` + plugin-react may not load | Baseline first; contingency: minimal `test` block or `vitest.config.ts` without the react plugin |
| jsdom engine mismatch | pin `^27.4.0` (Node ≥24 supported) |
| framer-motion/`AppShell` needs `matchMedia` in jsdom | guarded stub in `setup.dom.ts` |
| Silent capture hides errors from developers | Visible fallback + React dev logging + `onError` seam for gap #14 |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification or process integration. Routing is touched only as a fixed `location.hash = "#/"` constant with no user-controlled target, covered by the `Ir al inicio` test.

## Migration / Rollout

Additive: no data, schema, route, flag or `convex/` change. Rollback is `git revert`. Gate: `npm test` (9 files) + `npm run typecheck` (tsconfig includes `src`, so tests are typechecked).

## Open Questions

- [ ] Baseline `npm test` after `npm install`: does the vitest 4 ↔ vite 5/8 skew load `vite.config.ts` cleanly? Resolve first in tasks; contingency above.
- [ ] Add `@testing-library/jest-dom` later? Not needed by any mapped scenario.
