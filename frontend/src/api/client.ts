import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import type { DetectorSnapshotPayload } from "../types/session";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const api = axios.create({ baseURL: BASE_URL });

// Short-lived token cache so we don't hit Supabase on every request
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

// Attach the Supabase JWT to every request so Express can verify the caller
api.interceptors.request.use(async (config) => {
  const now = Date.now();
  if (!_cachedToken || now >= _tokenExpiry) {
    const { data: { session } } = await supabase.auth.getSession();
    _cachedToken = session?.access_token ?? null;
    _tokenExpiry = now + 30_000; // re-fetch at most every 30s
  }
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`;
  }
  return config;
});

// On 401, invalidate the cache, refresh the Supabase session, and retry once.
// This handles expired access tokens during long focus sessions.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true;
      _cachedToken = null; // force re-fetch on next request
      const { data, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && data.session?.access_token) {
        _cachedToken = data.session.access_token;
        _tokenExpiry = Date.now() + 30_000;
        error.config.headers.Authorization = `Bearer ${_cachedToken}`;
        return api.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);

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