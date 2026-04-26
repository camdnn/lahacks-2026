import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import type { DetectorSnapshotPayload } from "../types/session";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

// Attach the Supabase JWT to every request so Express can verify the caller
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export const startSession = (data: {
  session_type?: string;
  focus_duration_mins?: number;
  allowed_tabs?: string[];
}) => api.post("/sessions/start", data);

export const endSession = (id: string) => api.post(`/sessions/end/${id}`);

export const logEvent = (data: {
  session_id: string;
  event_type: string;
  duration_ms?: number;
  metadata?: object;
}) => api.post("/events/", data);

export const saveSessionSnapshot = async (payload: DetectorSnapshotPayload): Promise<void> => {
  const { session_id, ...body } = payload;
  try {
    await api.post(`/sessions/${session_id}/snapshot`, body);
  } catch (err: any) {
    // Silently ignore 409 (session already ended) — next tick won't fire anyway
    if (err?.response?.status === 409) return;
    throw err;
  }
};

export const getState = () => api.get("/state");

export { BASE_URL };
export default api;