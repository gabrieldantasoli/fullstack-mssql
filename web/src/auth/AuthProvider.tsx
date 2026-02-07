import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type User = { id: number; nome: string; login: string };

type AuthStatus = "loading" | "authed" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const inFlight = useRef<Promise<void> | null>(null);

  async function refresh() {
    if (inFlight.current) return inFlight.current;

    inFlight.current = (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          setUser(null);
          setStatus("guest");
          return;
        }
        const data = (await res.json()) as User;
        setUser(data);
        setStatus("authed");
      } catch {
        setUser(null);
        setStatus("guest");
      } finally {
        inFlight.current = null;
      }
    })();

    return inFlight.current;
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
