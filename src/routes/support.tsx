import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Help & Support — Steve Safari" },
      { name: "description", content: "Answers about registration, the KES 500 fee, payment, status checks and documents." },
      { property: "og:title", content: "Help & Support — Steve Safari" },
      { property: "og:description", content: "Get help with your Steve Safari registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const FAQ = [
  ["How much does registration cost?", "Registration is a one-time fee of KES 500, paid by M-Pesa. There are no other fees charged by Steve Safari. Never pay anyone claiming to charge extra."],
  ["Does registering guarantee sponsorship or a flight?", "No. Registration does not guarantee sponsorship, flights, visas or programme acceptance. Each application is reviewed."],
  ["My M-Pesa prompt did not appear. What do I do?", "Open your confirmation page or Check status and try the payment again. If money left your account but the status shows unpaid, contact us with your M-Pesa receipt."],
  ["How do I check my application status?", "Use the Check status page with your reference number and phone number."],
  ["Will my name be shown publicly?", "Only if you agreed. Public lists show your first name, last initial and county only."],
  ["Which documents should I upload?", "Your ID or passport and CV are helpful. Uploads are optional and only visible to the review team."],
] as const;

function SupportPage() {
  return (
    <>
      <PageHero eyebrow="Help centre" title="How can we help?">
        Quick answers to common questions. Still stuck? Send us a message and the team will reply.
      </PageHero>
      <section className="container-page grid gap-10 py-14 lg:grid-cols-[2fr_1fr]">
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-6">
          {FAQ.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <aside className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-medium">Need more help?</h2>
          <p className="text-sm text-muted-foreground">Our support team reads every message.</p>
          <Button asChild className="w-full"><Link to="/contact">Contact support</Link></Button>
          <Button asChild variant="outline" className="w-full"><Link to="/status">Check my status</Link></Button>
        </aside>
      </section>
    </>
  );
}
