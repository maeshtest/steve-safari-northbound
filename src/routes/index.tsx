import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, FileSearch, Lock, Plane, Quote, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { directoryCountsQuery, siteContentQuery, testimonialsQuery } from "@/lib/queries";
import { REGISTRATION_FEE_KES } from "@/lib/constants";
import heroImg from "@/assets/hero-savanna.jpg";
import canadaImg from "@/assets/canada-lake.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Steve Safari — Sponsored work travel from Kenya to Canada" },
      { name: "description", content: "Register with Steve Safari for sponsored work opportunities in Canada. One transparent registration fee of KES 500 and online status tracking." },
      { property: "og:title", content: "Steve Safari — Sponsored work travel to Canada" },
      { property: "og:description", content: "One honest step towards sponsored work in Canada. KES 500 one-time registration fee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteContentQuery),
  component: Home,
});

const journey = [
  { title: "Register", text: "Submit your details and pay the one-time KES 500 fee by M-Pesa." },
  { title: "Review", text: "Our team reviews your application and supporting documents." },
  { title: "Approval", text: "Approved members are considered for employer sponsorship." },
  { title: "Sponsorship", text: "Sponsorship is confirmed by a partner employer in Canada." },
  { title: "Flight list", text: "You join the flight waiting list and prepare for departure." },
  { title: "Alumni", text: "You complete the programme and help guide those who follow." },
];

function Home() {
  const { data: content } = useSuspenseQuery(siteContentQuery);
  const { data: counts } = useQuery(directoryCountsQuery);
  const { data: testimonials } = useQuery(testimonialsQuery);
  const featured = (testimonials ?? []).filter((t) => t.featured).slice(0, 3);
  const home = content.home;
  const programmes = content.programmes.items;

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-forest text-forest-foreground">
        <img
          src={home.hero_image || heroImg}
          alt="A Kenyan traveller looking out over the savanna at sunrise"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_center] animate-slow-zoom"
          width={1536}
          height={1024}
        />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        <div className="container-page flex min-h-[78vh] flex-col justify-center py-24">
          <p className="eyebrow text-gold animate-fade-up">{home.eyebrow}</p>
          <h1 className="mt-5 max-w-2xl text-4xl font-medium leading-[1.05] sm:text-5xl md:text-6xl animate-fade-up [animation-delay:120ms]">
            {home.headline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-forest-foreground/85 md:text-lg animate-fade-up [animation-delay:220ms]">
            {home.subheadline}
          </p>
          <div className="mt-9 flex flex-wrap gap-3 animate-fade-up [animation-delay:320ms]">
            <Button asChild variant="gold" size="xl">
              <Link to="/register">
                {home.cta_label} <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline-light" size="xl">
              <Link to="/status">Check my application</Link>
            </Button>
          </div>
          <p className="mt-6 max-w-md text-xs text-forest-foreground/65 animate-fade-up [animation-delay:420ms]">
            KES {REGISTRATION_FEE_KES} is the only registration fee. Registration does not guarantee sponsorship, flights, visas or programme acceptance.
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-border bg-card">
        <div className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            { icon: BadgeCheck, title: `KES ${REGISTRATION_FEE_KES} once`, text: "No hidden or follow-up fees" },
            { icon: FileSearch, title: "Track online", text: "Status with your reference" },
            { icon: Lock, title: "Private by default", text: "IDs & documents never public" },
            { icon: Plane, title: "Canada focus", text: "Sponsored work pathways" },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Journey */}
      <section className="container-page py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.6fr]">
          <div>
            <p className="eyebrow text-accent">The journey</p>
            <h2 className="mt-3 text-3xl font-medium leading-tight md:text-4xl">Six clear stages, from Nairobi to Canada.</h2>
            <div className="gold-rule mt-6" />
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Every applicant moves through the same transparent stages. You can see exactly where you stand at any time — no guesswork, no extra payments to move forward.
            </p>
            <Button asChild variant="link" className="mt-4 px-0">
              <Link to="/about">How the programme works <ArrowRight /></Link>
            </Button>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {journey.map((step, i) => (
              <li key={step.title} className="bg-card p-6 transition-colors hover:bg-secondary/60">
                <span className="font-display text-3xl italic text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Programmes + Canada image */}
      <section className="bg-secondary/60">
        <div className="container-page grid items-center gap-12 py-20 md:py-24 lg:grid-cols-2">
          <div className="relative">
            <img src={canadaImg} alt="A Canadian lakeside town at dawn" loading="lazy" width={1536} height={1024} className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lift" />
            <div className="absolute -bottom-6 left-6 right-6 rounded-xl bg-card p-5 shadow-soft md:left-auto md:right-[-1.5rem] md:w-72">
              <p className="eyebrow text-accent">Our promise</p>
              <p className="mt-2 text-sm leading-relaxed">One fee. Clear stages. Honest updates — whether the news is good or not.</p>
            </div>
          </div>
          <div className="pt-6 lg:pt-0">
            <p className="eyebrow text-accent">What we offer</p>
            <h2 className="mt-3 text-3xl font-medium md:text-4xl">Guidance at every step of the way.</h2>
            <div className="mt-8 space-y-6">
              {programmes.map((p) => (
                <div key={p.title} className="border-l-2 border-accent pl-5">
                  <h3 className="text-lg font-semibold font-sans">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lists */}
      <section className="container-page py-20 md:py-24">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-accent">Public records</p>
            <h2 className="mt-3 text-3xl font-medium md:text-4xl">Our member lists, updated live.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">Only members who agree to be listed appear, shown by first name and initial with their county.</p>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/members", label: "Registered members", key: "members" },
            { to: "/sponsorship", label: "Approved sponsorship", key: "sponsorship" },
            { to: "/flight-waiting-list", label: "Flight waiting list", key: "flight" },
            { to: "/alumni", label: "Programme alumni", key: "alumni" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-accent">
              <Users className="h-5 w-5 text-primary" />
              <p className="mt-6 font-display text-4xl font-medium text-primary">
                {counts ? counts[l.key as keyof typeof counts] : "—"}
              </p>
              <p className="mt-1 flex items-center justify-between text-sm font-medium">
                {l.label} <ArrowRight className="h-4 w-4 text-accent transition group-hover:translate-x-1" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {featured.length > 0 && (
        <section className="bg-forest-gradient grain text-forest-foreground">
          <div className="container-page relative z-10 py-20 md:py-24">
            <p className="eyebrow text-gold">In their words</p>
            <h2 className="mt-3 text-3xl font-medium md:text-4xl">Stories from our members.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {featured.map((t) => (
                <figure key={t.id} className="rounded-2xl border border-forest-foreground/15 bg-forest-foreground/5 p-7">
                  <Quote className="h-6 w-6 text-gold" />
                  <blockquote className="mt-4 font-display text-lg leading-relaxed">“{t.quote}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="h-11 w-11 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">{t.name.charAt(0)}</span>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      {(t.role_title || t.location) && <p className="text-xs text-forest-foreground/65">{[t.role_title, t.location].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
            <Button asChild variant="outline-light" className="mt-10">
              <Link to="/testimonials">Read all testimonials</Link>
            </Button>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page py-20 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card p-10 shadow-soft md:p-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-gradient opacity-25 blur-2xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-center">
            <div>
              <h2 className="text-3xl font-medium md:text-4xl">Ready to take the first step?</h2>
              <p className="mt-3 max-w-lg text-muted-foreground">Registration takes about five minutes. Have your national ID and M-Pesa phone ready.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild variant="gold" size="xl">
                <Link to="/register">Start registration <ArrowRight /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
