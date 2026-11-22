import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";
import { ensureInitialAdmin } from "@/lib/admin.functions";
import heroImg from "@/assets/hero-savanna.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — Steve Safari" },
      { name: "description", content: "Sign in to the Steve Safari administration dashboard." },
      { property: "og:title", content: "Staff sign in — Steve Safari" },
      { property: "og:description", content: "Administration dashboard sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(ensureInitialAdmin);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap().catch(() => null);
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
    });
  }, [bootstrap, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("If that email belongs to a staff account, a reset link is on its way.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-forest lg:block">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative flex h-full flex-col justify-end p-12 text-forest-foreground">
          <p className="eyebrow text-gold">Administration</p>
          <p className="mt-3 max-w-md font-display text-3xl leading-snug">Every applicant deserves a careful, honest review.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-3xl font-medium">{mode === "signin" ? "Staff sign in" : "Reset your password"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "For Steve Safari administrators only. Accounts are created by a Super Admin." : "Enter your staff email and we'll send you a reset link."}
          </p>
          <form onSubmit={mode === "signin" ? signIn : forgot} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode === "signin" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
            {mode === "forgot" && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("signin")}>Back to sign in</Button>
            )}
          </form>
          <Link to="/" className="mt-10 block text-center text-sm text-muted-foreground hover:text-primary">← Back to website</Link>
        </div>
      </div>
    </div>
  );
}
