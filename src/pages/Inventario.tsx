import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CloudUpload, ImageIcon, Pencil, Plus, Search, Share2, Shirt, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import type { Product, SocialNetwork } from "../lib/types";
import { money } from "../lib/format";
import { fileToImageDataUrl } from "../lib/image";
import { buildCatalogo, publishCatalogo } from "../lib/catalogo";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Field, Select } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import PublishModal from "../components/PublishModal";

export default function Inventario() {
  const products = useApp((s) => s.products);
  const currency = useApp((s) => s.settings.currency);
  const storeName = useApp((s) => s.settings.storeName);
  const addProduct = useApp((s) => s.addProduct);
  const updateProduct = useApp((s) => s.updateProduct);
  const deleteProduct = useApp((s) => s.deleteProduct);
  const updateSettings = useApp((s) => s.updateSettings);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [publishing, setPublishing] = useState<Product | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [mensajePublicacion, setMensajePublicacion] = useState<string | null>(null);

  const publicarCatalogo = async () => {
    const { publishSecret, whatsappNumber } = useApp.getState().settings;
    if (!whatsappNumber) {
      setMensajePublicacion("Configura primero el WhatsApp del dueño en Ajustes.");
      return;
    }
    if (!publishSecret) {
      setMensajePublicacion("Configura primero la clave del catálogo en Ajustes.");
      return;
    }
    setPublicando(true);
    setMensajePublicacion(null);
    try {
      await publishCatalogo(
        buildCatalogo(products, useApp.getState().settings, Date.now()),
        publishSecret
      );
      updateSettings({ ultimaPublicacion: Date.now() });
      setMensajePublicacion("Catálogo publicado ✓ Tus clientes ya pueden verlo.");
    } catch (e) {
      setMensajePublicacion(e instanceof Error ? e.message : "No se pudo publicar el catálogo.");
    } finally {
      setPublicando(false);
    }
  };

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()],
    [products]
  );

  const togglePublish = (network: SocialNetwork, value: boolean) => {
    if (!publishing) return;
    const published = { ...(publishing.published ?? {}), [network]: value ? Date.now() : undefined };
    updateProduct(publishing.id, { published });
    setPublishing({ ...publishing, published });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          (category === "Todas" || p.category === category) &&
          (!q ||
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query, category]);

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Productos, precios y existencias."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void publicarCatalogo()} disabled={publicando}>
              <CloudUpload className="h-4 w-4" /> {publicando ? "Publicando…" : "Publicar catálogo"}
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </div>
        }
      />

      {mensajePublicacion && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          {mensajePublicacion}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto o código…"
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto min-w-[140px]"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="Sin productos"
          description="Agrega tu primer producto para empezar a vender."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Costo</th>
                  <th className="px-4 py-3 text-right font-semibold">Precio</th>
                  <th className="px-4 py-3 text-right font-semibold">Ganancia</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{p.name}</p>
                          {(p.size || p.color) && (
                            <p className="text-xs text-muted">
                              {[p.size && `Talla ${p.size}`, p.color && `Color ${p.color}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.stock === 0 ? "danger" : p.stock <= p.minStock ? "warning" : "success"}>
                        {p.stock} disp.
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {money(p.cost, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {money(p.price, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">
                      {money(p.price - p.cost, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setPublishing(p)}
                          className="rounded-lg p-2 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                          aria-label="Publicar"
                          title="Publicar en redes"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditing(p)}
                          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(p)}
                          className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProductFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSave={(data) => {
          addProduct(data);
          setCreating(false);
        }}
      />
      <ProductFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing ?? undefined}
        onSave={(data) => {
          if (editing) updateProduct(editing.id, data);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Eliminar producto"
        description={`¿Seguro que quieres eliminar "${toDelete?.name ?? ""}" del inventario?`}
        onConfirm={() => {
          if (toDelete) deleteProduct(toDelete.id);
        }}
      />
      <PublishModal
        open={!!publishing}
        onClose={() => setPublishing(null)}
        product={publishing}
        currency={currency}
        storeName={storeName}
        onToggle={togglePublish}
      />
    </div>
  );
}

function ProductFormModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Product;
  onSave: (data: Omit<Product, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [size, setSize] = useState(initial?.size ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [cost, setCost] = useState(initial ? String(initial.cost) : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "");
  const [minStock, setMinStock] = useState(initial ? String(initial.minStock) : "3");
  const [image, setImage] = useState(initial?.image ?? "");
  const [imgError, setImgError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = name.trim().length > 0 && parseFloat(price) >= 0 && parseFloat(cost) >= 0;
  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError("");
    try {
      setImage(await fileToImageDataUrl(file));
    } catch {
      setImgError("No se pudo procesar esa imagen.");
    }
    e.target.value = "";
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar producto" : "Nuevo producto"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                category: category.trim() || "General",
                size: size.trim() || undefined,
                color: color.trim() || undefined,
                sku: sku.trim() || undefined,
                cost: num(cost),
                price: num(price),
                stock: Math.max(0, Math.round(num(stock))),
                minStock: Math.max(0, Math.round(num(minStock))),
                image: image || undefined,
                published: initial?.published,
              })
            }
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Foto del producto</span>
          <div className="flex items-center gap-3">
            {image ? (
              <img
                src={image}
                alt={name || "Producto"}
                className="h-16 w-16 rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  Subir foto
                </Button>
                {image && (
                  <Button size="sm" variant="ghost" onClick={() => setImage("")}>
                    Quitar
                  </Button>
                )}
              </div>
              {imgError && <p className="text-xs text-danger">{imgError}</p>}
            </div>
          </div>
          <span className="mt-1 block text-xs text-muted">
            Se comprime automáticamente. Se usa al publicar en redes.
          </span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </div>

        <Field label="Nombre" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Jean Clásico Azul"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoría">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Pantalones" />
          </Field>
          <Field label="Talla">
            <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / 32 / Única" />
          </Field>
        </div>
        <Field label="Color">
          <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Azul, Negro, Multicolor…" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Costo" required>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Precio de venta" required>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Stock">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Stock mínimo" hint="Avisa cuando quede poco.">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="3"
            />
          </Field>
        </div>
        <Field label="Código / SKU">
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opcional" />
        </Field>
      </div>
    </Modal>
  );
}
