import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers } from "@/lib/users";
import { getTickets } from "@/lib/suporte";

export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = getUsers();
  const tickets = getTickets();

  const now = Date.now();
  const trialUsers = users.filter(u => u.subscriptionStatus === "trial");
  const activeUsers = users.filter(u => u.subscriptionStatus === "active");
  const expiredUsers = users.filter(u => {
    if (u.subscriptionStatus === "trial" && u.trialEndsAt) {
      return new Date(u.trialEndsAt).getTime() < now;
    }
    return u.subscriptionStatus === "expired";
  });

  const planRevenue: Record<string, number> = { basic: 49, pro: 99, profissional: 199 };
  const monthlyRevenue = activeUsers.reduce((sum, u) => sum + (planRevenue[u.plan] ?? 0), 0);

  return NextResponse.json({
    totalUsers: users.filter(u => u.plan !== "admin").length,
    trialActive: trialUsers.filter(u => u.trialEndsAt && new Date(u.trialEndsAt).getTime() > now).length,
    subscriptionsActive: activeUsers.length,
    expiredPlans: expiredUsers.length,
    openTickets: tickets.filter(t => t.status === "aberto" || t.status === "em_andamento").length,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
    byPlan: {
      basic: users.filter(u => u.plan === "basic" && u.subscriptionStatus === "active").length,
      pro: users.filter(u => u.plan === "pro" && u.subscriptionStatus === "active").length,
      profissional: users.filter(u => u.plan === "profissional" && u.subscriptionStatus === "active").length,
    },
  });
}
