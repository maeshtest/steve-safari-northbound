import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Smartphone, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPaymentProgress, initiatePayment } from "@/lib/registration.functions";
import { REGISTRATION_FEE_KES } from "@/lib/constants";
import { normalizeKenyanPhone } from "@/lib/phone";

export type ApplicantCredentials = { reference: string; token?: string; nationalId?: string };
type Phase = "idle" | "sending" | "waiting" | "success" | "failed" | "timeout";

export function PaymentPanel({
  credentials,
  defaultPhone = "",
  alreadyPaid = false,
  onPaid,
}: {
  credentials: ApplicantCredentials;
  defaultPhone?: string;
  alreadyPaid?: boolean;
  onPaid?: () => void;
}) {
  const start = useServerFn(initiatePayment);
  const progress = useServerFn(getPaymentProgress);
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<Phase>(alreadyPaid ? "success" : "idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (alreadyPaid) setPhase("success");
  }, [alreadyPaid]);

  const poll = useCallback(async () => {
    try {
      const r = await progress({ data: credentials });
      if (!r.ok) return;
      if (r.application.paymentStatus === "paid") {
        stop();
        setPhase("success");
        onPaid?.();
        return;
      }
      if (r.latestPayment?.status === "failed" || r.latestPayment?.status === "cancelled") {
        stop();
        setPhase("failed");
        setError(r.latestPayment.message ?? "The payment was not completed.");
        return;
      }
      if (Date.now() - startedAt.current > 150_000) {
        stop();
        setPhase("timeout");
      }
    } catch {
      /* transient network error — keep polling */
    }
  }, [credentials, onPaid, progress]);

  const pay = async () => {
    setError(null);
    if (!normalizeKenyanPhone(phone)) {
      setError("Enter a valid Safaricom M-Pesa number, e.g. 0712 345 678.");
      return;
    }
    setPhase("sending");
    try {
      const r = await start({ data: { ...credentials, phone } });
      if (!r.ok) {
        setPhase("idle");
        setError(r.error);
        return;
      }
      setPhase("waiting");
      startedAt.current = Date.now();
      stop();
      timer.current = setInterval(poll, 4000);
    } catch {
      setPhase("idle");
      setError("Something went wrong. Please try again.");
    }
  };

  if (phase === "success") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <div>
            <p className="font-semibold">Payment confirmed</p>
            <p className="mt-1 text-sm text-muted-foreground">Your KES {REGISTRATION_FEE_KES} registration fee has been verified. Your application is now with our review team.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Registration fee</p>
          <p className="mt-1 font-display text-4xl font-medium text-primary">KES {REGISTRATION_FEE_KES}</p>
          <p className="mt-1 text-xs text-muted-foreground">One-time · paid via M-Pesa · the only fee we charge</p>
        </div>
        <Smartphone className="h-8 w-8 text-accent" />
      </div>

      {phase === "waiting" ? (
        <div className="mt-6 rounded-xl bg-secondary p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="font-semibold">Check your phone</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            An M-Pesa prompt has been sent to {phone}. Enter your M-Pesa PIN to pay KES {REGISTRATION_FEE_KES}. We'll confirm automatically once M-Pesa verifies the payment.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {(phase === "failed" || phase === "timeout") && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>
                {phase === "timeout"
                  ? "We haven't received confirmation yet. If you completed the payment, check your status in a few minutes — otherwise try again."
                  : `Payment not completed${error ? `: ${error}` : "."} You can try again.`}
              </span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mpesa-phone">M-Pesa phone number</Label>
            <Input id="mpesa-phone" inputMode="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error && phase === "idle" && <p className="text-sm text-destructive">{error}</p>}
          <Button size="lg" className="w-full" onClick={pay} disabled={phase === "sending"}>
            {phase === "sending" ? <Loader2 className="animate-spin" /> : phase === "idle" ? null : <RefreshCw />}
            {phase === "idle" || phase === "sending" ? `Pay KES ${REGISTRATION_FEE_KES} with M-Pesa` : "Try payment again"}
          </Button>
        </div>
      )}
    </div>
  );
}
