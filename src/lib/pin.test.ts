import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PIN_KDF,
  PinCryptoUnavailableError,
  hashPin,
  isLegacyPinCredential,
  isValidPin,
  lockoutDelayMs,
  verifyLegacyPin,
  verifyPin,
  type PinSubtle,
} from "./pin";

/**
 * Credenciales heredadas (cyrb53, formato antiguo) congeladas como valores de
 * referencia: si el algoritmo heredado cambia, estos tests fallan y avisan de
 * que las tiendas ya instaladas quedarían sin poder desbloquearse.
 */
const LEGACY_1234 = "1pekp8kgg2q";
const LEGACY_5678 = "1vgaewyvbv2";

/** Iteraciones bajas para que las derivaciones de prueba sean rápidas. */
const FAST_ITERATIONS = 1000;

/** Primitiva real de la plataforma (medida presente en ambos entornos de Vitest). */
const platformCrypto = globalThis.crypto;
const platformSubtle = platformCrypto.subtle as PinSubtle;

/** Sal fija de 16 bytes para las pruebas que necesitan determinismo. */
function fixedSalt(fill: number): Uint8Array {
  return new Uint8Array(PIN_KDF.saltBytes).fill(fill);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hashPin", () => {
  it("deriva una credencial autocontenida y no guarda el PIN en claro", async () => {
    const credential = await hashPin("1234");

    // pbkdf2$<iteraciones>$<sal-b64 16 bytes>$<hash-b64 32 bytes>
    expect(credential).toMatch(/^pbkdf2\$210000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
    expect(PIN_KDF.iterations).toBe(210_000);
    expect(PIN_KDF.saltBytes).toBe(16);
    expect(PIN_KDF.derivedBits).toBe(256);
    expect(credential).not.toBe("1234");
    expect(credential).not.toContain("1234");
  });

  it("usa una sal nueva en cada credencial y respeta la sal inyectada", async () => {
    const first = await hashPin("1234", { iterations: FAST_ITERATIONS });
    const second = await hashPin("1234", { iterations: FAST_ITERATIONS });

    // Misma tienda, mismo PIN, credenciales distintas: la sal es aleatoria.
    expect(first).not.toBe(second);

    const salt = fixedSalt(7);
    const third = await hashPin("1234", { salt, iterations: FAST_ITERATIONS });
    const fourth = await hashPin("1234", { salt, iterations: FAST_ITERATIONS });
    expect(third).toBe(fourth);
    expect(third).not.toBe(first);
  });
});

