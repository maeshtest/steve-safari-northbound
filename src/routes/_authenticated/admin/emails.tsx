import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Eye, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getIntegrationStatus, sendEmails } from "@/lib/admin.functions";
import { STAGE_LABELS, STAGE_ORDER, type MemberStage } from "@/lib/constants";
import { TEMPLATE_PLACEHOLDERS, renderTemplate } from "@/lib/templating";
import { PageHeader, RequireAdmin, TxnBadge, fmtDate } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  component: () => (
    <RequireAdmin>
      <Emails />
    </RequireAdmin>
  ),
});

const SAMPLE = { first_name: "Grace", full_name: "Grace Wanjiru", reference: "SS-26-AB12CD", stage: "Approved", message: "Please upload a clear copy of your national ID.", receipt: "SAE3YULR0Y" };

function Emails() {
  const integrations = useServerFn(getIntegrationStatus);
  const config = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => integrations() });
  return (
    <>
      <PageHeader title="Emails" description="Send individual or bulk messages, manage templates and review delivery history." />
      {config.data && !config.data.email.configured && (
        <div className="mb-6 rounded-xl border border-warning/60 bg-warning/15 p-4 text-sm">
          No email provider is configured, so messages will be recorded as “not configured” and not delivered. <Link to="/admin/settings" className="font-semibold underline">Configure email</Link>
        </div>
      )}
      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="mt-4"><Compose /></TabsContent>
        <TabsContent value="templates" className="mt-4"><Templates /></TabsContent>
        <TabsContent value="history" className="mt-4"><History /></TabsContent>
      </Tabs>
    </>
  );
}

function useTemplates() {
  return useQuery({
    queryKey: ["admin", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").order("slug", { nullsFirst: false }).order("name");
      if (error) throw error;
      return data;
    },
  });
}

