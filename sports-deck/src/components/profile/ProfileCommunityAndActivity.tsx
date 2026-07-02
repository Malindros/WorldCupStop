"use client";

import { useState } from "react";
import { Activity, Expand, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProfileActivitySection from "./ProfileActivitySection";
import { useProfileActivityChart } from "./useProfileActivityChart";
import type { ProfileActivityDayBucket } from "./types";

const PERIODS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "6mo" },
  { days: 365, label: "1y" },
] as const;

const COMPACT_PREVIEW_DAYS = 7;

function formatDayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Horizontal space (viewBox units) per day.
 * Caps total viewBox width so the chart fits the modal/card width without horizontal scrolling.
 */
function slotWidthForDayCount(n: number, variant: "compact" | "modal"): number {
  const maxVbW = variant === "compact" ? 260 : 560;
  if (n <= 10) {
    return Math.min(18, maxVbW / n);
  }
  if (n <= 45) {
    return Math.min(10, maxVbW / n);
  }
  return Math.max(1.35, Math.min(6, maxVbW / n));
}

/** Pick label column indices so ticks never crowd; hover still shows any day. */
function getXAxisLabelIndices(n: number): number[] {
  if (n <= 1) return [0];
  const maxTicks = n <= 10 ? 5 : n <= 30 ? 7 : n <= 90 ? 9 : 12;
  if (n <= maxTicks) {
    return Array.from({ length: n }, (_, i) => i);
  }
  const step = Math.ceil((n - 1) / Math.max(1, maxTicks - 1));
  const set = new Set<number>([0, n - 1]);
  for (let i = step; i < n - 1; i += step) set.add(i);
  return Array.from(set).sort((a, b) => a - b);
}

