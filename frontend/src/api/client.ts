import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const register  = (data: { email: string; password: string; username?: string }) =>
  api.post("/auth/register", data);

export const login = (data: { email: string; password: string }) =>
  api.post("/auth/login", data);

export const startSession = (data: { session_type?: string; focus_duration_mins?: number; allowed_tabs?: string[] }) =>
  api.post("/sessions/start", data);

export const endSession = (id: string) =>
  api.post(`/sessions/end/${id}`);

export const logEvent = (data: { session_id: string; event_type: string; duration_ms?: number; metadata?: object }) =>
  api.post("/events/", data);

export const logEyeData = (data: object) => api.post("/eye-data/", data);
export const logScreenData = (data: object) => api.post("/screen-data/", data);
export const getState = () => api.get("/state");

export default api;
