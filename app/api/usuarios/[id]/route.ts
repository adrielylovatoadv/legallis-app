import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { updateUserAsync, deleteUserAsync, getUserByIdAsync } from "@/lib/users";

const USER_EDITABLE_FIELDS = ["name", "phone", "theme", "oab", "company", "avatar", "password", "sexo"] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  // Users can only see themselves unless admin
  if (session.user.role !== "admin" && session.user.id !== id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const user = await getUserByIdAsync(id);
  if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const { password: _pw, ...safe } = user;
  return NextResponse.json(safe);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  // Users can only edit themselves (name/password); admins can edit everything
  if (session.user.role !== "admin" && session.user.id !== id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const rawBody = await req.json();
  let body: Record<string, unknown>;
  if (session.user.role !== "admin") {
    // Whitelist: apenas campos permitidos para usuários comuns
    body = Object.fromEntries(
      USER_EDITABLE_FIELDS.filter(f => f in rawBody).map(f => [f, rawBody[f]])
    );
  } else {
    body = rawBody;
  }
  // Hash senha se enviada
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
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json({ error: "Não pode excluir a si mesmo" }, { status: 400 });
  }
  const ok = await deleteUserAsync(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Não encontrado" }, { status: 404 });
}
