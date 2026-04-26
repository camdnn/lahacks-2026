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
  owned_characters: string[];
  active_character: string;
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
  purchaseCharacter: (key: string, cost: number) => Promise<boolean>;
  setActiveCharacter: (key: string) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, username, coin_balance, owned_characters, active_character")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const raw = data as Record<string, unknown>;
  return {
    ...raw,
    owned_characters: Array.isArray(raw.owned_characters) ? raw.owned_characters as string[] : ["peach_classic"],
    active_character: typeof raw.active_character === "string" ? raw.active_character : "peach_classic",
  } as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    // Bootstrap: read the cached session immediately so loading never gets stuck
    // waiting for onAuthStateChange to fire.
    const bootstrap = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(s);
        if (s) {
          const p = await fetchProfile(s.user.id).catch(() => null);
          if (mounted) setProfile(p);
        }
      } catch {
        // getSession() is non-throwing in practice; guard against the unexpected
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    // Handle all subsequent auth events (sign-in, sign-out, token refresh, etc.)
    // INITIAL_SESSION is skipped — bootstrap() already covered it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (event === "INITIAL_SESSION") return;
        if (!mounted) return;
        setSession(s);
        if (s) {
          const p = await fetchProfile(s.user.id);
          if (mounted) setProfile(p);
        } else {
          if (mounted) setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sign-in timed out — please refresh and try again.")), 10000)
    );
    const { error } = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      deadline,
    ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
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
    if (session) {
      supabase
        .from("profiles")
        .update({ coin_balance: balance })
        .eq("id", session.user.id)
        .then(() => {});
    }
  }, [session]);

  const purchaseCharacter = useCallback(async (key: string, cost: number): Promise<boolean> => {
    if (!session || !profile) return false;
    if (profile.coin_balance < cost) return false;
    if (profile.owned_characters.includes(key)) return false;
    const newBalance = profile.coin_balance - cost;
    const newOwned = [...profile.owned_characters, key];
    setProfile((p) => p ? { ...p, coin_balance: newBalance, owned_characters: newOwned } : p);
    await supabase
      .from("profiles")
      .update({ coin_balance: newBalance, owned_characters: newOwned })
      .eq("id", session.user.id);
    return true;
  }, [session, profile]);

  const setActiveCharacter = useCallback((key: string) => {
    setProfile((p) => p ? { ...p, active_character: key } : p);
    if (session) {
      supabase
        .from("profiles")
        .update({ active_character: key })
        .eq("id", session.user.id)
        .then(() => {});
    }
  }, [session]);

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
        purchaseCharacter,
        setActiveCharacter,
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
