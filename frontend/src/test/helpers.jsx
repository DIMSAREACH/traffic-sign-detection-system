/**
 * Test helpers — shared render wrapper with all providers.
 */
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../i18n/LanguageContext.jsx";

/**
 * Minimal AuthContext stub — tests can override via `authValue` option.
 */
const AuthContext = React.createContext(null);

export function useAuthStub() {
  return React.useContext(AuthContext);
}

const defaultAuth = {
  user: null,
  loading: false,
  login: vi.fn(),
  loginFromData: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  isAdmin: () => false,
  isOfficer: () => false,
};

/**
 * Render a component wrapped in Router + LanguageProvider + AuthContext.
 *
 * Options:
 *  - route: initial URL (default "/")
 *  - authValue: override auth context
 */
export function renderWithProviders(ui, { route = "/", authValue = {} } = {}) {
  const auth = { ...defaultAuth, ...authValue };

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={auth}>
        <LanguageProvider>{ui}</LanguageProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
