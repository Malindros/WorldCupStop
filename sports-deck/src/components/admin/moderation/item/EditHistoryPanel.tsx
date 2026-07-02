import { ChevronDown } from "lucide-react";
import type { QueuePostTarget } from "../types";
import { formatDate } from "./styles";

type Props = {
  target: QueuePostTarget | null;
  open: boolean;
  onToggle: () => void;
};

export default function EditHistoryPanel({ target, open, onToggle }: Props) {
  if (!target || target.edits.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/80 bg-background/60 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-foreground">Edit History ({target.edits.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
          {target.edits.map((edit) => (
            <div key={edit.id} className="min-w-0 rounded-lg border border-border/80 p-2.5 text-sm">
              <p className="whitespace-pre-wrap break-all text-foreground">{edit.previousContent}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(edit.editedAt)} {edit.editor ? `• by ${edit.editor.username}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
