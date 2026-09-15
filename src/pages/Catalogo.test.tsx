// @vitest-environment jsdom
import "../test/setup.dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Catalogo from "./Catalogo";
import type { CatalogoPublico } from "../lib/types";

const CATALOGO: CatalogoPublico = {
  publishedAt: 1726400000000,
  storeName: "Mi Tienda",
  currency: "$",
  bcvRate: 40,
  whatsappNumber: "04141234567",
  products: [
    {
      id: "p1",
      name: "Jean Azul",
      category: "Ropa",
      size: "32",
      color: "Azul",
      price: 20,
      stock: 3,
      image: "data:image/png;base64,AA",
    },
    { id: "p2", name: "Camisa Blanca", category: "Ropa", price: 15, stock: 0 },
  ],
};

function stubFetchConCatalogo(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify(CATALOGO), { status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Catalogo", () => {
  it("muestra los productos publicados con precio en $ y Bs", async () => {
    vi.stubGlobal("fetch", stubFetchConCatalogo());
    render(<Catalogo />);
    expect(await screen.findByText("Jean Azul")).toBeTruthy();
    expect(screen.getByText("Camisa Blanca")).toBeTruthy();
    expect(screen.getByText("$20.00")).toBeTruthy();
    expect(screen.getByText("Bs 800,00")).toBeTruthy();
    expect(screen.getByText("T.32")).toBeTruthy();
    expect(screen.getByText("Azul")).toBeTruthy();
    expect(screen.getAllByText("Ropa").length).toBe(2);
    const imagenes = screen.getAllByRole("img");
    expect(imagenes).toHaveLength(1);
  });

  it("marca Agotado solo a los productos sin stock", async () => {
    vi.stubGlobal("fetch", stubFetchConCatalogo());
    render(<Catalogo />);
    await screen.findByText("Jean Azul");
    expect(screen.getByText("Agotado")).toBeTruthy();
    expect(screen.getAllByText("Agregar").length).toBe(2);
  });

  it("agrega al carrito y refleja el contador con persistencia propia", async () => {
    vi.stubGlobal("fetch", stubFetchConCatalogo());
    render(<Catalogo />);
    await screen.findByText("Jean Azul");
    fireEvent.click(screen.getAllByText("Agregar")[0]);
    const guardado = JSON.parse(localStorage.getItem("termuxtienda-cart") ?? "[]");
    expect(guardado).toEqual([{ productId: "p1", qty: 1 }]);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Mi Tienda")).toBeTruthy();
  });

  it("muestra un estado vacío distinguible cuando no hay catálogo publicado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ catalogo: null }), { status: 404 })));
    render(<Catalogo />);
    expect(await screen.findByText("Aún no hay catálogo publicado")).toBeTruthy();
    expect(screen.queryByText("Agregar")).toBeNull();
  });

  it("muestra error en español con reintento que vuelve a consultar", async () => {
    const fetchMock = vi
      .fn<(input: string) => Promise<Response>>()
      .mockRejectedValueOnce(new Error("sin red"))
      .mockResolvedValueOnce(new Response(JSON.stringify(CATALOGO), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Catalogo />);
    expect(await screen.findByText("No se pudo cargar el catálogo")).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    await waitFor(() => expect(screen.getByText("Jean Azul")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
