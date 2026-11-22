import type { ReactNode } from "react";
import { PageHero } from "./PageHero";
import { POLICY_VERSION } from "@/lib/constants";

export function LegalPage({ eyebrow, title, sections }: { eyebrow: string; title: string; sections: { heading: string; body: ReactNode }[] }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title}>
        <p className="text-sm">Version {POLICY_VERSION}</p>
      </PageHero>
      <section className="container-page py-14 md:py-20">
        <div className="mx-auto max-w-3xl space-y-10">
          {sections.map((s, i) => (
            <div key={s.heading}>
              <h2 className="text-xl font-medium md:text-2xl">
                <span className="mr-2 font-display italic text-accent">{i + 1}.</span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
