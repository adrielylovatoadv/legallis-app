import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByIdAsync } from "@/lib/users";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 503 });
  }

  const user = await getUserByIdAsync(session.user.id);
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "Nenhuma assinatura Stripe encontrada." }, { status: 404 });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const returnUrl = `${process.env.NEXTAUTH_URL}/dashboard/configuracoes/assinatura`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[Stripe Portal]", err);
    return NextResponse.json({ error: "Erro ao criar sessão do portal." }, { status: 500 });
  }
}
