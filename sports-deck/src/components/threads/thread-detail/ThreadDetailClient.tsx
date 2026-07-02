"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EllipsisVertical, Flag, MessageCircle, Trash2, Pencil} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReportModal from "@/components/reports/ReportModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  createThreadReply,
  fetchThreadSentimentById,
  fetchThreadById,
  fetchThreadPostsById,
  lookupThreadIdBySlug,
  reportThreadById,
  deleteThreadById,
  editThreadById,
} from "./api";
import type { UserReportReasonCode } from "@/lib/reportReasons";
import PostCard from "./PostCard";
import ThreadSentimentPanel from "./ThreadSentimentPanel";
import PollsPanel from "./PollsPanel";
import type { ThreadDetail, ThreadPost, ThreadSentimentResponse } from "./types";

function formatDate(v: string) {
  const d = new Date(v);
  return d.toLocaleString();
}

function formatOpenIn(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.ceil(diff / 3600000);
  if (hours >= 48) {
    const days = Math.ceil(diff / 86400000);
    return `${days} DAYS`;
  }
  return `${hours} HOURS`;
}

// Stable inline reply editor component (defined outside the main component
// so it isn't recreated on every render which would cause remounts/focus)
function InlineReplyEditor({
  parentId,
  parentAuthor,
  inlineReply,
  setInlineReply,
  submitReply,
  posting,
  threadIsHidden,
  error,
  setReplyToPostId,
}: {
  parentId?: number;
  parentAuthor?: string | null;
  inlineReply: string;
  setInlineReply: (v: string) => void;
  submitReply: (parentId?: number) => Promise<void>;
  posting: boolean;
  threadIsHidden?: boolean;
  error?: string | null;
  setReplyToPostId: (id: number | null) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Replying to {parentAuthor ? parentAuthor : parentId ? `post ${parentId}` : "thread"}
        </div>
        <button type="button" className="text-sm hover:underline" onClick={() => setReplyToPostId(null)}>Cancel</button>
      </div>
      <textarea
        ref={taRef}
        value={inlineReply}
        onChange={(e) => setInlineReply(e.target.value)}
        placeholder={threadIsHidden ? "Thread is hidden. Replies are disabled." : "Write your reply..."}
        className="min-h-20 w-full resize-y bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        disabled={threadIsHidden}
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={() => submitReply(parentId)} disabled={threadIsHidden || posting || !inlineReply.trim()}>
          {posting ? "Posting..." : "Post Reply"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
export default function ThreadDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { authedFetch, status, user } = useAuth();
  const PAGE_LIMIT = 10;
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [sentiment, setSentiment] = useState<ThreadSentimentResponse | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const [sentimentRefreshKey, setSentimentRefreshKey] = useState(0);
  const [offset, setOffset] = useState(0);
  // `totalRoots` is the number of root posts (parentPostId === null) used for pagination
  const [totalRoots, setTotalRoots] = useState(0);
  // `totalPostsCount` is the total number of posts in the thread (including replies)
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [firstPostCreatedAt, setFirstPostCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [inlineReply, setInlineReply] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<number | null>(null);
  const [threadReportOpen, setThreadReportOpen] = useState(false);
  const [threadReportFeedback, setThreadReportFeedback] = useState<string | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);
  const [deleteThreadDialogOpen, setDeleteThreadDialogOpen] = useState(false);
  const [editingThread, setEditingThread] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState(""); // comma separated
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loadThread = async () => {
      try {
        setLoading(true);
        setError(null);
        const lookup = await lookupThreadIdBySlug(slug);
        const [t, firstSlice] = await Promise.all([
          fetchThreadById(lookup.id),
          fetchThreadPostsById(lookup.id, 0, 1),
        ]);

        if (!cancelled) {
          setThreadId(lookup.id);
          setThread(t);
          setTotalRoots(firstSlice.totalPosts);
          setTotalPostsCount(firstSlice.totalPostsCount ?? firstSlice.posts.length);
          setFirstPostCreatedAt(firstSlice.posts[0]?.createdAt ?? t.createdAt);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load thread");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!threadId) return;

    let cancelled = false;
    const loadPosts = async () => {
      try {
        setError(null);
        const data = await fetchThreadPostsById(threadId, offset, PAGE_LIMIT);
        if (!cancelled) {
          setPosts(data.posts);
          setTotalRoots(data.totalPosts);
          setTotalPostsCount(data.totalPostsCount ?? data.posts.length);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load posts");
      }
    };
    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [threadId, offset]);

  useEffect(() => {
    if (!threadId || !thread?.matchId || status !== "authenticated") {
      setSentiment(null);
      setSentimentError(null);
      setSentimentLoading(false);
      return;
    }

    let cancelled = false;
    const loadSentiment = async () => {
      try {
        setSentimentLoading(true);
        setSentimentError(null);
        const data = await fetchThreadSentimentById(threadId, authedFetch);
        if (!cancelled) {
          setSentiment(data);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load sentiment";
        if (!cancelled) {
          if (message === "Unauthorized") {
            setSentiment(null);
            return;
          }
          setSentimentError(message);
        }
      } finally {
        if (!cancelled) {
          setSentimentLoading(false);
        }
      }
    };

    loadSentiment();

    return () => {
      cancelled = true;
    };
  }, [threadId, thread?.matchId, totalPostsCount, sentimentRefreshKey, status, authedFetch]);

  const totalPages = Math.max(Math.ceil(totalRoots / PAGE_LIMIT), 1);
  const currentPage = Math.floor(offset / PAGE_LIMIT) + 1;

  const grouped = useMemo(() => {
    const roots = posts.filter((p) => p.parentPostId === null);
    const byParent = new Map<number, ThreadPost[]>();

    for (const p of posts) {
      if (p.parentPostId !== null) {
        const list = byParent.get(p.parentPostId) ?? [];
        list.push(p);
        byParent.set(p.parentPostId, list);
      }
    }

    return { roots, byParent };
  }, [posts]);

  const submitReply = async (parentId?: number) => {
    if (!thread) return;
    const content = (parentId ? inlineReply : reply).trim();
    if (!content) return;

    try {
      setPosting(true);
      setError(null);
      await createThreadReply(thread.id, content, authedFetch, parentId ?? undefined);
      if (parentId) setInlineReply(""); else setReply("");
      setReplyToPostId(null);

      const countSlice = await fetchThreadPostsById(thread.id, 0, 1);
      const nextTotalRoots = countSlice.totalPosts;
      const nextLastOffset = parentId ? offset : Math.max(Math.ceil(nextTotalRoots / PAGE_LIMIT) - 1, 0) * PAGE_LIMIT;
      setOffset(nextLastOffset);

      const refreshed = await fetchThreadPostsById(thread.id, nextLastOffset, PAGE_LIMIT);
      setPosts(refreshed.posts);
      setTotalRoots(nextTotalRoots);
      setTotalPostsCount(refreshed.totalPostsCount ?? refreshed.posts.length);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to post reply";
      if (message === "Unauthorized") {
        const next = encodeURIComponent(`/threads/${slug}`);
        router.push(`/login?next=${next}`);
        return;
      }
      setError(message);
    } finally {
      setPosting(false);
    }
  };
  

  const submitThreadReport = async ({ reasonCode, additionalComment }: { reasonCode: UserReportReasonCode; additionalComment: string | null }) => {
    if (!threadId) return;
    await reportThreadById(threadId, { reasonCode, additionalComment }, authedFetch);
    setThreadReportFeedback("Thread report submitted successfully.");
    window.setTimeout(() => setThreadReportFeedback(null), 3000);
  };

  const handleDeleteThread = async () => {
    if (!threadId) return;
    try {
      setDeletingThread(true);
      await deleteThreadById(threadId, authedFetch);
      router.push(`/threads`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete thread";
      if (message === "Unauthorized") {
        const next = encodeURIComponent(`/threads/${slug}`);
        router.push(`/login?next=${next}`);
        return;
      }
      setError(message);
    } finally {
      setDeletingThread(false);
      setDeleteThreadDialogOpen(false);
    }
  };

  const onPostDeleted = (postId: number) => {
    let wasRoot = false;
    setPosts((current) => {
      const found = current.find((p) => p.id === postId);
      if (found && found.parentPostId === null) wasRoot = true;
      return current.map((post) =>
        post.id === postId
          ? {
              ...post,
              isHidden: true,
            }
          : post,
      );
    });
    setTotalPostsCount((current) => Math.max(current - 1, 0));
    if (wasRoot) setTotalRoots((current) => Math.max(current - 1, 0));
    setSentimentRefreshKey((k) => k + 1);
  };

  const onPostEdited = (updated: { id: number; content: string; lastEditedAt: string | null }) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === updated.id
          ? {
              ...post,
              content: updated.content,
              lastEditedAt: updated.lastEditedAt,
            }
          : post,
      ),
    );
    setSentimentRefreshKey((k) => k + 1);
  };

  const replyToPost = replyToPostId ? posts.find((p) => p.id === replyToPostId) ?? null : null;
  const replyExcerpt = replyToPost ? replyToPost.content.replace(/\s+/g, " ").trim() : "";

  if (loading) {
    return <div className="h-full overflow-y-auto p-8 text-muted-foreground">Loading thread...</div>;
  }

  if (error && !thread) {
    return <div className="h-full overflow-y-auto p-8 text-red-600">{error}</div>;
  }

  if (!thread) {
    return <div className="h-full overflow-y-auto p-8 text-muted-foreground">Thread not found.</div>;
  }

  const authorName = thread.author?.username ?? "System";
  const avatarUrl = thread.author?.avatar?.url;
  const threadTypeLabel = thread.matchId !== null
    ? "Match Thread"
    : thread.teamId !== null
      ? "Team Thread"
      : "League Thread";

  const headerAccentColor = thread.matchId !== null ? '#059669' : (thread.teamId !== null ? '#6366F1' : '#0EA5E9');
  const badgeClass = thread.matchId !== null ? 'bg-emerald-100 text-emerald-800' : (thread.teamId !== null ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800');
  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.id !== undefined && thread.author?.id === user.id;
  const canManageThread = (isAdmin || isOwner) && !thread.isHidden && thread.isWithinWindow !== false;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-8 relative">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="order-1 min-w-0 rounded-2xl border border-border bg-card p-5" style={{ borderLeft: `6px solid ${headerAccentColor}` }}>
            {editingThread ? (
              <div className="mb-3">
                <label className="block text-sm mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mb-2 w-full rounded-md border px-3 py-2 bg-background text-foreground"
                />
                <label className="block text-sm mb-1">Tags (comma-separated)</label>
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                />
                <div className="mt-2 flex gap-2">
                  <Button onClick={async () => {
                    if (!thread) return;
                    try {
                      setSavingEdit(true);
                      setEditError(null);
                      const tagsArray = editTags.split(",").map(t => t.trim()).filter(Boolean);
                      const updated = await editThreadById(thread.id, { title: editTitle, tags: tagsArray }, authedFetch);
                      setThread(updated);
                      setEditingThread(false);
                    } catch (e) {
                      const message = e instanceof Error ? e.message : "Failed to save";
                      if (message === "Unauthorized") {
                        const next = encodeURIComponent(`/threads/${slug}`);
                        router.push(`/login?next=${next}`);
                        return;
                      }
                      setEditError(message);
                    } finally {
                      setSavingEdit(false);
                    }
                  }} disabled={savingEdit || !editTitle.trim()}>
                    {savingEdit ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingThread(false); setEditError(null); }}>
                    Cancel
                  </Button>
                </div>
                {editError ? <p className="mt-2 text-sm text-red-600">{editError}</p> : null}
              </div>
            ) : (
              <h1 className="mb-3 text-3xl font-bold break-all">{thread.title}</h1>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={authorName} width={40} height={40} unoptimized />
                ) : (
                  <span>{authorName.charAt(0)}</span>
                )}
              </div>
              {thread.author?.username ? (
                <Link href={`/profile/${thread.author.username}`} className="font-medium text-foreground hover:underline">
                  {authorName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{authorName}</span>
              )}
              <span>{formatDate(firstPostCreatedAt ?? thread.createdAt)}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${badgeClass}`}>
                {threadTypeLabel}
              </span>
              {isAdmin && thread.isHidden ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium uppercase text-amber-800">
                  Hidden
                </span>
              ) : null}
              {(() => {
                const openIn = formatOpenIn((thread as any).autoOpenAt);
                if (openIn) {
                  return (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium uppercase text-yellow-800">
                      OPEN IN {openIn}
                    </span>
                  );
                }
                if (thread.isWithinWindow === false) {
                  return (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase text-slate-800">
                      Closed
                    </span>
                  );
                }
                return null;
              })()}
              <span className="rounded-full bg-muted/50 px-2 py-1">{Math.max(totalPostsCount, 0)} replies</span>
              {status === "authenticated" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Thread options">
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 min-w-56">
                    {canManageThread ? (
                      <DropdownMenuItem onClick={() => {
                        setEditingThread(true);
                        setEditTitle(thread.title);
                        setEditTags(thread.tags.map(t => t.name).join(", "));
                      }}>
                        <Pencil className="h-4 w-4" />
                        Edit Thread
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => setThreadReportOpen(true)}>
                      <Flag className="h-4 w-4" />
                      Report Thread
                    </DropdownMenuItem>
                    {canManageThread ? (
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteThreadDialogOpen(true)} disabled={deletingThread}>
                        <Trash2 className="h-4 w-4" />
                        {deletingThread ? "Deleting..." : "Delete Thread"}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            {threadReportFeedback ? <p className="mt-3 text-sm text-emerald-600">{threadReportFeedback}</p> : null}
          </div>

          {/* Mobile polls panel - place below header to avoid collapsing into header */}
          <div className="w-full lg:hidden order-2 mb-4">
            <PollsPanel threadId={thread.id} isWithinWindow={thread.isWithinWindow} />
          </div>

          <div className="order-3 min-w-0 space-y-6 lg:col-start-1">
            <section>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold">
                <MessageCircle className="h-5 w-5" /> Discussion ({Math.max(totalPostsCount, 0)})
              </h2>

              {/* Top-level reply box (create a new root post) — placed at top per request */}
              <div className="rounded-2xl border border-border bg-card p-4 mb-4">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Reply to thread</h3>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={thread.isHidden || thread.isWithinWindow === false ? "Thread is closed. Replies are disabled." : "Join the discussion..."}
                  className="min-h-20 w-full resize-y bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  disabled={thread.isHidden || thread.isWithinWindow === false}
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={() => submitReply()} disabled={thread.isHidden || thread.isWithinWindow === false || posting || !reply.trim()}>
                    {posting ? "Posting..." : <span className={thread.isWithinWindow === false ? "line-through text-muted-foreground" : ""}>Post Reply</span>}
                  </Button>
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              </div>

              <div className="space-y-4">
                {grouped.roots.map((root) => {
                  const renderReplies = (parentId: number): React.ReactElement[] => {
                    const children = grouped.byParent.get(parentId) ?? [];
                    return children.map((child) => (
                        <div key={child.id} className="pt-3 pl-4 border-l-4 border-border">
                          <PostCard post={child} noWrapper isWithinWindow={thread.isWithinWindow} onPostDeleted={onPostDeleted} onPostEdited={onPostEdited} onReply={(id) => { setReplyToPostId(id); }} />
                              {replyToPostId === child.id ? (
                                <div className="mt-3 ml-2">
                                  <InlineReplyEditor
                                    parentId={child.id}
                                    parentAuthor={child.author?.username ?? null}
                                    inlineReply={inlineReply}
                                    setInlineReply={setInlineReply}
                                    submitReply={submitReply}
                                    posting={posting}
                                    threadIsHidden={thread?.isHidden || thread?.isWithinWindow === false}
                                    error={error}
                                    setReplyToPostId={setReplyToPostId}
                                  />
                                </div>
                              ) : null}
                          {renderReplies(child.id)}
                        </div>
                      ));
                  };

                  return (
                    <article key={root.id} className="group rounded-2xl border border-border border-l-4 bg-card p-4 pl-6">
                      <PostCard post={root} noWrapper isWithinWindow={thread.isWithinWindow} onPostDeleted={onPostDeleted} onPostEdited={onPostEdited} onReply={(id) => { setReplyToPostId(id); }} />
                      {replyToPostId === root.id ? (
                        <div className="mt-3 ml-2">
                          <InlineReplyEditor
                            parentId={root.id}
                            parentAuthor={root.author?.username ?? null}
                            inlineReply={inlineReply}
                            setInlineReply={setInlineReply}
                            submitReply={submitReply}
                            posting={posting}
                            threadIsHidden={thread?.isHidden || thread?.isWithinWindow === false}
                            error={error}
                            setReplyToPostId={setReplyToPostId}
                          />
                        </div>
                      ) : null}
                      {renderReplies(root.id)}
                    </article>
                  );
                })}
              </div>

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
            </section>
          </div>
        </div>

        {/* Right column (large): positioned absolute so it doesn't affect grid height */}
        <div className="hidden lg:block absolute top-8 right-0 w-96">
          <div className="max-h-[calc(100vh-6rem)] space-y-4 pr-2">
            {thread.matchId !== null && status === "authenticated" ? (
              <ThreadSentimentPanel
                sentiment={sentiment}
                loading={sentimentLoading}
                error={sentimentError}
              />
            ) : null}
            <PollsPanel threadId={thread.id} isWithinWindow={thread.isWithinWindow} />
          </div>
        </div>
      </div>

      <ReportModal
        open={threadReportOpen}
        targetLabel="thread"
        onOpenChange={setThreadReportOpen}
        onSubmit={submitThreadReport}
      />
      <AlertDialog open={deleteThreadDialogOpen} onOpenChange={setDeleteThreadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteThread}>
              {deletingThread ? "Deleting..." : "Delete Thread"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
