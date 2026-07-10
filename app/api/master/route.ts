import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync, isOwner } from "@/lib/users";
import { getTickets } from "@/lib/suporte";

export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getUsersAsync();
  const tickets = getTickets();

  const now = Date.now();
  // Assinatura é por escritório (tenant): contas de equipe usam o plano do
  // dono sem cobrança própria, então só o dono do tenant entra na contagem
  // de assinaturas/receita. "Ativo" só conta como pago de verdade quando há
  // stripeSubscriptionId — do contrário é status setado manualmente (trial,
  // conta de teste) e não representa pagamento confirmado.
  const tenantOwners = users.filter(u => u.plan !== "admin" && isOwner(u));
  const payingOwners = tenantOwners.filter(u => u.subscriptionStatus === "active" && !!u.stripeSubscriptionId);
  const trialOwners = tenantOwners.filter(u => u.subscriptionStatus === "trial");
  const expiredOwners = tenantOwners.filter(u => {
    if (u.subscriptionStatus === "trial" && u.trialEndsAt) {
      return new Date(u.trialEndsAt).getTime() < now;
    }
    return u.subscriptionStatus === "expired";
  });

  const planRevenue: Record<string, number> = { basic: 97, pro: 347, profissional: 197 };
  const monthlyRevenue = payingOwners.reduce((sum, u) => sum + (planRevenue[u.plan] ?? 0), 0);

  return NextResponse.json({
    totalUsers: users.filter(u => u.plan !== "admin").length,
    trialActive: trialOwners.filter(u => u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now).length,
    subscriptionsActive: payingOwners.length,
    expiredPlans: expiredOwners.length,
    openTickets: tickets.filter(t => t.status === "aberto" || t.status === "em_andamento").length,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
    byPlan: {
      basic: payingOwners.filter(u => u.plan === "basic").length,
      pro: payingOwners.filter(u => u.plan === "pro").length,
      profissional: payingOwners.filter(u => u.plan === "profissional").length,
    },
  });
}
