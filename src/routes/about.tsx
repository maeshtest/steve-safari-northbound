import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, HeartHandshake, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/site/PageHero";
import { siteContentQuery } from "@/lib/queries";
import { REGISTRATION_FEE_KES } from "@/lib/constants";
import officeImg from "@/assets/about-office.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Steve Safari — Guiding Kenyans to sponsored work in Canada" },
      { name: "description", content: "Learn how Steve Safari guides Kenyan applicants through registration, review, sponsorship and travel preparation for work in Canada." },
      { property: "og:title", content: "About Steve Safari" },
      { property: "og:description", content: "A transparent path to sponsored work in Canada, with one KES 500 registration fee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteContentQuery),
  component: About,
});

function About() {
  const { data } = useSuspenseQuery(siteContentQuery);
  const about = data.about;
  return (
    <>
      <PageHero eyebrow="About us" title={about.title}>
        <p>{about.intro}</p>
      </PageHero>
      <section className="container-page grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <img src={about.image || officeImg} alt="A Steve Safari advisor reviewing documents with an applicant" width={1536} height={1024} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift" />
        <div>
          <p className="eyebrow text-accent">Our mission</p>
          <p className="mt-3 font-display text-2xl leading-snug md:text-3xl">{about.mission}</p>
          <div className="gold-rule mt-6" />
          {about.body.split(/\n{2,}/).filter(Boolean).map((p, i) => (
            <p key={i} className="mt-5 leading-relaxed text-muted-foreground">{p}</p>
          ))}
        </div>
      </section>
      <section className="bg-secondary/60">
        <div className="container-page grid gap-6 py-16 md:grid-cols-3 md:py-20">
          {[
            { icon: ShieldCheck, title: "Transparent", text: `One registration fee of KES ${REGISTRATION_FEE_KES}. No payments are ever required to move between stages.` },
            { icon: Compass, title: "Guided", text: "Clear stages, honest updates and practical guidance from registration to departure." },
            { icon: HeartHandshake, title: "Respectful", text: "Your personal information stays private and is used only to process your application." },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl bg-card p-7 shadow-soft">
              <v.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-xl font-medium">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container-page py-16 md:py-20">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10">
          <h2 className="text-2xl font-medium">What registration does — and doesn't — mean</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
            Registering puts your application in our review process. It does not guarantee sponsorship, a job offer, flights, a visa or acceptance into the programme. Final decisions on employment and immigration rest with employers and the relevant Canadian authorities.
          </p>
          <Button asChild variant="gold" className="mt-6">
            <Link to="/register">Register now <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
