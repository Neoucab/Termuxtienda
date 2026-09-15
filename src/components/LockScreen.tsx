import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock, Store } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useApp } from "../lib/store";
import { lockoutDelayMs, verifyPin, type PinSubtle } from "../lib/pin";

interface LockScreenProps {
  onUnlock: () => void;
  /** Almacenamiento no disponible: no hay credencial verificable (fail closed). */
  storageBlocked?: boolean;
  /** Seam de pruebas: en producción se omite y se usa la primitiva de la plataforma. */
  subtle?: PinSubtle;
}

/** Frecuencia del tic que refresca la cuenta atrás de la penalización. */
const TICK_MS = 250;

export default function LockScreen({ onUnlock, storageBlocked = false, subtle }: LockScreenProps) {
  const storeName = useApp((s) => s.settings.storeName);
  const pinHash = useApp((s) => s.settings.pinHash);
  const updateSettings = useApp((s) => s.updateSettings);

  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cryptoBlocked, setCryptoBlocked] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Contador de fallos en un ref: no provoca render ni setState anidados.
  const failuresRef = useRef(0);

  const remainingMs = blockedUntil === null ? 0 : Math.max(0, blockedUntil - now);
  const waiting = remainingMs > 0;
  const penaltySeconds = Math.ceil(remainingMs / 1000);
  const blocked = storageBlocked || cryptoBlocked;
  const disabled = blocked || submitting || waiting;

  // Un único efecto, indexado por la penalización: garantiza el clearInterval al desmontar.
  useEffect(() => {
    if (blockedUntil === null) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= blockedUntil) setBlockedUntil(null);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const attempt = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled || !pinHash) return;
    setSubmitting(true);
    setError(false);
    try {
      const result = await verifyPin(pin, pinHash, subtle ? { subtle } : undefined);

      if (result.ok) {
        failuresRef.current = 0;
        setBlockedUntil(null);
        // La credencial heredada se reescribe en el formato derivado antes de entrar.
        if (result.upgraded) updateSettings({ pinHash: result.upgraded });
        onUnlock();
        return;
      }

      if (result.reason === "crypto-unavailable") {
        setCryptoBlocked(true);
        setPin("");
        return;
      }

      failuresRef.current += 1;
      const current = Date.now();
      setNow(current);
      setBlockedUntil(current + lockoutDelayMs(failuresRef.current));
      setError(true);
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={attempt}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-pop"
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-gradient text-white shadow-md shadow-primary/30">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{storeName}</h1>
          <p className="text-sm text-muted">Ingresa tu PIN para continuar</p>
        </div>

        <div className="space-y-3">
          {blocked ? (
            <p className="text-center text-sm text-danger" role="alert">
              {storageBlocked
                ? "No se puede acceder al almacenamiento de este dispositivo. Revisa los permisos o el modo privado y vuelve a abrir la app."
                : "Este dispositivo no permite verificar el PIN. Abre la app en un contexto seguro (HTTPS) o actualiza el navegador."}
            </p>
          ) : (
            <>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                disabled={disabled}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(false);
                }}
                placeholder="••••"
                className="text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
              {error && (
                <p className="text-center text-sm text-danger">
                  PIN incorrecto. Inténtalo de nuevo.
                </p>
              )}
              {waiting && (
                <p className="text-center text-sm text-danger" role="status">
                  Demasiados intentos. Espera {penaltySeconds} s para volver a intentarlo.
                </p>
              )}
            </>
          )}
          <Button type="submit" fullWidth size="lg" disabled={disabled}>
            <Lock className="h-4 w-4" /> {submitting ? "Comprobando…" : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
