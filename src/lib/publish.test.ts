import { describe, expect, it } from "vitest";
import { isPublished, productCaption, SOCIAL_LABELS } from "./publish";
import type { Product } from "./types";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Jean Azul",
    category: "Pantalones",
    size: "32",
    color: "Azul",
    cost: 800,
    price: 1400,
    stock: 5,
    minStock: 1,
    createdAt: 0,
    ...over,
  };
}

describe("isPublished", () => {
  it("detecta la publicación por red", () => {
    const p = product({ published: { instagram: Date.now() } });
    expect(isPublished(p, "instagram")).toBe(true);
    expect(isPublished(p, "whatsapp")).toBe(false);
  });

  it("maneja productos sin campo published", () => {
    expect(isPublished(product(), "instagram")).toBe(false);
    expect(isPublished(product(), "whatsapp")).toBe(false);
  });
});

describe("productCaption", () => {
  it("incluye nombre, precio, detalles y tienda", () => {
    const msg = productCaption(product(), "$", "MiTienda");
    expect(msg).toContain("Jean Azul");
    expect(msg).toMatch(/1,?400\.00/);
    expect(msg).toContain("Talla 32");
    expect(msg).toContain("Color Azul");
    expect(msg).toContain("MiTienda");
  });

  it("omite los detalles que no existen", () => {
    const msg = productCaption(product({ size: undefined, color: undefined }), "$", "T");
    expect(msg).not.toContain("Talla");
    expect(msg).not.toContain("Color");
  });

  it("añade el enlace del catálogo solo cuando se indica", () => {
    const conEnlace = productCaption(product(), "$", "MiTienda", "https://t.app/#/tienda");
    expect(conEnlace).toContain("🛒 Ver catálogo: https://t.app/#/tienda");
    expect(productCaption(product(), "$", "MiTienda")).not.toContain("Ver catálogo");
  });
});

describe("SOCIAL_LABELS", () => {
  it("tiene etiquetas para ambas redes", () => {
    expect(SOCIAL_LABELS.instagram).toBe("Instagram");
    expect(SOCIAL_LABELS.whatsapp).toBe("Estado de WhatsApp");
  });
});
