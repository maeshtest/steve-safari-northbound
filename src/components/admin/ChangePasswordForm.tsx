import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completePasswordChange } from "@/lib/admin.functions";

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const complete = useServerFn(completePasswordChange);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 12) return toast.error("Use at least 12 characters.");
    if (next !== confirm) return toast.error("New passwords do not match.");
    if (next === current) return toast.error("Choose a password different from your current one.");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email ?? "";
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyErr) {
      setBusy(false);
      return toast.error("Your current password is incorrect.");
    }
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current } as never);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    await complete();
    setBusy(false);
    toast.success("Password changed.");
    setCurrent("");
    setNext("");
    setConfirm("");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cur">Current password</Label>
        <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new">New password (min. 12 characters)</Label>
        <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conf">Confirm new password</Label>
        <Input id="conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Change password</Button>
    </form>
  );
}
