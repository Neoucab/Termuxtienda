// @vitest-environment jsdom
import "./test/setup.dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_SETTINGS, useApp } from "./lib/store";

const flags = vi.hoisted(() => ({ lockThrows: true, routeThrows: true }));

vi.mock("./components/LockScreen", () => ({
  default: () => {
    if (flags.lockThrows) throw new Error("fallo simulado en la pantalla de bloqueo");
    return <p>bloqueo recuperado</p>;
  },
}));

vi.mock("./pages/Dashboard", () => ({
  default: () => {
    if (flags.routeThrows) throw new Error("fallo simulado en la ruta");
    return <p>panel recuperado</p>;
  },
}));

function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Rama de bloqueo: PIN configurado y sesión sin desbloquear. */
function renderLockedBranch() {
  sessionStorage.clear();
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, pinHash: "hash-de-prueba" } });
  return render(<App />);
}

/** Rama protegida: sin PIN, con el router montado en la ruta inicial. */
function renderRoutedBranch() {
  sessionStorage.clear();
  useApp.setState({ settings: { ...DEFAULT_SETTINGS } });
  window.location.hash = "#/";
  return render(<App />);
}

beforeEach(() => {
  flags.lockThrows = true;
  flags.routeThrows = true;
  window.location.hash = "";
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
