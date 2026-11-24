import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHero } from "@/components/site/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { confirmDocumentUploads, requestDocumentUploads, submitRegistration } from "@/lib/registration.functions";
import { ALLOWED_DOC_TYPES, KENYAN_COUNTIES, MAX_DOCS, MAX_DOC_BYTES, POLICY_VERSION, REGISTRATION_FEE_KES } from "@/lib/constants";
import { normalizeKenyanPhone } from "@/lib/phone";
import { saveApplicantToken, savePhoneHint } from "@/lib/applicant-session";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — Steve Safari" },
      { name: "description", content: "Register for the Steve Safari sponsored work programme for Canada. One-time registration fee of KES 500 via M-Pesa." },
      { property: "og:title", content: "Register with Steve Safari" },
      { property: "og:description", content: "Five minutes, your national ID and an M-Pesa phone. KES 500 one-time fee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Register,
});

type Form = { fullName: string; nationalId: string; phone: string; email: string; county: string };
type Errors = Partial<Record<keyof Form | "terms", string>>;

function validate(f: Form, terms: boolean): Errors {
  const e: Errors = {};
  if (f.fullName.trim().split(/\s+/).length < 2) e.fullName = "Enter your full name (at least two names)";
  if (!/^[0-9A-Za-z]{6,12}$/.test(f.nationalId.trim())) e.nationalId = "Enter a valid national ID number";
  if (!normalizeKenyanPhone(f.phone)) e.phone = "Enter a valid Kenyan mobile number, e.g. 0712 345 678";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!f.county) e.county = "Select your county";
  if (!terms) e.terms = "You must accept the Terms and Privacy Policy";
  return e;
}

