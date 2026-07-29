import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { updateUserAsync, deleteUserAsync, getUserByIdAsync, isOwner, toSafeUser } from "@/lib/users";
import { PLAN_FEATURES, type Plan } from "@/lib/plans";

const USER_EDITABLE_FIELDS = ["name", "phone", "theme", "oab", "company", "avatar", "password", "sexo"] as const;
// Campos que o dono do escritório (ou super-admin) pode alterar em outro usuário do seu tenant
const MANAGER_EDITABLE_FIELDS = [...USER_EDITABLE_FIELDS, "role", "cargo", "isActive", "email"] as const;

// Super-admin (painel master, plan="admin") gerencia qualquer usuário de qualquer escritório.
// Dono do tenant ou funcionário com role="admin" ("Administrador do sistema") só gerenciam
// usuários do PRÓPRIO escritório.
//
// IMPORTANTE: super-admin aqui tem que ser `plan === "admin"`, NUNCA `role === "admin"` — role
// é um papel interno do escritório, livremente atribuível pelo dono do tenant a qualquer
// funcionário (dropdown "Administrador do sistema" em Configurações > Usuários). Usar `role`
// para pular a checagem de tenant permitia que qualquer escritório criasse um funcionário
// "role: admin" e, com ele, editasse/excluísse usuários de OUTROS escritórios.
async function requireManagerForTarget(sessionUserId: string, targetId: string) {
  const currentUser = await getUserByIdAsync(sessionUserId);
  const targetUser = await getUserByIdAsync(targetId);
  if (!currentUser || !targetUser) return null;
  const isSuperAdmin = currentUser.plan === "admin";
  const isTenantManager = isSuperAdmin || isOwner(currentUser) || currentUser.role === "admin";
  if (!isTenantManager) return null;
  if (!isSuperAdmin && currentUser.tenantId !== targetUser.tenantId) return null;
  return { currentUser, targetUser };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  if (session.user.id === id) {
    const user = await getUserByIdAsync(id);
    if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json(toSafeUser(user));
  }
  const managed = await requireManagerForTarget(session.user.id, id);
  if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  return NextResponse.json(toSafeUser(managed.targetUser));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  const rawBody = await req.json();
  let body: Record<string, unknown>;
  let targetPlan: Plan;

  if (session.user.id === id) {
    // Usuário editando a si mesmo: só campos de perfil, não pode se auto-promover/desativar
    body = Object.fromEntries(
      USER_EDITABLE_FIELDS.filter(f => f in rawBody).map(f => [f, rawBody[f]])
    );
    targetPlan = (session.user.plan as Plan) ?? "basic";
  } else {
    const managed = await requireManagerForTarget(session.user.id, id);
    if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    body = Object.fromEntries(
      MANAGER_EDITABLE_FIELDS.filter(f => f in rawBody).map(f => [f, rawBody[f]])
    );
    targetPlan = (managed.targetUser.plan as Plan) ?? "basic";
  }

  if (Array.isArray(body.oab)) {
    const maxOabs = PLAN_FEATURES[targetPlan]?.maxOabs ?? 1;
    if (body.oab.length > maxOabs) {
      return NextResponse.json({ error: `Limite de ${maxOabs} registros de OAB atingido para o plano ${PLAN_FEATURES[targetPlan]?.label ?? targetPlan}. Faça upgrade para cadastrar mais.` }, { status: 403 });
    }
  }

  if (body.password && typeof body.password === "string" && !body.password.startsWith("$2")) {
    body.password = await bcrypt.hash(body.password, 10);
  }
  const updated = await updateUserAsync(id, body);
  if (!updated) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(toSafeUser(updated));
}

export async function DELETE(req2: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json({ error: "Não pode excluir a si mesmo" }, { status: 400 });
  }
  const managed = await requireManagerForTarget(session.user.id, id);
  if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const ok = await deleteUserAsync(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Não encontrado" }, { status: 404 });
}
