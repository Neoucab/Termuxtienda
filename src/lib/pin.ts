/**
 * Credencial local del PIN de acceso.
 *
 * Las credenciales nuevas son PBKDF2-HMAC-SHA-256 sobre una sal aleatoria de 16
 * bytes por tienda y se guardan en un formato autocontenido que incluye el
 * algoritmo, las iteraciones, la sal y el valor derivado:
 *
 *     pbkdf2$<iteraciones>$<sal-base64>$<hash-base64>
 *
 * Sigue siendo una barrera de acceso casual en la tablet del negocio (no cifra
 * los datos en reposo ni protege frente a alguien con las herramientas de
 * desarrollo abiertas).
 */

/** Parámetros del KDF que usan las credenciales nuevas. */
export const PIN_KDF = {
  algorithm: "PBKDF2",
  hash: "SHA-256",
  iterations: 210_000,
  derivedBits: 256,
  saltBytes: 16,
} as const;

/** Subconjunto de WebCrypto que necesita el PIN (inyectable en las pruebas). */
export type PinSubtle = Pick<SubtleCrypto, "importKey" | "deriveBits">;

export interface DerivePinOptions {
  /** Sal de 16 bytes; por defecto se genera aleatoriamente. */
  salt?: Uint8Array;
  /** Iteraciones de PBKDF2; por defecto `PIN_KDF.iterations`. */
  iterations?: number;
  /** Primitiva de derivación; por defecto la de la plataforma. */
  subtle?: PinSubtle;
}

export type PinVerifyResult =
  | { readonly ok: true; readonly upgraded?: string }
  | { readonly ok: false; readonly reason: "mismatch" | "malformed" | "crypto-unavailable" };

/** La plataforma no ofrece la primitiva de derivación (contexto no seguro). */
export class PinCryptoUnavailableError extends Error {
  constructor(message = "Este dispositivo no permite procesar el PIN.") {
    super(message);
    this.name = "PinCryptoUnavailableError";
  }
}

/** Etiqueta del formato derivado; lo que no empiece por aquí es heredado. */
const CREDENTIAL_TAG = "pbkdf2";
const CREDENTIAL_PREFIX = `${CREDENTIAL_TAG}$`;
/** Cota superior del contador de iteraciones aceptado al parsear. */
const MAX_ITERATIONS = 10_000_000;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

interface ParsedCredential {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function resolveSubtle(subtle: PinSubtle | undefined): PinSubtle {
  const primitive = subtle ?? (globalThis.crypto?.subtle as PinSubtle | undefined);
  if (!primitive || typeof primitive.importKey !== "function" || typeof primitive.deriveBits !== "function") {
    throw new PinCryptoUnavailableError();
  }
  return primitive;
}

function randomSalt(): Uint8Array {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) throw new PinCryptoUnavailableError();
  const salt = new Uint8Array(PIN_KDF.saltBytes);
  source.getRandomValues(salt);
  return salt;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 !== 0 || !BASE64_RE.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Compara dos derivaciones sin cortocircuitar (evita filtrar por tiempo). */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePinBytes(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  subtle: PinSubtle | undefined
): Promise<Uint8Array> {
  try {
    const primitive = resolveSubtle(subtle);
    // Copia a un búfer propio: `BufferSource` no admite `SharedArrayBuffer`.
    const saltBytes: BufferSource = Uint8Array.from(salt);
    const key = await primitive.importKey(
      "raw",
      new TextEncoder().encode(pin),
      { name: PIN_KDF.algorithm },
      false,
      ["deriveBits"]
    );
    const bits = await primitive.deriveBits(
      { name: PIN_KDF.algorithm, salt: saltBytes, iterations, hash: PIN_KDF.hash },
      key,
      PIN_KDF.derivedBits
    );
    return new Uint8Array(bits);
  } catch (error) {
    if (error instanceof PinCryptoUnavailableError) throw error;
    // Cualquier fallo de la primitiva se trata como plataforma no disponible:
    // nunca se escribe ni se acepta una credencial bajo una primitiva degradada.
    throw new PinCryptoUnavailableError();
  }
}

function parseCredential(stored: string): ParsedCredential | null {
  const parts = stored.split("$");
  if (parts.length !== 4) return null;
  const [tag, iterationsRaw, saltRaw, hashRaw] = parts;
  if (tag !== CREDENTIAL_TAG) return null;
  if (!/^[1-9]\d*$/.test(iterationsRaw)) return null;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations > MAX_ITERATIONS) return null;
  const salt = decodeBase64(saltRaw);
  const hash = decodeBase64(hashRaw);
  if (!salt || salt.length !== PIN_KDF.saltBytes) return null;
  if (!hash || hash.length !== PIN_KDF.derivedBits / 8) return null;
  return { iterations, salt, hash };
}

