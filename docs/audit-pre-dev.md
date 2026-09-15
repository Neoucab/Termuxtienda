# Auditoría Pre-Desarrollo — Termuxtienda

**Fecha:** 2026-09-14
**Stack:** React 18 + Vite 5 + TypeScript (strict) + Tailwind 3 + Convex + Recharts + Framer Motion
**Escala:** 37 archivos TS/TSX, 6 archivos Convex backend, 8 archivos de test, ~4,500 líneas

---

## 🔴 CRÍTICOS — Resolver antes de continuar

### 1. Sin Error Boundaries
- No existe ningún componente `ErrorBoundary` en el proyecto.
- Un error de renderizado en `Dashboard`, `Ventas` o cualquier página白-screen completa la app.
- **Archivos afectados:** `src/App.tsx`, todos los componentes de página.

### 2. Backend Convex sin Authentication/Authorization
- Todas las mutaciones son públicas: `addProduct`, `addSale`, `deleteClient`, `snapshot:replaceAll`.
- `convex/snapshot.ts:replaceAll` (línea 52) reemplaza **toda la base de datos** sin protección.
- `convex/sync.ts:catalog` (línea 11) reemplaza productos y elimina faltantes, accesible para cualquiera.
- **Impacto:** Con la URL de Convex se puede corromper, robar o borrar todos los datos.

### 3. Falta directorio `convex/_generated/`
- `convex/_generated/` no existe (glob vacío). El proyecto usa `anyApi` como workaround.
- Sin codegen: no hay API tipada, no hay validación de contrato en runtime.
- `npx convex deploy` fallará.

### 4. PIN es cosmético — bypass trivial
- `src/lib/pin.ts` usa `cyrb53` (hash no criptográfico, 64-bit) almacenado en `localStorage`.
- Un `sessionStorage.setItem("termuxtienda-unlocked", "1")` por DevTools bypasea el lock completamente.
- **Impacto:** Cualquier usuario con DevTools accede a datos financieros (ventas, pagos, deudas).

---

## 🟠 IMPORTANTES — Resolver pronto

### 5. Sin tests de UI
- Los 8 archivos de test cubren solo funciones puras en `src/lib/`.
- **0 tests** para: `Ventas.tsx` (718 líneas), `Dashboard.tsx` (412), `ClienteDetalle.tsx` (383), `Reportes.tsx` (404), `Inventario.tsx` (413), `App.tsx`.
- No está instalado `@testing-library/react`.
- **Riesgo:** El flujo de checkout, pagos y devoluciones no tiene cobertura de UI.

### 6. Sin code splitting
- `src/App.tsx` importa eagerly todos los componentes de página (líneas 7-19).
- `recharts` (~500KB) carga de golpe aunque no se visiten reportes.
- **Impacto:** Carga lenta en móvil/tablet, la plataforma principal.

### 7. Sin CI/CD pipeline
- No hay `.github/workflows/`, ni hooks de build en Netlify.
- `netlify.toml` solo define `command = "npm run build"` — sin typecheck, tests ni lint antes del deploy.
- **Riesgo:** Builds rotos se deployean directo a producción.

### 8. Sin linter ni formatter
- No hay `.eslintrc*` ni `.prettierrc*`.
- `package.json` no tiene scripts `lint` ni `format`.
- La calidad depende solo de `tsconfig.json` strict.

### 9. Mutaciones sin validación de negocio
- `mutations.ts`: acepta `qty` negativo (inventario inconsistente).
- `addPayment`: `amount` sin validación contra deuda del cliente.
- `addReturn`: no verifica si ya se procesó una devolución para los mismos items.
- `closeCaja`: `dayStart`/`dayEnd` son timestamps provistos por el cliente sin validación server-side.

### 10. Dual data source sin sync bidireccional
- localStorage (Zustand persist) y Convex mantienen datos paralelos.
- `useCatalogSync.ts` empuja local → Convex pero **nunca** Convex → local.
- Dos dispositivos con el mismo deployment de Convex se desincronizan silenciosamente.

---

## 🟡 NICE-TO-HAVE — Puede esperar

| # | Problema |
|---|---|
| 11 | Accessibility — ARIA labels incompletos, sin focus trapping en modals, sin skip-to-content |
| 12 | Documentación — README mínimo (35 líneas), sin docs de componentes ni API |
| 13 | i18n — strings hardcodeados en español, sin infraestructura de traducción |
| 14 | Offline-first mutation queue — sync fire-and-forget con pérdida silenciosa de datos |
| 15 | Componentes monolíticos — `Ventas.tsx` (718 líneas), `Dashboard.tsx` (412), `Reportes.tsx` (404) |
| 16 | Keyboard navigation — sin focus trapping, sin navegación con flechas en grids |
| 17 | Sin bundle analysis — no hay `rollup-plugin-visualizer` ni `source-map-explorer` |

---

## ✅ Lo que está sólido

| Área | Detalles |
|---|---|
| TypeScript strict mode | `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` |
| Type coverage | Tipos completos en `src/lib/types.ts`, validators en `convex/lib.ts` |
| Zustand store | Separación limpia: state, actions, persistencia, migración v1→v2 |
| Tests de funciones puras | 8 archivos cubriendo selectors, format, pin, BCV, catalog, whatsapp |
| UI component system | Design tokens CSS, `Button` con 6 variantes, `Card`, `Badge`, `Modal`, `Field`/`Input`/`Select`/`Textarea` |
| Dark mode | CSS variables con 5 presets de tema (verde, azul, morado, naranja, rosa) |
| Mobile-first | Bottom nav, responsive grid, `viewport-fit=cover` para notch |
| Data export/import | Backup JSON con validación de schema y migración |
| PWA | `manifest.webmanifest`, service worker network-first |
| Convex schema | Índices correctos (`by_app_id`, `by_clientId`), separación public/admin |
| Dual currency | USD + Bs con integración BCV, tracking correcto en ventas/pagos/cierre |
| Business logic | Cálculo de deuda/saldo-a-favor maneja edge cases (tested en `store.test.ts:82-110`) |
| Sin secrets en código | `.env` gitignored, `.env.example` provisto |
| Sin console.log | Zero calls de `console.*` en source |

---

## Recomendación de orden de trabajo

1. **Error Boundaries** (#1) — protección inmediata contra crashes
2. **Auth en Convex** (#2) — seguridad del backend
3. **`convex/_generated/`** (#3) — desbloquea deploy y API tipada
4. **Validación de negocio en mutaciones** (#9) — integridad de datos
5. **CI/CD mínimo** (#7) — pipeline de build + typecheck + tests
6. **Linter + Formatter** (#8) — consistencia de código
7. **Tests de UI** (#5) — cobertura del flujo crítico
8. **Code splitting** (#6) — performance en móvil
