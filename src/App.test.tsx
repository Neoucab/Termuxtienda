// @vitest-environment jsdom
import "./test/setup.dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_SETTINGS, useApp } from "./lib/store";

const flags = vi.hoisted(() => ({ lockThrows: true, routeThrows: true }));

vi.mock("./components/LockScreen", () => ({
  default: ({ onUnlock }: { onUnlock: () => void }) => {
    if (flags.lockThrows) throw new Error("fallo simulado en la pantalla de bloqueo");
    return (
      <div>
        <p>bloqueo recuperado</p>
        <button onClick={onUnlock}>desbloquear</button>
      </div>
    );
  },
}));

vi.mock("./pages/Dashboard", () => ({
  default: () => {
    if (flags.routeThrows) throw new Error("fallo simulado en la ruta");
    return <p>panel recuperado</p>;
  },
}));

/** Credencial configurada: la compuerta solo comprueba que exista. */
const CONFIGURED_CREDENTIAL =
  "pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Reinicia la compuerta en memoria: sin datos almacenados previos y con la
 * credencial indicada (la ausencia de argumento deja la app sin PIN).
 */
function resetGate(pinHash?: string) {
  localStorage.clear();
  useApp.setState({
    settings: { ...DEFAULT_SETTINGS, ...(pinHash === undefined ? {} : { pinHash }) },
  });
  window.location.hash = "#/";
}

/** Rama de bloqueo: credencial configurada y desbloqueo solo en memoria. */
function renderLockedBranch() {
  resetGate(CONFIGURED_CREDENTIAL);
  return render(<App />);
}

/** Rama protegida: sin credencial, con el router montado en la ruta inicial. */
function renderRoutedBranch() {
  resetGate();
  return render(<App />);
}

beforeEach(() => {
  flags.lockThrows = true;
  flags.routeThrows = true;
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("contiene el fallo de la rama de bloqueo y ofrece la misma recuperación", () => {
    renderLockedBranch();

    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ir al inicio" })).toBeTruthy();
    // Nada de la app quedó montado: el fallback reemplaza al bloqueo por completo.
    expect(normalize(document.body.textContent)).not.toBe("");
    expect(screen.queryByText("Panel de ventas")).toBeNull();
  });

  it("contiene el fallo de una ruta con el mismo fallback y sin boundary por página", () => {
    const locked = renderLockedBranch();
    const lockedText = normalize(locked.container.textContent);
    const lockedHtml = locked.container.innerHTML;
    locked.unmount();

    const routed = renderRoutedBranch();

    expect(normalize(routed.container.textContent)).toBe(lockedText);
    expect(routed.container.innerHTML).toBe(lockedHtml);
    expect(screen.queryByText("Panel de ventas")).toBeNull();
  });

  it("recupera la rama de bloqueo al pulsar Reintentar cuando deja de fallar", () => {
    renderLockedBranch();

    flags.lockThrows = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Algo salió mal" })).toBeNull();
  });

  it("recupera la ruta al pulsar Reintentar cuando deja de fallar", () => {
    renderRoutedBranch();

    flags.routeThrows = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("panel recuperado")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Algo salió mal" })).toBeNull();
  });
});

describe("App · compuerta en memoria", () => {
  beforeEach(() => {
    flags.lockThrows = false;
    flags.routeThrows = false;
  });

  it("muestra el bloqueo y oculta el contenido cuando hay una credencial configurada", () => {
    renderLockedBranch();

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    expect(screen.queryByText("panel recuperado")).toBeNull();
  });

  it("abre directamente cuando no hay credencial configurada", () => {
    renderRoutedBranch();

    expect(screen.getByText("panel recuperado")).toBeTruthy();
    expect(screen.queryByText("bloqueo recuperado")).toBeNull();
  });

  it("vuelve a bloquear tras desmontar y montar de nuevo (recarga)", () => {
    resetGate(CONFIGURED_CREDENTIAL);
    const first = render(<App />);

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "desbloquear" }));
    expect(screen.getByText("panel recuperado")).toBeTruthy();

    first.unmount();
    render(<App />);

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    expect(screen.queryByText("panel recuperado")).toBeNull();
  });

  it("ignora los valores almacenados que parecen marcar la app como desbloqueada", () => {
    resetGate(CONFIGURED_CREDENTIAL);
    // Banderas plausibles de "ya desbloqueado": la app no lee ninguna.
    localStorage.setItem("termuxtienda-session", "1");
    localStorage.setItem(
      "termuxtienda-store",
      JSON.stringify({
        state: {
          unlocked: true,
          sessionUnlocked: true,
          settings: { ...DEFAULT_SETTINGS, pinHash: CONFIGURED_CREDENTIAL },
        },
        version: 2,
      })
    );

    render(<App />);

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    expect(screen.queryByText("panel recuperado")).toBeNull();
    // El valor preexistente sigue ahí: la app simplemente no lo lee.
    expect(localStorage.getItem("termuxtienda-session")).toBe("1");
  });

  it("muestra el bloqueo cuando el almacenamiento no está disponible", () => {
    renderWithoutStorage();

    expect(screen.getByText("bloqueo recuperado")).toBeTruthy();
    expect(screen.queryByText("panel recuperado")).toBeNull();
  });
});

/** Rama sin credencial y sin almacenamiento utilizable: debe fallar cerrado. */
function renderWithoutStorage() {
  resetGate();
  vi.stubGlobal("localStorage", undefined);
  return render(<App />);
}
