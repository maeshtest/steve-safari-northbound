import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock, FileStack, GraduationCap, Plane, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getIntegrationStatus } from "@/lib/admin.functions";
import { PageHeader, PaymentBadge, RequireAdmin, StageBadge, fmtDate } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/admin-context";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => (
    <RequireAdmin>
      <Overview />
    </RequireAdmin>
  ),
});

type Stats = Record<"total" | "paid" | "pending" | "approved" | "sponsorship" | "flight" | "alumni" | "rejected" | "revenue" | "unread_messages", number>;

function Overview() {
  const me = useAdmin();
  const integrations = useServerFn(getIntegrationStatus);
  const stats = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_overview");
      if (error) throw error;
      return data as Stats;
    },
  });
  const status = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => integrations() });
  const recent = useQuery({
    queryKey: ["admin", "recent-apps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("id, reference, full_name, county, stage, payment_status, created_at").order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const s = stats.data;
  const cards = [
    { label: "Total registrations", value: s?.total, icon: FileStack },
    { label: "Paid registrations", value: s?.paid, icon: CheckCircle2 },
    { label: "Pending applications", value: s?.pending, icon: Clock },
    { label: "Approved members", value: s?.approved, icon: Users },
    { label: "Sponsorship beneficiaries", value: s?.sponsorship, icon: Award },
    { label: "Awaiting flights", value: s?.flight, icon: Plane },
    { label: "Alumni", value: s?.alumni, icon: GraduationCap },
    { label: "Registration revenue", value: s ? `KES ${s.revenue.toLocaleString()}` : undefined, icon: Banknote },
  ];

  return (
    <>
      <PageHeader title={`Welcome${me.fullName ? `, ${me.fullName.split(" ")[0]}` : ""}`} description="A live overview of Steve Safari registrations and members." />
      {status.data && (!status.data.payhero.configured || !status.data.email.configured) && (
        <div className="mb-6 space-y-3">
          {!status.data.payhero.configured && (
            <Warning title="PayHero is not configured" body="Applicants cannot pay the KES 500 registration fee until PayHero credentials are added." />
          )}
          {!status.data.email.configured && (
            <Warning title="Email provider is not configured" body="Notification emails are recorded in history as “not configured” and are not delivered." />
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-3 font-display text-3xl font-medium text-primary">{c.value ?? "Not available"}</p>
          </div>
        ))}
      </div>
      {s && s.unread_messages > 0 && (
        <Link to="/admin/messages" className="mt-4 block rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          You have <strong>{s.unread_messages}</strong> unhandled contact {s.unread_messages === 1 ? "message" : "messages"} →
        </Link>
      )}
      <div className="mt-10 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-medium">Latest registrations</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/admin/applications">View all <ArrowRight /></Link></Button>
        </div>
        {recent.data?.length ? (
          <ul className="divide-y divide-border">
            {recent.data.map((a) => (
              <li key={a.id}>
                <Link to="/admin/applications/$id" params={{ id: a.id }} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.reference} · {a.county} · {fmtDate(a.created_at)}</p>
                  </div>
                  <div className="flex gap-2"><StageBadge stage={a.stage} /><PaymentBadge status={a.payment_status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">{recent.isLoading ? "Loading…" : "No registrations yet."}</p>
        )}
      </div>
    </>
  );
}

function Warning({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/60 bg-warning/15 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-warning-foreground" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline"><Link to="/admin/settings">Configure</Link></Button>
    </div>
  );
}
