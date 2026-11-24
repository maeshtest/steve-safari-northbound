import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, Loader2, Mail, MapPin, MessageCircle, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHero } from "@/components/site/PageHero";
import { siteContentQuery } from "@/lib/queries";
import { submitContactMessage } from "@/lib/public.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Steve Safari" },
      { name: "description", content: "Get in touch with the Steve Safari team by phone, WhatsApp, email or the contact form." },
      { property: "og:title", content: "Contact Steve Safari" },
      { property: "og:description", content: "Questions about registration or your application? Talk to our team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteContentQuery),
  component: Contact,
});

function Contact() {
  const { data } = useSuspenseQuery(siteContentQuery);
  const c = data.contact;
  const send = useServerFn(submitContactMessage);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Updated Fallbacks
  const phone = c.phone || "+1 (343) 296-9450";
  const email = c.email || "dereknash@usa.com";
  const address = c.address || "Quebec, Canada";
  const whatsapp = c.whatsapp || "+1 (343) 296-9450";
  const hours = c.hours || "Monday – Friday, 9:00 AM – 5:00 PM";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await send({ data: form });
      if (r.ok) setDone(true);
      else toast.error(r.error);
    } catch {
      toast.error("Please check the form and try again.");
    } finally {
      setBusy(false);
    }
  };

  const items = [
    { icon: Phone, label: "Phone", value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: whatsapp, href: `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}` },
    { icon: Mail, label: "Email", value: email, href: `mailto:${email}` },
    { icon: MapPin, label: "Office", value: address },
    { icon: Clock, label: "Hours", value: hours },
  ].filter((i) => i.value);

  return (
    <>
      <PageHero eyebrow="Contact us" title="We're here to help.">
        <p>Questions about registration, payment or your application? Reach out — we reply within one working day.</p>
      </PageHero>
      <section className="container-page grid gap-10 py-14 md:py-20 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {items.map((i) => (
            <div key={i.label} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
              <i.icon className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <p className="eyebrow text-muted-foreground">{i.label}</p>
                {i.href ? (
                  <a href={i.href} className="mt-1 block font-medium hover:text-primary">{i.value}</a>
                ) : (
                  <p className="mt-1 font-medium">{i.value}</p>
                )}
              </div>
            </div>
          ))}
          <p className="rounded-xl bg-secondary p-5 text-sm leading-relaxed text-secondary-foreground">
            <strong>Stay safe:</strong> Steve Safari only charges a KES 500 registration fee, paid through the M-Pesa prompt on this website. We will never ask you to send money to a personal number.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-7 shadow-soft md:p-9">
          {done ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h2 className="mt-4 text-2xl font-medium">Message sent</h2>
              <p className="mt-2 text-muted-foreground">Thank you — our team will get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <h2 className="text-2xl font-medium">Send us a message</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Full name</Label>
                  <Input id="c-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Phone (optional)</Label>
                  <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-msg">Message</Label>
                <Textarea id="c-msg" required minLength={5} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <Button type="submit" size="lg" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Send message
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