function Register() {
  const navigate = useNavigate();
  const submit = useServerFn(submitRegistration);
  const requestUploads = useServerFn(requestDocumentUploads);
  const confirmUploads = useServerFn(confirmDocumentUploads);
  const [form, setForm] = useState<Form>({ fullName: "", nationalId: "", phone: "", email: "", county: "" });
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<null | string>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(f.type)) {
        toast.error(`${f.name}: only PDF, JPG and PNG files are accepted`);
        continue;
      }
      if (f.size > MAX_DOC_BYTES) {
        toast.error(`${f.name} is larger than 10 MB`);
        continue;
      }
      if (next.length >= MAX_DOCS) {
        toast.error(`You can attach up to ${MAX_DOCS} documents`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validate(form, terms);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy("Saving your registration…");
    try {
      const r = await submit({
        data: { ...form, county: form.county as (typeof KENYAN_COUNTIES)[number], publicConsent: consent, acceptedTerms: true, policyVersion: POLICY_VERSION },
      });
      if (!r.ok) {
        setFormError(r.error);
        setBusy(null);
        return;
      }
      saveApplicantToken(r.reference, r.token);
      savePhoneHint(r.reference, form.phone);
      if (files.length) {
        setBusy("Uploading your documents…");
        const creds = { reference: r.reference, token: r.token };
        const up = await requestUploads({ data: { ...creds, files: files.map((f) => ({ name: f.name, type: f.type as (typeof ALLOWED_DOC_TYPES)[number], size: f.size })) } });
        if (up.ok) {
          const done: string[] = [];
          for (let i = 0; i < up.uploads.length; i++) {
            const u = up.uploads[i]!;
            const { error } = await supabase.storage.from("application-documents").uploadToSignedUrl(u.path, u.token, files[i]!, { contentType: files[i]!.type });
            if (!error) done.push(u.documentId);
          }
          await confirmUploads({ data: { ...creds, documentIds: up.uploads.map((u) => u.documentId) } });
          if (done.length < files.length) toast.warning("Some documents could not be uploaded. You can send them to us later.");
        } else {
          toast.warning("Your documents could not be uploaded, but your registration was saved.");
        }
      }
      navigate({ to: "/confirmation/$reference", params: { reference: r.reference } });
    } catch {
      setFormError("Please check your details and try again.");
      setBusy(null);
    }
  };

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Input id={`f-${k}`} value={form[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} {...props} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <>
      <PageHero eyebrow="Registration" title="Register for the Steve Safari programme.">
        <p>Complete the form, then pay the one-time KES {REGISTRATION_FEE_KES} registration fee by M-Pesa. It takes about five minutes.</p>
      </PageHero>
      <section className="container-page grid gap-10 py-12 md:py-16 lg:grid-cols-[1.6fr_1fr]">
        <form onSubmit={onSubmit} noValidate className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-soft md:p-9">
          <div>
            <p className="eyebrow text-accent">Step 1 of 2</p>
            <h2 className="mt-1 text-2xl font-medium">Your details</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("fullName", "Full name (as on your ID)", { autoComplete: "name" })}</div>
            {field("nationalId", "National ID number", { inputMode: "numeric" })}
            {field("phone", "Phone number (M-Pesa)", { inputMode: "tel", placeholder: "0712 345 678", autoComplete: "tel" })}
            {field("email", "Email address", { type: "email", autoComplete: "email" })}
            <div className="space-y-2">
              <Label htmlFor="f-county">County / location</Label>
              <Select value={form.county} onValueChange={(v) => setForm({ ...form, county: v })}>
                <SelectTrigger id="f-county" aria-invalid={Boolean(errors.county)}>
                  <SelectValue placeholder="Select county" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {KENYAN_COUNTIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.county && <p className="text-xs text-destructive">{errors.county}</p>}
            </div>
          </div>

          <div>
            <Label>Supporting documents (optional)</Label>
            <p className="mt-1 text-xs text-muted-foreground">PDF, JPG or PNG · up to {MAX_DOCS} files · 10 MB each. E.g. CV, certificates, passport bio page.</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/50 px-4 py-7 text-sm text-muted-foreground transition hover:border-primary hover:bg-secondary"
            >
              <Upload className="mb-2 h-5 w-5 text-primary" />
              Click to add documents
            </button>
            <input ref={fileInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{f.name}</span></span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4 rounded-xl bg-muted/60 p-5">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" aria-invalid={Boolean(errors.terms)} />
              <span>
                I accept the <Link to="/terms" target="_blank" className="font-medium text-primary underline">Terms and Conditions</Link> and{" "}
                <Link to="/privacy" target="_blank" className="font-medium text-primary underline">Privacy Policy</Link>. I understand that KES {REGISTRATION_FEE_KES} is the only registration fee and that registration does not guarantee sponsorship, flights, visas or programme acceptance.
              </span>
            </label>
            {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>
                (Optional) I agree to my first name, last initial and county appearing on Steve Safari's public member lists. My ID, phone, email and documents will never be shown.
              </span>
            </label>
          </div>

          {formError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}

          <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={busy !== null}>
            {busy ? <><Loader2 className="animate-spin" /> {busy}</> : "Continue to payment"}
          </Button>
        </form>

        <aside className="space-y-5">
          <div className="rounded-2xl bg-forest-gradient p-7 text-forest-foreground">
            <ShieldCheck className="h-6 w-6 text-gold" />
            <h3 className="mt-4 text-xl font-medium">KES {REGISTRATION_FEE_KES} — and nothing more</h3>
            <p className="mt-2 text-sm leading-relaxed text-forest-foreground/80">
              This is the only fee Steve Safari charges. You pay it through the official M-Pesa prompt sent from this website — never to a personal number.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-7">
            <h3 className="text-lg font-medium">What happens next</h3>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><strong className="text-foreground">1.</strong> You receive a reference number.</li>
              <li><strong className="text-foreground">2.</strong> You pay KES {REGISTRATION_FEE_KES} via the M-Pesa prompt.</li>
              <li><strong className="text-foreground">3.</strong> Our team contacts you to book an online Zoom meeting with Steve Safari and the team — required before approval.</li>
              <li><strong className="text-foreground">4.</strong> Track progress any time on the status page.</li>
            </ol>
          </div>
        </aside>
      </section>
    </>
  );
}
