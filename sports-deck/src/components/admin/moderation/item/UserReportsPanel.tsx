import { ChevronDown } from "lucide-react";
import type { QueueUserReport } from "../types";
import { formatDate, getReasonLabel, getReportComment } from "./styles";

type Props = {
  reports: QueueUserReport[];
  open: boolean;
  onToggle: () => void;
};

export default function UserReportsPanel({ reports, open, onToggle }: Props) {
  return (
    <section className="rounded-xl border border-border/80 bg-background/60 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-foreground">User Reports ({reports.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No user-submitted reports. Item was flagged automatically.</p>
          ) : (
            reports.map((report) => {
              const comment = getReportComment(report);
              return (
                <div key={report.id} className="min-w-0 rounded-lg border border-border/80 p-2.5 text-sm">
                  <p className="break-all font-medium text-foreground">{getReasonLabel(report.reasonCode)}</p>
                  {comment ? <p className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">Comment: {comment}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(report.createdAt)} {report.reporter ? `• by ${report.reporter.username}` : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
