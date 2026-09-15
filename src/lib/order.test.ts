import { describe, expect, it } from "vitest";
import { orderMessage, type OrderLine } from "./order";
import { moneyBs } from "./format";

const LINEAS: OrderLine[] = [
  { name: "Jean Azul", qty: 2, unitPrice: 20, size: "32", color: "Azul" },
  { name: "Camisa Blanca", qty: 1, unitPrice: 15 },
];

describe("orderMessage", () => {
  it("arma el presupuesto itemizado con total en $ y Bs", () => {
    const msg = orderMessage("Mi Tienda", LINEAS, "$", 40);
    expect(msg).toContain("🛒 Pedido — Mi Tienda");
    expect(msg).toContain("2× Jean Azul (T.32 · Azul) — $20.00 c/u — $40.00");
    expect(msg).toContain("1× Camisa Blanca — $15.00");
    expect(msg).toContain(`Total estimado: $55.00 (${moneyBs(55 * 40)} @ BCV)`);
    expect(msg).toContain("Pre-pedido sin reserva de stock, sujeto a disponibilidad.");
  });

  it("omite el detalle de talla/color cuando no hay y el Bs sin bcvRate", () => {
    const msg = orderMessage("Mi Tienda", [{ name: "Camisa Blanca", qty: 1, unitPrice: 15 }], "$", undefined);
    expect(msg).toContain("1× Camisa Blanca — $15.00");
    expect(msg).not.toContain("(");
    expect(msg).toContain("Total estimado: $15.00");
    expect(msg).not.toContain("@ BCV");
  });

  it("incluye el nombre del cliente solo cuando se indica", () => {
    expect(orderMessage("Mi Tienda", LINEAS, "$", 40, "Juan")).toContain("Nombre: Juan");
    expect(orderMessage("Mi Tienda", LINEAS, "$", 40)).not.toContain("Nombre:");
    expect(orderMessage("Mi Tienda", LINEAS, "$", 40, "   ")).not.toContain("Nombre:");
  });
});
