"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ConnectionsPage from "@/components/connections/ConnectionsPage";

export default function FollowingConnectionsPage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=%2Fconnections%2Ffollowing");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Loading…</div>;
  }

  if (status === "unauthenticated") {
    return <div className="p-4 text-sm text-muted-foreground sm:p-8">Redirecting to sign in…</div>;
  }

  return <ConnectionsPage variant="following" />;
}
