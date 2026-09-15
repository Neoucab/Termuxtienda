import { money, moneyBs, usdToBs } from "./format";

/** Línea de un pre-pedido armado desde el catálogo público. */
export interface OrderLine {
  name: string;
  qty: number;
  unitPrice: number;
  size?: string;
  color?: string;
}

/** Presupuesto itemizado que el cliente envía por WhatsApp al dueño. */
export function orderMessage(
  storeName: string,
  lines: OrderLine[],
  currency: string,
  bcvRate: number | undefined,
  clientName?: string
): string {
  const out: string[] = [`🛒 Pedido — ${storeName}`, ""];
  let total = 0;
  for (const l of lines) {
    const detalle = [l.size !== undefined && `T.${l.size}`, l.color].filter(Boolean).join(" · ");
    const nombre = detalle !== "" ? `${l.name} (${detalle})` : l.name;
    const lineTotal = l.qty * l.unitPrice;
    total += lineTotal;
    out.push(`${l.qty}× ${nombre} — ${money(l.unitPrice, currency)} c/u — ${money(lineTotal, currency)}`);
  }
  out.push("");
  out.push(`Total estimado: ${money(total, currency)}${bcvRate !== undefined ? ` (${moneyBs(usdToBs(total, bcvRate))} @ BCV)` : ""}`);
  out.push("Pre-pedido sin reserva de stock, sujeto a disponibilidad.");
  if (clientName !== undefined && clientName.trim().length > 0) {
    out.push(`Nombre: ${clientName.trim()}`);
  }
  out.push(`Enviado desde el catálogo web de ${storeName}`);
  return out.join("\n");
}
