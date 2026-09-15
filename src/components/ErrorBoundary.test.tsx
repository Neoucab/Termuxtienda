// @vitest-environment jsdom
import "../test/setup.dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorInfo } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import errorBoundarySource from "./ErrorBoundary.tsx?raw";

let shouldThrow = true;

/** Hijo de prueba: lanza al renderizar mientras `shouldThrow` siga activo. */
function Crashable({ text = "contenido recuperado" }: { text?: string }) {
  if (shouldThrow) throw new Error("fallo simulado en el subárbol");
  return <p>{text}</p>;
}

function renderBoundary(onError?: (error: Error, info: ErrorInfo) => void) {
  return render(
    <ErrorBoundary onError={onError}>
      <Crashable />
    </ErrorBoundary>
  );
}

beforeEach(() => {
  shouldThrow = true;
  window.location.hash = "";
});

describe("ErrorBoundary", () => {
  it("renderiza componentes en jsdom a través de Testing Library", () => {
    expect(typeof document).toBe("object");
    render(<p>sonda</p>);
    expect(screen.getByText("sonda")).toBeTruthy();
  });

  it("muestra el fallback en español cuando el subárbol lanza al renderizar", () => {
    renderBoundary();

    expect(document.body.textContent?.trim()).not.toBe("");
    expect(document.body.textContent).toContain("Algo salió mal");
    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeTruthy();
  });

  it("mantiene una salida alcanzable con el fallback visible", () => {
    renderBoundary();

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ir al inicio" })).toBeTruthy();
  });

  it("vuelve al inicio sin recargar la página", () => {
    renderBoundary();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Ir al inicio" }));

    expect(window.location.hash).toBe("#/");
    expect(screen.queryByRole("heading", { name: "Algo salió mal" })).toBeNull();
    expect(screen.getByText("contenido recuperado")).toBeTruthy();
  });

  it("vuelve a renderizar el subárbol cuando deja de fallar", () => {
    renderBoundary();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("contenido recuperado")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Algo salió mal" })).toBeNull();
  });

  it("mantiene el fallback y su acción cuando el fallo se repite", () => {
    renderBoundary();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByRole("heading", { name: "Algo salió mal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("captura el error solo por el hook onError y sin escribir en consola", () => {
    const onError = vi.fn((_error: Error, _info: ErrorInfo) => {});
    renderBoundary(onError);

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0];
    expect(error.message).toBe("fallo simulado en el subárbol");
    expect(typeof info.componentStack).toBe("string");
    // El camino de captura es el hook: el componente no emite nada por consola.
    expect(errorBoundarySource).not.toMatch(/\bconsole\./);
  });
});
