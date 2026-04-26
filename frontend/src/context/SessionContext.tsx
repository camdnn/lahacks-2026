import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { startSession as apiStart, endSession as apiEnd } from "../api/client";
import { useAuth } from "./AuthContext";

interface SessionCtx {
  sessionId: string | null;
  sessionType: string;
  allowedTabs: string[];
  durationMins: number | null;
  elapsed: number;
  isActive: boolean;
  summary: object | null;
  start: (type: string, durationMins?: number, allowedTabs?: string[]) => Promise<void>;
  end: () => Promise<object>;
}

const SessionContext = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { updateCoins } = useAuth();
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [sessionType, setSessionType]   = useState("general");
  const [allowedTabs, setAllowedTabs]   = useState<string[]>([]);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [elapsed, setElapsed]           = useState(0);
  const [isActive, setIsActive]         = useState(false);
  const [summary, setSummary]           = useState<object | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async (type: string, durMins?: number, tabs: string[] = []) => {
    const { data } = await apiStart({
      session_type: type,
      focus_duration_mins: durMins,
      allowed_tabs: tabs,
    });
    setSessionId(data.session_id);
    setSessionType(type);
    setAllowedTabs(tabs);
    setDurationMins(durMins ?? null);
    setElapsed(0);
    setIsActive(true);
    setSummary(null);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const end = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const { data } = await apiEnd(sessionId!);
      setIsActive(false);
      setSummary(data);
      updateCoins(data.coin_balance);
      return data;
    } catch (err) {
      setIsActive(false);
      throw err;
    }
  }, [sessionId, updateCoins]);

  return (
    <SessionContext.Provider value={{
      sessionId, sessionType, allowedTabs, durationMins,
      elapsed, isActive, summary, start, end,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be inside SessionProvider");
  return ctx;
}
