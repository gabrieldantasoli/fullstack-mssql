import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return null;

  // ✅ logado não entra em /login e /cadastro
  if (status === "authed") return <Navigate to="/app/home" replace />;

  return <>{children}</>;
}
