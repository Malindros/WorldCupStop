"use client";

import Link from "next/link";
import { AlertTriangle, Ban } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchModerationQueue } from "@/components/admin/moderation/api";

export default function AdminDashboardCards() {
  const { authedFetch } = useAuth();
  const [moderationPendingCount, setModerationPendingCount] = useState<number>(0);
  const [appealsPendingCount, setAppealsPendingCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadCount = async () => {
      try {
        setLoadingCount(true);
        const [queue, appealsResponse] = await Promise.all([
          fetchModerationQueue(authedFetch, { sort: "ai_score" }),
          authedFetch("/api/admin/appeals?status=PENDING", { method: "GET", cache: "no-store" }),
        ]);

        const appealsBody = appealsResponse.ok
          ? await appealsResponse.json().catch(() => ({ appeals: [] }))
          : { appeals: [] };

        if (!cancelled) {
          setModerationPendingCount(queue.meta.pendingReportCount);
          setAppealsPendingCount(Array.isArray(appealsBody?.appeals) ? appealsBody.appeals.length : 0);
        }
      } catch {
        if (!cancelled) {
          setModerationPendingCount(0);
          setAppealsPendingCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingCount(false);
        }
      }
    };

    loadCount();

    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link
        href="/admin/moderation"
        className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div
          className={`absolute right-4 top-4 rounded-full px-2 py-1 text-xs font-semibold ${
            !loadingCount && moderationPendingCount === 0
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {loadingCount ? "..." : moderationPendingCount} pending
        </div>
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Moderation Queue</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review reported posts and threads and take appropriate moderation actions.
        </p>
      </Link>

      <Link
        href="/admin/bans"
        className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div
          className={`absolute right-4 top-4 rounded-full px-2 py-1 text-xs font-semibold ${
            !loadingCount && appealsPendingCount === 0
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          }`}
        >
          {loadingCount ? "..." : appealsPendingCount} pending
        </div>
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300">
          <Ban className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Ban Appeals</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage active bans and appeals.
        </p>
      </Link>
    </div>
  );
}
