"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThreadCard from "./ThreadCard";
import { Button } from "@/components/ui/button";
import { fetchForumTags, fetchForumThreads } from "./api";
import type { ForumTag, ForumThreadListItem } from "./types";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type ScopeFilter = "all" | "general" | "team" | "match";

export default function ThreadList() {
  const { isAuthenticated, user } = useAuth();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [teams, setTeams] = useState<Array<{ id: number; name: string; slug?: string }>>([]);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [threads, setThreads] = useState<ForumThreadListItem[]>([]);
  const [limit, setLimit] = useState(30);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tags, setTags] = useState<ForumTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [threadsRes, tagsRes, teamsRes] = await Promise.all([
          fetchForumThreads({
            q: query || undefined,
            team: teamQuery || undefined,
            tags: tagFilter ?? undefined,
            limit,
            offset,
          }),
          fetchForumTags(),
          fetch("/api/teams", { method: "GET", cache: "no-store" }).then((r) => r.ok ? r.json() : []),
        ]);

        if (isCancelled) return;
        setThreads(threadsRes.threads ?? []);
        setTotal(threadsRes.total ?? null);
        setHasMore(Boolean(threadsRes.hasMore));
        setTags(tagsRes.tags ?? []);
        setTeams(teamsRes ?? []);
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load threads");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const timeout = setTimeout(load, 220);
    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [query, teamQuery, tagFilter, limit, offset]);

  const visibleThreads = useMemo(() => {
    if (scope === "general") return threads.filter((t) => t.teamId === null && t.matchId === null);
    if (scope === "team") return threads.filter((t) => t.teamId !== null && t.matchId === null);
    if (scope === "match") return threads.filter((t) => t.matchId !== null);
    return threads;
  }, [threads, scope]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  useEffect(() => {
    // Reset pagination when filters change
    setOffset(0);
  }, [query, teamQuery, tagFilter, scope]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[220px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, author, tags..."
              className="w-full h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <select
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              className="w-full h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
            >
              <option value="">All teams</option>
              {sortedTeams.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeFilter)}
              className="w-full h-10 rounded-md border border-border px-3 py-2 bg-background text-foreground"
            >
              <option value="all">All Threads</option>
              <option value="general">League Threads</option>
              <option value="team">Team Threads</option>
              <option value="match">Match Threads</option>
            </select>
          </div>
          {/* {isAuthenticated ? (
            <div className="w-full sm:w-auto sm:ml-auto">
              <Button asChild size="lg" className="w-full sm:w-auto whitespace-nowrap">
                <Link href="/threads/new" className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>New Thread</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="w-full sm:w-auto sm:ml-auto">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto whitespace-nowrap">
                <Link href="/login?next=%2Fthreads">Sign in to create thread</Link>
              </Button>
            </div>
          )} */}

                {isAuthenticated &&
            <div className="w-full sm:w-auto sm:ml-auto">
              <Button asChild size="lg" className="w-full sm:w-auto whitespace-nowrap h-10">
                <Link href="/create-thread" className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>New Thread</span>
                </Link>
              </Button>
            </div>
          }
        </div>

        {/* Popular tags for small screens: show below filters and above thread list */}
        <div className="block lg:hidden p-4 rounded-lg border border-border bg-card">
          <h4 className="font-semibold mb-2">Popular Tags</h4>
          <div className="flex flex-col gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setTagFilter((s) => (s === tag.slug ? null : tag.slug))}
                className={`text-sm px-3 py-2 rounded-full text-left ${tagFilter === tag.slug
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "bg-muted/20 text-muted-foreground"
                  }`}
              >
                <span className="font-medium">#{tag.name}</span>
                <span className="ml-1 opacity-70">({tag.threadCount})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading threads...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && visibleThreads.length === 0 && (
            <p className="text-sm text-muted-foreground">No threads found for the current filters.</p>
          )}
          {!loading && !error && visibleThreads.map((t) => <ThreadCard key={t.id} thread={t} isAdmin={user?.role === "ADMIN"} />)}
          {/* Pagination controls */}
          <div className="flex items-center gap-3 mt-4">
            <Button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
            <div className="text-sm text-muted-foreground">{offset + 1} - {Math.min((offset + limit), (total ?? (offset + threads.length)))} of {total ?? "?"}</div>
            <Button disabled={!hasMore || loading} onClick={() => setOffset(offset + limit)}>Next</Button>
          </div>
        </div>
      </div>

      <aside className="space-y-4 hidden lg:block">
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="font-semibold mb-2">Popular Tags</h4>
          <div className="flex flex-col gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setTagFilter((s) => (s === tag.slug ? null : tag.slug))}
                className={`text-sm px-3 py-2 rounded-full text-left ${tagFilter === tag.slug
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "bg-muted/20 text-muted-foreground"
                  }`}
              >
                <span className="font-medium">#{tag.name}</span>
                <span className="ml-1 opacity-70">({tag.threadCount})</span>
              </button>
            ))}
          </div>
        </div>

      </aside>
    </div>
  );
}
