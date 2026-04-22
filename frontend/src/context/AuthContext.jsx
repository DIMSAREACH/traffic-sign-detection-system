import React, { createContext, useContext, useEffect, useState } from "react";

import { fetchProfile, login as loginRequest } from "../services/authService.js";

const AuthContext = createContext(null);

export const isAdmin   = (user) => user?.role === "admin";
export const isOfficer = (user) => user?.role === "officer" || user?.role === "admin";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetchProfile()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const data = await loginRequest(credentials);
    sessionStorage.setItem("access_token", data.access);
    sessionStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
    return data.user;
  };

  const loginFromData = (data) => {
    sessionStorage.setItem("access_token", data.access);
    sessionStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    setUser(null);
  };

  const updateUser = (patch) => setUser((prev) => ({ ...prev, ...patch }));

  const value = { user, login, loginFromData, logout, updateUser, loading, isAdmin, isOfficer };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
