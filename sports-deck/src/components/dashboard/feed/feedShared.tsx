import Link from "next/link";
import type { ReactNode } from "react";
import { formatRelativeIsoTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

export const formatFeedTime = formatRelativeIsoTime;

export function threadHref(slug: string | null) {
  return slug ? `/threads/${encodeURIComponent(slug)}` : "/threads";
}

function profileHref(username: string) {
  return `/profile/${encodeURIComponent(username)}`;
}

export function AuthorTag({ author }: { author: { username: string } | null | undefined }) {
  const u = author?.username?.trim();
  if (!u) {
    return <span className="font-medium text-muted-foreground">Unknown user</span>;
  }
  return (
    <Link href={profileHref(u)} className="font-medium text-foreground hover:underline">
      @{u}
    </Link>
  );
}

export function FeedCard({
  children,
  accent,
}: {
  children: ReactNode;
  accent: "violet" | "amber" | "emerald" | "sky";
}) {
  const border =
    accent === "violet"
      ? "border-l-violet-500/80"
      : accent === "amber"
        ? "border-l-amber-500/80"
        : accent === "emerald"
          ? "border-l-emerald-500/80"
          : "border-l-sky-500/80";
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur-sm sm:p-5",
        "border-l-4 bg-gradient-to-br from-card to-muted/20",
        border,
      )}
    >
      {children}
    </article>
  );
}
