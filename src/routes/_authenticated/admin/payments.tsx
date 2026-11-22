import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getIntegrationStatus, recheckPayment } from "@/lib/admin.functions";
import { downloadCsv } from "@/lib/csv";
import { PageHeader, RequireAdmin, TxnBadge, fmtDate } from "@/components/admin/ui";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: () => (
    <RequireAdmin>
      <Payments />
    </RequireAdmin>
  ),
});

type TxnStatus = Database["public"]["Enums"]["payment_txn_status"];

function Payments() {
  const qc = useQueryClient();
  const recheck = useServerFn(recheckPayment);
  const integrations = useServerFn(getIntegrationStatus);
  const [status, setStatus] = useState<string>("all");
  const config = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => integrations() });
  const txns = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: async () => {
      let q = supabase.from("payments").select("*, applications(full_name, reference)").order("created_at", { ascending: false }).limit(500);
      if (status !== "all") q = q.eq("status", status as TxnStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const callbacks = useQuery({
    queryKey: ["admin", "callbacks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_callbacks").select("*").order("received_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const total = (txns.data ?? []).filter((t) => t.status === "success").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every M-Pesa registration payment attempt, verified with PayHero."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `steve-safari-payments-${new Date().toISOString().slice(0, 10)}.csv`,
                (txns.data ?? []).map((t) => ({
                  date: t.created_at,
                  applicant: t.applications?.full_name,
                  reference: t.applications?.reference,
                  phone: t.phone,
                  amount: t.amount,
                  status: t.status,
                  mpesa_receipt: t.mpesa_receipt,
                  external_reference: t.external_reference,
                  provider_reference: t.provider_reference,
                  verified_at: t.verified_at,
                  detail: t.result_desc,
                })),
              )
            }
          >
            <Download /> Export report
          </Button>
        }
      />
      {config.data && !config.data.payhero.configured && (
        <div className="mb-6 rounded-xl border border-warning/60 bg-warning/15 p-4 text-sm">
          PayHero credentials have not been configured — applicants cannot pay yet. <Link to="/admin/settings" className="font-semibold underline">Configure PayHero</Link>
        </div>
      )}
      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="callbacks">Callback logs</TabsTrigger>
        </TabsList>
        <TabsContent value="txns" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["initiated", "queued", "success", "failed", "cancelled"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">Verified revenue in view: <strong className="text-foreground">KES {total.toLocaleString()}</strong></p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : (txns.data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No transactions yet.</TableCell></TableRow>
                ) : (
                  txns.data!.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(t.created_at)}</TableCell>
                      <TableCell>
                        <Link to="/admin/applications/$id" params={{ id: t.application_id }} className="font-medium hover:underline">{t.applications?.full_name}</Link>
                        <p className="text-xs text-muted-foreground">{t.applications?.reference}</p>
                      </TableCell>
                      <TableCell className="text-sm">+{t.phone}</TableCell>
                      <TableCell>KES {t.amount}</TableCell>
                      <TableCell><TxnBadge status={t.status} />{t.result_desc && <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground" title={t.result_desc}>{t.result_desc}</p>}</TableCell>
                      <TableCell className="font-mono text-xs">{t.mpesa_receipt ?? "—"}</TableCell>
                      <TableCell>
                        {t.status === "queued" && (
                          <Button size="sm" variant="ghost" onClick={async () => { const r = await recheck({ data: { paymentId: t.id } }); toast.info(`PayHero status: ${r.status}`); void qc.invalidateQueries({ queryKey: ["admin"] }); }}>
                            <RefreshCw /> Re-check
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="callbacks" className="mt-4">
          {(callbacks.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No callbacks received from PayHero yet.</p>
          ) : (
            <ul className="space-y-3">
              {callbacks.data!.map((c) => (
                <li key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{c.external_reference ?? "Unknown reference"}</span>
                    <span className="flex items-center gap-2"><TxnBadge status={c.verified ? "success" : "unverified"} /><span className="text-xs text-muted-foreground">{fmtDate(c.received_at)}</span></span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.processing_result}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary">Raw payload</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(c.payload, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
