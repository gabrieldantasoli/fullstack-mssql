import { Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "./auth/RequireAuth";
import Login from "./components/login";
import Cadastro from "./components/cadastro";
import AppHome from ".";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppHome />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
