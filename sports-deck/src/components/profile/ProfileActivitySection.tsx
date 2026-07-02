"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, MessagesSquare, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchUserPostsForProfile, fetchUserThreadsForProfile } from "./api";
import type { ProfileActivityPost, ProfileActivityThread } from "./types";

/** Matches fetch limits in this component (newest first from API). */
const RECENT_THREADS_LIMIT = 24;
const RECENT_POSTS_LIMIT = 80;

type TabId = "threads" | "posts" | "replies";

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 0) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function threadHref(slug: string | null, id: number) {
  return `/threads/${slug ?? id}`;
}

function threadAccent(thread: ProfileActivityThread) {
  if (thread.matchId != null) return "bg-emerald-500";
  if (thread.teamId != null) return "bg-indigo-500";
  return "bg-sky-500";
}

function threadBadgeClass(thread: ProfileActivityThread) {
  if (thread.matchId != null) return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  if (thread.teamId != null) return "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200";
  return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
}

function threadKindLabel(thread: ProfileActivityThread) {
  if (thread.matchId != null) return "Match";
  if (thread.teamId != null) return "Team";
  return "League";
}

type ProfileActivitySectionProps = {
  userId: number;
  username: string;
  threadsTotal: number;
  postsTotal: number;
};

export default function ProfileActivitySection({
  userId,
  username,
  threadsTotal,
  postsTotal,
}: ProfileActivitySectionProps) {
  const [tab, setTab] = useState<TabId>("threads");
  const [threads, setThreads] = useState<ProfileActivityThread[] | null>(null);
  const [posts, setPosts] = useState<ProfileActivityPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, p] = await Promise.all([
        fetchUserThreadsForProfile(userId, RECENT_THREADS_LIMIT),
        fetchUserPostsForProfile(userId, RECENT_POSTS_LIMIT),
      ]);
      setThreads(t);
      setPosts(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity");
      setThreads([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const topLevelPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => !p.isReply && p.thread);
  }, [posts]);

  const replyPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => p.isReply && p.thread);
  }, [posts]);

  /** Span from oldest loaded item to now (newest-first capped lists; not a server-side date filter). */
  const activitySpanDays = useMemo(() => {
    if (!threads?.length && !posts?.length) return null;
    const times: number[] = [];
    for (const t of threads ?? []) times.push(new Date(t.createdAt).getTime());
    for (const p of posts ?? []) times.push(new Date(p.createdAt).getTime());
    if (times.length === 0) return null;
    const oldest = Math.min(...times);
    return Math.max(1, Math.ceil((Date.now() - oldest) / 86_400_000));
  }, [threads, posts]);

  const tabs: { id: TabId; label: string; icon: typeof MessagesSquare; count: number; hint: string }[] = [
    { id: "threads", label: "Threads", icon: MessagesSquare, count: threads?.length ?? 0, hint: `${threadsTotal} total` },
    { id: "posts", label: "Posts", icon: MessageSquare, count: topLevelPosts.length, hint: `${postsTotal} posts total` },
    { id: "replies", label: "Replies", icon: Reply, count: replyPosts.length, hint: "in threads" },
  ];

  return (
    <section
      id="profile-activity"
      className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-6"
      aria-labelledby="profile-activity-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="profile-activity-heading" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Community
          </h2>
          <p className="text-sm text-muted-foreground">
            Threads, posts, and replies by <span className="font-medium text-foreground">@{username}</span>
            {activitySpanDays != null
              ? activitySpanDays === 1
                ? " in the last day"
                : ` in the last ${activitySpanDays} days`
              : ""}
            .
          </p>
        </div>
        {error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline sm:mt-0"
          >
            Retry
          </button>
        ) : null}
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1"
        role="tablist"
        aria-label="Activity type"
      >
        {tabs.map(({ id, label, icon: Icon, count, hint }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            id={`profile-activity-tab-${id}`}
            aria-controls={`profile-activity-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:flex-row sm:gap-2 sm:py-2.5",
              tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-xs font-semibold sm:text-sm">{label}</span>
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
              {loading ? "…" : `${count} recent`}
            </span>
            <span className="sr-only">{hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[8rem]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm">Loading activity…</p>
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div
              id="profile-activity-panel-threads"
              role="tabpanel"
              aria-labelledby="profile-activity-tab-threads"
              hidden={tab !== "threads"}
              className="space-y-3"
            >
              {!threads?.length ? (
                <EmptyActivity message="No threads yet. Discussions they start will show up here." />
              ) : (
                threads.map((thread) => (
                  <article
                    key={thread.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-background transition hover:border-primary/30"
                  >
                    <div className="flex min-w-0">
                      <div className={cn("w-1 shrink-0", threadAccent(thread))} aria-hidden />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-base font-semibold leading-snug text-foreground">
                            <Link
                              href={threadHref(thread.slug, thread.id)}
                              className="hover:text-primary hover:underline"
                            >
                              {thread.title}
                            </Link>
                          </h3>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              threadBadgeClass(thread),
                            )}
                          >
                            {threadKindLabel(thread)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(thread.createdAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                            {thread.postCount} {thread.postCount === 1 ? "post" : "posts"}
                          </span>
                          {thread.team ? <span className="truncate">{thread.team.name}</span> : null}
                          {thread.isClosed ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">Closed</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div
              id="profile-activity-panel-posts"
              role="tabpanel"
              aria-labelledby="profile-activity-tab-posts"
              hidden={tab !== "posts"}
              className="space-y-3"
            >
              {!topLevelPosts.length ? (
                <EmptyActivity message="No top-level posts yet. Posts in threads appear here; replies have their own tab." />
              ) : (
                topLevelPosts.map((post) => (
                  <PostActivityCard key={post.id} post={post} variant="post" />
                ))
              )}
            </div>

            <div
              id="profile-activity-panel-replies"
              role="tabpanel"
              aria-labelledby="profile-activity-tab-replies"
              hidden={tab !== "replies"}
              className="space-y-3"
            >
              {!replyPosts.length ? (
                <EmptyActivity message="No replies yet. When they reply in a thread, it shows up here." />
              ) : (
                replyPosts.map((post) => (
                  <PostActivityCard key={post.id} post={post} variant="reply" />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function EmptyActivity({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PostActivityCard({ post, variant }: { post: ProfileActivityPost; variant: "post" | "reply" }) {
  const t = post.thread;
  if (!t) return null;
  const href = threadHref(t.slug, t.id);

  return (
    <article className="rounded-xl border border-border bg-background p-4 transition hover:border-primary/25">
      <div className="flex items-start gap-2">
        {variant === "reply" ? (
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
            Reply
          </span>
        ) : (
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Post
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground line-clamp-4">{post.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>In </span>
            <Link href={href} className="font-medium text-primary hover:underline">
              {t.title}
            </Link>
            {t.isClosed ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">Closed</span>
            ) : null}
            <span aria-hidden>·</span>
            <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
          </div>
          <div className="mt-2">
            <Link
              href={href}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Open thread
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
