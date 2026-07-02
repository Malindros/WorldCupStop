"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Clock, User } from "lucide-react";
import { formatRelativeIsoTime } from "@/lib/relativeTime";
import type { ForumThreadListItem } from "./types";

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

export default function ThreadCard({ thread, isAdmin = false }: { thread: ForumThreadListItem; isAdmin?: boolean }) {
  const authorName = thread.author?.username ?? "System";
  const avatarUrl = thread.author?.avatar?.url;
  const threadTypeLabel = thread.matchId !== null
    ? "Match Thread"
    : thread.teamId !== null
      ? "Team Thread"
      : "League Thread";

  const accentClass = thread.matchId !== null ? 'bg-emerald-500' : (thread.teamId !== null ? 'bg-indigo-500' : 'bg-sky-500');
  const badgeClass = thread.matchId !== null ? 'bg-emerald-100 text-emerald-800' : (thread.teamId !== null ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800');

  return (
    <article className="bg-card text-card-foreground rounded-lg border border-border overflow-hidden shadow-sm">
      <div className="flex">
        <div className={`w-1.5 ${accentClass} hidden sm:block`} aria-hidden />
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={authorName} width={48} height={48} unoptimized />
              ) : (
                <div className="text-sm text-muted-foreground">{authorName.charAt(0)}</div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold break-all">
                  <Link href={`/threads/${thread.slug ?? thread.id}`} className="hover:underline block break-all">
                    {thread.title}
                  </Link>
                </h3>
                <div className="flex items-center gap-2">
                  {isAdmin && thread.isHidden ? (
                    <span className="text-xs font-medium uppercase bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                      Hidden
                    </span>
                  ) : null}
                  {(() => {
                    const openIn = formatOpenIn((thread as any).autoOpenAt);
                    if (openIn) {
                      return (
                        <span className="text-xs font-medium uppercase bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                          OPEN IN {openIn}
                        </span>
                      );
                    }
                    if (thread.isWithinWindow === false) {
                      return (
                        <span className="text-xs font-medium uppercase bg-slate-100 text-slate-800 px-3 py-1 rounded-full">
                          Closed
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span className={`text-xs font-medium uppercase px-3 py-1 rounded-full ${badgeClass}`}>
                    {threadTypeLabel}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {thread.author?.username ? (
                    <Link href={`/profile/${thread.author.username}`} className="hover:underline text-foreground/90">
                      {authorName}
                    </Link>
                  ) : (
                    authorName
                  )}
                </span>
                <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {formatRelativeIsoTime(thread.latestActivityAt)}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {thread.replyCount} replies</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {thread.tags.map((tag) => (
                  <span key={tag.id} className="text-xs bg-muted/40 text-muted-foreground px-2 py-1 rounded-full">
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
