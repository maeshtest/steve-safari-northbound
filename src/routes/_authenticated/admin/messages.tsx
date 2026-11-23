import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, RequireAdmin, fmtDate } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/messages")({ component: () => <RequireAdmin><Messages /></RequireAdmin> });

function Messages() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const toggle = async (id: string, handled: boolean) => {
    await supabase.from("contact_messages").update({ handled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-messages"] });
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Support messages" description="Messages sent from the Contact and Support pages." />
      {q.data?.length === 0 && <EmptyState>No messages yet.</EmptyState>}
      <div className="space-y-3">
        {q.data?.map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{m.name} <span className="text-sm text-muted-foreground">· {m.email}{m.phone ? ` · ${m.phone}` : ""}</span></p>
                <p className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</p>
              </div>
              <Button size="sm" variant={m.handled ? "outline" : "default"} onClick={() => toggle(m.id, !m.handled)}>
                {m.handled ? "Mark as open" : "Mark handled"}
              </Button>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
