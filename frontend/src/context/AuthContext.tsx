import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister } from "../api/client";

interface User {
  user_id: string;
  email: string;
  username?: string;
  coin_balance: number;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => void;
  updateCoins: (balance: number) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiLogin({ email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, username?: string) => {
    const { data } = await apiRegister({ email, password, username });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const updateCoins = useCallback((balance: number) => {
    setUser((u) => {
      if (!u) return u;
      const updated = { ...u, coin_balance: balance };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateCoins }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
