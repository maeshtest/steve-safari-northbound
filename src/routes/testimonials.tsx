import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageSquareQuote, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/site/PageHero";
import { testimonialsQuery } from "@/lib/queries";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials — Steve Safari" },
      { name: "description", content: "Read stories from Steve Safari members on their journey towards sponsored work in Canada." },
      { property: "og:title", content: "Member testimonials — Steve Safari" },
      { property: "og:description", content: "Stories from Steve Safari members, shared with their consent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(testimonialsQuery),
  component: Testimonials,
});

function Testimonials() {
  const { data } = useSuspenseQuery(testimonialsQuery);
  return (
    <>
      <PageHero eyebrow="Testimonials" title="In our members' own words.">
        <p>Every testimonial is shared with the member's consent.</p>
      </PageHero>
      <section className="container-page py-14 md:py-20">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <MessageSquareQuote className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-display text-xl">Testimonials are coming soon.</p>
            <p className="mt-2 text-sm text-muted-foreground">We publish member stories only once they have agreed to share them.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/register">Start your own journey</Link></Button>
          </div>
        ) : (
          <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [&>*]:mb-6">
            {data.map((t) => (
              <figure key={t.id} className="break-inside-avoid rounded-2xl border border-border bg-card p-7 shadow-soft">
                <Quote className="h-5 w-5 text-accent" />
                <blockquote className="mt-3 font-display text-lg leading-relaxed">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.name} className="h-12 w-12 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary font-display text-lg text-primary">{t.name.charAt(0)}</span>
                  )}
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    {(t.role_title || t.location) && <p className="text-xs text-muted-foreground">{[t.role_title, t.location].filter(Boolean).join(" · ")}</p>}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
