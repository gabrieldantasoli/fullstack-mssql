import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import PublicOnly from "./auth/PublicOnly";
import Login from "./components/login";
import Cadastro from "./components/cadastro";
import AppLayout from "./components/layout/AppLayout";
import ProcessosPage from "./app/layout/pages/processos";
import GabinetesPage from "./app/layout/pages/gabinetes";
import SolicitacoesPage from "./app/layout/pages/solicitacoes";
import FavoritosPage from "./app/layout/pages/favoritos";
import Acessos from "./app/layout/pages/acessos";
import Home from "./app/layout/pages/home"; // (você disse que existe)

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />

      <Route
        path="/cadastro"
        element={
          <PublicOnly>
            <Cadastro />
          </PublicOnly>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/home" replace />} />
        <Route path="home" element={<Home />} />

        <Route path="processos" element={<ProcessosPage />} />
        <Route path="gabinetes" element={<GabinetesPage />} />
        <Route path="solicitacoes" element={<SolicitacoesPage />} />
        <Route path="favoritos" element={<FavoritosPage />} />
        <Route path="meus-acessos" element={<Acessos />} />

        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
