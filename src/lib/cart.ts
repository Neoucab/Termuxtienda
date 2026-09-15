import { useState } from "react";
import type { ProductoPublico } from "./types";

/** Entrada del carrito del cliente: separada de termuxtienda-store. */
export interface CartEntry {
  productId: string;
  qty: number;
}

const CART_KEY = "termuxtienda-cart";

/** Lee el carrito del cliente; datos corruptos o incompletos se descartan. */
export function loadCart(): CartEntry[] {
  const raw = localStorage.getItem(CART_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CartEntry =>
        typeof e === "object" && e !== null &&
        typeof (e as CartEntry).productId === "string" &&
        typeof (e as CartEntry).qty === "number"
    );
  } catch {
    return [];
  }
}

/** Guarda el carrito del cliente bajo su propia clave. */
export function saveCart(items: CartEntry[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

/** Hook del carrito: lee al montar y persiste en cada cambio. */
export function useCart() {
  const [items, setItems] = useState<CartEntry[]>(loadCart);
  const update = (fn: (prev: CartEntry[]) => CartEntry[]) =>
    setItems((prev) => {
      const next = fn(prev);
      saveCart(next);
      return next;
    });
  const add = (productId: string) =>
    update((prev) => {
      const existente = prev.find((e) => e.productId === productId);
      if (existente) {
        return prev.map((e) => (e.productId === productId ? { ...e, qty: e.qty + 1 } : e));
      }
      return [...prev, { productId, qty: 1 }];
    });
  const setQty = (productId: string, qty: number) =>
    update((prev) =>
      prev.map((e) => (e.productId === productId ? { ...e, qty: Math.max(1, Math.floor(qty) || 1) } : e))
    );
  const remove = (productId: string) => update((prev) => prev.filter((e) => e.productId !== productId));
  return { items, add, setQty, remove };
}

/**
 * Resuelve el carrito contra el catálogo recién leído: las entradas cuyo
 * producto ya no existe se descartan (se reportan por id) y la cantidad
 * mínima es 1.
 */
export function resolveCart(
  items: CartEntry[],
  productos: ProductoPublico[]
): { items: CartEntry[]; dropped: string[] } {
  const visibles = new Set(productos.map((p) => p.id));
  const items_finales: CartEntry[] = [];
  const dropped: string[] = [];
  for (const entry of items) {
    if (!visibles.has(entry.productId)) {
      dropped.push(entry.productId);
      continue;
    }
    items_finales.push({ productId: entry.productId, qty: Math.max(1, Math.floor(entry.qty)) });
  }
  return { items: items_finales, dropped };
}
