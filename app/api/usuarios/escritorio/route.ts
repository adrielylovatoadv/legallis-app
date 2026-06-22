import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync, getUserByIdAsync } from "@/lib/users";

// Retorna todos os usuários do mesmo escritório (tenantId) do usuário logado
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const currentUser = await getUserByIdAsync(session.user.id);
  if (!currentUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const allUsers = await getUsersAsync();

  // Filtra pelo mesmo tenantId; se não houver tenantId, retorna só o próprio usuário
  const colegas = currentUser.tenantId
    ? allUsers.filter(u => u.tenantId === currentUser.tenantId && u.isActive)
    : allUsers.filter(u => u.id === currentUser.id);

  const safe = colegas.map(({ password: _, ...u }) => u);
  return NextResponse.json(safe);
}
