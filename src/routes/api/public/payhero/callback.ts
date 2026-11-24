import { createFileRoute } from "@tanstack/react-router";

// PayHero does not sign callbacks, so the payload is only a hint: every payment
// is re-verified against PayHero's transaction-status API before it counts.
export const Route = createFileRoute("/api/public/payhero/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 20_000) return new Response("Payload too large", { status: 413 });
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const { hasServiceKey, callPrimaryBridge } = await import("@/lib/server/bridge.server");
        if (!hasServiceKey()) {
          try {
            await callPrimaryBridge({ action: "payhero_callback", payload });
            return Response.json({ ok: true });
          } catch {
            return Response.json({ ok: false }, { status: 502 });
          }
        }
        const { processPayheroCallback } = await import("@/lib/server/payhero.server");
        return Response.json(await processPayheroCallback(payload));
      },
    },
  },
});
