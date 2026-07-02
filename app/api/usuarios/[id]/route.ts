import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { updateUserAsync, deleteUserAsync, getUserByIdAsync, isOwner } from "@/lib/users";

const USER_EDITABLE_FIELDS = ["name", "phone", "theme", "oab", "company", "avatar", "password", "sexo"] as const;
// Campos que o dono do escritório (ou super-admin) pode alterar em outro usuário do seu tenant
const MANAGER_EDITABLE_FIELDS = [...USER_EDITABLE_FIELDS, "role", "cargo", "isActive", "email"] as const;

// Dono do tenant ou super-admin, e o alvo pertence ao mesmo escritório
async function requireManagerForTarget(sessionUserId: string, sessionRole: string, targetId: string) {
  const currentUser = await getUserByIdAsync(sessionUserId);
  const targetUser = await getUserByIdAsync(targetId);
  if (!currentUser || !targetUser) return null;
  const manages = sessionRole === "admin" || isOwner(currentUser);
  if (!manages) return null;
  if (currentUser.tenantId !== targetUser.tenantId) return null;
  return { currentUser, targetUser };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  if (session.user.id === id) {
    const user = await getUserByIdAsync(id);
    if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    const { password: _pw, ...safe } = user;
    return NextResponse.json(safe);
  }
  const managed = await requireManagerForTarget(session.user.id, session.user.role, id);
  if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { password: _pw, ...safe } = managed.targetUser;
  return NextResponse.json(safe);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  const rawBody = await req.json();
  let body: Record<string, unknown>;

  if (session.user.id === id) {
    // Usuário editando a si mesmo: só campos de perfil, não pode se auto-promover/desativar
    body = Object.fromEntries(
      USER_EDITABLE_FIELDS.filter(f => f in rawBody).map(f => [f, rawBody[f]])
    );
  } else {
    const managed = await requireManagerForTarget(session.user.id, session.user.role, id);
    if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    body = Object.fromEntries(
      MANAGER_EDITABLE_FIELDS.filter(f => f in rawBody).map(f => [f, rawBody[f]])
    );
  }

  if (body.password && typeof body.password === "string" && !body.password.startsWith("$2")) {
    body.password = await bcrypt.hash(body.password, 10);
  }
  const updated = await updateUserAsync(id, body);
  if (!updated) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const { password: _, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(req2: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json({ error: "Não pode excluir a si mesmo" }, { status: 400 });
  }
  const managed = await requireManagerForTarget(session.user.id, session.user.role, id);
  if (!managed) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const ok = await deleteUserAsync(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Não encontrado" }, { status: 404 });
}
