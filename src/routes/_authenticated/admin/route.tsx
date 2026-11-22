import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CreditCard, FileStack, Inbox, LayoutDashboard, Loader2, LogOut, Mail, Menu, Settings, ShieldCheck, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/Logo";
import { AdminContext, type AdminMe } from "@/components/admin/admin-context";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/admin.functions";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Steve Safari" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; level: "staff" | "admin" | "super" };
const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, level: "admin" },
  { to: "/admin/applications", label: "Applications", icon: FileStack, level: "admin" },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, level: "admin" },
  { to: "/admin/emails", label: "Emails", icon: Mail, level: "admin" },
  { to: "/admin/messages", label: "Messages", icon: Inbox, level: "admin" },
  { to: "/admin/settings", label: "Integrations", icon: Settings, level: "admin" },
];

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const me = useQuery({ queryKey: ["admin-me"], queryFn: () => fetchMe(), staleTime: 60_000 });
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (me.isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (me.isError || !me.data) {
    return (
      <Centered title="We couldn't load your account" body="Please refresh the page or sign in again.">
        <Button onClick={signOut}>Sign in again</Button>
      </Centered>
    );
  }
  const data = me.data as AdminMe;
  if (!data.active || data.roles.length === 0) {
    return (
      <Centered title="No admin access" body="This account doesn't have access to the Steve Safari dashboard, or it has been deactivated.">
        <Button onClick={signOut}>Sign out</Button>
      </Centered>
    );
  }
  if (data.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
          <ShieldCheck className="h-8 w-8 text-accent" />
          <h1 className="mt-4 text-2xl font-medium">Set your own password</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">For security, you must replace your temporary password before using the dashboard.</p>
          <ChangePasswordForm onDone={() => void me.refetch()} />
          <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const isSuper = data.roles.includes("super_admin");
  const isAdmin = isSuper || data.roles.includes("admin");
  const items = NAV.filter((n) => n.level === "staff" || (n.level === "admin" && isAdmin) || (n.level === "super" && isSuper));

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={() => setOpen(false)}
          activeOptions={{ exact: n.to === "/admin" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <AdminContext.Provider value={data}>
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar p-4 text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-2 py-2">
            <Link to="/" className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <span className="font-display text-lg">Steve <span className="italic">Safari</span></span>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-6 flex-1 overflow-y-auto">{nav}</div>
          <div className="border-t border-sidebar-border pt-4">
            <p className="truncate px-2 text-sm font-medium">{data.fullName ?? data.email}</p>
            <p className="truncate px-2 text-xs text-sidebar-foreground/60">{data.roles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
            <button onClick={signOut} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-charcoal/40 lg:hidden" onClick={() => setOpen(false)} />}
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            <span className="font-display text-lg text-primary">Admin</span>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}

function Centered({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-medium">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
