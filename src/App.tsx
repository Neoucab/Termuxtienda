import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useApp, isStorageAvailable } from "./lib/store";
import { applyTheme } from "./lib/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AppShell from "./components/layout/AppShell";
import LockScreen from "./components/LockScreen";
import Catalogo from "./pages/Catalogo";
import Carrito from "./pages/Carrito";
import Dashboard from "./pages/Dashboard";
import Ventas from "./pages/Ventas";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Cobrar from "./pages/Cobrar";
import Inventario from "./pages/Inventario";
import Compras from "./pages/Compras";
import Reportes from "./pages/Reportes";
import Ajustes from "./pages/Ajustes";

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const themeColor = useApp((s) => s.settings.themeColor);
  const darkMode = useApp((s) => s.settings.darkMode);
  const pinHash = useApp((s) => s.settings.pinHash);
  // El desbloqueo vive solo en memoria: no sobrevive a una recarga ni lo puede
  // conceder un valor almacenado.
  const [unlocked, setUnlocked] = useState(false);
  const [storageOk] = useState(isStorageAvailable);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    applyTheme(themeColor, darkMode);
  }, [themeColor, darkMode]);

  const hasCredential = typeof pinHash === "string" && pinHash.length > 0;
  // Sin almacenamiento no hay credencial verificable: el POS falla cerrado.
  const locked = !storageOk || (hasCredential && !unlocked);

  return (
    <HashRouter>
      <Routes>
        {/* Vistas públicas del cliente: fuera de la compuerta del dueño. */}
        <Route path="/tienda" element={<Catalogo />} />
        <Route path="/tienda/carrito" element={<Carrito />} />
        {/* Subárbol del dueño: protegido por el PIN. */}
        <Route
          path="*"
          element={
            locked ? (
              <LockScreen storageBlocked={!storageOk} onUnlock={() => setUnlocked(true)} />
            ) : (
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="/ventas" element={<Ventas />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/:id" element={<ClienteDetalle />} />
                  <Route path="/cobrar" element={<Cobrar />} />
                  <Route path="/inventario" element={<Inventario />} />
                  <Route path="/compras" element={<Compras />} />
                  <Route path="/reportes" element={<Reportes />} />
                  <Route path="/ajustes" element={<Ajustes />} />
                  <Route path="*" element={<Dashboard />} />
                </Route>
              </Routes>
            )
          }
        />
      </Routes>
    </HashRouter>
  );
}
