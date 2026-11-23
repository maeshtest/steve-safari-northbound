import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/team")({ component: TeamAdmin });

type Form = { id?: string; full_name: string; role_title: string; bio: string; photo_url: string | null; sort_order: number; is_visible: boolean };
const blank: Form = { full_name: "", role_title: "", bio: "", photo_url: null, sort_order: 0, is_visible: true };

function TeamAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-team"] }); qc.invalidateQueries({ queryKey: ["team"] }); };

  const upload = async (file: File) => {
    if (!form) return;
    if (file.size > 5_000_000) { toast.error("Photo must be under 5 MB"); return; }
    const path = `team/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
    const { error } = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); return; }
    setForm({ ...form, photo_url: supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl });
  };

  const save = async () => {
    if (!form || form.full_name.trim().length < 2) { toast.error("Enter a name"); return; }
    setBusy(true);
    const { id, ...row } = form;
    const { error } = id ? await supabase.from("team_members").update(row).eq("id", id) : await supabase.from("team_members").insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setForm(null);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    await supabase.from("team_members").delete().eq("id", id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="People shown on the public Team page." actions={<Button onClick={() => setForm({ ...blank, sort_order: (q.data?.length ?? 0) + 1 })}>Add member</Button>} />
      {form && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2">
          <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Role / title</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Bio</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <div>
            <Label>Photo</Label>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {form.photo_url && <img src={form.photo_url} alt="" className="mt-2 h-20 w-20 rounded-full object-cover" />}
          </div>
          <div className="flex items-end gap-6">
            <div><Label>Order</Label><Input type="number" className="w-24" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} /> Visible</label>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button onClick={save} disabled={busy}>Save</Button>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {q.data?.length === 0 && <EmptyState>No team members yet.</EmptyState>}
      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.map((m) => (
          <div key={m.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
            {m.photo_url ? <img src={m.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.full_name} {!m.is_visible && <span className="text-xs text-muted-foreground">(hidden)</span>}</p>
              <p className="text-sm text-muted-foreground">{m.role_title}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setForm({ id: m.id, full_name: m.full_name, role_title: m.role_title, bio: m.bio, photo_url: m.photo_url, sort_order: m.sort_order, is_visible: m.is_visible })}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>Remove</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