function Compose() {
  const qc = useQueryClient();
  const send = useServerFn(sendEmails);
  const templates = useTemplates();
  const [mode, setMode] = useState<"stages" | "applications" | "manual">("stages");
  const [stages, setStages] = useState<MemberStage[]>(["approved"]);
  const [paidOnly, setPaidOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [manualEmail, setManualEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const recipientsCount = useQuery({
    queryKey: ["admin", "recipient-count", stages, paidOnly],
    enabled: mode === "stages" && stages.length > 0,
    queryFn: async () => {
      let q = supabase.from("applications").select("id", { count: "exact", head: true }).in("stage", stages);
      if (paidOnly) q = q.eq("payment_status", "paid");
      const { count } = await q;
      return count ?? 0;
    },
  });
  const results = useQuery({
    queryKey: ["admin", "recipient-search", search],
    enabled: mode === "applications" && search.trim().length >= 2,
    queryFn: async () => {
      const s = search.trim().replace(/[,()%]/g, "");
      const { data } = await supabase.from("applications").select("id, full_name, email, reference").or(`full_name.ilike.%${s}%,reference.ilike.%${s}%,email.ilike.%${s}%`).limit(8);
      return data ?? [];
    },
  });

  const submit = async () => {
    setBusy(true);
    try {
      const r = await send({
        data: {
          mode,
          subject,
          body,
          ...(mode === "stages" ? { stages, paidOnly } : {}),
          ...(mode === "applications" ? { applicationIds: picked.map((p) => p.id) } : {}),
          ...(mode === "manual" ? { manualEmail } : {}),
        },
      });
      if (r.not_configured > 0) toast.warning(`${r.not_configured} message(s) recorded but not delivered — email provider not configured.`);
      if (r.sent > 0) toast.success(`${r.sent} email(s) sent.`);
      if (r.failed > 0) toast.error(`${r.failed} email(s) failed. See history for details.`);
      void qc.invalidateQueries({ queryKey: ["admin", "email-logs"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSend = subject.trim().length >= 2 && body.trim().length >= 2 && (mode === "stages" ? stages.length > 0 : mode === "applications" ? picked.length > 0 : /\S+@\S+\.\S+/.test(manualEmail));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-5 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Recipients</h2>
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stages">By membership stage (bulk)</SelectItem>
            <SelectItem value="applications">Selected applicants</SelectItem>
            <SelectItem value="manual">A single email address</SelectItem>
          </SelectContent>
        </Select>
        {mode === "stages" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {STAGE_ORDER.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={stages.includes(s)} onCheckedChange={(v) => setStages(v ? [...stages, s] : stages.filter((x) => x !== s))} />
                  {STAGE_LABELS[s]}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={paidOnly} onCheckedChange={(v) => setPaidOnly(v === true)} /> Paid registrations only</label>
            <p className="text-sm text-muted-foreground">{recipientsCount.data ?? 0} recipient(s)</p>
          </div>
        )}
        {mode === "applications" && (
          <div className="space-y-3">
            <Input placeholder="Search name, reference or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            {(results.data ?? []).length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {results.data!.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => !picked.some((p) => p.id === r.id) && setPicked([...picked, r])}>
                      {r.full_name} <span className="text-xs text-muted-foreground">· {r.reference}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {picked.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                  {p.full_name}
                  <button onClick={() => setPicked(picked.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.full_name}`}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
        {mode === "manual" && <Input type="email" placeholder="name@example.com" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} />}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Message</h2>
          <Select
            onValueChange={(id) => {
              const t = templates.data?.find((x) => x.id === id);
              if (t) {
                setSubject(t.subject);
                setBody(t.body);
              }
            }}
          >
            <SelectTrigger className="w-56"><SelectValue placeholder="Start from a template" /></SelectTrigger>
            <SelectContent>
              {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="space-y-2"><Label>Body</Label><Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">Placeholders: {TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreview(true)} disabled={!body}><Eye /> Preview</Button>
          <Button onClick={submit} disabled={!canSend || busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>
        </div>
      </div>
      <PreviewDialog open={preview} onOpenChange={setPreview} subject={subject} body={body} />
    </div>
  );
}

function PreviewDialog({ open, onOpenChange, subject, body }: { open: boolean; onOpenChange: (v: boolean) => void; subject: string; body: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Preview (sample applicant)</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-secondary p-5">
          <p className="font-display text-lg text-primary">Steve Safari</p>
          <div className="mt-3 rounded-lg bg-card p-5">
            <p className="mb-3 font-semibold">{renderTemplate(subject, SAMPLE)}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{renderTemplate(body, SAMPLE)}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">KES 500 is the only registration fee. Registration does not guarantee sponsorship, flights, visas or programme acceptance.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Templates() {
  const qc = useQueryClient();
  const templates = useTemplates();
  const [editing, setEditing] = useState<{ id?: string; slug?: string | null; name: string; subject: string; body: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const payload = { name: editing.name, subject: editing.subject, body: editing.body };
    const { error } = editing.id
      ? await supabase.from("email_templates").update(payload).eq("id", editing.id)
      : await supabase.from("email_templates").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.rpc("log_admin_activity", { _action: editing.id ? "template.updated" : "template.created", _target_type: "email_template", _target_id: editing.id ?? "", _details: { name: editing.name } });
    toast.success("Template saved");
    setEditing(null);
    void qc.invalidateQueries({ queryKey: ["admin", "templates"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["admin", "templates"] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-medium">Templates</p>
          <Button size="sm" variant="outline" onClick={() => setEditing({ name: "", subject: "", body: "" })}><Plus /> New</Button>
        </div>
        <ul className="divide-y divide-border">
          {(templates.data ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-5 py-3">
              <button className="min-w-0 text-left" onClick={() => setEditing(t)}>
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.slug ? "Automatic notification" : "Custom"}</p>
              </button>
              {!t.slug && <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Delete template"><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      </div>
      {editing ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Subject</Label><Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></div>
          <div className="space-y-2"><Label>Body</Label><Textarea rows={12} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Placeholders: {TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(true)}><Eye /> Preview</Button>
            <Button onClick={save} disabled={busy || !editing.name || !editing.subject || !editing.body}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
          <PreviewDialog open={preview} onOpenChange={setPreview} subject={editing.subject} body={editing.body} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Select a template to edit, or create a new one.</div>
      )}
    </div>
  );
}

function History() {
  const [status, setStatus] = useState("all");
  const logs = useQuery({
    queryKey: ["admin", "email-logs", status],
    queryFn: async () => {
      let q = supabase.from("email_logs").select("id, to_email, subject, status, error, category, provider, created_at").order("created_at", { ascending: false }).limit(300);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const counts = useMemo(() => {
    const c = { sent: 0, failed: 0, not_configured: 0 };
    for (const l of logs.data ?? []) c[l.status as keyof typeof c]++;
    return c;
  }, [logs.data]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="not_configured">Not configured</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{counts.sent} sent · {counts.failed} failed · {counts.not_configured} not delivered</p>
      </div>
      {(logs.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {logs.data!.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.subject}</p>
                <p className="text-xs text-muted-foreground">{l.to_email} · {l.category} · {fmtDate(l.created_at)}{l.error ? ` · ${l.error}` : ""}</p>
              </div>
              <TxnBadge status={l.status === "sent" ? "success" : l.status === "failed" ? "failed" : "not configured"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
