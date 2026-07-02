"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedAuthor, FeedItemCommentsOnMyPost } from "../types";
import { FeedCard, AuthorTag, formatFeedTime, threadHref } from "./feedShared";

function ReplySnippetRow({
  content,
  createdAt,
  author,
}: {
  content?: string;
  createdAt: string;
  author: FeedAuthor | null;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <AuthorTag author={author} />
        <span className="text-xs text-muted-foreground">{formatFeedTime(createdAt)}</span>
      </div>
      {content ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{content}</p>
      ) : null}
    </div>
  );
}

export default function CommentsOnMyPostCard({ item }: { item: FeedItemCommentsOnMyPost }) {
  const [expanded, setExpanded] = useState(false);
  const th = item.thread;
  const total = item.commentCount;
  const shown = item.comments.length;
  const moreInGroup = Math.max(0, total - shown);
  const hasMultipleInPreview = item.comments.length > 1;

  return (
    <FeedCard accent="amber">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>On your posts</span>
          </div>
          {total > 1 ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              {total} on one post
            </span>
          ) : null}
        </div>
        <time className="text-xs text-muted-foreground" dateTime={item.timestamp}>
          {formatFeedTime(item.timestamp)}
        </time>
      </div>
      {item.parentPost?.content ? (
        <p className="mt-2 line-clamp-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm italic text-muted-foreground">
          “{item.parentPost.content}”
        </p>
      ) : null}
      {th ? (
        <Link
          href={threadHref(th.slug)}
          className="mt-2 inline-block text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          {th.title}
        </Link>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {total} new {total === 1 ? "reply" : "replies"}
        {moreInGroup > 0 ? ` · preview shows latest ${shown}` : ""}
      </p>

      {item.comments[0] ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {total > 1 ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest reply</p>
          ) : null}
          <ReplySnippetRow
            content={item.comments[0].content}
            createdAt={item.comments[0].createdAt}
            author={item.comments[0].author}
          />
        </div>
      ) : null}

      {hasMultipleInPreview ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-1.5 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            {expanded ? "Hide older replies in preview" : `Show all ${shown} replies in preview`}
          </Button>
        </div>
      ) : null}

      {expanded && item.comments.length > 1 ? (
        <ul className="mt-2 space-y-2 border-t border-dashed border-border/60 pt-3">
          {item.comments.slice(1).map((c) => (
            <li key={c.id}>
              <ReplySnippetRow content={c.content} createdAt={c.createdAt} author={c.author} />
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
              +{moreInGroup} more {moreInGroup === 1 ? "reply" : "replies"} in thread
            </span>
          ) : null}
        </div>
      ) : null}
    </FeedCard>
  );
}
