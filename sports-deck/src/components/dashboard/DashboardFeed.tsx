"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Shield, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { fetchDashboardFeed } from "./api";
import CommentsOnMyPostCard from "./feed/CommentsOnMyPostCard";
import PostsFromFollowedCard from "./feed/PostsFromFollowedCard";
import { AuthorTag, FeedCard, formatFeedTime, threadHref } from "./feed/feedShared";
import type { FeedItem } from "./types";

const PAGE_SIZE = 15;

const getStatusLabel = (s?: string | null) => {
  const st = (s ?? '').toString().toUpperCase();
  const map: Record<string,string> = {
    SCHEDULED: 'Upcoming',
    TIMED: 'Upcoming',
    IN_PLAY: 'Live',
    PAUSED: 'Live',
    LIVE: 'Live',
    FINISHED: 'Finished',
    AWARDED: 'Finished',
    POSTPONED: 'Postponed',
    SUSPENDED: 'Suspended',
    CANCELLED: 'Cancelled'
  };
  return map[st] ?? (s ?? '');
};


function FeedItemBlock({ item }: { item: FeedItem }) {
  if (item.type === "posts_from_followed") {
    return <PostsFromFollowedCard item={item} />;
  }

  if (item.type === "comments_on_my_post") {
    return <CommentsOnMyPostCard item={item} />;
  }

  if (item.type === "match_update") {
    const m = item.match;
    const home = m.homeTeam.shortName || m.homeTeam.name;
    const away = m.awayTeam.shortName || m.awayTeam.name;
    const score =
      m.homeScore != null && m.awayScore != null ? `${m.homeScore} – ${m.awayScore}` : "vs";
    return (
      <FeedCard accent="emerald">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Volleyball className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span>Favorite team · Match</span>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={item.timestamp}>
            {formatFeedTime(item.timestamp)}
          </time>
        </div>
        <p className="mt-3 text-center font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <span className="text-muted-foreground">{home}</span>{" "}
          <span className="text-emerald-600 dark:text-emerald-400">{score}</span>{" "}
          <span className="text-muted-foreground">{away}</span>
        </p>
        <p className="mt-2 text-center text-xs capitalize text-muted-foreground">
          {getStatusLabel(m.status)}
        </p>
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/matches/${m.id}`}>Match center</Link>
          </Button>
        </div>
      </FeedCard>
    );
  }

  if (item.type === "team_thread") {
    const t = item.thread;
    return (
      <FeedCard accent="sky">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <span>Favorite team · New thread</span>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={item.timestamp}>
            {formatFeedTime(item.timestamp)}
          </time>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t.team.name}</p>
        <Link
          href={threadHref(t.slug)}
          className="mt-2 block text-lg font-semibold leading-snug text-foreground hover:text-primary hover:underline"
        >
          {t.title}
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          Started by <AuthorTag author={t.author} />
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={threadHref(t.slug)}>Join discussion</Link>
          </Button>
        </div>
      </FeedCard>
    );
  }

  return null;
}

type DashboardFeedProps = {
  /** Tighter spacing when embedded on home under the digest */
  compact?: boolean;
  className?: string;
};

export default function DashboardFeed({ compact, className }: DashboardFeedProps) {
  const { authedFetch, status } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardFeed(authedFetch, PAGE_SIZE, 0);
      setFeed(data.feed);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load feed");
      setFeed([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, status]);

  const loadMore = useCallback(async () => {
    if (status !== "authenticated" || !hasMore || loadingMore) return;
    try {
      setLoadingMore(true);
      setError(null);
      const data = await fetchDashboardFeed(authedFetch, PAGE_SIZE, feed.length);
      setFeed((prev) => [...prev, ...data.feed]);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }, [authedFetch, status, hasMore, loadingMore, feed.length]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  if (status === "loading") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading your feed…
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="dashboard-feed-heading">
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", compact && "gap-2")}>
        <div>
          <h2 id="dashboard-feed-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Your activity feed
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Newest updates from your threads, people you follow, and your favorite team's forum, grouped by threads.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 self-start sm:self-auto"
          onClick={() => void loadInitial()}
          disabled={loading || loadingMore}
        >
          <RefreshCw className={cn("h-4 w-4", (loading || loadingMore) && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>

      {loading && feed.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="mt-3" type="button" onClick={() => void loadInitial()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && feed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center sm:px-8">
          <p className="text-base font-medium text-foreground">Nothing in your feed yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow other fans from their profiles, pick a favorite team in your profile settings, and join threads — your
            personalized updates will show up here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="default">
              <Link href="/threads">Browse threads</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile/edit">Edit profile</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {!error && feed.length > 0 ? (
        <>
          <ul className={cn("space-y-4", compact && "space-y-3")}>
            {feed.map((item) => (
              <li key={item.id}>
                <FeedItemBlock item={item} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