function formatRange(from: string, to: string) {
  return `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
}

/** Y-axis tick marks for the compact activity card (max = peak daily total posts+replies). */
function CompactActivityScale({ maxDaily }: { maxDaily: number }) {
  const cap = Math.max(0, Math.round(maxDaily));
  const mid = cap > 2 ? Math.ceil(cap / 2) : cap > 1 ? 1 : 0;

  if (cap < 1) {
    return (
      <div
        className="flex w-6 shrink-0 flex-col justify-end border-r border-border/50 py-0 pr-1"
        aria-label="Scale: no activity this week"
      >
        <span className="text-right text-[9px] tabular-nums text-muted-foreground">0</span>
      </div>
    );
  }

  return (
    <div
      className="flex w-6 shrink-0 flex-col justify-between border-r border-border/50 py-0 pr-1"
      aria-label={`Y-axis from 0 to ${cap} activity per day`}
    >
      <span className="text-right text-[9px] font-medium tabular-nums leading-none text-foreground/90">{cap}</span>
      {cap > 2 ? (
        <span className="text-right text-[8px] tabular-nums leading-none text-muted-foreground">{mid}</span>
      ) : null}
      <span className="text-right text-[9px] tabular-nums leading-none text-muted-foreground">0</span>
    </div>
  );
}

type SvgProps = {
  activity: ProfileActivityDayBucket[];
  maxTotal: number;
  hovered: number | null;
  setHovered: (i: number | null) => void;
  variant: "compact" | "modal";
};

function ActivityChartSvg({ activity, maxTotal, hovered, setHovered, variant }: SvgProps) {
  const n = Math.max(activity.length, 1);
  const slot = slotWidthForDayCount(n, variant);
  const vbW = n * slot;
  const vbH = variant === "compact" ? 100 : 118;
  const plotBottom = variant === "compact" ? 92 : 108;
  const plotTop = variant === "compact" ? 6 : 8;
  const plotH = plotBottom - plotTop;
  const barW = slot * 0.78;
  const barInset = slot * 0.11;

  const labelIndices =
    variant === "modal" ? new Set(getXAxisLabelIndices(n)) : new Set<number>();

  const labelFont = variant === "compact" ? 4.8 : n <= 14 ? 5.75 : 6.25;

  /** 7d–14d viewBoxes are almost square; w-full + h-auto made the chart as tall as the viewport width. */
  const modalShortRange = variant === "modal" && n <= 14;

  const svgClass = cn(
    "block text-foreground",
    modalShortRange
      ? "mx-auto h-[min(11rem,30vh)] w-auto max-w-full"
      : "h-auto w-full max-w-full",
  );

  const svgEl = (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className={svgClass}
      role="img"
    >
        <title>Activity chart</title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = plotBottom - t * plotH;
          return (
            <line
              key={t}
              x1={0}
              x2={vbW}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              className="pointer-events-none text-foreground"
            />
          );
        })}
        {activity.map((row, i) => {
          const x = i * slot + barInset;
          const w = barW;
          let postsH = maxTotal > 0 ? (row.postsCount / maxTotal) * plotH : 0;
          let commentsH = maxTotal > 0 ? (row.commentsCount / maxTotal) * plotH : 0;
          if (row.postsCount > 0 && postsH < 1.8) postsH = 1.8;
          if (row.commentsCount > 0 && commentsH < 1.8) commentsH = 1.8;
          const stack = postsH + commentsH;
          if (stack > plotH && stack > 0) {
            const s = plotH / stack;
            postsH *= s;
            commentsH *= s;
          }
          const postsY = plotBottom - postsH;
          const commentsY = plotBottom - postsH - commentsH;
          const isHover = hovered === i;
          return (
            <g
              key={row.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {row.postsCount > 0 ? (
                <rect
                  x={x}
                  y={postsY}
                  width={w}
                  height={postsH}
                  className={cn(
                    "fill-amber-500 transition-opacity dark:fill-amber-400",
                    isHover ? "opacity-100" : "opacity-90",
                  )}
                  style={{ pointerEvents: "none" }}
                  rx={0.5}
                />
              ) : null}
              {row.commentsCount > 0 ? (
                <rect
                  x={x}
                  y={commentsY}
                  width={w}
                  height={commentsH}
                  className={cn(
                    "fill-violet-500 transition-opacity dark:fill-violet-400",
                    isHover ? "opacity-100" : "opacity-90",
                  )}
                  style={{ pointerEvents: "none" }}
                  rx={0.5}
                />
              ) : null}
              {row.totalActivity === 0 ? (
                <rect
                  x={x}
                  y={plotBottom - 0.5}
                  width={w}
                  height={0.5}
                  className="fill-muted-foreground/25"
                  style={{ pointerEvents: "none" }}
                  rx={0.25}
                />
              ) : null}
              {variant === "modal" && labelIndices.has(i) ? (
                <text
                  x={
                    i === 0
                      ? i * slot + barInset
                      : i === n - 1
                        ? i * slot + slot - barInset
                        : i * slot + slot / 2
                  }
                  y={vbH - 3}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  className="fill-muted-foreground"
                  style={{ fontSize: labelFont, pointerEvents: "none" }}
                >
                  {formatDayLabel(row.date)}
                </text>
              ) : null}
              {/* Sole hit surface (on top) — avoids flicker when moving from below / across bars vs labels */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={vbH}
                fill="transparent"
                style={{ pointerEvents: "auto" }}
              />
            </g>
          );
        })}
    </svg>
  );

  return (
    <div
      className={cn(
        "w-full rounded-lg",
        variant === "modal" ? "border border-border/50 bg-muted/15 py-3" : "pb-0",
      )}
    >
      {variant === "compact" ? (
        <div className="flex min-h-0 items-stretch gap-0">
          <CompactActivityScale maxDaily={maxTotal} />
          <div className="min-w-0 flex-1">{svgEl}</div>
        </div>
      ) : (
        svgEl
      )}
    </div>
  );
}

function ProfileActivityTimelineModalInner({
  onClose,
  userId,
  username,
}: {
  onClose: () => void;
  userId: number;
  username: string;
}) {
  const [days, setDays] = useState(30);
  const [hovered, setHovered] = useState<number | null>(null);
  const { activity, range, loading, error, reload, maxTotal, totals } = useProfileActivityChart(userId, days);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close dialog" />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="timeline-modal-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              Activity timeline
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Posts and replies per day for @{username}
              {range ? <span className="block text-xs">{formatRange(range.from, range.to)}</span> : null}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border/80 px-4 py-3 sm:px-5" role="group" aria-label="Time range">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                setDays(p.days);
                setHovered(null);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                days === p.days
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-border/80 px-4 py-3 text-xs sm:px-5 sm:text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden />
            <span className="text-muted-foreground">Posts</span>
            <span className="font-semibold tabular-nums">{totals.posts}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" aria-hidden />
            <span className="text-muted-foreground">Replies</span>
            <span className="font-semibold tabular-nums">{totals.comments}</span>
          </span>
          <span className="text-muted-foreground">
            Total <span className="font-semibold text-foreground">{totals.all}</span>
          </span>
          {error ? (
            <button
              type="button"
              onClick={() => void reload()}
              className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline sm:text-sm"
            >
              Retry
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <p className="text-sm">Loading chart…</p>
            </div>
          ) : error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <>
              <ActivityChartSvg
                activity={activity}
                maxTotal={maxTotal}
                hovered={hovered}
                setHovered={setHovered}
                variant="modal"
              />
              <div className="mt-3 min-h-[5.25rem]">
                {hovered != null && activity[hovered] ? (
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center sm:text-left" role="status">
                    <p className="text-sm font-semibold text-foreground">{formatDayLabel(activity[hovered].date)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="text-amber-600 dark:text-amber-400">{activity[hovered].postsCount} posts</span>
                      {" · "}
                      <span className="text-violet-600 dark:text-violet-400">{activity[hovered].commentsCount} replies</span>
                    </p>
                  </div>
                ) : activity.length > 0 ? (
                  <p className="rounded-xl border border-transparent px-4 py-3 text-center text-xs text-muted-foreground sm:text-left">
                    Hover a day for details.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileActivityTimelineModal({
  open,
  onOpenChange,
  userId,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  username: string;
}) {
  if (!open) return null;
  return (
    <ProfileActivityTimelineModalInner
      userId={userId}
      username={username}
      onClose={() => onOpenChange(false)}
    />
  );
}

function ProfileActivityCompactCard({
  userId,
  username,
  onExpand,
}: {
  userId: number;
  username: string;
  onExpand: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { activity, range, loading, error, reload, maxTotal, totals } = useProfileActivityChart(userId, COMPACT_PREVIEW_DAYS);

  return (
    <aside
      className="flex w-full flex-col rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm lg:sticky lg:top-24 lg:self-start"
      aria-labelledby="profile-activity-mini-heading"
      aria-label={`Activity snapshot for @${username}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="profile-activity-mini-heading" className="text-sm font-semibold text-foreground">
          Activity
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last {COMPACT_PREVIEW_DAYS}d</span>
      </div>
      {range ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{formatRange(range.from, range.to)}</p>
      ) : null}

      <div
        className="relative mt-3 aspect-square w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-muted/20 lg:mx-auto lg:max-w-none"
        id="profile-activity-chart"
      >
        {loading ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-xs text-destructive">{error}</p>
            <button type="button" onClick={() => void reload()} className="text-xs font-medium text-primary underline">
              Retry
            </button>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-1 p-2">
            <ActivityChartSvg
              activity={activity}
              maxTotal={maxTotal}
              hovered={hovered}
              setHovered={setHovered}
              variant="compact"
            />
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground sm:text-[11px]">
              <span>
                <span className="text-amber-600 dark:text-amber-400">{totals.posts}</span> posts
              </span>
              <span aria-hidden>
                ·
              </span>
              <span>
                <span className="text-violet-600 dark:text-violet-400">{totals.comments}</span> replies
              </span>
            </div>
          </div>
        )}
      </div>

      <Button type="button" variant="outline" className="mt-4 w-full gap-2" onClick={onExpand}>
        <Expand className="h-4 w-4" aria-hidden />
        Explore timeline
      </Button>
      <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
        Change the date range and explore daily breakdown in full view.
      </p>
    </aside>
  );
}

type ProfileCommunityAndActivityProps = {
  userId: number;
  username: string;
  threadsTotal: number;
  postsTotal: number;
};

export default function ProfileCommunityAndActivity({
  userId,
  username,
  threadsTotal,
  postsTotal,
}: ProfileCommunityAndActivityProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-2 min-w-0 flex-1 lg:order-1">
          <ProfileActivitySection
            userId={userId}
            username={username}
            threadsTotal={threadsTotal}
            postsTotal={postsTotal}
          />
        </div>
        <div className="order-1 w-full shrink-0 lg:order-2 lg:w-[min(100%,280px)]">
          <ProfileActivityCompactCard userId={userId} username={username} onExpand={() => setTimelineOpen(true)} />
        </div>
      </div>

      <ProfileActivityTimelineModal
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        userId={userId}
        username={username}
      />
    </>
  );
}
