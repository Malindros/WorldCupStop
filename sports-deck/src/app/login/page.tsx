import React, { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center p-8">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
