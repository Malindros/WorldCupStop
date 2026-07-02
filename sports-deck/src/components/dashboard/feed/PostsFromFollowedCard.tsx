"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedAuthor, FeedItemPostsFromFollowed } from "../types";
import { FeedCard, AuthorTag, formatFeedTime, threadHref } from "./feedShared";

function PostSnippetRow({
  content,
  createdAt,
  author,
  badge,
}: {
  content?: string;
  createdAt: string;
  author: FeedAuthor | null;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <AuthorTag author={author} />
        <span className="text-xs text-muted-foreground">{formatFeedTime(createdAt)}</span>
        {badge}
      </div>
      {content ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{content}</p>
      ) : null}
    </div>
  );
}

export default function PostsFromFollowedCard({ item }: { item: FeedItemPostsFromFollowed }) {
  const [expanded, setExpanded] = useState(false);
  const th = item.thread;
  const total = item.postCount;
  const shown = item.posts.length;
  const moreInGroup = Math.max(0, total - shown);
  const hasMultipleInPreview = item.posts.length > 1;
  const latest = item.posts[0];

  return (
    <FeedCard accent="violet">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <span>From people you follow</span>
          </div>
          {total > 1 ? (
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
              {total} in one thread
            </span>
          ) : null}
        </div>
        <time className="text-xs text-muted-foreground" dateTime={item.timestamp}>
          {formatFeedTime(item.timestamp)}
        </time>
      </div>
      {th ? (
        <Link
          href={threadHref(th.slug)}
          className="mt-2 block text-lg font-semibold leading-snug text-foreground hover:text-primary hover:underline"
        >
          {th.title}
        </Link>
      ) : (
        <p className="mt-2 text-lg font-semibold text-muted-foreground">Thread</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {total} new {total === 1 ? "post" : "posts"}
        {th ? " in this conversation" : ""}
        {moreInGroup > 0 ? ` · preview shows latest ${shown}` : ""}
      </p>

      {latest ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {total > 1 ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest</p>
          ) : null}
          <PostSnippetRow
            content={latest.content}
            createdAt={latest.createdAt}
            author={latest.author}
            badge={
              latest.isReply ? (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Reply
                </span>
              ) : null
            }
          />
        </div>
      ) : null}

      {hasMultipleInPreview ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-1.5 text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            {expanded ? "Hide older in this batch" : `Show all ${shown} in feed preview`}
          </Button>
        </div>
      ) : null}

      {expanded && item.posts.length > 1 ? (
        <ul className="mt-2 space-y-2 border-t border-dashed border-border/60 pt-3">
          {item.posts.slice(1).map((p) => (
            <li key={p.id}>
              <PostSnippetRow
                content={p.content}
                createdAt={p.createdAt}
                author={p.author}
                badge={
                  p.isReply ? (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      Reply
                    </span>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {th?.slug ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={threadHref(th.slug)}>Open thread</Link>
          </Button>
          {moreInGroup > 0 ? (
            <span className="self-center text-xs text-muted-foreground">
              +{moreInGroup} more {moreInGroup === 1 ? "post" : "posts"} in thread
            </span>
          ) : null}
        </div>
      ) : null}
    </FeedCard>
  );
}
