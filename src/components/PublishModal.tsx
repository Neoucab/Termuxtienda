import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, ImageIcon, Instagram, MessageCircle, Share2 } from "lucide-react";
import Modal from "./ui/Modal";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Input";
import type { Product, SocialNetwork } from "../lib/types";
import { dataUrlToFile } from "../lib/image";
import { isPublished, productCaption, SOCIAL_LABELS } from "../lib/publish";
import { cn } from "../lib/cn";

export default function PublishModal({
  open,
  onClose,
  product,
  currency,
  storeName,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  currency: string;
  storeName: string;
  onToggle: (network: SocialNetwork, value: boolean) => void;
}) {
  const [caption, setCaption] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && product) {
      // El enlace del catálogo dirige al cliente a la tienda pública.
      const catalogUrl = `${location.origin}${location.pathname}#/tienda`;
      setCaption(productCaption(product, currency, storeName, catalogUrl));
      setCopied(false);
    }
  }, [open, product, currency, storeName]);

  if (!product) return null;

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const downloadImage = () => {
    if (!product.image) return;
    const a = document.createElement("a");
    a.href = product.image;
    a.download = `${product.name.replace(/\s+/g, "-") || "producto"}.jpg`;
    a.click();
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };

  const share = async () => {
    if (!canShare) {
      await copyCaption();
      if (product.image) downloadImage();
      return;
    }
    const shareData: ShareData = {
      text: caption,
      ...(product.image ? { files: [dataUrlToFile(product.image, `${product.name || "producto"}.jpg`)] } : {}),
    };
    try {
      if (typeof navigator.canShare === "function" && !navigator.canShare(shareData)) {
        await copyCaption();
        if (product.image) downloadImage();
        return;
      }
      await navigator.share(shareData);
    } catch {
      /* el usuario canceló la hoja de compartir */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publicar producto"
      description="Comparte la foto y el texto; luego marca en qué red lo publicaste."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={share}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-44 w-full rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/50 text-muted">
            <ImageIcon className="h-5 w-5" /> Sin foto (puedes agregarla en Inventario)
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Texto de la publicación</span>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyCaption}>
            <Copy className="h-4 w-4" /> {copied ? "Copiado ✓" : "Copiar texto"}
          </Button>
          {product.image && (
            <Button variant="outline" size="sm" onClick={downloadImage}>
              <Download className="h-4 w-4" /> Descargar foto
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">Marcar como publicado</p>
          <div className="grid grid-cols-2 gap-2">
            <NetworkToggle
              icon={<Instagram className="h-4 w-4" />}
              label={SOCIAL_LABELS.instagram}
              active={isPublished(product, "instagram")}
              onClick={() => onToggle("instagram", !isPublished(product, "instagram"))}
            />
            <NetworkToggle
              icon={<MessageCircle className="h-4 w-4" />}
              label={SOCIAL_LABELS.whatsapp}
              active={isPublished(product, "whatsapp")}
              onClick={() => onToggle("whatsapp", !isPublished(product, "whatsapp"))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NetworkToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:bg-surface-2"
      )}
    >
      {icon}
      {label}
      {active && <Check className="h-4 w-4" />}
    </button>
  );
}
