"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL: dashboard hub lives at `/` when signed in. */
export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(`/${hash}`);
  }, [router]);

  return <div className="p-4 text-sm text-muted-foreground sm:p-8">Opening your dashboard…</div>;
}
