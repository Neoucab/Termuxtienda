/**
 * API pública/privada del catálogo para el Worker de Cloudflare.
 * Handlers puros sobre un KvLike para poder probarlos sin Miniflare.
 */

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const CATALOGO_KEY = "catalogo";

const PRODUCTO_KEYS: readonly string[] = ["id", "name", "category", "size", "color", "price", "image", "stock"];
const PRODUCTO_REQUERIDOS: readonly string[] = ["id", "name", "category", "price", "stock"];
const CATALOGO_KEYS: readonly string[] = ["publishedAt", "storeName", "currency", "bcvRate", "whatsappNumber", "products"];
const CATALOGO_REQUERIDOS: readonly string[] = ["publishedAt", "storeName", "currency", "products"];

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function esTexto(o: Record<string, unknown>, key: string): boolean {
  const v = o[key];
  return typeof v === "string" && v.length > 0;
}

function esTextoOpcional(o: Record<string, unknown>, key: string): boolean {
  return o[key] === undefined || typeof o[key] === "string";
}

function esProductoValido(p: unknown): boolean {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  if ("cost" in o) return false; // el margen del dueño jamás viaja al catálogo público
  for (const k of Object.keys(o)) {
    if (!PRODUCTO_KEYS.includes(k)) return false;
  }
  for (const k of PRODUCTO_REQUERIDOS) {
    if (!(k in o)) return false;
  }
  if (!esTexto(o, "id") || !esTexto(o, "name") || typeof o.category !== "string") return false;
  if (typeof o.price !== "number" || !Number.isFinite(o.price)) return false;
  if (typeof o.stock !== "number" || !Number.isInteger(o.stock) || o.stock < 0) return false;
  return esTextoOpcional(o, "size") && esTextoOpcional(o, "color") && esTextoOpcional(o, "image");
}

function esCatalogoValido(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const o = body as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!CATALOGO_KEYS.includes(k)) return false;
  }
  for (const k of CATALOGO_REQUERIDOS) {
    if (!(k in o)) return false;
  }
  if (typeof o.publishedAt !== "number" || !Number.isFinite(o.publishedAt)) return false;
  if (!esTexto(o, "storeName") || typeof o.currency !== "string") return false;
  if (o.bcvRate !== undefined && (typeof o.bcvRate !== "number" || !Number.isFinite(o.bcvRate))) return false;
  if (o.whatsappNumber !== undefined && !esTexto(o, "whatsappNumber")) return false;
  if (!Array.isArray(o.products)) return false;
  return o.products.every(esProductoValido);
}

/** GET /api/catalogo — público. Sin catálogo publicado → 404 {catalogo: null}. */
export async function handleGetCatalogo(kv: KvLike): Promise<Response> {
  const raw = await kv.get(CATALOGO_KEY);
  if (raw === null) return Response.json({ catalogo: null }, { status: 404 });
  return Response.json(JSON.parse(raw) as unknown);
}

/**
 * POST /api/catalogo — solo el dueño (header X-Catalogo-Secret == PUBLISH_SECRET).
 * Rechaza payloads que incluyan cost o que no respeten la forma de la proyección.
 */
export async function handlePostCatalogo(
  kv: KvLike,
  secret: string | undefined,
  body: unknown,
  workerSecret: string
): Promise<Response> {
  if (typeof secret !== "string" || secret.length === 0 || secret !== workerSecret) {
    return jsonError(401, "Clave de catálogo inválida.");
  }
  if (!esCatalogoValido(body)) {
    return jsonError(400, "El catálogo enviado no tiene el formato esperado.");
  }
  await kv.put(CATALOGO_KEY, JSON.stringify(body));
  return Response.json({ ok: true }, { status: 201 });
}
