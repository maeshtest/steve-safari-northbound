import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { POLICY_VERSION, REGISTRATION_FEE_KES } from "@/lib/constants";

const KEY = "ss_policy_accepted";

export function hasAcceptedPolicy() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === POLICY_VERSION;
}

export function TermsModal({ suppressed }: { suppressed: boolean }) {
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  useEffect(() => {
    setOpen(!suppressed && !hasAcceptedPolicy());
  }, [suppressed]);
  const accept = () => {
    window.localStorage.setItem(KEY, POLICY_VERSION);
    window.localStorage.setItem(`${KEY}_at`, new Date().toISOString());
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="max-w-lg [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <DialogTitle className="font-display text-2xl">Before you continue</DialogTitle>
        {!declined ? (
          <>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>Please read and accept our Terms and Conditions and Privacy Policy to use the Steve Safari website.</p>
                <ul className="space-y-2 rounded-lg border border-border bg-muted/60 p-4 text-foreground/85">
                  <li>• <strong>KES {REGISTRATION_FEE_KES}</strong> is the <strong>only</strong> registration fee. We never ask for any other payment to register.</li>
                  <li>• Registration does <strong>not guarantee</strong> sponsorship, flights, visas or programme acceptance.</li>
                  <li>• Your national ID, phone, email and documents are never shown publicly.</li>
                </ul>
                <p>
                  Read the full <Link to="/terms" className="font-medium text-primary underline underline-offset-2" onClick={() => setOpen(false)}>Terms and Conditions</Link> and{" "}
                  <Link to="/privacy" className="font-medium text-primary underline underline-offset-2" onClick={() => setOpen(false)}>Privacy Policy</Link>.
                </p>
              </div>
            </DialogDescription>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDeclined(true)}>Decline</Button>
              <Button onClick={accept}>I Agree &amp; Continue</Button>
            </div>
          </>
        ) : (
          <>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              We respect your choice. You need to accept the Terms and Privacy Policy to use this website and register. You can review them first and come back at any time.
            </DialogDescription>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" asChild>
                <Link to="/terms" onClick={() => setOpen(false)}>Read the terms</Link>
              </Button>
              <Button onClick={() => setDeclined(false)}>Review again</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
