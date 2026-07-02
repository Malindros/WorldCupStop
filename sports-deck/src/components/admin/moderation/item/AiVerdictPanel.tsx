import type { QueueAiVerdict } from "../types";
import { getToxicityClass, getVerdictClass, toxicityPercent } from "./styles";

type Props = {
  verdict: QueueAiVerdict;
};

export default function AiVerdictPanel({ verdict }: Props) {
  const toxicity = toxicityPercent(verdict?.toxicityScore ?? null);

  return (
    <section className="rounded-xl border border-border/80 bg-background/60 p-3">
      <h3 className="text-sm font-semibold text-foreground">AI Verdict</h3>
      {verdict ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-foreground">Verdict:</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getVerdictClass(verdict.verdict)}`}>
              {verdict.verdict}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-foreground">Toxicity:</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getToxicityClass(verdict.toxicityScore)}`}>
              {toxicity !== null ? `${toxicity}%` : "N/A"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {verdict.explanation || "No explanation was provided by the model."}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No AI verdict is available for this item.</p>
      )}
    </section>
  );
}
