import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Loader2, MessageCircleQuestion, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { changeStage, clearInfoRequest, recheckPayment, requestMoreInfo, setZoomMeeting } from "@/lib/admin.functions";
import { STAGE_LABELS } from "@/lib/constants";
import { PageHeader, PaymentBadge, RequireAdmin, StageBadge, TxnBadge, fmtDate } from "@/components/admin/ui";
import { StageChangeDialog } from "@/components/admin/StageChangeDialog";
import { useAdmin } from "@/components/admin/admin-context";

export const Route = createFileRoute("/_authenticated/admin/applications/$id")({
  component: () => (
    <RequireAdmin>
      <ApplicationDetail />
    </RequireAdmin>
  ),
});

function ApplicationDetail() {
  const { id } = Route.useParams();
  const me = useAdmin();
  const qc = useQueryClient();
  const change = useServerFn(changeStage);
  const askInfo = useServerFn(requestMoreInfo);
  const clearInfo = useServerFn(clearInfoRequest);
  const recheck = useServerFn(recheckPayment);
  const zoom = useServerFn(setZoomMeeting);
  const [stageOpen, setStageOpen] = useState(false);
  const [note, setNote] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "application", id],
    queryFn: async () => {
      const [app, docs, notes, history, payments, emails, terms] = await Promise.all([
        supabase.from("applications").select("*").eq("id", id).maybeSingle(),
        supabase.from("application_documents").select("*").eq("application_id", id).eq("uploaded", true).order("created_at"),
        supabase.from("application_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
        supabase.from("status_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("application_id", id).order("created_at", { ascending: false }),
        supabase.from("email_logs").select("id, subject, status, error, created_at, category").eq("application_id", id).order("created_at", { ascending: false }),
        supabase.from("terms_acceptances").select("*").eq("application_id", id).order("accepted_at", { ascending: false }),
      ]);
      if (app.error) throw app.error;
      return { app: app.data, docs: docs.data ?? [], notes: notes.data ?? [], history: history.data ?? [], payments: payments.data ?? [], emails: emails.data ?? [], terms: terms.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  if (q.isLoading) return <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-primary" />;
  const d = q.data;
  if (!d?.app) return <p className="text-muted-foreground">Application not found.</p>;
  const a = d.app;

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("application-documents").createSignedUrl(path, 120);
    if (error || !data) { toast.error("Could not open the document."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
    await supabase.rpc("log_admin_activity", { _action: "document.viewed", _target_type: "application", _target_id: id, _details: { path } });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy("note");
    const { error } = await supabase.from("application_notes").insert({ application_id: id, author_id: me.userId, author_email: me.email, body: note.trim() });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setNote("");
    void refresh();
  };

  const sendInfoRequest = async () => {
    setBusy("info");
    try {
      const r = await askInfo({ data: { applicationId: id, message: infoMsg } });
      toast.success(r.emailStatus === "sent" ? "Request saved and emailed." : r.emailStatus === "not_configured" ? "Request saved. Email not sent — provider not configured." : "Request saved, but the email failed.");
      setInfoMsg("");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );

  return (
    <>
      <Link to="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Applications</Link>
      <PageHeader
        title={a.full_name}
        description={`${a.reference} · registered ${fmtDate(a.created_at)}`}
        actions={<Button onClick={() => setStageOpen(true)}>Change stage</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="mb-5 flex flex-wrap gap-2"><StageBadge stage={a.stage} /><PaymentBadge status={a.payment_status} /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="National ID" value={a.national_id} />
              <Field label="Phone" value={`+${a.phone}`} />
              <Field label="Email" value={a.email} />
              <Field label="County" value={a.county} />
              <Field label="Public listing consent" value={a.public_consent ? "Yes — first name & initial" : "No"} />
              <Field label="Terms accepted" value={`${a.terms_version} · ${fmtDate(a.terms_accepted_at)}`} />
              <Field label="Paid at" value={fmtDate(a.paid_at)} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Supporting documents</h2>
            {d.docs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {d.docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span className="truncate">{doc.file_name}</span><span className="text-xs text-muted-foreground">{Math.round(doc.size_bytes / 1024)} KB</span></span>
                    <Button size="sm" variant="ghost" onClick={() => openDoc(doc.storage_path)}><ExternalLink /> Open</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Tabs defaultValue="notes" className="rounded-xl border border-border bg-card p-6">
            <TabsList>
              <TabsTrigger value="notes">Notes ({d.notes.length})</TabsTrigger>
              <TabsTrigger value="history">Audit trail</TabsTrigger>
              <TabsTrigger value="emails">Emails ({d.emails.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Textarea rows={3} placeholder="Add an internal note (never shown to the applicant)" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" onClick={addNote} disabled={busy === "note" || !note.trim()}>{busy === "note" && <Loader2 className="animate-spin" />} Add note</Button>
              </div>
              <ul className="space-y-3">
                {d.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{n.author_email} · {fmtDate(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <ol className="space-y-3 border-l border-border pl-4">
                {d.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <p><strong>{h.from_stage ? `${STAGE_LABELS[h.from_stage]} → ` : ""}{STAGE_LABELS[h.to_stage]}</strong></p>
                    {h.note && <p className="text-muted-foreground">{h.note}</p>}
                    <p className="text-xs text-muted-foreground">{h.changed_by_email ?? "System"} · {fmtDate(h.created_at)}</p>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="emails" className="mt-4">
              {d.emails.length === 0 ? <p className="text-sm text-muted-foreground">No emails yet.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {d.emails.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0"><p className="truncate font-medium">{e.subject}</p><p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}{e.error ? ` · ${e.error}` : ""}</p></div>
                      <TxnBadge status={e.status === "sent" ? "success" : e.status === "failed" ? "failed" : "not configured"} />
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Zoom meeting</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {a.payment_status !== "paid"
                ? "The applicant must pay the KES 500 fee first. Then contact them by email or phone to book the Zoom meeting with Steve Safari and the team."
                : a.zoom_meeting_completed_at
                  ? `Completed ${fmtDate(a.zoom_meeting_completed_at)}. The application can now be approved.`
                  : "Contact the applicant by email or phone to book the Zoom meeting. Approval is blocked until it is marked complete."}
            </p>
            <Button
              size="sm"
              variant={a.zoom_meeting_completed_at ? "outline" : "default"}
              className="mt-3"
              disabled={busy === "zoom" || (a.payment_status !== "paid" && !a.zoom_meeting_completed_at)}
              onClick={async () => {
                setBusy("zoom");
                try {
                  await zoom({ data: { applicationId: id, completed: !a.zoom_meeting_completed_at } });
                  toast.success(a.zoom_meeting_completed_at ? "Zoom meeting marked as not done" : "Zoom meeting marked complete");
                  void refresh();
                } catch (e) { toast.error((e as Error).message); }
                setBusy(null);
              }}
            >
              {a.zoom_meeting_completed_at ? "Undo — meeting not done" : "Mark Zoom meeting complete"}
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-medium"><MessageCircleQuestion className="h-5 w-5 text-accent" /> Request more information</h2>
            {a.info_requested && (
              <div className="mt-3 rounded-lg bg-warning/15 p-3 text-sm">
                <p className="whitespace-pre-line">{a.info_requested}</p>
                <p className="mt-1 text-xs text-muted-foreground">Requested {fmtDate(a.info_requested_at)}</p>
                <Button size="sm" variant="ghost" className="mt-2 px-0" onClick={async () => { await clearInfo({ data: { applicationId: id } }); void refresh(); }}>Mark as resolved</Button>
              </div>
            )}
            <Textarea className="mt-3" rows={3} placeholder="What do you need from the applicant? This is shown on their status page and emailed." value={infoMsg} onChange={(e) => setInfoMsg(e.target.value)} />
            <Button size="sm" className="mt-2" onClick={sendInfoRequest} disabled={busy === "info" || infoMsg.trim().length < 5}>{busy === "info" && <Loader2 className="animate-spin" />} Send request</Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Payments</h2>
            {d.payments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No payment attempts yet.</p> : (
              <ul className="mt-3 space-y-3">
                {d.payments.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between"><span className="font-medium">KES {p.amount}</span><TxnBadge status={p.status} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">+{p.phone} · {fmtDate(p.created_at)}</p>
                    {p.mpesa_receipt && <p className="text-xs">Receipt: <strong>{p.mpesa_receipt}</strong></p>}
                    {p.result_desc && <p className="text-xs text-muted-foreground">{p.result_desc}</p>}
                    {p.status === "queued" && (
                      <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={async () => { const r = await recheck({ data: { paymentId: p.id } }); toast.info(`PayHero status: ${r.status}`); void refresh(); }}>
                        <RefreshCw /> Re-check with PayHero
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <StageChangeDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        count={1}
        initialStage={a.stage}
        onConfirm={async (stage, n, notify) => {
          const r = await change({ data: { applicationIds: [id], stage, note: n, notify } });
          if (r.changed === 0) toast.info("No change made.");
          else toast.success(`Moved to ${STAGE_LABELS[stage]}${notify ? (r.emailResults["sent"] ? " · email sent" : r.emailResults["not_configured"] ? " · email not sent (provider not configured)" : " · email failed") : ""}`);
          void refresh();
        }}
      />
    </>
  );
}
