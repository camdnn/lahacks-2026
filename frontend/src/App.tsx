import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Component as LoginPage } from "./login";
import { Component as RegisterPage } from "./register";
import { Component as AnalyticsPage } from "./analytics";
import Home from "./pages/Home";
import StartFocus from "./pages/StartFocus";
import ActiveSession from "./pages/ActiveSession";
import SessionSummary from "./pages/SessionSummary";
import CVTest from "./pages/CVTest";
import AuthCallback from "./pages/AuthCallback";
import Homepage from "./homepage";
import "./App.css";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/start" element={<RequireAuth><StartFocus /></RequireAuth>} />
        <Route path="/session" element={<RequireAuth><ActiveSession /></RequireAuth>} />
        <Route path="/summary" element={<RequireAuth><SessionSummary /></RequireAuth>} />
        <Route path="/cv-test" element={<RequireAuth><CVTest /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
