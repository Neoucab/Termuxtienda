import { useEffect, useState } from "react";
import { fetchCatalogoApi } from "../lib/catalogo";
import { resolveCart, useCart } from "../lib/cart";
import { orderMessage } from "../lib/order";
import { waLink, waNumber } from "../lib/whatsapp";
import { money, moneyBs, usdToBs } from "../lib/format";
import type { CatalogoPublico } from "../lib/types";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { ShoppingCart, Store } from "lucide-react";

type Estado =
  | { kind: "cargando" }
  | { kind: "listo"; catalogo: CatalogoPublico }
  | { kind: "vacio" }
  | { kind: "error" };

/** Carrito público del cliente: pre-pedido por WhatsApp, sin transacciones. */
export default function Carrito() {
  const [estado, setEstado] = useState<Estado>({ kind: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const [nombre, setNombre] = useState("");
  const [avisoDescarte, setAvisoDescarte] = useState<string | null>(null);
  const cart = useCart();

  useEffect(() => {
    let viva = true;
    setEstado({ kind: "cargando" });
    fetchCatalogoApi()
      .then((c) => {
        if (viva) setEstado(c === null ? { kind: "vacio" } : { kind: "listo", catalogo: c });
      })
      .catch(() => {
        if (viva) setEstado({ kind: "error" });
      });
    return () => {
      viva = false;
    };
  }, [recarga]);

  const catalogo = estado.kind === "listo" ? estado.catalogo : null;

  useEffect(() => {
    if (estado.kind !== "listo") return;
    const { dropped } = resolveCart(cart.items, estado.catalogo.products);
    if (dropped.length > 0) {
      setAvisoDescarte(
        dropped.length === 1
          ? "1 producto ya no está en el catálogo y se quitó del carrito."
          : `${dropped.length} productos ya no están en el catálogo y se quitaron del carrito.`
      );
      dropped.forEach((id) => cart.remove(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const lineas =
    estado.kind === "listo"
      ? resolveCart(cart.items, estado.catalogo.products).items.map((e) => ({
          entry: e,
          producto: estado.catalogo.products.find((p) => p.id === e.productId)!,
        }))
      : [];

  const total = lineas.reduce((n, l) => n + l.producto.price * l.entry.qty, 0);
  const mensaje =
    catalogo && lineas.length > 0
      ? orderMessage(
          catalogo.storeName,
          lineas.map((l) => ({
            name: l.producto.name,
            qty: l.entry.qty,
            unitPrice: l.producto.price,
            size: l.producto.size,
            color: l.producto.color,
          })),
          catalogo.currency,
          catalogo.bcvRate,
          nombre
        )
      : null;
  const enlaceWhatsApp =
    catalogo?.whatsappNumber && mensaje ? waLink(waNumber(catalogo.whatsappNumber), mensaje) : null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold text-foreground">Tu carrito</h1>
          <p className="text-xs text-muted">Pre-pedido sin reserva de stock</p>
        </div>
        <a
          href="#/tienda"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          <Store className="h-4 w-4" /> Catálogo
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {estado.kind === "cargando" && <p className="text-center text-sm text-muted">Cargando…</p>}
        {estado.kind === "vacio" && (
          <EmptyState
            icon={Store}
            title="Aún no hay catálogo publicado"
            description="Vuelve más tarde o contacta al vendedor por otros medios."
          />
        )}
        {estado.kind === "error" && (
          <EmptyState
            icon={ShoppingCart}
            title="No se pudo cargar tu carrito"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => setRecarga((n) => n + 1)}>Reintentar</Button>}
          />
        )}

        {estado.kind === "listo" && lineas.length === 0 && (
          <EmptyState
            icon={ShoppingCart}
            title="Tu carrito está vacío"
            description="Explora el catálogo y agrega los productos que te interesen."
            action={
              <a href="#/tienda" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                Ver catálogo
              </a>
            }
          />
        )}

        {catalogo && lineas.length > 0 && (
          <div className="space-y-3">
            {avisoDescarte && (
              <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="status">
                {avisoDescarte}
              </p>
            )}

            {lineas.map(({ entry, producto }) => (
              <div key={entry.productId} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{producto.name}</p>
                  <p className="text-xs text-muted">
                    {money(producto.price, catalogo.currency)} c/u
                    {producto.size !== undefined ? ` · T.${producto.size}` : ""}
                    {producto.color ? ` · ${producto.color}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => cart.setQty(entry.productId, entry.qty - 1)}
                    aria-label={`Restar ${producto.name}`}
                    className="h-8 w-8 rounded-lg border border-border text-foreground"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground">{entry.qty}</span>
                  <button
                    onClick={() => cart.setQty(entry.productId, entry.qty + 1)}
                    aria-label={`Sumar ${producto.name}`}
                    className="h-8 w-8 rounded-lg border border-border text-foreground"
                  >
                    +
                  </button>
                </div>
                <div className="w-20 text-right text-sm font-bold text-foreground">
                  {money(producto.price * entry.qty, catalogo.currency)}
                </div>
                <button
                  onClick={() => cart.remove(entry.productId)}
                  className="text-xs text-danger underline-offset-2 hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))}

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Total estimado:</span>
                <span className="text-lg font-bold text-foreground">{money(total, catalogo.currency)}</span>
              </div>
              {catalogo.bcvRate !== undefined && (
                <p className="mt-0.5 text-right text-xs text-muted">
                  {moneyBs(usdToBs(total, catalogo.bcvRate))} @ BCV
                </p>
              )}
              <div className="mt-3">
                <Input
                  placeholder="Tu nombre (opcional)"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
            </div>

            {enlaceWhatsApp ? (
              <a
                href={enlaceWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp text-base font-medium text-white shadow-sm shadow-whatsapp/30"
              >
                Enviar pedido por WhatsApp
              </a>
            ) : (
              <p className="rounded-xl border border-border bg-surface px-3 py-3 text-center text-sm text-muted">
                Este catálogo no tiene un número de WhatsApp configurado. Avisa al vendedor por otro medio.
              </p>
            )}
            <p className="text-center text-xs text-muted">
              El dueño confirma disponibilidad y total por mensaje. Aquí no se paga nada.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