describe("verifyPin", () => {
  it("acepta el PIN correcto y rechaza cualquier otro", async () => {
    const credential = await hashPin("1234", { salt: fixedSalt(1), iterations: FAST_ITERATIONS });

    expect(await verifyPin("1234", credential, { subtle: platformSubtle })).toEqual({ ok: true });
    expect(await verifyPin("1235", credential, { subtle: platformSubtle })).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(await verifyPin("", credential, { subtle: platformSubtle })).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(await verifyPin("12345", credential, { subtle: platformSubtle })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("cada credencial verifica solo su propio PIN", async () => {
    const storeA = await hashPin("1234", { iterations: FAST_ITERATIONS });
    const storeB = await hashPin("1234", { iterations: FAST_ITERATIONS });

    expect(storeA).not.toBe(storeB);
    expect(await verifyPin("1234", storeA)).toEqual({ ok: true });
    expect(await verifyPin("1234", storeB)).toEqual({ ok: true });
    expect(await verifyPin("5678", storeA)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("marca como mal formada cualquier credencial derivada que no se pueda parsear", async () => {
    const salt = "AAAAAAAAAAAAAAAAAAAAAA==";
    const hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const malformed = [
      `pbkdf2$0$${salt}$${hash}`,
      `pbkdf2$01000$${salt}$${hash}`,
      `pbkdf2$10000001$${salt}$${hash}`,
      `pbkdf2$abc$${salt}$${hash}`,
      `pbkdf2$1000$no-es-base64!$${hash}`,
      `pbkdf2$1000$${salt}$no-es-base64!`,
      `pbkdf2$1000$${salt}$AAAA`,
      `pbkdf2$1000$${salt}`,
      `pbkdf2$1000$${salt}$${hash}$extra`,
      `pbkdf2$1000$${salt}$${hash.slice(0, 20)}`,
    ];

    for (const stored of malformed) {
      expect(await verifyPin("1234", stored)).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("informa cuando la primitiva criptográfica no está disponible", async () => {
    const credential = await hashPin("1234", { salt: fixedSalt(2), iterations: FAST_ITERATIONS });
    // Contexto no seguro (http://) o WebView antiguo: no existe `crypto.subtle`.
    vi.stubGlobal("crypto", undefined);

    expect(await verifyPin("1234", credential)).toEqual({
      ok: false,
      reason: "crypto-unavailable",
    });
    await expect(hashPin("1234")).rejects.toBeInstanceOf(PinCryptoUnavailableError);
    // La credencial heredada se verifica sin primitiva, pero no se puede mejorar.
    expect(await verifyPin("1234", LEGACY_1234)).toEqual({ ok: true });
    expect(await verifyPin("1235", LEGACY_1234)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("propaga el fallo de una primitiva que rechaza", async () => {
    const failing: PinSubtle = {
      importKey: () => Promise.reject(new Error("sin WebCrypto")),
      deriveBits: () => Promise.reject(new Error("sin WebCrypto")),
    };
    const credential = await hashPin("1234", { salt: fixedSalt(3), iterations: FAST_ITERATIONS });

    expect(await verifyPin("1234", credential, { subtle: failing })).toEqual({
      ok: false,
      reason: "crypto-unavailable",
    });
    await expect(hashPin("1234", { subtle: failing })).rejects.toBeInstanceOf(
      PinCryptoUnavailableError
    );
  });

  it("usa las primitivas de la plataforma cuando no se inyecta ninguna", async () => {
    const calls = { importKey: 0, deriveBits: 0 };
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => platformCrypto.getRandomValues(bytes),
      subtle: {
        importKey: (...args: Parameters<PinSubtle["importKey"]>) => {
          calls.importKey += 1;
          return platformCrypto.subtle.importKey(...args);
        },
        deriveBits: (...args: Parameters<PinSubtle["deriveBits"]>) => {
          calls.deriveBits += 1;
          return platformCrypto.subtle.deriveBits(...args);
        },
      },
    });

    const credential = await hashPin("1234", { iterations: FAST_ITERATIONS });

    expect(credential).toMatch(/^pbkdf2\$1000\$/);
    expect(calls.importKey).toBe(1);
    expect(calls.deriveBits).toBe(1);
    expect(await verifyPin("1234", credential)).toEqual({ ok: true });
  });
});

describe("credenciales heredadas", () => {
  it("reconoce el formato heredado por su prefijo", async () => {
    expect(isLegacyPinCredential(LEGACY_1234)).toBe(true);
    expect(isLegacyPinCredential(LEGACY_5678)).toBe(true);
    expect(isLegacyPinCredential("")).toBe(true);
    expect(isLegacyPinCredential(await hashPin("1234", { iterations: FAST_ITERATIONS }))).toBe(false);
  });

  it("verifica el PIN de una credencial heredada sin poder derivarla", () => {
    expect(verifyLegacyPin("1234", LEGACY_1234)).toBe(true);
    expect(verifyLegacyPin("1235", LEGACY_1234)).toBe(false);
    expect(verifyLegacyPin("1234", LEGACY_5678)).toBe(false);
  });

  it("mejora la credencial heredada al verificar el PIN correcto", async () => {
    const result = await verifyPin("1234", LEGACY_1234);

    expect(result.ok).toBe(true);
    expect(result.ok && result.upgraded).toMatch(/^pbkdf2\$210000\$/);
    expect(verifyLegacyPin("1234", LEGACY_1234)).toBe(true);
  });

  it("no toca la credencial heredada cuando el PIN es incorrecto", async () => {
    expect(await verifyPin("9999", LEGACY_1234, { subtle: platformSubtle })).toEqual({
      ok: false,
      reason: "mismatch",
    });
    // El valor almacenado sigue siendo byte a byte el mismo y sigue siendo válido.
    expect(LEGACY_1234).toBe("1pekp8kgg2q");
    expect(verifyLegacyPin("1234", LEGACY_1234)).toBe(true);
  });
});

describe("lockoutDelayMs", () => {
  it("escala 1s → 2s → 4s … con tope de 30s", () => {
    const table: Array<[number, number]> = [
      [0, 0],
      [-3, 0],
      [1, 1000],
      [2, 2000],
      [3, 4000],
      [4, 8000],
      [5, 16000],
      [6, 30000],
      [7, 30000],
      [20, 30000],
    ];

    for (const [failures, expected] of table) {
      expect(lockoutDelayMs(failures)).toBe(expected);
    }
    expect(lockoutDelayMs(Number.NaN)).toBe(0);
  });
});

describe("isValidPin", () => {
  it("acepta de 4 a 6 dígitos", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
  });

  it("rechaza otros valores", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});
