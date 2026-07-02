"use client";

import { useState } from "react";
import type { ModerationAction, QueueItem, QueuePostTarget } from "./types";
import AiVerdictPanel from "./item/AiVerdictPanel";
import EditHistoryPanel from "./item/EditHistoryPanel";
import ModerationActionsPanel from "./item/ModerationActionsPanel";
import TargetSummary from "./item/TargetSummary";
import UserReportsPanel from "./item/UserReportsPanel";
import { formatDate, getTypeBadgeClass } from "./item/styles";

type Props = {
  item: QueueItem;
  onAction: (item: QueueItem, action: ModerationAction) => Promise<void>;
  loadingAction: ModerationAction | null;
};

export default function ModerationQueueItemCard({ item, onAction, loadingAction }: Props) {
  const [showReports, setShowReports] = useState(false);
  const [showEdits, setShowEdits] = useState(false);

  const postTarget = item.type === "POST" ? (item.target as QueuePostTarget | null) : null;

  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getTypeBadgeClass(item.type)}`}>
            {item.type === "POST" ? "Post" : "Thread"}
          </span>
          {item.autoReportCount > 0 ? (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              automod
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">{item.openReportCount} open report(s)</span>
          <span className="text-sm text-muted-foreground">-</span>
          <span className="text-sm text-muted-foreground">Latest report: {formatDate(item.lastUserReportAt)}</span>
        </div>
        <div className="text-sm text-muted-foreground">Target #{item.targetId}</div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <TargetSummary item={item} />
          <UserReportsPanel reports={item.userReports} open={showReports} onToggle={() => setShowReports((value) => !value)} />
          <EditHistoryPanel target={postTarget} open={showEdits} onToggle={() => setShowEdits((value) => !value)} />
        </div>

        <aside className="space-y-4">
          <AiVerdictPanel verdict={item.latestAiVerdict} />
          <ModerationActionsPanel item={item} loadingAction={loadingAction} onAction={onAction} />
        </aside>
      </div>
    </article>
  );
}
