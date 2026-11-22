import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentPanel, type ApplicantCredentials } from "@/components/site/PaymentPanel";
import { StageTimeline } from "@/components/site/StageTimeline";
import { getPaymentProgress } from "@/lib/registration.functions";
import { readApplicantToken, readPhoneHint } from "@/lib/applicant-session";
import type { MemberStage } from "@/lib/constants";

export const Route = createFileRoute("/confirmation/$reference")({
  head: () => ({
    meta: [
      { title: "Registration received — Steve Safari" },
      { name: "description", content: "Your Steve Safari registration has been received. Complete your KES 500 payment by M-Pesa." },
      { property: "og:title", content: "Registration received — Steve Safari" },
      { property: "og:description", content: "Complete your KES 500 registration payment by M-Pesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirmation,
});

type View = { firstName: string; stage: MemberStage; paymentStatus: string };

function Confirmation() {
  const { reference } = Route.useParams();
  const progress = useServerFn(getPaymentProgress);
  const [creds, setCreds] = useState<ApplicantCredentials | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [needId, setNeedId] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");

  const load = async (c: ApplicantCredentials) => {
    setLoading(true);
    const r = await progress({ data: c }).catch(() => null);
    setLoading(false);
    if (r && r.ok) {
      setCreds(c);
      setNeedId(false);
      setView({ firstName: r.application.firstName, stage: r.application.stage as MemberStage, paymentStatus: r.application.paymentStatus });
    } else {
      setNeedId(true);
      if (c.nationalId) toast.error("That national ID doesn't match this reference.");
    }
  };

  useEffect(() => {
    setPhone(readPhoneHint(reference));
    const token = readApplicantToken(reference);
    if (token) void load({ reference, token });
    else {
      setLoading(false);
      setNeedId(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  return (
    <section className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-soft md:p-10">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <h1 className="mt-4 text-3xl font-medium md:text-4xl">{view ? `Thank you, ${view.firstName}.` : "Registration received."}</h1>
          <p className="mt-2 text-muted-foreground">Keep your reference number — you'll need it with your national ID to check your status.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-5 py-4">
            <span className="eyebrow text-muted-foreground">Reference</span>
            <span className="font-display text-2xl tracking-wide text-primary">{reference}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(reference);
                toast.success("Reference copied");
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
          {view && (
            <div className="mt-8">
              <StageTimeline stage={view.stage} />
            </div>
          )}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : needId ? (
            <form
              className="rounded-2xl border border-border bg-card p-7"
              onSubmit={(e) => {
                e.preventDefault();
                void load({ reference, nationalId });
              }}
            >
              <p className="eyebrow text-accent">Step 2 of 2</p>
              <h2 className="mt-1 text-xl font-medium">Confirm it's you to continue</h2>
              <div className="mt-4 space-y-2">
                <Label htmlFor="cid">National ID number</Label>
                <Input id="cid" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
              </div>
              <Button type="submit" className="mt-4">Continue</Button>
            </form>
          ) : creds && view ? (
            <>
              {view.paymentStatus !== "paid" && (
                <>
                  <p className="eyebrow text-accent">Step 2 of 2</p>
                  <h2 className="mb-4 mt-1 text-2xl font-medium">Pay your registration fee</h2>
                </>
              )}
              <PaymentPanel
                credentials={creds}
                defaultPhone={phone}
                alreadyPaid={view.paymentStatus === "paid"}
                onPaid={() => setView({ ...view, paymentStatus: "paid", stage: view.stage === "registered" ? "pending_approval" : view.stage })}
              />
            </>
          ) : null}
          <p className="mt-6 text-sm text-muted-foreground">
            You can return later — go to <Link to="/status" className="font-medium text-primary underline">Check status</Link> and enter your reference and national ID.
          </p>
        </div>
      </div>
    </section>
  );
}
