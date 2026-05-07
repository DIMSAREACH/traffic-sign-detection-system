import "./index.css";
import "./styles/global.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/dark.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";

// Fall back to a placeholder so GoogleOAuthProvider never receives an empty
// string (which throws). The Login page separately guards the button with the
// `googleConfigured` flag, so no real OAuth flow is triggered without a real ID.
const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "not-configured";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
