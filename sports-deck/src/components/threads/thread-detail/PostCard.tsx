"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { EllipsisVertical, Flag, History, Languages, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import ReportModal from "@/components/reports/ReportModal";
import { deletePostById, reportPostById, translatePostToEnglish, editPostById, fetchPostHistoryById } from "./api";
import type { UserReportReasonCode } from "@/lib/reportReasons";
import type { ThreadPost } from "./types";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString();
}

export default function PostCard({ post, nested = 0, onPostDeleted, onPostEdited, onReply, noWrapper = false, isWithinWindow = true }: { post: ThreadPost; nested?: number; onPostDeleted?: (postId: number) => void; onPostEdited?: (updated: { id: number; content: string; lastEditedAt: string | null }) => void; onReply?: (postId: number) => void; noWrapper?: boolean; isWithinWindow?: boolean }) {
  const { status, authedFetch, user } = useAuth();
  const isAuthenticated = status === "authenticated";
  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.id !== undefined && post.author?.id === user.id;
  const canManagePost = (isAdmin || isOwner) && !post.isHidden && isWithinWindow !== false;
  const authorName = post.author?.username ?? "System";
  const avatarUrl = post.author?.avatar?.url;
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<import("./api").PostHistoryResponse | null>(null);

  const contentToDisplay = showTranslated && translatedText ? translatedText : post.content;

  const onTranslate = async () => {
    if (!isAuthenticated) return;

    try {
      setTranslating(true);
      setTranslationError(null);
      const data = await translatePostToEnglish(post.id, authedFetch);
      setTranslatedText(data.translatedText);
      setShowTranslated(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to translate post";
      setTranslationError(message === "Unauthorized" ? "Please log in to translate this post" : message);
    } finally {
      setTranslating(false);
    }
  };

  const onShowOriginal = () => {
    setShowTranslated(false);
    setTranslationError(null);
  };

  const submitPostReport = async ({ reasonCode, additionalComment }: { reasonCode: UserReportReasonCode; additionalComment: string | null }) => {
    if (!isAuthenticated) throw new Error("Please log in to report this post");
    await reportPostById(post.id, { reasonCode, additionalComment }, authedFetch);
    setReportFeedback("Report submitted successfully.");
    window.setTimeout(() => setReportFeedback(null), 3000);
  };

  const onDeletePost = async () => {
    if (!canManagePost || deleting) return;

    try {
      setDeleting(true);
      setDeleteError(null);
      await deletePostById(post.id, authedFetch);
      onPostDeleted?.(post.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const indentClass = nested === 1 ? "ml-4 mt-3" : (nested && nested >= 2) ? "ml-16 mt-3" : "";

  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={authorName} width={44} height={44} unoptimized />
          ) : (
            <span className="text-sm text-muted-foreground">{authorName.charAt(0)}</span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {post.author?.username ? (
                <Link href={`/profile/${post.author.username}`} className="font-semibold text-foreground hover:underline">
                  {authorName}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{authorName}</span>
              )}
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{formatDate(post.createdAt)}</span>
              <span className="text-muted-foreground">{post.lastEditedAt ? ` (Edited ${formatDate(post.lastEditedAt)})` : null}</span>
              {isAdmin && post.isHidden ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase text-amber-800">
                  Hidden
                </span>
              ) : null}
            </div>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Post options">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 min-w-56">
                  {canManagePost ? (
                    <DropdownMenuItem onClick={() => { setEditing(true); setEditContent(post.content); setEditError(null); }}>
                      <Pencil className="h-4 w-4" />
                      Edit Post
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag className="h-4 w-4" />
                    Report Post
                  </DropdownMenuItem>

                  {post.lastEditedAt ? (
                    <DropdownMenuItem onClick={async () => {
                      setHistoryOpen(true);
                      setHistoryLoading(true);
                      setHistoryError(null);
                      try {
                        const data = await fetchPostHistoryById(post.id, authedFetch);
                        setHistoryData(data);
                      } catch (err) {
                        setHistoryError(err instanceof Error ? err.message : 'Failed to load history');
                      } finally {
                        setHistoryLoading(false);
                      }
                    }}>
                      <History className="h-4 w-4" />
                      View Edit History
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuItem onClick={showTranslated ? onShowOriginal : onTranslate} disabled={translating}>
                    <Languages className="h-4 w-4" />
                    {translating
                      ? "Translating..."
                      : showTranslated
                        ? "Show Original"
                        : "Translate To English"}
                  </DropdownMenuItem>

                  {canManagePost ? <DropdownMenuSeparator /> : null}
                  {canManagePost ? (
                    <DropdownMenuItem variant="destructive" onClick={onDeletePost} disabled={deleting}>
                      <Trash2 className="h-4 w-4" />
                      {deleting ? "Deleting..." : "Delete Post"}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {!editing ? (
            <p className="mt-2 whitespace-pre-wrap break-all text-[1.05rem] leading-8 text-foreground">{contentToDisplay}</p>
          ) : (
            <div className="mt-2">
              <div className="rounded-md border border-border bg-card p-3">
                <textarea
                  className="min-h-20 w-full resize-y bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditing(false); setEditContent(post.content); setEditError(null); }} disabled={savingEdit}>Cancel</Button>
                <Button onClick={async () => {
                  if (savingEdit) return;
                  const payload = editContent.trim();
                  if (!payload) { setEditError('Content is required'); return; }
                  try {
                    setSavingEdit(true);
                    setEditError(null);
                    const updated = await editPostById(post.id, payload, authedFetch);
                    onPostEdited?.({
                      id: updated.id,
                      content: updated.content,
                      lastEditedAt: updated.lastEditedAt,
                    });
                    setTranslatedText(null);
                    setShowTranslated(false);
                    setEditing(false);
                  } catch (err) {
                    setEditError(err instanceof Error ? err.message : 'Failed to edit post');
                  } finally {
                    setSavingEdit(false);
                  }
                }} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Edit Post'}</Button>
              </div>
              {editError ? <p className="mt-2 text-sm text-red-600">{editError}</p> : null}
            </div>
          )}

          {!post.isHidden ? (
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <button type="button" className={`${isWithinWindow === false ? "line-through text-muted-foreground" : "hover:underline"}`} onClick={() => { if (isWithinWindow !== false) onReply?.(post.id); }} disabled={isWithinWindow === false}>{isWithinWindow === false ? "Reply (closed)" : "Reply"}</button>
            </div>
          ) : null}
          {translationError ? <p className="mt-2 text-sm text-red-600">{translationError}</p> : null}
          {reportFeedback ? <p className="mt-2 text-sm text-emerald-600">{reportFeedback}</p> : null}
          {deleteError ? <p className="mt-2 text-sm text-red-600">{deleteError}</p> : null}
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        targetLabel="post"
        onOpenChange={setReportOpen}
        onSubmit={submitPostReport}
      />
      {historyOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-6 max-h-[80vh] overflow-auto"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Edit History</h3>
                <p className="text-sm text-muted-foreground">Post ID {post.id}</p>
              </div>
              <div>
                <Button variant="ghost" onClick={() => setHistoryOpen(false)}>Close</Button>
              </div>
            </div>

            <div className="mt-4">
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Loading history...</p>
              ) : historyError ? (
                <p className="text-sm text-red-600">{historyError}</p>
              ) : historyData ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-card p-3">
                    <div className="text-sm text-muted-foreground">Current</div>
                    <div className="mt-2 whitespace-pre-wrap break-words text-foreground">{historyData.current.content}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Updated at {new Date(historyData.current.updatedAt).toLocaleString()}</div>
                  </div>

                  {historyData.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No previous edits.</p>
                  ) : (
                    historyData.history.slice().reverse().map((h) => {
                      const original = historyData.history;
                      const originalIndex = original.findIndex((x) => x.id === h.id);
                      const displayAt = originalIndex === 0 ? historyData.createdAt : original[originalIndex - 1].editedAt;
                      return (
                        <div key={h.id} className="rounded-md border border-border bg-card p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">Edited by {h.editor?.username ?? 'System'}</div>
                            <div className="text-xs text-muted-foreground">{new Date(displayAt).toLocaleString()}</div>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap break-words text-foreground">{h.previousContent}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (noWrapper) {
    return (<div className={`p-0 ${nested ? "mt-3" : ""}`}>{inner}</div>);
  }

  return (
    <article className={`group rounded-2xl border border-border bg-card p-4 ${indentClass}`}>
      {inner}
    </article>
  );
}
