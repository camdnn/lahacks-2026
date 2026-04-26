import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

const INACTIVITY_MS = 30 * 60 * 1000;

interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  coin_balance: number;
}

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  logout: () => Promise<void>;
  updateCoins: (balance: number) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, username, coin_balance")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      supabase.auth.signOut();
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    if (!session) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => document.addEventListener(e, resetTimeout, { passive: true }));
    resetTimeout();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetTimeout));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session, resetTimeout]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string, username?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const loginWithGitHub = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateCoins = useCallback((balance: number) => {
    setProfile((p) => (p ? { ...p, coin_balance: balance } : p));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginWithGitHub,
        logout,
        updateCoins,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
