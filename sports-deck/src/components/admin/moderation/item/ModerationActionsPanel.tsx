import { EyeOff, Gavel, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModerationAction, QueueItem } from "../types";

type Props = {
  item: QueueItem;
  loadingAction: ModerationAction | null;
  onAction: (item: QueueItem, action: ModerationAction) => Promise<void>;
};

export default function ModerationActionsPanel({ item, loadingAction, onAction }: Props) {
  return (
    <section className="rounded-xl border border-border/80 bg-background/60 p-3">
      <h3 className="text-sm font-semibold text-foreground">Actions</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
          onClick={() => onAction(item, "dismiss")}
          disabled={loadingAction !== null}
        >
          <Trash2 className="h-4 w-4" />
          {loadingAction === "dismiss" ? "Working..." : "Dismiss all reports"}
        </Button>

        <Button
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          onClick={() => onAction(item, "remove")}
          disabled={loadingAction !== null}
        >
          <EyeOff className="h-4 w-4" />
          {loadingAction === "remove" ? "Working..." : item.type === "POST" ? "Hide Post" : "Hide Thread"}
        </Button>

        <Button
          variant="destructive"
          onClick={() => onAction(item, "ban_user")}
          disabled={loadingAction !== null}
        >
          <Gavel className="h-4 w-4" />
          {loadingAction === "ban_user" ? "Working..." : "Ban User"}
        </Button>
      </div>
    </section>
  );
}
