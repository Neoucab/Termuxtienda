// @vitest-environment jsdom
import "../test/setup.dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Carrito from "./Carrito";
import type { CatalogoPublico } from "../lib/types";

const CATALOGO: CatalogoPublico = {
  publishedAt: 1726400000000,
  storeName: "Mi Tienda",
  currency: "$",
  bcvRate: 40,
  whatsappNumber: "04141234567",
  products: [
    { id: "p1", name: "Jean Azul", category: "Ropa", size: "32", color: "Azul", price: 20, stock: 3 },
    { id: "p2", name: "Camisa Blanca", category: "Ropa", price: 15, stock: 0 },
  ],
};

function catalogoSinWhatsApp(): CatalogoPublico {
  const { whatsappNumber: _sin, ...resto } = CATALOGO;
  return resto;
}

function stubFetchCon(catalogo: CatalogoPublico): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(catalogo), { status: 200 })));
}

function seedCart(entries: { productId: string; qty: number }[]): void {
  localStorage.setItem("termuxtienda-cart", JSON.stringify(entries));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Carrito", () => {
  it("muestra las líneas con qty y totales en $ y Bs", async () => {
    seedCart([
      { productId: "p1", qty: 2 },
      { productId: "p2", qty: 1 },
    ]);
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    expect(await screen.findByText("Jean Azul")).toBeTruthy();
    expect(screen.getByText("$40.00")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
    expect(screen.getByText("Total estimado:")).toBeTruthy();
    expect(screen.getByText("$55.00")).toBeTruthy();
    expect(screen.getByText(/Bs 2\.200,00 @ BCV/)).toBeTruthy();
  });

  it("suma, resta y quita líneas", async () => {
    seedCart([{ productId: "p1", qty: 1 }]);
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    await screen.findByText("Jean Azul");
    fireEvent.click(screen.getByText("+"));
    expect((await screen.findAllByText("$40.00")).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("−"));
    expect((await screen.findAllByText("$20.00")).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByText("Quitar"));
    await waitFor(() => expect(screen.queryByText("Jean Azul")).toBeNull());
    expect(JSON.parse(localStorage.getItem("termuxtienda-cart") ?? "[]")).toEqual([]);
  });

  it("mantiene el carrito en termuxtienda-cart tras interactuar y nunca escribe termuxtienda-store", async () => {
    seedCart([{ productId: "p1", qty: 1 }]);
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    await screen.findByText("Jean Azul");
    fireEvent.click(screen.getByText("+"));
    await waitFor(() => {
      const cart = JSON.parse(localStorage.getItem("termuxtienda-cart") ?? "[]");
      expect(cart).toEqual([{ productId: "p1", qty: 2 }]);
    });
    expect(localStorage.getItem("termuxtienda-store")).toBeNull();
  });

  it("descarta con aviso las entradas cuyo producto ya no está publicado", async () => {
    seedCart([
      { productId: "p1", qty: 1 },
      { productId: "viejo", qty: 2 },
    ]);
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    expect(await screen.findByText(/ya no está en el catálogo/)).toBeTruthy();
    expect(screen.queryByText("viejo")).toBeNull();
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("termuxtienda-cart") ?? "[]")).toEqual([{ productId: "p1", qty: 1 }]);
    });
  });

  it("arma el enlace wa.me con el mensaje del pre-pedido (solo dígitos)", async () => {
    seedCart([{ productId: "p1", qty: 2 }]);
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    await screen.findByText("Jean Azul");
    fireEvent.change(screen.getByPlaceholderText("Tu nombre (opcional)"), { target: { value: "Juan" } });
    const enlace = await screen.findByRole("link", { name: /Enviar pedido por WhatsApp/i });
    expect(enlace.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/584141234567\?text=/);
    const texto = decodeURIComponent((enlace.getAttribute("href") ?? "").split("text=")[1] ?? "");
    expect(texto).toContain("🛒 Pedido — Mi Tienda");
    expect(texto).toContain("2× Jean Azul (T.32 · Azul) — $20.00 c/u — $40.00");
    expect(texto).toContain("Nombre: Juan");
    expect(texto).toContain("Pre-pedido sin reserva de stock");
  });

  it("reemplaza el envío por un aviso cuando el catálogo no tiene WhatsApp", async () => {
    seedCart([{ productId: "p1", qty: 1 }]);
    stubFetchCon(catalogoSinWhatsApp());
    render(<Carrito />);
    await screen.findByText("Jean Azul");
    expect(screen.queryByRole("link", { name: /Enviar pedido por WhatsApp/i })).toBeNull();
    expect(screen.getByText(/no tiene un número de WhatsApp configurado/i)).toBeTruthy();
  });

  it("muestra el estado vacío del carrito", async () => {
    stubFetchCon(CATALOGO);
    render(<Carrito />);
    expect(await screen.findByText("Tu carrito está vacío")).toBeTruthy();
  });
});
