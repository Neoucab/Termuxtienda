# Tasks: add-error-boundaries

## Review Workload Forecast

Estimated changed lines: 260–340. Delivery strategy: ask-on-risk; single PR, no slice needed.

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Toolchain + harness (1.x–2.x) | `npx vitest --version` | `npm test` baseline | Revert `package.json`, `src/test/setup.dom.ts` |
| 2 | Boundary + wiring (3.x–4.x) | `npx vitest run src/components/ErrorBoundary.test.tsx` | `npm run build` | Revert `src/components/ErrorBoundary.tsx`, `src/App.tsx` |
| 3 | Verification (5.x) | `npm test` | `npm run build` | None |

## Phase 1: Toolchain baseline

- [x] 1.1 Verify devDeps: `npx vitest --version`, `npx tsc --version` non-empty.
  - Evidence: `vitest/4.1.10 win32-x64 node-v24.17.0`; `Version 5.9.3`.
- [x] 1.2 Baseline `npm test` → 7 files pass before any change.
  - Evidence (pre-change): 7 files passed / 45 tests passed; `npm run typecheck` exit 0.
- [x] 1.3 CONDITIONAL, only if 1.2 cannot load `vite.config.ts` with `@vitejs/plugin-react`: add a minimal `test` block there, or create `vitest.config.ts` without the react plugin; re-run 1.2.
  - NOT TRIGGERED: vitest 4.1.10 loaded `vite.config.ts` + `@vitejs/plugin-react` cleanly in 1.2 (only esbuild/oxc deprecation warnings). `vite.config.ts` untouched.

## Phase 2: Test harness

- [x] 2.1 `npm i -D jsdom@^27.4.0 @testing-library/react@^16.3.3 @testing-library/dom@^10 --include=dev`; evidence: `git diff package.json` touches only devDependencies.
  - Evidence: install exit 0 (`added 55 packages`); resolved `jsdom@27.4.0`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`; `git diff package.json` = 3 added lines, all inside `devDependencies`; `npm ls --omit=dev --depth=0` unchanged (8 runtime deps: convex, framer-motion, lucide-react, react, react-dom, react-router-dom, recharts, zustand).
- [x] 2.2 Create `src/test/setup.dom.ts`: guarded `window.matchMedia` stub, explicit `afterEach(cleanup)`, `console.error` spy restored in `afterEach`.
  - Evidence: file created with the guarded `matchMedia` stub, `beforeEach` `vi.spyOn(console, "error")` + `afterEach(cleanup)` + `vi.restoreAllMocks()` (RTL is a static import in the test files — the env fix relies on import order: tests import `setup.dom` first, so `NODE_ENV` is normalized before React loads; only `cleanup` is imported dynamically inside `afterEach`).
  - DEVIATION D1 (blocker, closest compliant alternative — see Apply Notes).

## Phase 3: RED — failing component tests

- [x] 3.1 Create `src/components/ErrorBoundary.test.tsx` (`// @vitest-environment jsdom`, imports `src/test/setup.dom.ts`); scenarios 1,2,4,5,7,10: heading plus non-empty body, both actions by role, `Ir al inicio` sets `location.hash`, retry restores child, retry-while-throwing shows fallback, `document` object check, `onError` spy as sole capture path.
  - Evidence: file created, 7 tests. RED: `Failed to resolve import "./ErrorBoundary" from "src/components/ErrorBoundary.test.tsx". Does the file exist?` (suite failed, 0 tests ran).
  - Addition (test-only): scenario 10 is also proven in-file via `import errorBoundarySource from "./ErrorBoundary.tsx?raw"` asserting the component source matches no `console.` — deterministic and independent of the dev/prod build question.
- [x] 3.2 Create `src/App.test.tsx` (same docblock); scenarios 3,6: `pinHash` + throwing `LockScreen` mock → same fallback; routed case identical.
  - Evidence: file created, 4 tests (`LockScreen` and `Dashboard` mocked through `vi.hoisted` flags). RED: all 4 failed with the simulated render errors escaping uncaught (`react-dom.development.js:25889 recoverFromConcurrentError`), i.e. the pre-change app has zero containment.
- [x] 3.3 Confirm RED: `npx vitest run src/components/ErrorBoundary.test.tsx src/App.test.tsx` fails on missing `./ErrorBoundary`.
  - Evidence: 2 files failed (1 failed suite on the missing module + 4 failed tests); `npm test` at that moment: 7 files/45 tests still passed (old suite untouched).

## Phase 4: GREEN — minimal implementation

- [x] 4.1 Create `src/components/ErrorBoundary.tsx`: state-only `reset`, `getDerivedStateFromError`, `componentDidCatch` → `onError?.(error, info)`, private `ErrorFallback` (`Card`/`Button`, "Algo salió mal", Reintentar, Ir al inicio via `location.hash`), zero `console.*`.
  - Evidence: file created as designed (class boundary + private `ErrorFallback` reusing `Card`/`Button` and `--c-*` token classes; `goHome` sets `location.hash = "#/"` then `reset()`).
- [x] 4.2 Edit `src/App.tsx`: `App` returns `<ErrorBoundary><AppContent/></ErrorBoundary>`; `AppContent` keeps today's hooks and branches verbatim.
  - Evidence: `App` is now a 5-line wrapper; `AppContent` holds the unchanged hooks, theme effect, lock branch and `HashRouter` tree.
