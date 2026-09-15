// @vitest-environment jsdom
import "../test/setup.dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inventario from "./Inventario";
import { DEFAULT_SETTINGS, useApp } from "../lib/store";
import type { Product } from "../lib/types";

const PRODUCTO: Product = {
  id: "p1",
  name: "Jean Azul",
  category: "Ropa",
  size: "32",
  color: "Azul",
  cost: 8,
  price: 20,
  stock: 3,
  minStock: 1,
  createdAt: 1,
};

function seed(over: { whatsappNumber?: string; publishSecret?: string }): void {
  useApp.setState({
    products: [PRODUCTO],
    settings: { ...DEFAULT_SETTINGS, ...over },
  });
}

beforeEach(() => {
  useApp.setState({ products: [PRODUCTO], settings: { ...DEFAULT_SETTINGS } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Inventario · publicar catálogo", () => {
  it("bloquea la publicación sin WhatsApp del dueño y no hace ninguna petición", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seed({ whatsappNumber: undefined, publishSecret: "clave" });
    render(<Inventario />);

    fireEvent.click(screen.getByText("Publicar catálogo"));

    expect(await screen.findByText(/Configura primero el WhatsApp del dueño/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea la publicación sin la clave del catálogo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seed({ whatsappNumber: "04141234567", publishSecret: undefined });
    render(<Inventario />);

    fireEvent.click(screen.getByText("Publicar catálogo"));

    expect(await screen.findByText(/Configura primero la clave del catálogo/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publica con el secret y un payload sin costos", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    seed({ whatsappNumber: "04141234567", publishSecret: "la-clave" });
    render(<Inventario />);

    fireEvent.click(screen.getByText("Publicar catálogo"));

    expect(await screen.findByText(/Catálogo publicado/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/catalogo");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Catalogo-Secret"]).toBe("la-clave");
    const body = JSON.parse(init.body as string);
    expect(body.products[0]).not.toHaveProperty("cost");
    expect(body.products[0].price).toBe(20);
    expect(body.storeName).toBe(DEFAULT_SETTINGS.storeName);
    expect(useApp.getState().settings.ultimaPublicacion).toBeGreaterThan(0);
  });

  it("muestra el mensaje del worker cuando la clave no coincide (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Clave de catálogo inválida." }), { status: 401 }))
    );
    seed({ whatsappNumber: "04141234567", publishSecret: "mala" });
    render(<Inventario />);

    fireEvent.click(screen.getByText("Publicar catálogo"));

    expect(await screen.findByText("Clave de catálogo inválida.")).toBeTruthy();
    expect(useApp.getState().settings.ultimaPublicacion).toBeUndefined();
  });
});
