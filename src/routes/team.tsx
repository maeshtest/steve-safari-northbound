import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PageHero } from "@/components/site/PageHero";
import { getTeam } from "@/lib/extra.functions";

const teamQuery = queryOptions({ queryKey: ["team"], queryFn: () => getTeam() });

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Our Team: Steve Safari" },
      { name: "description", content: "Meet the Steve Safari team helping Kenyans prepare for sponsored work in Canada." },
      { property: "og:title", content: "Our Team: Steve Safari" },
      { property: "og:description", content: "Meet the people behind the Steve Safari programme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(teamQuery),
  component: TeamPage,
});

function initials(n: string) {
  return n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function TeamPage() {
  const { data } = useSuspenseQuery(teamQuery);
  return (
    <>
      <PageHero eyebrow="Our team" title="The people guiding your journey">
        A small team dedicated to clear, honest support from registration to departure.
      </PageHero>
      <section className="container-page py-14">
        {data.length === 0 ? (
          <p className="text-muted-foreground">Team profiles are coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((m) => (
              <article key={m.id} className="rounded-xl border border-border bg-card p-6">
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.full_name} loading="lazy" className="h-24 w-24 rounded-full object-cover" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-foreground">{initials(m.full_name)}</div>
                )}
                <h2 className="mt-4 text-xl font-medium">{m.full_name}</h2>
                <p className="text-sm text-accent-foreground/80 font-medium">{m.role_title}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{m.bio}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
