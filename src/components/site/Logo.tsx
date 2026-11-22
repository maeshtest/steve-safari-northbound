import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("h-9 w-9", className)}>
      <circle cx="20" cy="20" r="19" className="fill-primary" />
      <circle cx="20" cy="17" r="7" className="fill-accent" />
      <path d="M5 26c4-2.5 8-3.5 15-3.5S31 23.5 35 26v2.5H5z" className="fill-forest-foreground/90" />
      <path d="M11 24.5c1.2-3 3-4.6 5.4-4.9-.6 1.5-.4 3 .4 4.4M24 22.5c1-2 2.6-3.2 4.8-3.5-.5 1.3-.4 2.6.3 3.8" className="stroke-primary" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Steve Safari home">
      <LogoMark />
      <span className={cn("font-display text-xl font-semibold tracking-tight", light ? "text-forest-foreground" : "text-primary")}>
        Steve <span className="italic font-normal">Safari</span>
      </span>
    </Link>
  );
}
