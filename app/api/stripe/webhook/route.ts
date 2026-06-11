import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserByEmail, updateUser } from "@/lib/users";
import type { Plan, SubscriptionStatus } from "@/lib/users";

// Mapeamento de Payment Link suffix → plano
const LINK_TO_PLAN: Record<string, Plan> = {
  "test_6oU4gA6FE7Gt3Eg24NeEo00": "basic",
  "test_8x200k8NMaSF1w87p7eEo02": "pro",
  "test_3cIaEYbZY5yl0s46l3eEo01": "profissional",
};

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

async function parseEvent(req: NextRequest): Promise<StripeEvent | null> {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET) as unknown as StripeEvent;
    } catch (err) {
      console.error("[Stripe Webhook] Signature error:", err);
      return null;
    }
  }
  // Dev mode: no signature verification
  return JSON.parse(body) as StripeEvent;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] ${subject} → ${to}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Legallis <noreply@legallis.app.br>",
    to: to.includes("@legallis") ? "adriely@legallis.app.br" : to,
    subject,
    html,
  });
}

export async function POST(req: NextRequest) {
  const event = await parseEvent(req);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  console.log(`[Stripe] Event: ${event.type}`);

  switch (event.type) {
    // ── Pagamento aprovado (checkout com payment link) ──────────────
    case "checkout.session.completed": {
      const session = event.data.object as {
        client_reference_id?: string;
        customer_email?: string;
        customer?: string;
        payment_link?: string;
        subscription?: string;
      };

      const paymentLink = session.payment_link ?? "";
      const linkSuffix = Object.keys(LINK_TO_PLAN).find(k => paymentLink.includes(k));
      const plan: Plan = linkSuffix ? LINK_TO_PLAN[linkSuffix] : "basic";

      let user = session.client_reference_id ? getUserById(session.client_reference_id) : null;
      if (!user && session.customer_email) user = getUserByEmail(session.customer_email);

      if (user) {
        updateUser(user.id, {
          plan,
          subscriptionStatus: "active",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        });
        console.log(`[Stripe] Assinatura ativada: ${user.email} → plano ${plan}`);

        const planLabels: Record<string, string> = { basic: "Básico", pro: "Pro", profissional: "Profissional" };
        await sendEmail(
          user.email,
          "Bem-vindo ao Legallis! Assinatura confirmada.",
          `<h2>Olá, ${user.name}!</h2>
           <p>Sua assinatura do plano <strong>${planLabels[plan] ?? plan}</strong> foi ativada com sucesso.</p>
           <p>Acesse agora: <a href="${process.env.NEXTAUTH_URL}/dashboard">${process.env.NEXTAUTH_URL}/dashboard</a></p>
           <p>Equipe Legallis</p>`
        );
      }
      break;
    }

    // ── Renovação de assinatura ──────────────────────────────────────
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as {
        customer?: string;
        customer_email?: string;
        subscription?: string;
        billing_reason?: string;
      };

      if (invoice.billing_reason === "subscription_cycle") {
        let user = invoice.customer_email ? getUserByEmail(invoice.customer_email) : null;
        if (!user && invoice.customer) {
          const users = (await import("@/lib/users")).getUsers();
          user = users.find(u => u.stripeCustomerId === invoice.customer) ?? null;
        }
        if (user) {
          updateUser(user.id, { subscriptionStatus: "active" });
          console.log(`[Stripe] Renovação: ${user.email}`);
        }
      }
      break;
    }

    // ── Pagamento falhou ─────────────────────────────────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as {
        customer?: string;
        customer_email?: string;
      };

      let user = invoice.customer_email ? getUserByEmail(invoice.customer_email) : null;
      if (!user && invoice.customer) {
        const users = (await import("@/lib/users")).getUsers();
        user = users.find(u => u.stripeCustomerId === invoice.customer) ?? null;
      }

      if (user) {
        updateUser(user.id, { subscriptionStatus: "pending" });
        console.log(`[Stripe] Pagamento falhou: ${user.email}`);
        await sendEmail(
          user.email,
          "Problema com seu pagamento — Legallis",
          `<h2>Olá, ${user.name}!</h2>
           <p>Houve um problema ao processar seu pagamento. Por favor, atualize suas informações de pagamento.</p>
           <p>Acesse: <a href="${process.env.NEXTAUTH_URL}/assinar">${process.env.NEXTAUTH_URL}/assinar</a></p>
           <p>Equipe Legallis</p>`
        );
      }
      break;
    }

    // ── Assinatura cancelada ─────────────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as {
        customer?: string;
        status?: string;
      };

      const users = (await import("@/lib/users")).getUsers();
      const user = users.find(u => u.stripeCustomerId === sub.customer) ?? null;

      if (user) {
        updateUser(user.id, { subscriptionStatus: "cancelled" as SubscriptionStatus });
        console.log(`[Stripe] Assinatura cancelada: ${user.email}`);
        await sendEmail(
          user.email,
          "Assinatura cancelada — Legallis",
          `<h2>Olá, ${user.name}!</h2>
           <p>Sua assinatura foi cancelada. Seus dados ficam disponíveis por mais 1 dia.</p>
           <p>Para reativar: <a href="${process.env.NEXTAUTH_URL}/assinar">${process.env.NEXTAUTH_URL}/assinar</a></p>
           <p>Equipe Legallis</p>`
        );
      }
      break;
    }

    // ── Assinatura atualizada (upgrade/downgrade) ────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as {
        customer?: string;
        status?: string;
        items?: { data?: Array<{ price?: { lookup_key?: string; product?: string } }> };
      };

      const status = sub.status;
      const subscriptionStatus: SubscriptionStatus =
        status === "active" ? "active" :
        status === "canceled" ? "cancelled" :
        status === "past_due" ? "pending" : "active";

      const users = (await import("@/lib/users")).getUsers();
      const user = users.find(u => u.stripeCustomerId === sub.customer) ?? null;

      if (user) {
        updateUser(user.id, { subscriptionStatus });
        console.log(`[Stripe] Assinatura atualizada: ${user.email} → ${subscriptionStatus}`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
