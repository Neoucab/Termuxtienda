/// <reference lib="webworker" />
/**
 * Router del Worker: las rutas /api/* se resuelven aquí; todo lo demás
 * lo atiende el sistema de assets (assets-first por defecto con main + assets).
 */
import { handleGetCatalogo, handlePostCatalogo, jsonError, type KvLike } from "./catalogo";

interface Env {
  CATALOGO: KvLike;
  PUBLISH_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/catalogo") {
      if (request.method === "GET") return handleGetCatalogo(env.CATALOGO);
      if (request.method === "POST") {
        const body: unknown = await request.json().catch(() => null);
        const secret = request.headers.get("X-Catalogo-Secret") ?? undefined;
        return handlePostCatalogo(env.CATALOGO, secret, body, env.PUBLISH_SECRET);
      }
      return jsonError(405, "Método no permitido.");
    }
    return jsonError(404, "No encontrado.");
  },
};
