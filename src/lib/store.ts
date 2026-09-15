import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CajaCierre,
  Client,
  PayCurrency,
  Payment,
  Product,
  Purchase,
  ReturnRecord,
  Sale,
  Settings,
} from "./types";
import { endOfDay, startOfDay, uid } from "./format";
import { exampleData } from "./seed";
import { clientDebt } from "./selectors";
import { THEMES } from "./theme";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Termuxtienda",
  currency: "$",
  themeColor: "verde",
  darkMode: false,
};

export interface AddSaleInput {
  items: Sale["items"];
  total: number;
  paymentType: Sale["paymentType"];
  clientId?: string;
  note?: string;
  payCurrency?: PayCurrency;
  payRate?: number;
  payBsAmount?: number;
}

interface AppState {
  products: Product[];
  clients: Client[];
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  returns: ReturnRecord[];
  cajaCierres: CajaCierre[];
  settings: Settings;

  addProduct: (p: Omit<Product, "id" | "createdAt">) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addClient: (c: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  /** Devuelve false si el cliente no existe o tiene deuda pendiente. */
  deleteClient: (id: string) => boolean;

  addSale: (input: AddSaleInput) => Sale;
  addPayment: (p: Omit<Payment, "id" | "date">) => void;
  addPurchase: (input: Omit<Purchase, "id" | "date" | "total">) => void;
  addReturn: (input: { saleId: string; items: Sale["items"]; reason?: string }) => ReturnRecord | null;
  closeCaja: () => CajaCierre | null;

  updateSettings: (patch: Partial<Settings>) => void;
  resetData: () => void;
  loadExampleData: () => void;
  importData: (json: string) => boolean;
}

/** Subconjunto de datos que se persiste en localStorage (sin las acciones). */
export interface PersistedData {
  products: Product[];
  clients: Client[];
  sales: Sale[];
  payments: Payment[];
  purchases: Purchase[];
  returns: ReturnRecord[];
  cajaCierres: CajaCierre[];
  settings: Settings;
}

const initialState = {
  products: [] as Product[],
  clients: [] as Client[],
  sales: [] as Sale[],
  payments: [] as Payment[],
  purchases: [] as Purchase[],
  returns: [] as ReturnRecord[],
  cajaCierres: [] as CajaCierre[],
  settings: DEFAULT_SETTINGS,
};

/**
 * Comprueba que `localStorage` sea legible y escribible (modo privado, permisos
 * restringidos, cuota agotada). Si no se puede usar, la app falla cerrado.
 */
export function isStorageAvailable(): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const probe = "termuxtienda-storage-probe";
    storage.setItem(probe, "1");
    const ok = storage.getItem(probe) === "1";
    storage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

/** Migra estados persistidos de versiones anteriores al esquema actual (v2). */
export function migrateState(persisted: unknown, _version: number): PersistedData {
  const s = (persisted ?? {}) as Partial<PersistedData>;
  return {
    products: Array.isArray(s.products) ? s.products : [],
    clients: Array.isArray(s.clients) ? s.clients : [],
    sales: Array.isArray(s.sales) ? s.sales : [],
    payments: Array.isArray(s.payments)
      ? s.payments.map((p) => ({ ...p, kind: p.kind ?? "abono", currency: p.currency ?? "usd" }))
      : [],
    purchases: Array.isArray(s.purchases) ? s.purchases : [],
    returns: Array.isArray(s.returns) ? s.returns : [],
    cajaCierres: Array.isArray(s.cajaCierres) ? s.cajaCierres : [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
  };
}

export const useApp = create<AppState>()(
  persist<AppState, [], [], PersistedData>(
    (set, get) => ({
      ...initialState,

      addProduct: (p) =>
        set((s) => ({ products: [...s.products, { ...p, id: uid(), createdAt: Date.now() }] })),
      updateProduct: (id, patch) =>
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addClient: (c) => {
        const client: Client = { ...c, id: uid(), createdAt: Date.now() };
        set((s) => ({ clients: [...s.clients, client] }));
        return client;
      },
      updateClient: (id, patch) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteClient: (id) => {
        const { clients, sales, payments } = get();
        const client = clients.find((c) => c.id === id);
        if (!client) return false;
        // No permitir borrar clientes con deuda pendiente (quedaría incobrable).
        if (clientDebt(sales, payments, id) > 0.004) return false;
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
        return true;
      },

      addSale: (input) => {
        const { products, sales } = get();
        const number = sales.reduce((m, s) => Math.max(m, s.number), 0) + 1;
        const now = Date.now();
        // Recalcula el total desde los items (el caller no es fuente de verdad).
        const total = input.items.reduce((acc, i) => acc + i.price * i.qty, 0);
        const sale: Sale = { id: uid(), number, date: now, ...input, total };
        const updated = products.map((p) => {
          const item = input.items.find((i) => i.productId === p.id);
          return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
        });

        // El saldo a favor del cliente se aplica solo en el cálculo derivado
        // (clientBalance = crédito − pagos); NO se materializa como un pago,
        // de lo contrario se descontaría dos veces.
        set({
          sales: [...sales, sale],
          products: updated,
        });
        return sale;
      },

      addPayment: (p) =>
        set((s) => ({
          payments: [
            ...s.payments,
            { ...p, id: uid(), date: Date.now(), kind: p.kind ?? "abono", currency: p.currency ?? "usd" },
          ],
        })),

      addPurchase: (input) => {
        const { products, purchases } = get();
        const total = input.items.reduce((acc, i) => acc + i.qty * i.unitCost, 0);
        const updated = products.map((p) => {
          const item = input.items.find((i) => i.productId === p.id);
          return item ? { ...p, stock: p.stock + item.qty, cost: item.unitCost } : p;
        });
        set({
          purchases: [...purchases, { ...input, id: uid(), date: Date.now(), total }],
          products: updated,
        });
      },

      addReturn: (input) => {
        const { sales, products } = get();
        const sale = sales.find((s) => s.id === input.saleId);
        if (!sale) return null;

        // Validar que los artículos pertenezcan a la venta y no excedan lo vendido.
        for (const ret of input.items) {
          const sold = sale.items.find((i) => i.productId === ret.productId);
          if (!sold || ret.qty <= 0 || ret.qty > sold.qty) return null;
        }

        const now = Date.now();
        // Usa el precio real de la venta, no el que pueda traer el caller.
        const returnTotal = input.items.reduce((acc, ret) => {
          const sold = sale.items.find((i) => i.productId === ret.productId);
          return acc + (sold ? sold.price : 0) * ret.qty;
        }, 0);

        // Restaura stock.
        const updatedProducts = products.map((p) => {
          const item = input.items.find((i) => i.productId === p.id);
          return item ? { ...p, stock: p.stock + item.qty } : p;
        });

        // Quita los artículos devueltos y recalcula el total desde los restantes,
        // así la deuda del cliente se reduce correctamente.
        const updatedSales = sales.map((s) => {
          if (s.id !== sale.id) return s;
          const items = s.items
            .map((item) => {
              const ret = input.items.find((r) => r.productId === item.productId);
              return ret ? { ...item, qty: item.qty - ret.qty } : item;
            })
            .filter((i) => i.qty > 0);
          const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);
          return { ...s, items, total };
        });

        const record: ReturnRecord = {
          id: uid(),
          saleId: sale.id,
          saleNumber: sale.number,
          clientId: sale.clientId,
          date: now,
          items: input.items,
          total: returnTotal,
          reason: input.reason?.trim() || undefined,
        };

        set({
          sales: updatedSales,
          products: updatedProducts,
          returns: [...get().returns, record],
        });
        return record;
      },

      closeCaja: () => {
        const { sales, payments, cajaCierres } = get();
        const dayStart = startOfDay();
        // Un solo cierre por día.
        if (cajaCierres.some((c) => c.date === dayStart)) return null;
        const dayEnd = endOfDay();
        const today = sales.filter((s) => s.date >= dayStart && s.date <= dayEnd);
        const contadoTotal = today.filter((s) => s.paymentType === "contado").reduce((a, s) => a + s.total, 0);
        const creditoTotal = today.filter((s) => s.paymentType === "credito").reduce((a, s) => a + s.total, 0);
        const cobrosTotal = payments
          .filter((p) => p.kind !== "saldo" && p.date >= dayStart && p.date <= dayEnd)
          .reduce((a, p) => a + p.amount, 0);
        const contadoBsTotal = today
          .filter((s) => s.paymentType === "contado" && s.payCurrency === "bs")
          .reduce((a, s) => a + (s.payBsAmount ?? 0), 0);
        const cobrosBsTotal = payments
          .filter((p) => p.kind !== "saldo" && p.currency === "bs" && p.date >= dayStart && p.date <= dayEnd)
          .reduce((a, p) => a + (p.bsAmount ?? 0), 0);

        const cierre: CajaCierre = {
          id: uid(),
          date: dayStart,
          createdAt: Date.now(),
          ventaCount: today.length,
          contadoTotal,
          creditoTotal,
          cobrosTotal,
          cajaEsperada: contadoTotal + cobrosTotal,
          contadoBs: contadoBsTotal,
          cobrosBs: cobrosBsTotal,
        };
        set({ cajaCierres: [...cajaCierres, cierre] });
        return cierre;
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetData: () => set({ ...initialState, settings: { ...DEFAULT_SETTINGS } }),
      loadExampleData: () =>
        set((s) => ({
          ...exampleData(),
          returns: [],
          cajaCierres: [],
          settings: s.settings,
        })),

      importData: (json) => {
        try {
          const data = JSON.parse(json) as Record<string, unknown>;
          if (!data || typeof data !== "object") return false;
          const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
          if (!isArr(data.products) || !isArr(data.clients)) return false;

          const rawSettings =
            typeof data.settings === "object" && data.settings !== null
              ? (data.settings as Partial<Settings>)
              : {};
          const validColors = Object.keys(THEMES);
          const themeColor = validColors.includes(String(rawSettings.themeColor))
            ? (rawSettings.themeColor as Settings["themeColor"])
            : DEFAULT_SETTINGS.themeColor;
          // Un respaldo nunca instala ni reemplaza la credencial del PIN: se
          // descarta la importada y se conserva la del propio dispositivo.
          const { pinHash: _importedCredential, ...importedSettings } = rawSettings;
          const localPinHash = get().settings.pinHash;

          set({
            products: data.products as Product[],
            clients: data.clients as Client[],
            sales: isArr(data.sales) ? (data.sales as Sale[]) : [],
            payments: isArr(data.payments) ? (data.payments as Payment[]) : [],
            purchases: isArr(data.purchases) ? (data.purchases as Purchase[]) : [],
            returns: isArr(data.returns) ? (data.returns as ReturnRecord[]) : [],
            cajaCierres: isArr(data.cajaCierres) ? (data.cajaCierres as CajaCierre[]) : [],
            settings: {
              ...DEFAULT_SETTINGS,
              ...importedSettings,
              themeColor,
              ...(localPinHash === undefined ? {} : { pinHash: localPinHash }),
            },
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    { name: "termuxtienda-store", version: 2, migrate: migrateState }
  )
);
