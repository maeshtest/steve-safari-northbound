import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHero } from "@/components/site/PageHero";
import { PaymentPanel } from "@/components/site/PaymentPanel";
import { StageTimeline } from "@/components/site/StageTimeline";
import { lookupApplication } from "@/lib/registration.functions";
import { PAYMENT_STATE_LABELS, STAGE_DESCRIPTIONS, STAGE_LABELS, type MemberStage, type PaymentState } from "@/lib/constants";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Check application status — Steve Safari" },
      { name: "description", content: "Check the status of your Steve Safari application with your reference number and national ID." },
      { property: "og:title", content: "Check your application status — Steve Safari" },
      { property: "og:description", content: "Track your Steve Safari application at any time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Status,
});

type Result = { reference: string; firstName: string; stage: MemberStage; paymentStatus: PaymentState; infoRequested: string | null; phoneHint: string; createdAt: string };

function Status() {
  const lookup = useServerFn(lookupApplication);
  const [reference, setReference] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ref = reference.trim().toUpperCase();
    if (!/^SS-\d{2}-[A-F0-9]{6}$/.test(ref)) {
      setError("References look like SS-26-AB12CD.");
      return;
    }
    setBusy(true);
    try {
      const r = await lookup({ data: { reference: ref, nationalId: nationalId.trim() } });
      if (r.ok) setResult(r.application as Result);
      else {
        setResult(null);
        setError(r.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero eyebrow="Application status" title="Where is my application?">
        <p>Enter the reference number you received at registration and your national ID number.</p>
      </PageHero>
      <section className="container-page py-12 md:py-16">
        <div className="mx-auto grid max-w-4xl gap-8">
          <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft md:grid-cols-[1fr_1fr_auto] md:items-end md:p-8">
            <div className="space-y-2">
              <Label htmlFor="s-ref">Reference number</Label>
              <Input id="s-ref" placeholder="SS-26-AB12CD" value={reference} onChange={(e) => setReference(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-id">National ID number</Label>
              <Input id="s-id" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
            </div>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Search />} Check status
            </Button>
            {error && <p className="text-sm text-destructive md:col-span-3">{error}</p>}
          </form>

          {result && (
            <div className="space-y-6 animate-fade-up">
              <div className="rounded-2xl border border-border bg-card p-7 md:p-9">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-muted-foreground">{result.reference}</p>
                    <h2 className="mt-1 text-2xl font-medium md:text-3xl">Hello {result.firstName},</h2>
                    <p className="mt-2 text-muted-foreground">
                      Your application is <strong className="text-foreground">{STAGE_LABELS[result.stage]}</strong>. {STAGE_DESCRIPTIONS[result.stage]}
                    </p>
                  </div>
                  <Badge variant={result.paymentStatus === "paid" ? "default" : "secondary"}>{PAYMENT_STATE_LABELS[result.paymentStatus]}</Badge>
                </div>
                <div className="mt-8">
                  <StageTimeline stage={result.stage} />
                </div>
              </div>
              {result.infoRequested && (
                <div className="flex gap-3 rounded-2xl border border-warning/50 bg-warning/15 p-6">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
                  <div>
                    <p className="font-semibold">We need more information</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.infoRequested}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Please reply to our email or contact us using the details on the Contact page.</p>
                  </div>
                </div>
              )}
              {result.paymentStatus !== "paid" && result.stage !== "rejected" && result.stage !== "withdrawn" && (
                <PaymentPanel
                  credentials={{ reference: result.reference, nationalId: nationalId.trim() }}
                  onPaid={() => setResult({ ...result, paymentStatus: "paid", stage: result.stage === "registered" ? "pending_approval" : result.stage })}
                />
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
