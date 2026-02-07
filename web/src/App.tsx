import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./components/login";
import Cadastro from "./components/cadastro";

export default function App() {
  return (
    <Routes>
      {/* raiz do site */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* telas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
