import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Canal de captura de errores. Permite conectar un reporte cuando exista,
   * sin que el componente escriba en consola.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Punto único de contención de errores de render: evita la pantalla en blanco
 * mostrando un fallback en español con acciones de recuperación. React exige
 * un componente de clase para capturar errores de render.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // La captura sale solo por `onError`: no se emite nada por consola.
    this.props.onError?.(error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  /** Vuelve a la ruta inicial y después reinicia, por si la ruta fallida sigue rota. */
  private goHome = (): void => {
    window.location.hash = "#/";
    this.reset();
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.reset} onHome={this.goHome} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Algo salió mal</h1>
        <p className="mt-1 text-sm text-muted">
          Ocurrió un error inesperado. Vuelve a intentar o regresa al panel.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onRetry}>Reintentar</Button>
          <Button variant="outline" onClick={onHome}>
            Ir al inicio
          </Button>
        </div>
      </Card>
    </div>
  );
}
