// @vitest-environment jsdom
import "../test/setup.dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Ajustes from "./Ajustes";
import { DEFAULT_SETTINGS, useApp } from "../lib/store";
import { buildBackupPayload } from "../lib/backup";

vi.mock("../lib/backup", () => ({
  buildBackupPayload: vi.fn(() => ({
    products: [],
    clients: [],
    sales: [],
    payments: [],
    purchases: [],
    returns: [],
    cajaCierres: [],
    settings: {},
    exportedAt: "2026-01-02T03:04:05.000Z",
  })),
}));

const PIN = "1234";

function setSettings(settings: Partial<typeof DEFAULT_SETTINGS> = {}) {
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, ...settings } });
}

/** Abre el diálogo de PIN, lo rellena y pulsa «Guardar PIN». */
async function savePin(pin: string, confirm: string = pin) {
  fireEvent.click(screen.getByRole("button", { name: /Configurar PIN|Cambiar PIN/ }));
  fireEvent.change(screen.getByLabelText(/Nuevo PIN/), { target: { value: pin } });
  fireEvent.change(screen.getByLabelText(/Confirmar PIN/), { target: { value: confirm } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guardar PIN" }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  setSettings();
  vi.mocked(buildBackupPayload).mockClear();
  // jsdom no implementa la descarga del enlace `a.click()`: se neutraliza para
  // que la prueba se centre en cómo se construye el respaldo.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ajustes · PIN de acceso", () => {
  it("guarda una credencial derivada y autocontenida al configurar el PIN", async () => {
    render(<Ajustes />);

    await savePin(PIN);

    await waitFor(() =>
      expect(useApp.getState().settings.pinHash).toMatch(/^pbkdf2\$210000\$/)
    );
    const credential = useApp.getState().settings.pinHash ?? "";
    expect(credential).not.toContain(PIN);
    expect(credential.split("$")).toHaveLength(4);
  });

  it("avisa en español y no guarda nada cuando la primitiva no está disponible", async () => {
    vi.stubGlobal("crypto", undefined);
    render(<Ajustes />);

    await savePin(PIN);

    await waitFor(() =>
      expect(
        screen.getByText("No se pudo guardar el PIN en este dispositivo.")
      ).toBeTruthy()
    );
    expect(useApp.getState().settings.pinHash).toBeUndefined();
    // El diálogo sigue abierto para poder reintentar.
    expect(screen.getByRole("button", { name: "Guardar PIN" })).toBeTruthy();
  });
});

describe("Ajustes · respaldo", () => {
  it("construye el respaldo con `buildBackupPayload` en lugar de armarlo en el componente", () => {
    setSettings({ pinHash: "pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" });
    render(<Ajustes />);

    fireEvent.click(screen.getByRole("button", { name: /Exportar respaldo/ }));

    expect(buildBackupPayload).toHaveBeenCalledTimes(1);
    const [exported] = vi.mocked(buildBackupPayload).mock.calls[0];
    expect(exported.settings.pinHash).toBeDefined();
    expect(exported.clients).toEqual([]);
  });
});

describe("Ajustes · catálogo público", () => {
  it("muestra el enlace del catálogo apuntando a #/tienda", () => {
    render(<Ajustes />);
    const input = screen.getByDisplayValue(/#\/tienda$/) as HTMLInputElement;
    expect(input.value).toContain(location.origin);
  });

  it("guarda el WhatsApp del dueño", () => {
    render(<Ajustes />);
    fireEvent.change(screen.getByPlaceholderText("Ej. 0414 123 4567"), {
      target: { value: "04141234567" },
    });
    fireEvent.click(screen.getByText("Guardar WhatsApp"));
    expect(useApp.getState().settings.whatsappNumber).toBe("04141234567");
  });

  it("genera y regenera la clave del catálogo", () => {
    render(<Ajustes />);
    fireEvent.click(screen.getByText("Generar clave"));
    const primera = useApp.getState().settings.publishSecret;
    expect(primera).toBeTruthy();
    fireEvent.click(screen.getByText("Generar clave"));
    expect(useApp.getState().settings.publishSecret).toBeTruthy();
    expect(useApp.getState().settings.publishSecret).not.toBe(primera);
  });
});
