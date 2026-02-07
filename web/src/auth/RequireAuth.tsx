import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        setState(res.ok ? "ok" : "no");
      } catch {
        setState("no");
      }
    })();
  }, []);

  if (state === "loading") return null;
  if (state === "no") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
