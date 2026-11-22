import { Check } from "lucide-react";
import { STAGE_LABELS, type MemberStage } from "@/lib/constants";
import { cn } from "@/lib/utils";

const FLOW: MemberStage[] = ["registered", "pending_approval", "approved", "sponsorship_approved", "waiting_for_flight", "alumni"];

export function StageTimeline({ stage }: { stage: MemberStage }) {
  const closed = stage === "rejected" || stage === "withdrawn";
  const idx = FLOW.indexOf(stage);
  return (
    <ol className="grid gap-2 sm:grid-cols-6">
      {FLOW.map((s, i) => {
        const done = !closed && i < idx;
        const current = !closed && i === idx;
        return (
          <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-accent bg-accent text-accent-foreground",
                !done && !current && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("text-xs leading-tight", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{STAGE_LABELS[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}
