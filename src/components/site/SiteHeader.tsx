import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "./Logo";

const directories = [
  { to: "/members", label: "Registered Members" },
  { to: "/sponsorship", label: "Approved Sponsorship" },
  { to: "/flight-waiting-list", label: "Flight Waiting List" },
  { to: "/alumni", label: "Programme Alumni" },
] as const;

const main = [
  { to: "/about", label: "About" },
  { to: "/team", label: "Team" },
  { to: "/testimonials", label: "Testimonials" },
  { to: "/support", label: "Support" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const linkCls = "text-sm font-medium text-foreground/80 transition-colors hover:text-primary";
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          <Link to="/about" className={linkCls} activeProps={{ className: "text-primary" }}>About</Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={`${linkCls} flex items-center gap-1 outline-none`}>
              Members <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {directories.map((d) => (
                <DropdownMenuItem key={d.to} asChild>
                  <Link to={d.to}>{d.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/team" className={linkCls} activeProps={{ className: "text-primary" }}>Team</Link>
          <Link to="/testimonials" className={linkCls} activeProps={{ className: "text-primary" }}>Testimonials</Link>
          <Link to="/support" className={linkCls} activeProps={{ className: "text-primary" }}>Support</Link>
          <Link to="/contact" className={linkCls} activeProps={{ className: "text-primary" }}>Contact</Link>
          <Link to="/status" className={linkCls} activeProps={{ className: "text-primary" }}>Check status</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="gold" className="hidden sm:inline-flex">
            <Link to="/register">Register · KES 500</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mt-8 flex flex-col gap-1">
                {main.map((m) => (
                  <Link key={m.to} to={m.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted">
                    {m.label}
                  </Link>
                ))}
                <Link to="/status" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-base font-medium hover:bg-muted">
                  Check application status
                </Link>
                <p className="eyebrow mt-5 px-3 text-muted-foreground">Member lists</p>
                {directories.map((d) => (
                  <Link key={d.to} to={d.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-[0.95rem] hover:bg-muted">
                    {d.label}
                  </Link>
                ))}
                <Button asChild variant="gold" size="lg" className="mt-6">
                  <Link to="/register" onClick={() => setOpen(false)}>Register · KES 500</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
