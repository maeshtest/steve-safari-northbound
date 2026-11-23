import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, RequireAdmin, fmtDate } from "@/components/admin/ui";
import { useAdmin } from "@/components/admin/admin-context";
import { createAdmin, listAdmins, updateAdmin } from "@/lib/admin.functions";
import { ROLE_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin/administrators")({ component: () => <RequireAdmin superOnly><Admins /></RequireAdmin> });

type Role = "super_admin" | "admin" | "editor";

function Admins() {
  const me = useAdmin();
  const qc = useQueryClient();
  const list = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const update = useServerFn(updateAdmin);
  const q = useQuery({ queryKey: ["admins"], queryFn: () => list() });
  const [f, setF] = useState({ email: "", fullName: "", role: "admin" as Role, tempPassword: "" });
  const [busy, setBusy] = useState(false);

  const run = async (p: Promise<unknown>, msg: string) => {
    try { await p; toast.success(msg); qc.invalidateQueries({ queryKey: ["admins"] }); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Administrators" description="Create staff accounts, change roles and deactivate access." />
      <form
        className="grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await run(create({ data: f }), "Account created — share the temporary password securely.");
          setBusy(false);
          setF({ email: "", fullName: "", role: "admin", tempPassword: "" });
        }}
      >
        <div><Label>Full name</Label><Input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div><Label>Email</Label><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Temporary password</Label><Input required minLength={12} value={f.tempPassword} onChange={(e) => setF({ ...f, tempPassword: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(["super_admin", "admin", "editor"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="md:col-span-4"><Button disabled={busy}>Add administrator</Button></div>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Added</th><th className="p-3" /></tr></thead>
          <tbody>
            {q.data?.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3">{a.full_name}</td>
                <td className="p-3">{a.email}</td>
                <td className="p-3">
                  <select className="rounded-md border border-input bg-background px-2 py-1" value={a.roles[0] ?? "editor"} disabled={a.id === me.userId}
                    onChange={(e) => run(update({ data: { userId: a.id, role: e.target.value as Role } }), "Role updated")}>
                    {(["super_admin", "admin", "editor"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="p-3">{a.active ? "Active" : "Deactivated"}</td>
                <td className="p-3">{fmtDate(a.created_at, false)}</td>
                <td className="p-3 text-right">
                  {a.id !== me.userId && (
                    <Button size="sm" variant="outline" onClick={() => run(update({ data: { userId: a.id, active: !a.active } }), a.active ? "Deactivated" : "Reactivated")}>
                      {a.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
