import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATE_LABELS, STAGE_LABELS, type MemberStage, type PaymentState } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAdmin } from "./admin-context";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-medium">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const stageTone: Record<MemberStage, string> = {
  registered: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning/25 text-warning-foreground",
  approved: "bg-primary/15 text-primary",
  sponsorship_approved: "bg-accent/30 text-accent-foreground",
  waiting_for_flight: "bg-chart-3/20 text-primary",
  alumni: "bg-primary text-primary-foreground",
  rejected: "bg-destructive/15 text-destructive",
  withdrawn: "bg-destructive/10 text-destructive",
};

export function StageBadge({ stage }: { stage: MemberStage }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", stageTone[stage])}>{STAGE_LABELS[stage]}</span>;
}

export function PaymentBadge({ status }: { status: PaymentState }) {
  return (
    <Badge variant={status === "paid" ? "default" : status === "failed" ? "destructive" : "secondary"} className="font-medium">
      {PAYMENT_STATE_LABELS[status]}
    </Badge>
  );
}

export function TxnBadge({ status }: { status: string }) {
  const tone = status === "success" ? "bg-success/15 text-success" : status === "failed" || status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-warning/25 text-warning-foreground";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", tone)}>{status}</span>;
}

export function RequireAdmin({ children, superOnly = false }: { children: ReactNode; superOnly?: boolean }) {
  const { isAdmin, isSuper } = useAdmin();
  if (superOnly ? !isSuper : !isAdmin) {
    return <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">You don't have permission to view this section.</div>;
  }
  return <>{children}</>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function fmtDate(d: string | null | undefined, withTime = true) {
  if (!d) return "Not recorded";
  return new Date(d).toLocaleString("en-KE", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
