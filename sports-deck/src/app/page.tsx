"use client";

import DashboardHub from "@/components/dashboard/DashboardHub";
import PublicHome from "@/components/home/PublicHome";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { status } = useAuth();

  if (status === "loading") {
    return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  }

  if (status !== "authenticated") {
    return <PublicHome />;
  }

  return <DashboardHub />;
}
