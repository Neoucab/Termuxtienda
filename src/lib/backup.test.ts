import "../test/setup";
import { describe, expect, it } from "vitest";
import { buildBackupPayload, type ExportableSettings } from "./backup";
import { DEFAULT_SETTINGS, type PersistedData } from "./store";
import type { Client, Product, Settings } from "./types";

/** Credencial derivada de ejemplo: lo que NUNCA debe salir en un respaldo. */
const CREDENTIAL = "pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
/** Sal de esa credencial (16 bytes en cero, base64). */
const SALT_B64 = "AAAAAAAAAAAAAAAAAAAAAA==";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Producto",
    category: "General",
    cost: 10,
    price: 20,
    stock: 5,
    minStock: 1,
    createdAt: 0,
    ...over,
  };
}

function client(over: Partial<Client> = {}): Client {
  return { id: "c1", name: "Ana", createdAt: 0, ...over };
}

function state(over: Partial<Settings> = {}): PersistedData {
  return {
    products: [product()],
    clients: [client()],
    sales: [],
    payments: [],
    purchases: [],
    returns: [],
    cajaCierres: [],
    settings: {
      ...DEFAULT_SETTINGS,
      storeName: "Tienda de Ana",
      currency: "Bs",
      bcvRate: 36.5,
      themeColor: "azul",
      darkMode: true,
      pinHash: CREDENTIAL,
      ...over,
    },
  };
}

describe("buildBackupPayload", () => {
  it("no incluye la credencial del PIN ni su sal", () => {
    const payload = buildBackupPayload(state(), "2026-01-02T03:04:05.000Z");

    expect("pinHash" in payload.settings).toBe(false);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("pinHash");
    expect(serialized).not.toContain("pbkdf2");
    expect(serialized).not.toContain(CREDENTIAL);
    expect(serialized).not.toContain(SALT_B64);
  });

  it("mantiene sin cambios el resto de los ajustes y los datos", () => {
    const payload = buildBackupPayload(state(), "2026-01-02T03:04:05.000Z");

    expect(payload.settings).toEqual({
      storeName: "Tienda de Ana",
      currency: "Bs",
      bcvRate: 36.5,
      themeColor: "azul",
      darkMode: true,
    });
    expect(payload.products).toHaveLength(1);
    expect(payload.clients).toHaveLength(1);
    expect(payload.purchases).toEqual([]);
    expect(payload.exportedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("exporta un tipo de ajustes sin campo pinHash", () => {
    // Comprobación en tiempo de compilación: si el tipo incluyera `pinHash`,
    // `HasPinHash` sería `true` y esta asignación no compilaría.
    type HasPinHash = "pinHash" extends keyof ExportableSettings ? true : false;
    const hasPinHash: HasPinHash = false;

    expect(hasPinHash).toBe(false);
  });

  it("firma el respaldo con la fecha actual cuando no se indica una", () => {
    const payload = buildBackupPayload(state());

    expect(payload.exportedAt).toBe(new Date(payload.exportedAt).toISOString());
  });
});
