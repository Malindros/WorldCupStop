"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthUser = {
  id: number;
  email: string | null;
  username: string;
  role: "USER" | "ADMIN";
  displayName?: string | null;
  avatar?: {
    id?: number;
    url: string;
    altText?: string | null;
  } | null;
  favoriteTeamId?: number | null;
  isBanned?: boolean;
  banUntil?: string | null;
  createdAt?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (identity: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; username?: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  /** Re-fetch /api/me and update context (e.g. after profile or avatar changes). */
  refreshUser: () => Promise<void>;
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/me", { method: "GET", credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to fetch current user");
  }
  const body = await res.json();
  return body?.user ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    return res.ok;
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      let me = await fetchCurrentUser();
      if (!me) {
        const refreshed = await refreshSession();
        if (refreshed) {
          me = await fetchCurrentUser();
        }
      }

      if (me) {
        setUser(me);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [refreshSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const timer = window.setInterval(async () => {
      const ok = await refreshSession();
      if (!ok) {
        setUser(null);
        setStatus("unauthenticated");
      }
    }, 45 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [status, refreshSession]);

  const login = useCallback(async (identity: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identity, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Login failed");
    }

    const me = await fetchCurrentUser();
    if (me) {
      setUser(me);
      setStatus("authenticated");
    } else {
      throw new Error("Login succeeded but user profile is unavailable");
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);

    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const register = useCallback(async (input: { email: string; password: string; username?: string; displayName?: string }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Registration failed");
    }

    const me = await fetchCurrentUser();
    if (me) {
      setUser(me);
      setStatus("authenticated");
      return;
    }

    await login(input.email, input.password);
  }, [login]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      if (me) setUser(me);
    } catch {
      // keep last known user on transient errors
    }
  }, []);

  const authedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const run = () => fetch(input, { ...(init ?? {}), credentials: "include" });

    let response = await run();
    if (response.status !== 401) return response;

    const refreshed = await refreshSession();
    if (!refreshed) {
      setUser(null);
      setStatus("unauthenticated");
      return response;
    }

    response = await run();
    if (response.status === 401) {
      setUser(null);
      setStatus("unauthenticated");
    }

    return response;
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    isAuthenticated: status === "authenticated",
    login,
    register,
    logout,
    refreshSession,
    refreshUser,
    authedFetch,
  }), [user, status, login, register, logout, refreshSession, refreshUser, authedFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}