import { describe, expect, it } from "vitest";
import { handleGetCatalogo, handlePostCatalogo, type KvLike } from "./catalogo";

const SECRET = "s3cr3t-c4t4l0g0";

const VALID_CATALOGO = {
  publishedAt: 1726400000000,
  storeName: "Mi Tienda",
  currency: "$",
  bcvRate: 40,
  whatsappNumber: "04141234567",
  products: [
    { id: "p1", name: "Jean Azul", category: "Ropa", size: "32", color: "Azul", price: 20, stock: 3 },
    { id: "p2", name: "Camisa Blanca", category: "Ropa", price: 15, stock: 0, image: "data:image/png;base64,AA" },
  ],
};

function kvDouble(initial: Record<string, string> = {}): KvLike & { store: Map<string, string> } {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("handlePostCatalogo", () => {
  it("guarda el catálogo con el secret correcto y responde 201", async () => {
    const kv = kvDouble();
    const res = await handlePostCatalogo(kv, SECRET, VALID_CATALOGO, SECRET);
    expect(res.status).toBe(201);
    expect(JSON.parse((await kv.get("catalogo")) ?? "{}")).toEqual(VALID_CATALOGO);
  });

  it("rechaza 401 cuando falta el secret y no guarda nada", async () => {
    const kv = kvDouble();
    const res = await handlePostCatalogo(kv, undefined, VALID_CATALOGO, SECRET);
    expect(res.status).toBe(401);
    expect(kv.store.has("catalogo")).toBe(false);
  });

  it("rechaza 401 cuando el secret es incorrecto y no guarda nada", async () => {
    const kv = kvDouble();
    const res = await handlePostCatalogo(kv, "otro-secret", VALID_CATALOGO, SECRET);
    expect(res.status).toBe(401);
    expect(kv.store.has("catalogo")).toBe(false);
  });

  it("rechaza 400 un payload que incluye cost y no guarda nada", async () => {
    const kv = kvDouble();
    const conCosto = {
      ...VALID_CATALOGO,
      products: [{ ...VALID_CATALOGO.products[0], cost: 5 }],
    };
    const res = await handlePostCatalogo(kv, SECRET, conCosto, SECRET);
    expect(res.status).toBe(400);
    expect(kv.store.has("catalogo")).toBe(false);
  });

  it("rechaza 400 un payload con campos faltantes o desconocidos", async () => {
    const kv = kvDouble();
    const incompleto = {
      ...VALID_CATALOGO,
      products: [{ id: "p1", name: "Jean", price: 20 }],
    };
    expect((await handlePostCatalogo(kv, SECRET, incompleto, SECRET)).status).toBe(400);
    const conExtra = { ...VALID_CATALOGO, products: [...VALID_CATALOGO.products], kliento: "x" };
    expect((await handlePostCatalogo(kv, SECRET, conExtra, SECRET)).status).toBe(400);
    expect(kv.store.has("catalogo")).toBe(false);
  });

  it("rechaza 400 un payload con tipos incorrectos", async () => {
    const kv = kvDouble();
    const tipos = { ...VALID_CATALOGO, publishedAt: "ayer", products: [{ ...VALID_CATALOGO.products[0], price: "20" }] };
    const res = await handlePostCatalogo(kv, SECRET, tipos, SECRET);
    expect(res.status).toBe(400);
    expect(kv.store.has("catalogo")).toBe(false);
  });
});

describe("handleGetCatalogo", () => {
  it("devuelve 200 con el payload publicado", async () => {
    const kv = kvDouble({ catalogo: JSON.stringify(VALID_CATALOGO) });
    const res = await handleGetCatalogo(kv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VALID_CATALOGO);
  });

  it("devuelve 404 {catalogo:null} cuando no hay nada publicado", async () => {
    const res = await handleGetCatalogo(kvDouble());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ catalogo: null });
  });
});

describe("rotación del secret de publicación", () => {
  it("rechaza 401 el secret viejo y acepta 201 tras actualizar el secret del worker", async () => {
    const kv = kvDouble();
    const nuevo = "s3cr3t-nu3v0";
    expect((await handlePostCatalogo(kv, SECRET, VALID_CATALOGO, nuevo)).status).toBe(401);
    expect((await handlePostCatalogo(kv, nuevo, VALID_CATALOGO, nuevo)).status).toBe(201);
    expect(JSON.parse((await kv.get("catalogo")) ?? "{}")).toEqual(VALID_CATALOGO);
  });
});
