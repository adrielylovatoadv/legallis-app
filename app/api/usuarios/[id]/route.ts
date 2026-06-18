import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserAsync, deleteUserAsync, getUserByIdAsync } from "@/lib/users";

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
  const body = await req.json();
  // Non-admins cannot change role/plan
  if (session.user.role !== "admin") {
    delete body.role;
    delete body.plan;
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
