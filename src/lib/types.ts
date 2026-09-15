export type ID = string;

/** Redes sociales donde se puede publicar un producto. */
export type SocialNetwork = "instagram" | "whatsapp";

export interface Product {
  id: ID;
  name: string;
  category: string;
  size?: string;
  color?: string;
  sku?: string;
  /** Costo de compra por unidad. */
  cost: number;
  /** Precio de venta por unidad. */
  price: number;
  stock: number;
  minStock: number;
  /** Imagen del producto (data URL comprimida). */
  image?: string;
  /** Redes donde ya se publicó (timestamp de publicación). */
  published?: Partial<Record<SocialNetwork, number>>;
  createdAt: number;
}

export interface Client {
  id: ID;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: number;
}

export interface SaleItem {
  productId: ID;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export type PaymentType = "contado" | "credito";

/** Moneda de un pago: USD (moneda base) o bolívares (Bs). */
export type PayCurrency = "usd" | "bs";

export interface Sale {
  id: ID;
  number: number;
  date: number;
  clientId?: ID;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType;
  note?: string;
  /** Moneda en la que pagó (venta de contado). */
  payCurrency?: PayCurrency;
  /** Monto original en bolívares (cuando payCurrency === "bs"). */
  payBsAmount?: number;
  /** Tasa BCV (Bs por USD) usada (cuando payCurrency === "bs"). */
  payRate?: number;
}

/** Abono a una cuenta por cobrar. */
export interface Payment {
  id: ID;
  clientId: ID;
  /** Monto en USD (moneda base) que reduce la deuda. */
  amount: number;
  date: number;
  note?: string;
  /** "abono" = dinero recibido; "saldo" = saldo a favor aplicado automáticamente. */
  kind?: "abono" | "saldo";
  /** Moneda en la que pagó el cliente. */
  currency?: PayCurrency;
  /** Monto original en bolívares (cuando currency === "bs"). */
  bsAmount?: number;
  /** Tasa BCV (Bs por USD) usada al pagar (cuando currency === "bs"). */
  rate?: number;
}

/** Devolución de productos de una venta. */
export interface ReturnRecord {
  id: ID;
  saleId: ID;
  saleNumber: number;
  clientId?: ID;
  date: number;
  items: SaleItem[];
  total: number;
  reason?: string;
}

/** Cierre de caja del día. */
export interface CajaCierre {
  id: ID;
  /** Fecha (inicio del día) a la que corresponde. */
  date: number;
  createdAt: number;
  ventaCount: number;
  contadoTotal: number;
  creditoTotal: number;
  cobrosTotal: number;
  /** Efectivo esperado en caja = contado + cobros. */
  cajaEsperada: number;
  /** Contado recibido en bolívares (monto original en Bs). */
  contadoBs?: number;
  /** Cobros (abonos) recibidos en bolívares (monto original en Bs). */
  cobrosBs?: number;
}

export interface PurchaseItem {
  productId?: ID;
  name: string;
  qty: number;
  unitCost: number;
}

export interface Purchase {
  id: ID;
  date: number;
  supplier?: string;
  items: PurchaseItem[];
  total: number;
  note?: string;
}

export type ThemeColor = "verde" | "azul" | "morado" | "naranja" | "rosa";

export interface Settings {
  storeName: string;
  currency: string;
  /** Tasa BCV actual: bolívares por 1 dólar. */
  bcvRate?: number;
  /**
   * Credencial del PIN de acceso, derivada y autocontenida
   * (`pbkdf2$<iteraciones>$<sal-base64>$<hash-base64>`). El PIN nunca se guarda
   * en claro y esta credencial no se incluye en los respaldos exportados.
   */
  pinHash?: string;
  themeColor: ThemeColor;
  darkMode: boolean;
}
