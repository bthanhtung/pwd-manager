"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../auth";

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoggedIn()) {
      setIsAuthenticated(true);
      setUsername(localStorage.getItem("pm_username"));
    }
  }, []);

  const login = (token: string, u: string) => {
    auth.setToken(token);
    localStorage.setItem("pm_username", u);
    setIsAuthenticated(true);
    setUsername(u);
    router.push("/vault");
  };

  const logout = () => {
    auth.clearToken();
    localStorage.removeItem("pm_username");
    setIsAuthenticated(false);
    setUsername(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
