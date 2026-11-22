import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { changeStage } from "@/lib/admin.functions";
import { PAYMENT_STATE_LABELS, STAGE_LABELS, STAGE_ORDER, type MemberStage, type PaymentState } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { PageHeader, PaymentBadge, RequireAdmin, StageBadge, fmtDate } from "@/components/admin/ui";
import { StageChangeDialog } from "@/components/admin/StageChangeDialog";

export const Route = createFileRoute("/_authenticated/admin/applications/")({
  component: () => (
    <RequireAdmin>
      <Applications />
    </RequireAdmin>
  ),
});

const PAGE = 25;

function buildQuery(search: string, stage: string, payment: string) {
  let q = supabase.from("applications").select("id, reference, full_name, national_id, phone, email, county, stage, payment_status, public_consent, created_at, paid_at", { count: "exact" });
  if (stage !== "all") q = q.eq("stage", stage as MemberStage);
  if (payment !== "all") q = q.eq("payment_status", payment as PaymentState);
  const s = search.trim().replace(/[,()%]/g, "");
  if (s) q = q.or(`full_name.ilike.%${s}%,reference.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,national_id.ilike.%${s}%,county.ilike.%${s}%`);
  return q.order("created_at", { ascending: false });
}

function Applications() {
  const qc = useQueryClient();
  const change = useServerFn(changeStage);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stage, setStage] = useState("all");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(0);
    setSelected([]);
  }, [debounced, stage, payment]);

  const list = useQuery({
    queryKey: ["admin", "applications", debounced, stage, payment, page],
    queryFn: async () => {
      const { data, error, count } = await buildQuery(debounced, stage, payment).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await buildQuery(debounced, stage, payment).range(from, from + 999);
        if (error) throw error;
        rows.push(...data.map((r) => ({ ...r, stage: STAGE_LABELS[r.stage], payment_status: PAYMENT_STATE_LABELS[r.payment_status] })));
        if (data.length < 1000) break;
      }
      downloadCsv(`steve-safari-applications-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      await supabase.rpc("log_admin_activity", { _action: "applications.exported", _target_type: "applications", _target_id: "", _details: { count: rows.length, stage, payment } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <>
      <PageHeader
        title="Applications"
        description="Review, approve and move members through each programme stage."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, reference, ID, phone, email, county" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={payment} onValueChange={setPayment}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {(Object.keys(PAYMENT_STATE_LABELS) as PaymentState[]).map((p) => <SelectItem key={p} value={p}>{PAYMENT_STATE_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm"><strong>{selected.length}</strong> selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>Change stage</Button>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allOnPage} onCheckedChange={(v) => setSelected(v ? Array.from(new Set([...selected, ...rows.map((r) => r.id)])) : selected.filter((id) => !rows.some((r) => r.id === id)))} aria-label="Select page" />
              </TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead className="hidden md:table-cell">County</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="hidden lg:table-cell">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No applications match.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected(v ? [...selected, r.id] : selected.filter((x) => x !== r.id))} aria-label={`Select ${r.full_name}`} />
                  </TableCell>
                  <TableCell>
                    <Link to="/admin/applications/$id" params={{ id: r.id }} className="font-medium hover:text-primary hover:underline">{r.full_name}</Link>
                    <p className="text-xs text-muted-foreground">{r.reference} · {r.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{r.county}</TableCell>
                  <TableCell><StageBadge stage={r.stage} /></TableCell>
                  <TableCell><PaymentBadge status={r.payment_status} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{fmtDate(r.created_at, false)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      <StageChangeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        count={selected.length}
        onConfirm={async (stage, note, notify) => {
          const r = await change({ data: { applicationIds: selected, stage, note, notify } });
          toast.success(`Updated ${r.changed} application${r.changed === 1 ? "" : "s"}${notify ? ` · emails: ${r.emailResults["sent"] ?? 0} sent` : ""}`);
          if (notify && (r.emailResults["not_configured"] ?? 0) > 0) toast.warning("Emails were not delivered — the email provider is not configured.");
          setSelected([]);
          await qc.invalidateQueries({ queryKey: ["admin"] });
        }}
      />
    </>
  );
}
