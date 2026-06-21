import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync, createUserAsync } from "@/lib/users";
import { PLAN_FEATURES } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const users = (await getUsersAsync()).map(({ password: _, ...u }) => u);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, password, role, plan } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }
  const allUsers = await getUsersAsync();
  const adminUser = allUsers.find(u => u.id === session.user.id);
  if (adminUser) {
    const maxUsers = PLAN_FEATURES[adminUser.plan]?.maxUsers ?? 1;
    if (allUsers.length >= maxUsers) {
      return NextResponse.json({ error: `Limite de ${maxUsers} usuários atingido para o plano ${PLAN_FEATURES[adminUser.plan]?.label ?? adminUser.plan}.` }, { status: 403 });
    }
  }
  const user = await createUserAsync({ name, email, password, role: role ?? "user", plan: plan ?? "basic", avatar: "", subscriptionStatus: "active", isActive: true });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
