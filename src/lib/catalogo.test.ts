import "../test/setup";
import { describe, expect, it, vi } from "vitest";
import { buildCatalogo, fetchCatalogoApi, publishCatalogo } from "./catalogo";
import { DEFAULT_SETTINGS } from "./store";
import type { Product } from "./types";

function producto(extra: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Jean Azul",
    category: "Ropa",
    size: "32",
    color: "Azul",
    cost: 8,
    price: 20,
    stock: 3,
    minStock: 1,
    createdAt: 1726400000000,
    ...extra,
  };
}

describe("buildCatalogo", () => {
  it("arma la proyección con los campos públicos y datos de la tienda", () => {
    const publishedAt = 1726410000000;
    const out = buildCatalogo(
      [producto()],
      { ...DEFAULT_SETTINGS, storeName: "Mi Tienda", bcvRate: 40, whatsappNumber: "04141234567" },
      publishedAt
    );
    expect(out).toEqual({
      publishedAt,
      storeName: "Mi Tienda",
      currency: "$",
      bcvRate: 40,
      whatsappNumber: "04141234567",
      products: [
        { id: "p1", name: "Jean Azul", category: "Ropa", size: "32", color: "Azul", price: 20, stock: 3 },
      ],
    });
  });

  it("nunca incluye cost ni datos privados del inventario", () => {
    const out = buildCatalogo([producto({ sku: "X-1", minStock: 2 })], DEFAULT_SETTINGS, 1);
    expect("cost" in out.products[0]).toBe(false);
    expect("minStock" in out.products[0]).toBe(false);
    expect("sku" in out.products[0]).toBe(false);
    expect("published" in out.products[0]).toBe(false);
    expect("createdAt" in out.products[0]).toBe(false);
    expect(JSON.stringify(out)).not.toContain("cost");
    expect(JSON.stringify(out)).not.toContain('"clientes"');
  });
});

describe("fetchCatalogoApi", () => {
  it("devuelve el catálogo publicado en 200", async () => {
    const catalogo = buildCatalogo([], DEFAULT_SETTINGS, 1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalogo), { status: 200 })));
    await expect(fetchCatalogoApi()).resolves.toEqual(catalogo);
  });

  it("devuelve null en el 404 de no publicado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ catalogo: null }), { status: 404 })));
    await expect(fetchCatalogoApi()).resolves.toBeNull();
  });
});

describe("publishCatalogo", () => {
  it("publica con el header X-Catalogo-Secret y el payload completo", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const catalogo = buildCatalogo([producto()], DEFAULT_SETTINGS, 5);
    await expect(publishCatalogo(catalogo, "la-clave")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/catalogo");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Catalogo-Secret"]).toBe("la-clave");
    expect(JSON.parse(init.body as string)).toEqual(catalogo);
  });

  it("rechaza con error en 401 (clave inválida) y en 400 (formato)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 401 })));
    await expect(publishCatalogo(buildCatalogo([], DEFAULT_SETTINGS, 1), "mala")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 400 })));
    await expect(publishCatalogo(buildCatalogo([], DEFAULT_SETTINGS, 1), "mala")).rejects.toThrow();
  });
});
