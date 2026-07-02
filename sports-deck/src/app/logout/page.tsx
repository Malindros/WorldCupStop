import React, { Suspense } from "react";
import LogoutClient from "./LogoutClient";

export default function LogoutPage() {
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
      <LogoutClient />
    </Suspense>
  );
}
