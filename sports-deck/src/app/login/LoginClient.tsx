"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import type { FormEvent } from "react";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, status } = useAuth();

  const modeParam = searchParams.get("mode");
  const [mode, setMode] = useState<"signin" | "signup">(modeParam === "signup" ? "signup" : "signin");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const oauthError = searchParams.get("error");
  const next = searchParams.get("next") || "/";

  const startOAuth = (provider: "google" | "github") => {
    const qp = new URLSearchParams();
    qp.set("next", next);
    window.location.href = `/api/auth/oauth/${provider}/start?${qp.toString()}`;
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace(next.startsWith("/") ? next : "/");
  }, [status, next, router]);

  const onSignInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await login(identity.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onSignUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await register({
        email: signupEmail.trim(),
        password: signupPassword,
        username: signupUsername.trim() || undefined,
        displayName: signupDisplayName.trim() || undefined,
      });
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="mt-4 text-sm font-medium">You are signed in</p>
          <p className="mt-1 text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 z-0 min-h-dvh">
        {/* Sign in: wide stadium night. Sign up: pitch texture (abstract, readable with overlay). */}
        <Image
          key={mode}
          src={
            mode === "signup"
              ? "/images/atmosphere/pitch-corner.png"
              : "/images/atmosphere/stadium-night-wide.png"
          }
          alt=""
          fill
          priority
          quality={92}
          sizes="100vw"
          className={
            mode === "signup"
              ? "object-cover object-[center_55%] sm:object-center"
              : "object-cover object-center"
          }
          aria-hidden
        />
        <div
          className={
            mode === "signup"
              ? "absolute inset-0 bg-gradient-to-br from-slate-950/68 via-slate-950/50 to-slate-950/72 dark:from-slate-950/78 dark:via-slate-950/58 dark:to-slate-950/84"
              : "absolute inset-0 bg-gradient-to-br from-slate-950/64 via-slate-950/46 to-slate-950/68 dark:from-slate-950/76 dark:via-slate-950/56 dark:to-slate-950/82"
          }
          aria-hidden
        />
      </div>
      <div className="relative z-10 flex min-h-full items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-6 shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in with email/username + password, or continue with a provider."
              : "Sign up with email + password, or continue with Google/GitHub."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => startOAuth("google")}>
              Continue with Google
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => startOAuth("github")}>
              Continue with GitHub
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {mode === "signin" ? (
            <form onSubmit={onSignInSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email or Username</label>
                <input
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onSignUpSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Username (optional)</label>
                <input
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Display name (optional)</label>
                <input
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          )}

          {(error || oauthError) && (
            <p className="mt-4 text-sm text-red-600">
              {error || `OAuth error: ${oauthError}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

