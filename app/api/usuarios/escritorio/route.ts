import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByIdAsync, getTenantUsersAsync, toSafeUser } from "@/lib/users";

// Retorna todos os usuários do mesmo escritório (tenantId) do usuário logado
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const currentUser = await getUserByIdAsync(session.user.id);
  if (!currentUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const colegas = await getTenantUsersAsync(currentUser);
  return NextResponse.json(colegas.map(toSafeUser));
}