- [x] 4.3 Greens: `npx vitest run src/components/ErrorBoundary.test.tsx`, then `npx vitest run src/App.test.tsx`.
  - Evidence: `src/components/ErrorBoundary.test.tsx` → 7 passed (1 file); `src/App.test.tsx` → 4 passed (1 file), including strict cross-branch `container.innerHTML` equality.

## Phase 5: Verification

- [x] 5.1 Full suite `npm test` → 9 files pass; `git diff --name-only` lists no `src/lib/*.test.ts` (read-only) nor `src/test/setup.ts` (read-only).
  - Evidence: `Test Files 9 passed (9)`, `Tests 56 passed (56)` (45 pre-existing + 11 new); `git diff --name-only` = `.gitignore` (pre-existing session change), `package-lock.json`, `package.json`, `src/App.tsx` — no `src/lib/*.test.ts`, no `src/test/setup.ts`.
- [x] 5.2 `npm run typecheck` → clean.
  - Evidence: `tsc --noEmit` exit 0, no diagnostics (tsconfig `include: ["src", ...]` so the new tests are typechecked too).
- [x] 5.3 Runtime-dep gate: `git diff package.json` only devDependencies; `npm ls --omit=dev --depth=0` unchanged.
  - Evidence: see 2.1 — only the three devDependencies were added; the 8 runtime dependencies are byte-identical in name and range.
- [x] 5.4 Production-silence gate: `grep -rn "console\." src` → 0; `npm run build` succeeds.
  - Evidence: ripgrep `console\.` over `src` → 0 matches (the harness silences React's dev logging with `vi.spyOn(console, "error")`, which is not a `console.` property access, so the literal invariant holds with no exception); `npm run build` exit 0 (`2562 modules transformed`, `✓ built in 38.45s`); the production bundle contains the fallback copy (`Algo salió mal` present in `dist/assets/index-*.js`).
- [x] 5.5 Single-point gate: `grep -rn "getDerivedStateFromError\|componentDidCatch" src` → only `ErrorBoundary.tsx`; `grep -rn ErrorBoundary src/pages src/components/layout` → 0.
  - Evidence: `getDerivedStateFromError`/`componentDidCatch` → only `src/components/ErrorBoundary.tsx:27,31`; `ErrorBoundary` under `src/pages` + `src/components/layout` → 0 matches.
- [x] 5.6 Confirm every row of the mapping table is proven.
  - Evidence: rows 1,2,3,4,5,6,7,8,9,10 proven by 3.1/3.2/4.1/4.2 plus the 5.1–5.5 gate outputs listed above.

## Scenario → Test Mapping

| # | Spec scenario | Proven by |
|---|---------------|-----------|
| 1 | Throwing subtree shows fallback | 3.1, 4.1 |
| 2 | Exit stays reachable | 3.1, 4.1 |
| 3 | Lock branch contained | 3.2, 4.2 |
| 4 | Recovery re-renders subtree | 3.1, 3.2, 4.1 |
| 5 | Repeated failure keeps fallback | 3.1, 4.1 |
| 6 | One containment point for both branches | 3.2, 4.2, 5.5 |
| 7 | jsdom + RTL under `npm test` | 3.1, 3.2, 5.1 |
| 8 | 7 library tests green, untouched | 1.2, 5.1 |
| 9 | No runtime dependency added | 2.1, 5.3 |
| 10 | No console output on capture | 3.1, 4.1, 5.4 |

## Apply Notes / Deviations

- **D1 — `src/test/setup.dom.ts` normalizes `NODE_ENV` (documented deviation, harness-only).** This machine runs `npm test` with `NODE_ENV=production`, so `react`/`react-dom` resolve their **production** builds, where `React.act` is `function X(){throw Error("act(...) is not supported in production builds of React.")}` — Testing Library 16 cannot render at all (probed: `render()` failed with exactly that error before the fix). Design decision 5 and the design's RTL notes assume React's dev build ("React dev-logs caught errors itself"). The chosen alternative keeps every design constraint intact (per-file `// @vitest-environment jsdom`, `node` default env, **no config-file change**, `vite.config.ts` and `src/test/setup.ts` untouched, no `import.meta.env.DEV` dependency): the new harness module — which the design already authorizes and which the tests import first — sets `NODE_ENV` to `"test"` when it is `"production"`, before React is loaded. The test files import this harness module before their static RTL import, so static-import evaluation order guarantees the fix is not overtaken (only `cleanup` is imported dynamically, inside `afterEach`). The ordering dependency is intentional and documented. Rollback of D1 is deleting that block (restores the blocker, not the behavior). No source behaviour depends on it.
- **Observation (not a gate failure).** With React's dev build active, React re-reports caught errors through the global `reportError`, so vitest stderr prints the crashing fixtures' stack lines (`Error: fallo simulado …`). That channel is React's, dev-only, produced after our `componentDidCatch` already reported through `onError`; nothing in `src` writes to the console (5.4) and the production bundle has no such path. It is left unsilenced on purpose, so genuinely unhandled errors keep surfacing in test output.
- **`App.test.tsx` extra proof.** Scenario 6 is proven with strict `container.innerHTML` equality between the lock-branch fallback and the routed-branch fallback, plus `queryByText("Panel de ventas") === null` (nothing of the shell survives the routed failure → containment comes from above the router, not from a page-level boundary).
