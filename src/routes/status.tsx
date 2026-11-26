import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
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
import { consumeResumeNationalId } from "@/lib/applicant-session";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Check application status: Steve Safari" },
      { name: "description", content: "Check your Steve Safari application using either your reference number or your national ID." },
      { property: "og:title", content: "Check your application status: Steve Safari" },
      { property: "og:description", content: "Track your Steve Safari application at any time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Status,
});

type Result = { reference: string; firstName: string; stage: MemberStage; paymentStatus: PaymentState; infoRequested: string | null; phoneHint: string; createdAt: string };
type IdentifierType = "reference" | "nationalId";

function Status() {
  const lookup = useServerFn(lookupApplication);
  const [reference, setReference] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("reference");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [paymentNationalId, setPaymentNationalId] = useState("");
  const [paymentIdDraft, setPaymentIdDraft] = useState("");
  const [paymentIdError, setPaymentIdError] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const runLookup = useCallback(async (type: IdentifierType, value: string) => {
    const cleanValue = value.trim();
    setError(null);
    setResult(null);
    setPaymentNationalId("");
    setBusy(true);
    try {
      const data = type === "reference"
        ? { reference: cleanValue.toUpperCase() }
        : { nationalId: cleanValue };
      const response = await lookup({ data });
      if (response.ok) {
        setResult(response.application as Result);
        if (type === "nationalId") setPaymentNationalId(cleanValue);
      } else {
        setError(response.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [lookup]);

  useEffect(() => {
    const resumeNationalId = consumeResumeNationalId();
    if (!resumeNationalId) return;
    setIdentifierType("nationalId");
    setNationalId(resumeNationalId);
    void runLookup("nationalId", resumeNationalId);
  }, [runLookup]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifierType === "reference" ? reference : nationalId;
    if (identifierType === "reference" && !/^SS-\d{2}-[A-F0-9]{6}$/i.test(value.trim())) {
      setError("Enter a reference like SS-26-AB12CD.");
      return;
    }
    if (identifierType === "nationalId" && !/^[0-9A-Za-z]{6,12}$/.test(value.trim())) {
      setError("Enter a valid national ID number.");
      return;
    }
    await runLookup(identifierType, value);
  };

  const verifyPaymentIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = paymentIdDraft.trim();
    setPaymentIdError(null);
    if (!result || !/^[0-9A-Za-z]{6,12}$/.test(value)) {
      setPaymentIdError("Enter a valid national ID number.");
      return;
    }
    setVerifyBusy(true);
    try {
      const response = await lookup({ data: { nationalId: value } });
      const application = response.ok ? response.application as Result : null;
      if (!application || application.reference !== result.reference) {
        setPaymentIdError("That ID number does not match this application.");
        return;
      }
      setPaymentNationalId(value);
    } catch {
      setPaymentIdError("We could not verify those details. Please try again.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const clearLookupResult = () => {
    setResult(null);
    setError(null);
    setPaymentNationalId("");
    setPaymentIdError(null);
  };

  return (
    <>
      <PageHero eyebrow="Application status" title="Where is my application?">
        <p>Use either your reference number or your national ID number. You do not need to enter both.</p>
      </PageHero>
      <section className="container-page py-8 sm:py-10 md:py-14">
        <div className="mx-auto grid max-w-4xl gap-6 sm:gap-8">
          <form onSubmit={onSubmit} className="grid min-w-0 gap-5 rounded-xl border-2 border-border bg-card p-4 sm:p-6 md:p-8">
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold">Choose one way to find your application</legend>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant={identifierType === "reference" ? "default" : "outline"} size="lg" aria-pressed={identifierType === "reference"} className="h-12 whitespace-normal px-2 sm:px-4" onClick={() => { setIdentifierType("reference"); clearLookupResult(); }}>
                  Reference number
                </Button>
                <Button type="button" variant={identifierType === "nationalId" ? "default" : "outline"} size="lg" aria-pressed={identifierType === "nationalId"} className="h-12 whitespace-normal px-2 sm:px-4" onClick={() => { setIdentifierType("nationalId"); clearLookupResult(); }}>
                  National ID
                </Button>
              </div>
            </fieldset>
            <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              {identifierType === "reference" ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="s-ref">Reference number</Label>
                  <Input id="s-ref" placeholder="SS-26-AB12CD" value={reference} onChange={(e) => { setReference(e.target.value); clearLookupResult(); }} autoComplete="off" className="h-12 border-2 bg-background text-base" required />
                </div>
              ) : (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="s-id">National ID number</Label>
                  <Input id="s-id" value={nationalId} onChange={(e) => { setNationalId(e.target.value); clearLookupResult(); }} inputMode="numeric" autoComplete="off" className="h-12 border-2 bg-background text-base" required />
                </div>
              )}
              <Button type="submit" size="xl" disabled={busy} className="min-h-14 w-full sm:w-auto">
                {busy ? <Loader2 className="animate-spin" /> : <Search />} Check status
              </Button>
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          </form>

          {result && (
            <div className="grid min-w-0 gap-5 sm:gap-6">
              <div className="min-w-0 rounded-xl border-2 border-border bg-card p-5 sm:p-7 md:p-9">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-5">
                  <div className="min-w-0">
                    <p className="eyebrow text-muted-foreground">{result.reference}</p>
                    <h2 className="mt-1 break-words text-2xl font-medium sm:text-3xl">Hello {result.firstName},</h2>
                    <p className="mt-2 text-base leading-relaxed text-foreground">
                      Your application is <strong className="text-foreground">{STAGE_LABELS[result.stage]}</strong>. {STAGE_DESCRIPTIONS[result.stage]}
                    </p>
                  </div>
                  <Badge className="mt-1 shrink-0" variant={result.paymentStatus === "paid" ? "default" : "secondary"}>{PAYMENT_STATE_LABELS[result.paymentStatus]}</Badge>
                </div>
                <div className="mt-8">
                  <StageTimeline stage={result.stage} />
                </div>
              </div>
              {result.infoRequested && (
                <div className="flex min-w-0 gap-3 rounded-xl border-2 border-warning/50 bg-warning/15 p-5 sm:p-6">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
                  <div className="min-w-0">
                    <p className="font-semibold">We need more information</p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{result.infoRequested}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Please reply to our email or contact us using the details on the Contact page.</p>
                  </div>
                </div>
              )}
              {result.paymentStatus !== "paid" && result.stage !== "rejected" && result.stage !== "withdrawn" && (
                paymentNationalId ? (
                  <PaymentPanel
                    credentials={{ reference: result.reference, nationalId: paymentNationalId }}
                    onPaid={() => setResult({ ...result, paymentStatus: "paid", stage: result.stage === "registered" ? "pending_approval" : result.stage })}
                  />
                ) : (
                  <form onSubmit={verifyPaymentIdentity} className="grid gap-4 rounded-xl border-2 border-border bg-card p-5 sm:p-6">
                    <div>
                      <h3 className="text-lg font-semibold">Continue to payment</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">For your security, confirm the national ID linked to this application before starting a payment.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment-verify-id">National ID number</Label>
                      <Input id="payment-verify-id" value={paymentIdDraft} onChange={(e) => { setPaymentIdDraft(e.target.value); setPaymentIdError(null); }} inputMode="numeric" autoComplete="off" className="h-12 border-2 bg-background text-base" required />
                    </div>
                    {paymentIdError && <p role="alert" className="text-sm font-medium text-destructive">{paymentIdError}</p>}
                    <Button type="submit" size="xl" className="min-h-14 w-full sm:w-fit" disabled={verifyBusy}>
                      {verifyBusy ? <Loader2 className="animate-spin" /> : null} Verify and continue
                    </Button>
                  </form>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
