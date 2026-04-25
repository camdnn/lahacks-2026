import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useSession } from "./SessionContext";

interface FocusState {
  focus_score: number;
  counts: Record<string, number>;
  top_distractors: [string, number][];
  ear: number;
  mar: number;
  head_tilt: number;
  face_detected: boolean;
  blink_rate: number;
}

interface FocusCtx extends FocusState {
  connected: boolean;
}

const defaults: FocusState = {
  focus_score: 100,
  counts: {},
  top_distractors: [],
  ear: 0.3,
  mar: 0.1,
  head_tilt: 0,
  face_detected: false,
  blink_rate: 0,
};

const FocusContext = createContext<FocusCtx>({ ...defaults, connected: false });

export function FocusProvider({ children }: { children: ReactNode }) {
  const { isActive } = useSession();
  const [data, setData] = useState<FocusState>(defaults);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const ws = new WebSocket("ws://localhost:8000/ws/focus");
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => {
      try { setData(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [isActive]);

  return (
    <FocusContext.Provider value={{ ...data, connected }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  return useContext(FocusContext);
}
