// @vitest-environment jsdom
import "../test/setup.dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import LockScreen from "./LockScreen";
import { hashPin, type PinSubtle } from "../lib/pin";
import { DEFAULT_SETTINGS, useApp } from "../lib/store";
import setupSource from "../test/setup.ts?raw";
import viteConfigSource from "../../vite.config.ts?raw";

const PIN = "1234";
const WRONG_PIN = "9999";
/** Iteraciones bajas: la derivación real de prueba debe ser rápida. */
const FAST_ITERATIONS = 1000;
/** Credencial heredada (cyrb53) del PIN "1234". */
const LEGACY_CREDENTIAL = "1pekp8kgg2q";
/** Credencial válida para las primitivas simuladas (sal y hash en cero). */
const ZERO_CREDENTIAL = `pbkdf2$${FAST_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

/** Primitiva real de la plataforma (presente también en el entorno jsdom). */
const realSubtle = globalThis.crypto.subtle as PinSubtle;

let credential = "";

/** Primitiva simulada: devuelve siempre el mismo byte como hash derivado. */
function stubSubtle(byte: number): PinSubtle {
  return {
    importKey: () => Promise.resolve({} as CryptoKey),
    deriveBits: () => Promise.resolve(new Uint8Array(32).fill(byte).buffer as ArrayBuffer),
  };
}

/** Primitiva simulada que resuelve de inmediato con un hash no coincidente. */
const rejectingStub = stubSubtle(0xff);

/** Primitiva simulada conmutable: permite encadenar fallo → éxito → fallo. */
function switchableSubtle(initialByte: number) {
  const state = { byte: initialByte };
  const subtle: PinSubtle = {
    importKey: () => Promise.resolve({} as CryptoKey),
    deriveBits: () => Promise.resolve(new Uint8Array(32).fill(state.byte).buffer as ArrayBuffer),
  };
  return {
    subtle,
    setHashByte: (byte: number) => {
      state.byte = byte;
    },
  };
}

/** Primitiva que no está disponible en la plataforma (contexto no seguro). */
const unavailableStub: PinSubtle = {
  importKey: () => Promise.reject(new Error("sin WebCrypto")),
  deriveBits: () => Promise.reject(new Error("sin WebCrypto")),
};

/** Primitiva que cuenta las llamadas y delega en la real. */
function countingSubtle(calls: { importKey: number; deriveBits: number }): PinSubtle {
  // Los `as` son necesarios porque `importKey` es una firma sobrecargada.
  const importKey = ((...args: Parameters<PinSubtle["importKey"]>) => {
    calls.importKey += 1;
    return realSubtle.importKey(...args);
  }) as PinSubtle["importKey"];
  const deriveBits = ((...args: Parameters<PinSubtle["deriveBits"]>) => {
    calls.deriveBits += 1;
    return realSubtle.deriveBits(...args);
  }) as PinSubtle["deriveBits"];
  return { importKey, deriveBits };
}

/** Primitiva que queda pendiente hasta que la prueba la libera. */
function deferredSubtle() {
  const gate: { release: (() => void) | null } = { release: null };
  const subtle: PinSubtle = {
    importKey: () =>
      new Promise<CryptoKey>((resolve) => {
        gate.release = () => resolve({} as CryptoKey);
      }),
    deriveBits: () => Promise.resolve(new ArrayBuffer(32)),
  };
  return { subtle, gate };
}

/** Fija el escenario del store: credencial (o ninguna) y ajustes por defecto. */
function setCredential(pinHash?: string) {
  useApp.setState({
    settings: { ...DEFAULT_SETTINGS, ...(pinHash === undefined ? {} : { pinHash }) },
  });
}

function pinInput(): HTMLInputElement {
  return screen.getByPlaceholderText("••••") as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /Entrar|Comprobando/ }) as HTMLButtonElement;
}

/** Envía un PIN y espera a que la verificación asíncrona llegue al DOM. */
async function submitPin(pin: string) {
  const input = pinInput();
  fireEvent.change(input, { target: { value: pin } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Avanza el reloj simulado para consumir la penalización. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeAll(async () => {
  credential = await hashPin(PIN, { iterations: FAST_ITERATIONS });
});

beforeEach(() => {
  vi.useRealTimers();
  setCredential();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LockScreen", () => {
  it("desbloquea con el PIN correcto y retira la pantalla de bloqueo", async () => {
    const onUnlock = vi.fn();
    setCredential(credential);
    render(
      <UnlockHarness
        subtle={realSubtle}
        onUnlock={onUnlock}
      />
    );

    await submitPin(PIN);

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("contenido protegido")).toBeTruthy();
    expect(screen.queryByPlaceholderText("••••")).toBeNull();
  });

  it("mantiene el contenido oculto y avisa en español cuando el PIN es incorrecto", async () => {
    const onUnlock = vi.fn();
    setCredential(credential);
    render(<LockScreen subtle={realSubtle} onUnlock={onUnlock} />);

    await submitPin(WRONG_PIN);

    await waitFor(() =>
      expect(screen.getByText("PIN incorrecto. Inténtalo de nuevo.")).toBeTruthy()
    );
    expect(onUnlock).not.toHaveBeenCalled();
    expect(pinInput().value).toBe("");
    // El bloqueo sigue disponible: el formulario continúa renderizado.
    expect(pinInput()).toBeTruthy();
  });
});

describe("LockScreen · intentos fallidos", () => {
  it("escala la espera con una cuenta atrás en español y deshabilita el envío", async () => {
    vi.useFakeTimers();
    const onUnlock = vi.fn();
    setCredential(ZERO_CREDENTIAL);
    render(<LockScreen subtle={rejectingStub} onUnlock={onUnlock} />);

    await submitPin(WRONG_PIN);

    expect(screen.getByRole("status").textContent).toContain("Demasiados intentos. Espera 1 s");
    expect(submitButton().disabled).toBe(true);
    expect(onUnlock).not.toHaveBeenCalled();

    await advance(1000);
    expect(screen.queryByRole("status")).toBeNull();
    expect(submitButton().disabled).toBe(false);

    await submitPin(WRONG_PIN);
    expect(screen.getByRole("status").textContent).toContain("Espera 2 s");

    await advance(2000);
    await submitPin(WRONG_PIN);
    expect(screen.getByRole("status").textContent).toContain("Espera 4 s");

    await advance(4000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("limpia la penalización al desbloquear y el siguiente fallo vuelve a 1 s", async () => {
    vi.useFakeTimers();
    const onUnlock = vi.fn();
    const { subtle, setHashByte } = switchableSubtle(0xff);
    setCredential(ZERO_CREDENTIAL);
    render(<LockScreen subtle={subtle} onUnlock={onUnlock} />);

    await submitPin(WRONG_PIN);
    expect(screen.getByRole("status").textContent).toContain("Espera 1 s");

    await advance(1000);
    // La primitiva empieza a coincidir con la credencial: el PIN correcto desbloquea.
    setHashByte(0x00);
    await submitPin(PIN);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();

    setHashByte(0xff);
    await submitPin(WRONG_PIN);
    expect(screen.getByRole("status").textContent).toContain("Espera 1 s");
  });

  it("deshabilita el envío y muestra «Comprobando…» mientras verifica", async () => {
    const { subtle, gate } = deferredSubtle();
    const onUnlock = vi.fn();
    setCredential(ZERO_CREDENTIAL);
    render(<LockScreen subtle={subtle} onUnlock={onUnlock} />);

    const input = pinInput();
    fireEvent.change(input, { target: { value: PIN } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });

    expect(submitButton().textContent).toContain("Comprobando…");
    expect(submitButton().disabled).toBe(true);
    expect(input.disabled).toBe(true);

    await act(async () => {
      gate.release?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});

describe("LockScreen · credenciales heredadas", () => {
  it("desbloquea y guarda la credencial derivada al verificar el PIN correcto", async () => {
    const onUnlock = vi.fn();
    setCredential(LEGACY_CREDENTIAL);
    render(<LockScreen subtle={realSubtle} onUnlock={onUnlock} />);

    await submitPin(PIN);

    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
    expect(useApp.getState().settings.pinHash).toMatch(/^pbkdf2\$210000\$/);
  });

  it("no toca la credencial heredada cuando el PIN es incorrecto", async () => {
    const onUnlock = vi.fn();
    setCredential(LEGACY_CREDENTIAL);
    render(<LockScreen subtle={realSubtle} onUnlock={onUnlock} />);

    await submitPin(WRONG_PIN);

    await waitFor(() =>
      expect(screen.getByText("PIN incorrecto. Inténtalo de nuevo.")).toBeTruthy()
    );
    expect(onUnlock).not.toHaveBeenCalled();
    expect(useApp.getState().settings.pinHash).toBe(LEGACY_CREDENTIAL);
  });
});

describe("LockScreen · seam de pruebas", () => {
  it("verifica a través de la primitiva inyectada", async () => {
    const calls = { importKey: 0, deriveBits: 0 };
    setCredential(credential);
    render(<LockScreen subtle={countingSubtle(calls)} onUnlock={vi.fn()} />);

    await submitPin(PIN);

    await waitFor(() => expect(calls.deriveBits).toBe(1));
    expect(calls.importKey).toBe(1);
  });

  it("se queda bloqueado con el aviso de criptografía cuando la primitiva falla", async () => {
    const onUnlock = vi.fn();
    setCredential(credential);
    render(<LockScreen subtle={unavailableStub} onUnlock={onUnlock} />);

    await submitPin(PIN);

    expect(screen.getByText(/no permite verificar el PIN/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText("••••")).toBeNull();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("no modifica el arnés compartido ni la configuración del runner", () => {
    expect(setupSource).not.toMatch(/crypto|pbkdf2|pin/i);
    expect(viteConfigSource).not.toMatch(/crypto|pbkdf2|pin/i);
  });
});

describe("LockScreen · almacenamiento no disponible", () => {
  it("avisa y no ofrece formulario de PIN cuando no hay almacenamiento", async () => {
    const onUnlock = vi.fn();
    setCredential();
    render(<LockScreen storageBlocked subtle={realSubtle} onUnlock={onUnlock} />);

    expect(screen.getByText(/No se puede acceder al almacenamiento/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText("••••")).toBeNull();
    expect(submitButton().disabled).toBe(true);
    expect(onUnlock).not.toHaveBeenCalled();
  });
});

/** Monta el bloqueo y, al desbloquear, revela el contenido protegido. */
function UnlockHarness({ subtle, onUnlock }: { subtle?: PinSubtle; onUnlock: () => void }) {
  const [locked, setLocked] = useState(true);
  if (!locked) return <p>contenido protegido</p>;
  return (
    <LockScreen
      subtle={subtle}
      onUnlock={() => {
        onUnlock();
        setLocked(false);
      }}
    />
  );
}
