import { useRef, useState } from "react";
import { Download, Lock, Moon, Palette, RefreshCw, Save, ShieldCheck, Sparkles, Store, Sun, Trash2, Upload } from "lucide-react";
import { useApp } from "../lib/store";
import { fetchBcvRate } from "../lib/bcv";
import { buildBackupPayload } from "../lib/backup";
import { hashPin, isValidPin } from "../lib/pin";
import { THEMES } from "../lib/theme";
import type { ThemeColor } from "../lib/types";
import { cn } from "../lib/cn";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Field } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

const THEME_LABELS: Record<ThemeColor, string> = {
  verde: "Verde",
  azul: "Azul",
  morado: "Morado",
  naranja: "Naranja",
  rosa: "Rosa",
};

export default function Ajustes() {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const resetData = useApp((s) => s.resetData);
  const loadExampleData = useApp((s) => s.loadExampleData);
  const importData = useApp((s) => s.importData);

  const [storeName, setStoreName] = useState(settings.storeName);
  const [currency, setCurrency] = useState(settings.currency);
  const [bcvRateInput, setBcvRateInput] = useState(
    settings.bcvRate != null ? String(settings.bcvRate) : ""
  );
  const [saved, setSaved] = useState(false);
  const [bcvLoading, setBcvLoading] = useState(false);
  const [bcvError, setBcvError] = useState<string | null>(null);
  const [bcvDate, setBcvDate] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [confirmRemovePin, setConfirmRemovePin] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmExample, setConfirmExample] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveStore = () => {
    const parsedRate = parseFloat(bcvRateInput);
    updateSettings({
      storeName: storeName.trim() || "Termuxtienda",
      currency: currency.trim() || "$",
      bcvRate: !Number.isNaN(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const consultarBcv = async () => {
    setBcvLoading(true);
    setBcvError(null);
    setBcvDate(null);
    try {
      const r = await fetchBcvRate();
      setBcvRateInput(String(r.rate));
      setBcvDate(r.date);
    } catch {
      setBcvError("No se pudo consultar la tasa. Verifica tu conexión o escríbela manualmente.");
    } finally {
      setBcvLoading(false);
    }
  };

  const savePin = async (pin: string) => {
    // La derivación es asíncrona y puede fallar si la plataforma no ofrece la
    // primitiva: en ese caso el diálogo muestra el aviso y sigue abierto.
    const credential = await hashPin(pin);
    updateSettings({ pinHash: credential });
    setPinOpen(false);
  };

  const exportData = () => {
    // El respaldo se construye sin la credencial del PIN (ver `buildBackupPayload`).
    const payload = buildBackupPayload(useApp.getState());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termuxtienda-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = (file: File) => {
    file.text().then((text) => {
      const ok = importData(text);
      setMessage(ok ? "Datos importados correctamente." : "El archivo no es válido.");
      setTimeout(() => setMessage(null), 3000);
    });
  };

  return (
    <div>
      <PageHeader title="Ajustes" description="Personaliza tu tienda y administra tus datos." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <Store className="h-4 w-4" /> Mi tienda
          </h2>
          <div className="space-y-4">
            <Field label="Nombre de la tienda">
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </Field>
            <Field label="Símbolo de moneda" hint="Símbolo de la moneda base (los precios se guardan en USD).">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="max-w-[120px]" />
            </Field>
            <Field
              label="Tasa BCV (Bs por $)"
              hint="Bolívares por 1 dólar. Se usa para cobrar en bolívares."
            >
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.0001"
                value={bcvRateInput}
                onChange={(e) => setBcvRateInput(e.target.value)}
                placeholder="Ej. 36.00"
                className="max-w-[160px]"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={consultarBcv} disabled={bcvLoading}>
                <RefreshCw className={cn("h-4 w-4", bcvLoading && "animate-spin")} />
                {bcvLoading ? "Consultando…" : "Consultar tasa del día"}
              </Button>
              {bcvDate && (
                <span className="text-xs text-success">
                  Tasa oficial del {new Date(bcvDate).toLocaleDateString("es-VE")}
                </span>
              )}
            </div>
            {bcvError && <p className="text-xs text-danger">{bcvError}</p>}
            <Button onClick={saveStore}>
              <Save className="h-4 w-4" /> {saved ? "Guardado ✓" : "Guardar cambios"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <Palette className="h-4 w-4" /> Apariencia
          </h2>
          <p className="mb-3 text-sm text-muted">Color principal de la aplicación</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(THEMES) as ThemeColor[]).map((key) => {
              const active = settings.themeColor === key;
              return (
                <button
                  key={key}
                  onClick={() => updateSettings({ themeColor: key })}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-muted hover:bg-surface-2"
                  )}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: `rgb(${THEMES[key].light.primary})` }}
                  />
                  {THEME_LABELS[key]}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-4 py-3">
            <div className="flex items-center gap-2">
              {settings.darkMode ? <Moon className="h-4 w-4 text-muted" /> : <Sun className="h-4 w-4 text-muted" />}
              <span className="text-sm font-medium text-foreground">Modo oscuro</span>
            </div>
            <button
              onClick={() => updateSettings({ darkMode: !settings.darkMode })}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                settings.darkMode ? "bg-primary" : "bg-surface-2"
              )}
              aria-label="Alternar modo oscuro"
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  settings.darkMode ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4" /> Seguridad
          </h2>
          {settings.pinHash ? (
            <div className="space-y-3">
              <p className="text-sm text-success">PIN de acceso activado ✓</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
                  Cambiar PIN
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmRemovePin(true)}>
                  Quitar PIN
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Protege la app con un PIN de acceso. Te lo pedirá cada vez que la abras.
              </p>
              <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
                <Lock className="h-4 w-4" /> Configurar PIN
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Datos</h2>
          <p className="mb-4 text-sm text-muted">
            Tus datos se guardan en este dispositivo. Haz una copia de seguridad con frecuencia.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}>
              <Download className="h-4 w-4" /> Exportar respaldo
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar respaldo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
          {message && <p className="mt-3 text-sm text-primary">{message}</p>}

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setConfirmExample(true)}>
                <Sparkles className="h-4 w-4" /> Cargar datos de ejemplo
              </Button>
              <Button variant="outline" onClick={() => setConfirmReset(true)}>
                <Trash2 className="h-4 w-4" /> Borrar todos los datos
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Instalar en la tablet</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Abre esta app en Chrome en tu tablet Android.</li>
            <li>Toca el menú (⋮) de Chrome.</li>
            <li>Selecciona <span className="font-medium text-foreground">"Instalar aplicación"</span> o "Añadir a pantalla de inicio".</li>
            <li>Termuxtienda se abrirá como una app a pantalla completa.</li>
          </ol>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Borrar todos los datos"
        description="Se eliminarán productos, clientes, ventas, abonos y compras de este dispositivo. Esta acción no se puede deshacer."
        onConfirm={resetData}
      />
      <ConfirmDialog
        open={confirmExample}
        onClose={() => setConfirmExample(false)}
        title="Cargar datos de ejemplo"
        description="Se reemplazarán tus datos actuales por un conjunto de ejemplo para probar la app. ¿Continuar?"
        confirmLabel="Cargar ejemplo"
        danger={false}
        onConfirm={loadExampleData}
      />
      <PinModal
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        title={settings.pinHash ? "Cambiar PIN" : "Configurar PIN"}
        onSave={savePin}
      />
      <ConfirmDialog
        open={confirmRemovePin}
        onClose={() => setConfirmRemovePin(false)}
        title="Quitar PIN"
        description="Se desactivará la protección con PIN de esta app. ¿Continuar?"
        onConfirm={() => {
          updateSettings({ pinHash: undefined });
          setConfirmRemovePin(false);
        }}
      />
    </div>
  );
}

function PinModal({
  open,
  onClose,
  onSave,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (pin: string) => Promise<void>;
  title: string;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const valid = isValidPin(pin) && pin === confirm;

  const submit = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await onSave(pin);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button disabled={!valid || saving} onClick={() => void submit()}>
            {saving ? "Guardando…" : "Guardar PIN"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Elige un PIN de 4 a 6 dígitos para proteger la app en este dispositivo.
        </p>
        <Field label="Nuevo PIN" required>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••"
            className="text-center text-xl tracking-[0.4em]"
          />
        </Field>
        <Field label="Confirmar PIN" required>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••"
            className="text-center text-xl tracking-[0.4em]"
          />
        </Field>
        {pin.length > 0 && !isValidPin(pin) && (
          <p className="text-sm text-danger">El PIN debe tener de 4 a 6 dígitos.</p>
        )}
        {isValidPin(pin) && confirm.length > 0 && pin !== confirm && (
          <p className="text-sm text-danger">Los PIN no coinciden.</p>
        )}
        {saveError && (
          <p className="text-sm text-danger">No se pudo guardar el PIN en este dispositivo.</p>
        )}
      </div>
    </Modal>
  );
}
