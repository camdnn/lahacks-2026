import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Component as LoginPage } from "./login";
import { Component as RegisterPage } from "./register";
import Home from "./pages/Home";
import StartFocus from "./pages/StartFocus";
import ActiveSession from "./pages/ActiveSession";
import SessionSummary from "./pages/SessionSummary";
import CVTest from "./pages/CVTest";
import { FloatingPudge } from "./components/FloatingPudge";
import "./App.css";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <FloatingPudge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/start" element={<RequireAuth><StartFocus /></RequireAuth>} />
        <Route path="/session" element={<RequireAuth><ActiveSession /></RequireAuth>} />
        <Route path="/summary" element={<RequireAuth><SessionSummary /></RequireAuth>} />
        <Route path="/cv-test" element={<RequireAuth><CVTest /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
