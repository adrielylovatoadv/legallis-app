import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser } from "@/lib/users";
import type { Plan } from "@/lib/users";

// Mapeamento de Payment Link → plano
const LINK_TO_PLAN: Record<string, Plan> = {
  "test_6oU4gA6FE7Gt3Eg24NeEo00": "basic",
  "test_8x200k8NMaSF1w87p7eEo02": "pro",
  "test_3cIaEYbZY5yl0s46l3eEo01": "pro", // profissional → pro
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: { type: string; data: { object: Record<string, unknown> } };

  // Verifica assinatura do webhook se a secret estiver configurada
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET) as unknown as typeof event;
    } catch (err) {
      console.error("Webhook signature error:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // Dev mode sem verificação
    event = JSON.parse(body);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      client_reference_id?: string;
      customer_email?: string;
      payment_link?: string;
    };

    const userId = session.client_reference_id;
    const paymentLink = session.payment_link ?? "";

    // Detecta plano pelo ID do payment link
    const linkSuffix = Object.keys(LINK_TO_PLAN).find(k => paymentLink.includes(k));
    const plan: Plan = linkSuffix ? LINK_TO_PLAN[linkSuffix] : "basic";

    if (userId) {
      const user = getUserById(userId);
      if (user) {
        updateUser(userId, { plan });
        console.log(`[Stripe] Usuário ${user.email} ativado com plano ${plan}`);
      }
    } else if (session.customer_email) {
      // Fallback: busca por email
      const { getUserByEmail } = await import("@/lib/users");
      const user = getUserByEmail(session.customer_email);
      if (user) {
        updateUser(user.id, { plan });
        console.log(`[Stripe] Usuário ${user.email} ativado com plano ${plan} (por email)`);
      }
    }
  }

  return NextResponse.json({ received: true });
}

// Stripe exige que o body não seja parseado como JSON
export const config = {
  api: { bodyParser: false },
};
