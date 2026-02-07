import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return null;
  if (status === "guest") return <Navigate to="/login" replace />;

  return <>{children}</>;
}
