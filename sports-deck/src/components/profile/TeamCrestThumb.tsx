"use client";

import { cn } from "@/lib/utils";

function isHttpUrl(s: string | null | undefined): boolean {
  const t = typeof s === "string" ? s.trim() : "";
  return t.startsWith("https://") || t.startsWith("http://");
}

type TeamCrestThumbProps = {
  crestUrl: string | null | undefined;
  label: string;
  size?: "sm" | "md";
  className?: string;
};

/** Small crest image for team rows; falls back to initials when no URL. */
export default function TeamCrestThumb({ crestUrl, label, size = "sm", className }: TeamCrestThumbProps) {
  const px = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  if (isHttpUrl(crestUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary crest URLs from DB / APIs
      <img
        src={crestUrl!.trim()}
        alt=""
        className={cn(px, "shrink-0 rounded object-contain", className)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        px,
        "flex shrink-0 items-center justify-center rounded border border-border bg-muted text-[10px] font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
