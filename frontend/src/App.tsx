import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Component as LoginPage } from "./login";
import { Component as RegisterPage } from "./register";
import { Component as AnalyticsPage } from "./analytics";
import Home from "./pages/Home";
import MyAnalytics from "./pages/MyAnalytics";
import StartFocus from "./pages/StartFocus";
import ActiveSession from "./pages/ActiveSession";
import SessionSummary from "./pages/SessionSummary";
import CVTest from "./pages/CVTest";
import AuthCallback from "./pages/AuthCallback";
import Homepage from "./homepage";
import FAQ from "./pages/FAQ";
import Info from "./pages/Info";
import Store from "./pages/Store";
import "./App.css";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
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
        <Route path="/my-analytics" element={<RequireAuth><MyAnalytics /></RequireAuth>} />
        <Route path="/start" element={<RequireAuth><StartFocus /></RequireAuth>} />
        <Route path="/session" element={<RequireAuth><ActiveSession /></RequireAuth>} />
        <Route path="/summary" element={<RequireAuth><SessionSummary /></RequireAuth>} />
        <Route path="/cv-test" element={<RequireAuth><CVTest /></RequireAuth>} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/about" element={<Info />} />
        <Route path="/store" element={<RequireAuth><Store /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
