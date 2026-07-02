import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByIdAsync, getTenantUsersAsync, createUserAsync, updateUserAsync, isOwner } from "@/lib/users";
import { PLAN_FEATURES } from "@/lib/plans";

// Gerencia usuários do próprio escritório. Só o dono do tenant (quem contratou o plano)
// ou o super-admin da Legallis (painel mestre) podem administrar usuários por aqui.
async function requireManager(sessionUserId: string, sessionRole: string) {
  const currentUser = await getUserByIdAsync(sessionUserId);
  if (!currentUser) return null;
  if (sessionRole !== "admin" && !isOwner(currentUser)) return null;
  return currentUser;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const currentUser = await requireManager(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const users = (await getTenantUsersAsync(currentUser)).map(({ password: _, ...u }) => u);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const currentUser = await requireManager(session.user.id, session.user.role);
  if (!currentUser) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  // Contas legadas sem tenantId: atribui um agora para não vazar o novo usuário
  // para o fallback global (session.tenantId = t_<id>).
  if (!currentUser.tenantId) {
    currentUser.tenantId = `t_${currentUser.id}`;
    await updateUserAsync(currentUser.id, { tenantId: currentUser.tenantId });
  }

  const body = await req.json();
  const { name, email, password, role, cargo } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const tenantUsers = await getTenantUsersAsync(currentUser);
  if (tenantUsers.some(u => u.email.toLowerCase() === String(email).toLowerCase())) {
    return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
  }

  const effectivePlan = currentUser.plan;
  const maxUsers = PLAN_FEATURES[effectivePlan]?.maxUsers ?? 1;
  if (tenantUsers.length >= maxUsers) {
    return NextResponse.json({ error: `Limite de ${maxUsers} usuários atingido para o plano ${PLAN_FEATURES[effectivePlan]?.label ?? effectivePlan}.` }, { status: 403 });
  }

  const user = await createUserAsync({
    name, email, password,
    role: role ?? "user",
    plan: effectivePlan,
    cargo: cargo ?? undefined,
    avatar: "",
    subscriptionStatus: "active",
    isActive: true,
    tenantId: currentUser.tenantId,
  });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
