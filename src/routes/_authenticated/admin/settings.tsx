import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, RequireAdmin, fmtDate } from "@/components/admin/ui";
import { getIntegrationStatus, saveEmailSettings, savePayhero, sendTestEmail, testPayhero } from "@/lib/admin.functions";
import { createBridgeKey, getDemoCount, listBridgeKeys, removeDemoMembers, revokeBridgeKey } from "@/lib/extra.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({ component: () => <RequireAdmin><Settings /></RequireAdmin> });

const card = "space-y-4 rounded-xl border border-border bg-card p-6";
async function act(p: Promise<unknown>, ok: string) {
  try { await p; toast.success(ok); return true; } catch (e) { toast.error((e as Error).message); return false; }
}

function Settings() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["integrations"], queryFn: useServerFn(getIntegrationStatus) });
  const saveEmail = useServerFn(saveEmailSettings);
  const testEmail = useServerFn(sendTestEmail);
  const savePh = useServerFn(savePayhero);
  const testPh = useServerFn(testPayhero);
  const [em, setEm] = useState({ api_key: "", from_name: "Steve Safari", from_email: "", reply_to: "" });
  const [ph, setPh] = useState({ api_username: "", api_password: "", channel_id: "", callback_base_url: "" });
  const [to, setTo] = useState("");
  const s = status.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Email (Resend), M-Pesa payments, server bridge and sample data." />
      <section className={card}>
        <h2 className="text-lg font-medium">Email — Resend {s?.email.configured && <span className="text-sm text-primary">· connected</span>}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Resend API key {s?.email.hasSecret && "(saved — leave blank to keep)"}</Label><Input type="password" placeholder="re_..." value={em.api_key} onChange={(e) => setEm({ ...em, api_key: e.target.value })} /></div>
          <div><Label>From email (verified domain)</Label><Input placeholder={s?.email.publicConfig["from_email"] ?? "support@yourdomain.com"} value={em.from_email} onChange={(e) => setEm({ ...em, from_email: e.target.value })} /></div>
          <div><Label>From name</Label><Input value={em.from_name} onChange={(e) => setEm({ ...em, from_name: e.target.value })} /></div>
          <div><Label>Reply-to (optional)</Label><Input value={em.reply_to} onChange={(e) => setEm({ ...em, reply_to: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => { if (await act(saveEmail({ data: { provider: "resend", ...em, from_email: em.from_email || (s?.email.publicConfig["from_email"] ?? ""), api_key: em.api_key || undefined } }), "Email settings saved")) refresh(); }}>Save</Button>
          <Input className="w-64" placeholder="Send test to…" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" onClick={async () => { const r = await testEmail({ data: { to } }); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Send test</Button>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-medium">M-Pesa — PayHero {s?.payhero.configured && <span className="text-sm text-primary">· connected</span>}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>API username</Label><Input value={ph.api_username} placeholder={s?.payhero.publicConfig["api_username"]} onChange={(e) => setPh({ ...ph, api_username: e.target.value })} /></div>
          <div><Label>API password {s?.payhero.hasSecret && "(saved)"}</Label><Input type="password" value={ph.api_password} onChange={(e) => setPh({ ...ph, api_password: e.target.value })} /></div>
          <div><Label>Channel ID</Label><Input value={ph.channel_id} placeholder={s?.payhero.publicConfig["channel_id"]} onChange={(e) => setPh({ ...ph, channel_id: e.target.value })} /></div>
          <div><Label>Callback base URL (optional)</Label><Input value={ph.callback_base_url} onChange={(e) => setPh({ ...ph, callback_base_url: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Callback URL: {s?.defaultCallbackUrl}</p>
        <div className="flex gap-2">
          <Button onClick={async () => { if (await act(savePh({ data: { ...ph, api_password: ph.api_password || undefined } }), "PayHero saved")) refresh(); }}>Save</Button>
          <Button variant="outline" onClick={async () => { const r = await testPh(); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Test connection</Button>
        </div>
      </section>

      <BridgeSection />
      <DemoSection />
    </div>
  );
}

function BridgeSection() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["bridge-keys"], queryFn: useServerFn(listBridgeKeys) });
  const create = useServerFn(createBridgeKey);
  const revoke = useServerFn(revokeBridgeKey);
  const [label, setLabel] = useState("External site");
  const [newKey, setNewKey] = useState<string | null>(null);

  return (
    <section className={card}>
      <h2 className="text-lg font-medium">Server Bridge</h2>
      <p className="text-sm text-muted-foreground">
        Generate a key and add it to your external environment as <code>BRIDGE_KEY</code>.
        Your external site sends it in the <code>X-Bridge-Key</code> header to access the API — no service role key or endpoint URL needed.
      </p>
      <div className="flex gap-2">
        <Input className="w-64" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button onClick={async () => { try { const r = await create({ data: { label } }); setNewKey(r.key); qc.invalidateQueries({ queryKey: ["bridge-keys"] }); } catch (e) { toast.error((e as Error).message); } }}>Generate key</Button>
      </div>
      {newKey && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Copy this key now — it won't be shown again:</p>
          <code className="break-all">{newKey}</code>
          <Button size="sm" variant="outline" className="ml-2" onClick={() => navigator.clipboard.writeText(newKey)}>Copy</Button>
        </div>
      )}
      <ul className="space-y-2 text-sm">
        {keys.data?.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span>{k.label} · <code>{k.key_prefix}…</code> · last used {fmtDate(k.last_used_at)} {k.revoked_at && "· revoked"}</span>
            {!k.revoked_at && <Button size="sm" variant="ghost" onClick={async () => { await revoke({ data: { id: k.id } }); qc.invalidateQueries({ queryKey: ["bridge-keys"] }); }}>Revoke</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DemoSection() {
  const qc = useQueryClient();
  const c = useQuery({ queryKey: ["demo-count"], queryFn: useServerFn(getDemoCount) });
  const remove = useServerFn(removeDemoMembers);
  return (
    <section className={card}>
      <h2 className="text-lg font-medium">Sample members</h2>
      <p className="text-sm text-muted-foreground">{c.data?.count ?? 0} sample members are shown on the public lists.</p>
      <Button variant="destructive" disabled={!c.data?.count} onClick={async () => {
        if (!confirm("Remove all sample members?")) return;
        if (await act(remove(), "Sample members removed")) qc.invalidateQueries();
      }}>Remove all sample members</Button>
    </section>
  );
}
