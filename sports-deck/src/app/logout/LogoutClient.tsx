"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LogoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const next = searchParams.get("next") || "/";
  const [phase, setPhase] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await logout();
        if (!cancelled) {
          router.replace(next.startsWith("/") ? next : "/");
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [logout, router, next]);

  if (phase === "error") {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">Could not sign you out</p>
          <p className="mt-2 text-sm text-muted-foreground">Try again from the menu, or refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
        <h1 className="mt-5 text-lg font-semibold tracking-tight">Signing you out</h1>
        <p className="mt-2 text-sm text-muted-foreground">You will be redirected in a moment.</p>
      </div>
    </div>
  );
}
