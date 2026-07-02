"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownAZ, ArrowDownUp, ArrowUpAZ, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchModerationQueue, runModerationAction } from "./api";
import ModerationQueueItemCard from "./ModerationQueueItemCard";
import type { ModerationAction, ModerationQueueResponse, QueueDirection, QueueItem, QueueSort } from "./types";

const SORT_OPTIONS: Array<{ value: QueueSort; label: string }> = [
  { value: "ai_score", label: "AI Score" },
  { value: "reports", label: "User Reports" },
  { value: "recent", label: "Latest User Report" },
];

export default function ModerationQueueClient() {
  const { authedFetch } = useAuth();
  const PAGE_LIMIT = 10;
  const [sort, setSort] = useState<QueueSort>("ai_score");
  const [direction, setDirection] = useState<QueueDirection>("desc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ModerationQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<{ key: string; action: ModerationAction } | null>(null);

  const loadQueue = async (nextSort = sort, nextDirection = direction, nextOffset = offset) => {
    try {
      setLoading(true);
      setError(null);
      const queue = await fetchModerationQueue(authedFetch, {
        sort: nextSort,
        direction: nextDirection,
        limit: PAGE_LIMIT,
        offset: nextOffset,
      });
      setData(queue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(sort, direction, offset);
  }, [sort, direction, offset]);

  const sortedItems = useMemo(() => data?.items || [], [data]);

  const onRunAction = async (item: QueueItem, action: ModerationAction) => {
    const key = `${item.type}:${item.targetId}`;

    try {
      setActingOn({ key, action });
      setError(null);
      await runModerationAction(authedFetch, {
        targetType: item.type,
        targetId: item.targetId,
        action,
      });
      await loadQueue(sort, direction, offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply moderation action");
    } finally {
      setActingOn(null);
    }
  };

  const totalPages = data?.meta.totalPages ?? 1;
  const currentPage = data?.meta.currentPage ?? 1;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Moderation Queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review pending reports, inspect AI verdicts, and take moderation actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {data?.meta.pendingReportCount ?? 0} pending reports
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {data?.meta.pendingTargetCount ?? 0} targets
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowDownUp className="h-4 w-4" /> Sort by
          </span>
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={sort === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setOffset(0);
                setSort(option.value);
              }}
              disabled={loading}
            >
              {option.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOffset(0);
              setDirection((prev) => (prev === "desc" ? "asc" : "desc"));
            }}
            disabled={loading}
          >
            {direction === "desc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
            {direction === "desc" ? "Descending" : "Ascending"}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading moderation queue...
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

      {!loading && !error && sortedItems.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No pending moderation items.
        </div>
      ) : null}

      <div className="space-y-4">
        {sortedItems.map((item) => {
          const key = `${item.type}:${item.targetId}`;
          return (
            <ModerationQueueItemCard
              key={key}
              item={item}
              onAction={onRunAction}
              loadingAction={actingOn?.key === key ? actingOn.action : null}
            />
          );
        })}
      </div>

      {!loading && !error && (data?.meta.pendingTargetCount ?? 0) > 0 ? (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => setOffset((v) => Math.max(0, v - PAGE_LIMIT))} disabled={offset <= 0}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button
            variant="outline"
            onClick={() => setOffset((v) => Math.min(v + PAGE_LIMIT, Math.max((totalPages - 1) * PAGE_LIMIT, 0)))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
