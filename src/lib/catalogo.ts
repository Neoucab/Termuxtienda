import type { CatalogoPublico, ProductoPublico, Product, Settings } from "./types";

/** Proyección pública de un producto: jamás incluye el costo ni datos del dueño. */
function proyectar(p: Product): ProductoPublico {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    ...(p.size !== undefined && { size: p.size }),
    ...(p.color !== undefined && { color: p.color }),
    price: p.price,
    ...(p.image !== undefined && { image: p.image }),
    stock: p.stock,
  };
}

/** Instantánea sanitizada del catálogo: solo campos públicos. */
export function buildCatalogo(products: Product[], settings: Settings, publishedAt: number): CatalogoPublico {
  return {
    publishedAt,
    storeName: settings.storeName,
    currency: settings.currency,
    ...(settings.bcvRate !== undefined && { bcvRate: settings.bcvRate }),
    ...(settings.whatsappNumber !== undefined && { whatsappNumber: settings.whatsappNumber }),
    products: products.map(proyectar),
  };
}

/** Lee el catálogo publicado: null significa que aún no hay catálogo (404-null del Worker). */
export async function fetchCatalogoApi(): Promise<CatalogoPublico | null> {
  const res = await fetch("/api/catalogo");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${res.status}).`);
  return (await res.json()) as CatalogoPublico;
}

/** Publica el catálogo del dueño; falla con el mensaje del Worker en 401/400. */
export async function publishCatalogo(payload: CatalogoPublico, secret: string): Promise<void> {
  const res = await fetch("/api/catalogo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Catalogo-Secret": secret,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detalle = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detalle?.error ?? `No se pudo publicar el catálogo (HTTP ${res.status}).`);
  }
}