/**
 * Deriva la credencial del PIN en el formato autocontenido `pbkdf2$…`.
 * Lanza `PinCryptoUnavailableError` si no hay primitiva de derivación.
 */
export async function hashPin(pin: string, options: DerivePinOptions = {}): Promise<string> {
  const iterations = options.iterations ?? PIN_KDF.iterations;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new RangeError("El contador de iteraciones está fuera de rango.");
  }
  const salt = options.salt ?? randomSalt();
  if (salt.length !== PIN_KDF.saltBytes) {
    throw new RangeError(`La sal debe tener ${PIN_KDF.saltBytes} bytes.`);
  }
  const derived = await derivePinBytes(pin, salt, iterations, options.subtle);
  return `${CREDENTIAL_TAG}$${iterations}$${encodeBase64(salt)}$${encodeBase64(derived)}`;
}

/**
 * Comprueba el PIN contra la credencial almacenada.
 * Devuelve `upgraded` cuando la credencial era heredada y se pudo mejorar.
 */
export async function verifyPin(
  pin: string,
  stored: string,
  options: { subtle?: PinSubtle } = {}
): Promise<PinVerifyResult> {
  if (isLegacyPinCredential(stored)) {
    if (!verifyLegacyPin(pin, stored)) return { ok: false, reason: "mismatch" };
    try {
      return { ok: true, upgraded: await hashPin(pin, options) };
    } catch {
      // Sin primitiva disponible la credencial heredada sigue siendo válida:
      // se desbloquea, pero no se escribe una credencial degradada.
      return { ok: true };
    }
  }

  const parsed = parseCredential(stored);
  if (!parsed) return { ok: false, reason: "malformed" };
  if (!isValidPin(pin)) return { ok: false, reason: "mismatch" };

  try {
    const derived = await derivePinBytes(pin, parsed.salt, parsed.iterations, options.subtle);
    return equalBytes(derived, parsed.hash) ? { ok: true } : { ok: false, reason: "mismatch" };
  } catch {
    return { ok: false, reason: "crypto-unavailable" };
  }
}

/** `true` cuando el valor guardado no es una credencial derivada. */
export function isLegacyPinCredential(stored: string): boolean {
  return !stored.startsWith(CREDENTIAL_PREFIX);
}

/**
 * Hash heredado (cyrb53) del formato anterior, sin sal.
 * @deprecated Solo verificación de credenciales heredados; se elimina cuando
 * ninguna tienda conserve credenciales de ese formato.
 */
export function verifyLegacyPin(pin: string, stored: string): boolean {
  return legacyCyrb53(pin) === stored;
}

function legacyCyrb53(pin: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < pin.length; i++) {
    const ch = pin.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Espera antes de permitir el siguiente intento: 1s, 2s, 4s… con tope de 30s.
 * Función pura para poder probarla sin temporizadores.
 */
export function lockoutDelayMs(failures: number): number {
  if (!Number.isFinite(failures) || failures < 1) return 0;
  return Math.min(1000 * 2 ** (failures - 1), 30_000);
}

/** Valida que el PIN tenga de 4 a 6 dígitos. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
