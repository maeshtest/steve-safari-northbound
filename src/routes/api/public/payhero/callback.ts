import { createFileRoute } from "@tanstack/react-router";

// PayHero does not sign callbacks, so the payload is only a hint: every payment
// is re-verified against PayHero's transaction-status API before it counts.
export const Route = createFileRoute("/api/public/payhero/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAdminClient } = await import("@/lib/server/admin-client.server");
        const { verifyPayment } = await import("@/lib/server/payhero.server");
        const db = await getAdminClient();
        const raw = await request.text();
        if (raw.length > 20_000) return new Response("Payload too large", { status: 413 });
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          await db.from("payment_callbacks").insert({ payload: { raw: raw.slice(0, 2000) }, processing_result: "Invalid JSON" });
          return Response.json({ ok: false }, { status: 400 });
        }
        const response = (payload["response"] ?? {}) as Record<string, unknown>;
        const externalReference = typeof response["ExternalReference"] === "string" ? (response["ExternalReference"] as string) : null;
        const { data: log } = await db
          .from("payment_callbacks")
          .insert({ payload: payload as never, external_reference: externalReference })
          .select("id")
          .single();

        let result = "No matching payment";
        let verified = false;
        if (externalReference) {
          const { data: payment } = await db.from("payments").select("id, checkout_request_id").eq("external_reference", externalReference).maybeSingle();
          if (payment) {
            const checkout = response["CheckoutRequestID"];
            if (payment.checkout_request_id && checkout && checkout !== payment.checkout_request_id) {
              result = "CheckoutRequestID mismatch — ignored";
            } else {
              const amount = typeof response["Amount"] === "number" ? (response["Amount"] as number) : undefined;
              const receipt = typeof response["MpesaReceiptNumber"] === "string" ? (response["MpesaReceiptNumber"] as string) : undefined;
              const r = await verifyPayment(payment.id, { ...(amount !== undefined ? { amount } : {}), ...(receipt ? { receipt } : {}) });
              verified = r.status === "success";
              result = `Verified with PayHero: ${r.status}`;
            }
          }
        }
        if (log) await db.from("payment_callbacks").update({ verified, processing_result: result }).eq("id", log.id);
        return Response.json({ ok: true });
      },
    },
  },
});
