import { useEffect, useState } from "react";
import { fetchCatalogoApi } from "../lib/catalogo";
import { useCart } from "../lib/cart";
import { formatDateTime, money, moneyBs, usdToBs } from "../lib/format";
import type { CatalogoPublico } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Store, WifiOff } from "lucide-react";

type Estado =
  | { kind: "cargando" }
  | { kind: "listo"; catalogo: CatalogoPublico }
  | { kind: "vacio" }
  | { kind: "error" };

/** Vista pública del catálogo: sin PIN, lee la instantánea publicada por el dueño. */
export default function Catalogo() {
  const [estado, setEstado] = useState<Estado>({ kind: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const cart = useCart();
  const totalItems = cart.items.reduce((n, e) => n + e.qty, 0);

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

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold text-foreground">{catalogo?.storeName ?? "Catálogo"}</h1>
          <p className="text-xs text-muted">Pre-pedidos por WhatsApp · sin reserva de stock</p>
        </div>
        <a
          href="#/tienda/carrito"
          aria-label="Ver carrito"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-xl"
        >
          🛒
          {totalItems > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
              {totalItems}
            </span>
          )}
        </a>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {estado.kind === "cargando" && <p className="text-center text-sm text-muted">Cargando…</p>}

        {estado.kind === "vacio" && (
          <EmptyState
            icon={Store}
            title="Aún no hay catálogo publicado"
            description="El dueño todavía no publica su catálogo. Vuelve a intentarlo más tarde."
          />
        )}

        {estado.kind === "error" && (
          <EmptyState
            icon={WifiOff}
            title="No se pudo cargar el catálogo"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => setRecarga((n) => n + 1)}>Reintentar</Button>}
          />
        )}

        {estado.kind === "listo" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {estado.catalogo.products.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-surface-2 text-3xl">👕</div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      {p.stock <= 0 && <Badge variant="danger">Agotado</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                      {p.size && <span className="rounded bg-surface-2 px-1.5 py-0.5">T.{p.size}</span>}
                      {p.color && <span className="rounded bg-surface-2 px-1.5 py-0.5">{p.color}</span>}
                      <span>{p.category}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-base font-bold text-foreground">{money(p.price, estado.catalogo.currency)}</span>
                      {estado.catalogo.bcvRate !== undefined && (
                        <span className="text-xs text-muted">{moneyBs(usdToBs(p.price, estado.catalogo.bcvRate))}</span>
                      )}
                    </div>
                    <Button size="sm" className="mt-2 w-full" onClick={() => cart.add(p.id)}>
                      Agregar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <footer className="mt-6 text-center text-xs text-muted">
              <p>Catálogo publicado: {formatDateTime(estado.catalogo.publishedAt)}</p>
              <p>Precios estimados: confirman disponibilidad y total por WhatsApp.</p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
