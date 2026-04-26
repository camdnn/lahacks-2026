import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Component as LoginPage } from "./login";
import { Component as RegisterPage } from "./register";
import { Component as AnalyticsPage } from "./analytics";
import AuthCallback from "./pages/AuthCallback";
import Homepage from "./homepage";
import "./App.css";

// Heavy pages are code-split so they don't bloat the initial bundle
const Home           = lazy(() => import("./pages/Home"));
const MyAnalytics    = lazy(() => import("./pages/MyAnalytics"));
const StartFocus     = lazy(() => import("./pages/StartFocus"));
const ActiveSession  = lazy(() => import("./pages/ActiveSession"));
const SessionSummary = lazy(() => import("./pages/SessionSummary"));
const CVTest         = lazy(() => import("./pages/CVTest"));
const FAQ            = lazy(() => import("./pages/FAQ"));
const Info           = lazy(() => import("./pages/Info"));
const Store          = lazy(() => import("./pages/Store"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <PageLoader />;
  return session ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
