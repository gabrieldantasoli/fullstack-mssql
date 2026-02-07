import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type User = { id: number; nome: string; login: string };

type AuthStatus = "loading" | "authed" | "guest";

type AuthContextValue = {
    status: AuthStatus;
    user: User | null;
    refresh: () => Promise<void>;
    setUser: (u: User | null) => void;
    logout: () => Promise<void>;
    login: (u: User) => void;
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

    async function logout() {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } finally {
            setUser(null);
            setStatus("guest");
        }
    }

    function login(u: User) {
        setUser(u);
        setStatus("authed");
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <AuthContext.Provider value={{ status, user, refresh, setUser, logout, login }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
