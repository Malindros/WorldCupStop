import Link from "next/link";
import { FileText } from "lucide-react";
import type { QueueItem, QueuePostTarget, QueueThreadTarget } from "../types";

type Props = {
  item: QueueItem;
};

export default function TargetSummary({ item }: Props) {
  if (item.type === "POST") {
    return <PostSummary target={item.target as QueuePostTarget | null} />;
  }
  return <ThreadSummary target={item.target as QueueThreadTarget | null} />;
}

function PostSummary({ target }: { target: QueuePostTarget | null }) {
  if (!target) {
    return <p className="text-sm text-muted-foreground">Post is no longer available.</p>;
  }

  return (
    <section className="min-w-0 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span>Author: {target.author?.username || "Unknown"}</span>
      </div>
      {target.thread ? (
        <p className="mt-1 text-sm">
          Thread:{" "}
          <Link href={`/threads/${target.thread.slug ?? target.thread.id}`} className="text-primary hover:underline">
            {target.thread.title}
          </Link>
        </p>
      ) : null}
      <p className="mt-2 whitespace-pre-wrap break-all text-sm text-foreground">{target.content}</p>

      {target.parentPostPreview ? (
        <div className="mt-3 min-w-0 rounded-lg border border-border/80 bg-card p-2.5 text-sm">
          <p className="font-medium text-foreground">Replying to:</p>
          <p className="text-muted-foreground">{target.parentPostPreview.author?.username || "Unknown"}</p>
          <p className="mt-1 whitespace-pre-wrap break-all text-foreground">{target.parentPostPreview.content}</p>
        </div>
      ) : null}
    </section>
  );
}

function ThreadSummary({ target }: { target: QueueThreadTarget | null }) {
  if (!target) {
    return <p className="text-sm text-muted-foreground">Thread is no longer available.</p>;
  }

  return (
    <section className="min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
      <p className="text-sm text-muted-foreground">Author: {target.author?.username || "Unknown"}</p>
      <p className="mt-1 break-all text-sm font-semibold text-foreground">{target.title}</p>
      <p className="mt-1 text-sm">
        <Link href={`/threads/${target.slug ?? target.id}`} className="text-primary hover:underline">
          Open Thread
        </Link>
      </p>

      {target.firstPostPreview ? (
        <div className="mt-3 min-w-0 rounded-lg border border-border/80 bg-card p-2.5 text-sm">
          <p className="font-medium text-foreground">First Post Preview</p>
          <p className="text-muted-foreground">{target.firstPostPreview.author?.username || "Unknown"}</p>
          <p className="mt-1 whitespace-pre-wrap break-all text-foreground">{target.firstPostPreview.content}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No visible posts are available for preview.</p>
      )}
    </section>
  );
}
