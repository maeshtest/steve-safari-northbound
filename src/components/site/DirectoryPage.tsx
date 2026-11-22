import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { directoryQuery } from "@/lib/queries";
import type { DirectoryList } from "@/lib/constants";
import { PageHero } from "./PageHero";

export function DirectoryPage({ list, eyebrow, title, intro }: { list: DirectoryList; eyebrow: string; title: string; intro: string }) {
  const { data } = useSuspenseQuery(directoryQuery(list));
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? data.filter((r) => r.display_name.toLowerCase().includes(s) || r.county.toLowerCase().includes(s)) : data;
  }, [data, q]);

  return (
    <>
      <PageHero eyebrow={eyebrow} title={title}>
        <p>{intro}</p>
      </PageHero>
      <section className="container-page py-12 md:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{data.length}</span> {data.length === 1 ? "member" : "members"} listed · names shown as first name and initial
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or county" className="pl-9" aria-label="Search the list" />
          </div>
        </div>
        {data.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-display text-xl">No one is listed here yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">This list updates automatically as members progress through the programme.</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r, i) => (
              <li key={`${r.display_name}-${i}`} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-lg text-primary">
                  {r.display_name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.county} · since {new Date(r.listed_since).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}
                  </p>
                </div>
              </li>
            ))}
            {filtered.length === 0 && <li className="col-span-full py-8 text-center text-sm text-muted-foreground">No matches for “{q}”.</li>}
          </ul>
        )}
        <p className="mt-10 text-xs text-muted-foreground">
          Only members who gave consent are listed. We never publish ID numbers, phone numbers, emails or documents.
        </p>
      </section>
    </>
  );
}
