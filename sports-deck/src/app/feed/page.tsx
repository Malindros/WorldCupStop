"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Legacy URL: activity feed lives on the dashboard. */
export default function ActivityFeedRedirectPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?next=%2Ffeed");
      return;
    }
    router.replace("/#activity-feed");
  }, [status, router]);

  if (status === "loading") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Loading…</div>;
  }

  if (status === "unauthenticated") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Redirecting to sign in…</div>;
  }

  return <div className="p-4 text-sm text-muted-foreground sm:p-8">Opening your dashboard…</div>;
}
