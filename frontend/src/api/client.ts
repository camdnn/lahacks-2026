import axios from "axios";
import { supabase } from "../lib/supabaseClient";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

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

export const startCalibration = () => api.post("/calibrate/start");
export const logEyeData = (data: object) => api.post("/eye-data/", data);
export const logScreenData = (data: object) => api.post("/screen-data/", data);
export const getState = () => api.get("/state");

export default api;
