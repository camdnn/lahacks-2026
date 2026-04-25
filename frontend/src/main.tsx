import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { SessionProvider } from "./context/SessionContext";
import { FocusProvider } from "./context/FocusContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <SessionProvider>
        <FocusProvider>
          <App />
        </FocusProvider>
      </SessionProvider>
    </AuthProvider>
  </StrictMode>,
);
