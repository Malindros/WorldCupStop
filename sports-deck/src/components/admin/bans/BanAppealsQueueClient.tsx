"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { approveAppeal, fetchPendingBanAppeals, rejectAppeal } from "./api";
import type { BanAppealQueueItem } from "./types";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function BanAppealsQueueClient() {
  const { authedFetch } = useAuth();
  const [appeals, setAppeals] = useState<BanAppealQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<{ id: number; action: "approve" | "reject" } | null>(null);

  const loadAppeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPendingBanAppeals(authedFetch);
      setAppeals(data.appeals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ban appeals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, []);

  const onApprove = async (appealId: number) => {
    try {
      setActingOn({ id: appealId, action: "approve" });
      setError(null);
      await approveAppeal(appealId, authedFetch);
      setAppeals((current) => current.filter((appeal) => appeal.id !== appealId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve appeal");
    } finally {
      setActingOn(null);
    }
  };

  const onReject = async (appealId: number) => {
    try {
      setActingOn({ id: appealId, action: "reject" });
      setError(null);
      await rejectAppeal(appealId, authedFetch);
      setAppeals((current) => current.filter((appeal) => appeal.id !== appealId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject appeal");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-rose-500/10 p-4 sm:p-5">
        <h1 className="text-2xl font-semibold text-foreground">Ban Appeals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review pending appeals from banned users. Approving immediately lifts restrictions.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading pending appeals...
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <div className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        </div>
      ) : null}

      {!loading && !error && appeals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No pending ban appeals.
        </div>
      ) : null}

      <div className="space-y-4">
        {appeals.map((appeal) => (
          <article key={appeal.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">@{appeal.user.username}</h2>
                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-8">
                  <p className="whitespace-pre-wrap break-all">Ban reason: {appeal.ban.reason}</p>
                  <p>Ban date: {formatDate(appeal.ban.createdAt)}</p>
                  <p>Ban until: {formatDate(appeal.ban.until)}</p>
                  <p>Banned by: {appeal.ban.bannedBy?.username || "-"}</p>
                  <p className="sm:col-span-2">Appeal submitted: {formatDate(appeal.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appeal Reason</p>
                  <p className="mt-1 whitespace-pre-wrap break-all text-sm text-foreground">{appeal.message}</p>
                </div>
              </div>

              <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                <Button
                  onClick={() => onApprove(appeal.id)}
                  disabled={Boolean(actingOn)}
                  className="inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {actingOn?.id === appeal.id && actingOn.action === "approve" ? "Approving..." : "Approve Appeal"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => onReject(appeal.id)}
                  disabled={Boolean(actingOn)}
                  className="inline-flex items-center gap-2"
                >
                  <ShieldX className="h-4 w-4" />
                  {actingOn?.id === appeal.id && actingOn.action === "reject" ? "Rejecting..." : "Reject Appeal"}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
