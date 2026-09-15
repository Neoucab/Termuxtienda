import type { Product, SocialNetwork } from "./types";
import { money } from "./format";

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  whatsapp: "Estado de WhatsApp",
};

export function isPublished(product: Product, network: SocialNetwork): boolean {
  return (product.published?.[network] ?? 0) > 0;
}

/** Genera el texto listo para copiar/compartir al publicar un producto. */
export function productCaption(
  product: Product,
  currency: string,
  storeName: string,
  catalogUrl?: string
): string {
  const lines = [`🛍️ ${product.name}`, `💰 ${money(product.price, currency)}`];
  const details = [product.size && `Talla ${product.size}`, product.color && `Color ${product.color}`]
    .filter(Boolean)
    .join(" · ");
  if (details) lines.push(`📏 ${details}`);
  if (product.category) lines.push(`🏷️ ${product.category}`);
  lines.push("", `📲 ${storeName}`, "¡Pide el tuyo hoy! 😉");
  if (catalogUrl) lines.push(`🛒 Ver catálogo: ${catalogUrl}`);
  return lines.join("\n");
}
