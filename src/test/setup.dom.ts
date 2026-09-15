// Entorno de pruebas para componentes React (jsdom).
//
// Este módulo se importa PRIMERO en cada `*.test.tsx`. Con `NODE_ENV=production`
// (valor que trae el entorno donde corre `npm test`) `react` resuelve su build
// de producción, donde `act()` lanza "act(...) is not supported in production
// builds of React" y Testing Library no puede renderizar. Normalizamos
// `NODE_ENV` aquí para que React se cargue en su build de desarrollo. Los tests
// importan este módulo ANTES que a RTL: el orden de evaluación de imports
// estáticos garantiza que este ajuste corra antes de que React se cargue
// (solo `cleanup` se importa dinámicamente dentro de `afterEach`).
import { afterEach, beforeEach, vi } from "vitest";

// `@types/node` no está instalado, así que accedemos a `process.env` con un tipo
// mínimo en lugar de depender de los tipos de Node.
const processEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env;

if (processEnv?.NODE_ENV === "production") {
  processEnv.NODE_ENV = "test";
}

// jsdom no implementa `matchMedia` y framer-motion (AppShell) sí lo consulta.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// React registra en consola los errores capturados por un boundary; el espía
// mantiene limpia la salida de las pruebas y se restaura tras cada caso.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Vitest corre con `globals: false`, así que el auto-cleanup de RTL no se
// registra solo.
afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  vi.restoreAllMocks();
});
