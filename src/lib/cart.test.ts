import "../test/setup";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCart, resolveCart, saveCart, type CartEntry } from "./cart";
import type { ProductoPublico } from "./types";

const PRODUCTOS: ProductoPublico[] = [
  { id: "p1", name: "Jean Azul", category: "Ropa", price: 20, stock: 3 },
  { id: "p2", name: "Camisa Blanca", category: "Ropa", price: 15, stock: 0 },
];

beforeEach(() => {
  localStorage.clear();
});

describe("loadCart / saveCart", () => {
  it("empieza vacío y persiste bajo termuxtienda-cart", () => {
    expect(loadCart()).toEqual([]);
    const items: CartEntry[] = [{ productId: "p1", qty: 2 }];
    saveCart(items);
    expect(localStorage.getItem("termuxtienda-cart")).toContain("p1");
    expect(loadCart()).toEqual(items);
  });

  it("ignora datos corruptos y nunca toca termuxtienda-store", () => {
    localStorage.setItem("termuxtienda-cart", "{no-json");
    expect(loadCart()).toEqual([]);
    localStorage.setItem("termuxtienda-cart", JSON.stringify([{ productId: "zzz" }]));
    expect(loadCart()).toEqual([]);
    expect(localStorage.getItem("termuxtienda-store")).toBeNull();
  });
});

describe("resolveCart", () => {
  it("descarga las entradas cuyo producto ya no está en el catálogo", () => {
    const items: CartEntry[] = [
      { productId: "p1", qty: 2 },
      { productId: "viejo", qty: 1 },
    ];
    const { items: resueltas, dropped } = resolveCart(items, PRODUCTOS);
    expect(resueltas).toEqual([{ productId: "p1", qty: 2 }]);
    expect(dropped).toEqual(["viejo"]);
  });

  it("avisa con los nombres de los productos descartados y ajusta qty inválida", () => {
    const items: CartEntry[] = [
      { productId: "p1", qty: 0 },
      { productId: "desaparecido", qty: 3 },
    ];
    const { items: resueltas, dropped } = resolveCart(items, PRODUCTOS);
    expect(resueltas).toEqual([{ productId: "p1", qty: 1 }]);
    expect(dropped.join(" ")).toContain("desaparecido");
  });
});
