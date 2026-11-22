import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="bg-forest-gradient grain text-forest-foreground">
      <div className="container-page relative z-10 py-16 md:py-20">
        <p className="eyebrow text-gold animate-fade-up">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-medium leading-[1.1] md:text-5xl animate-fade-up">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-base leading-relaxed text-forest-foreground/80 animate-fade-up">{children}</div>}
      </div>
    </section>
  );
}
