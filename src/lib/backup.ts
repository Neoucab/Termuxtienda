import type { PersistedData } from "./store";
import type {
  CajaCierre,
  Client,
  Payment,
  Product,
  Purchase,
  ReturnRecord,
  Sale,
  Settings,
} from "./types";

/**
 * Ajustes que sí viajan en un respaldo exportado.
 * La credencial del PIN (y su sal, embebida en el valor) queda fuera por tipo.
 */
export type ExportableSettings = Omit<Settings, "pinHash">;

export interface BackupPayload {
  products: Product[];
  clients: Client[];
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  returns: ReturnRecord[];
  cajaCierres: CajaCierre[];
  settings: ExportableSettings;
  exportedAt: string;
}

/** Construye el respaldo exportable: nunca incluye el credencial del PIN. */
export function buildBackupPayload(
  state: PersistedData,
  exportedAt: string = new Date().toISOString()
): BackupPayload {
  // Se omite la credencial de forma explícita: `settings` no tiene ese campo.
  const { pinHash: _omittedCredential, ...settings } = state.settings;
  return {
    products: state.products,
    clients: state.clients,
    sales: state.sales,
    payments: state.payments,
    purchases: state.purchases,
    returns: state.returns,
    cajaCierres: state.cajaCierres,
    settings,
    exportedAt,
  };
}
