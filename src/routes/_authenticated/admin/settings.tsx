import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, RequireAdmin } from "@/components/admin/ui";
import { getIntegrationStatus, saveEmailSettings, savePayhero, sendTestEmail, testPayhero } from "@/lib/admin.functions";
import { createBridgeKey, getDemoCount, removeDemoMembers } from "@/lib/extra.functions";
import { supabase } from "@/integrations/supabase/client";
import { siteContentQuery } from "@/lib/queries";
import type { ContactContent } from "@/lib/site-content";

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
  const [ph, setPh] = useState({ api_token: "", channel_id: "" });
  const [to, setTo] = useState("");
  
  const s = status.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Email (Resend), M-Pesa payments, server bridge and sample data." />
      
      {/* Email Section */}
      <section className={card}>
        <h2 className="text-lg font-medium">Email - Resend {s?.email.configured && <span className="text-sm text-primary">· connected</span>}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Resend API key {s?.email.hasSecret && "(saved - leave blank to keep)"}</Label><Input type="password" placeholder="re_..." value={em.api_key} onChange={(e) => setEm({ ...em, api_key: e.target.value })} /></div>
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

      {/* PayHero Section */}
      <section className={card}>
        <h2 className="text-lg font-medium">M-Pesa - PayHero {s?.payhero.configured && <span className="text-sm text-primary">· connected</span>}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>API Token (Basic Auth) {s?.payhero.hasSecret && "(saved - leave blank to keep)"}</Label>
            <Input 
              type="password" 
              placeholder="e.g. dXNlcm5hbWU6cGFzc3dvcmQ=" 
              value={ph.api_token} 
              onChange={(e) => setPh({ ...ph, api_token: e.target.value })} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste the token generated from <strong>app.payhero.co.ke → API Keys</strong>. The app will automatically handle the <code>Basic </code> prefix.
            </p>
          </div>
          <div>
            <Label>Channel ID</Label>
            <Input value={ph.channel_id} placeholder={s?.payhero.publicConfig["channel_id"]} onChange={(e) => setPh({ ...ph, channel_id: e.target.value })} />
          </div>
        </div>
        
        <div className="rounded-md bg-muted p-3 mt-2 border border-border">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Active Callback URL</Label>
          <p className="text-sm font-mono mt-1 break-all select-all">{s?.defaultCallbackUrl}</p>
          <p className="text-xs text-muted-foreground mt-1">This is automatically passed to PayHero with every STK Push.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={async () => { if (await act(savePh({ data: { api_token: ph.api_token || undefined, channel_id: ph.channel_id || (s?.payhero.publicConfig["channel_id"] ?? "") } }), "PayHero saved")) refresh(); }}>Save</Button>
          <Button variant="outline" onClick={async () => { const r = await testPh(); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Test connection</Button>
        </div>
      </section>

      <SupportContactSection />
      <BridgeSection />
      <DemoSection />
    </div>
  );
}

function SupportContactSection() {
  const qc = useQueryClient();
  const content = useQuery(siteContentQuery);
  const [c, setC] = useState<ContactContent | null>(null);
  const current = c ?? content.data?.contact ?? { phone: "", email: "", whatsapp: "", address: "", hours: "" };
  const fields: { key: keyof ContactContent; label: string; placeholder: string }[] = [
    { key: "email", label: "Support email", placeholder: "support@yourdomain.com" },
    { key: "phone", label: "Phone number", placeholder: "+254 7XX XXX XXX" },
    { key: "whatsapp", label: "WhatsApp number", placeholder: "+254 7XX XXX XXX" },
    { key: "address", label: "Office address", placeholder: "Nairobi, Kenya" },
    { key: "hours", label: "Working hours", placeholder: "Monday – Friday, 8:00am – 5:00pm EAT" },
  ];
  return (
    <section className={card}>
      <h2 className="text-lg font-medium">Support contact details</h2>
      <p className="text-sm text-muted-foreground">Shown on the Contact and Support pages and in the site footer.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}><Label>{f.label}</Label><Input placeholder={f.placeholder} value={current[f.key]} onChange={(e) => setC({ ...current, [f.key]: e.target.value })} /></div>
        ))}
      </div>
      <Button
        disabled={!c}
        onClick={async () => {
          const { error } = await supabase.from("site_content").upsert({ key: "contact", value: current as never }, { onConflict: "key" });
          if (error) { toast.error(error.message); return; }
          toast.success("Support details saved");
          setC(null);
          void qc.invalidateQueries({ queryKey: siteContentQuery.queryKey });
        }}
      >Save support details</Button>
    </section>
  );
}

function BridgeSection() {
  const create = useServerFn(createBridgeKey);
  const [newKey, setNewKey] = useState<string | null>(null);

  return (
    <section className={card}>
      <h2 className="text-lg font-medium">Server Bridge</h2>
      <p className="text-sm text-muted-foreground">
        Generate a secure token and add only <code>HL_SERVER_KEY</code> to your Vercel environment.
        The stable bridge address is built in, so Vercel can use the latest Lovable preview without publishing the Lovable site or setting a bridge URL.
      </p>
      
      <Button 
        onClick={async () => { 
          try { 
            const r = await create(); 
            setNewKey(r.key); 
          } catch (e) { 
            toast.error((e as Error).message); 
          } 
        }}
      >
        Generate Server Key
      </Button>

      {newKey && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm mt-4">
          <p className="font-medium text-destructive">Copy this key now. It will not be shown again:</p>
          <code className="block break-all mt-2">{newKey}</code>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(newKey)}>
            Copy Key
          </Button>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground mt-4">
        Generate the key from Lovable Admin Settings, then save it in Vercel as HL_SERVER_KEY and redeploy Vercel. No bridge URL is needed.
      </div>
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
