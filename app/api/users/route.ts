import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserByIdAsync, getTenantUsersAsync } from "@/lib/users";

// Usado para popular dropdowns de "Responsável" (Prazos, Iniciais). Deve retornar
// apenas usuários do mesmo escritório (tenantId) do usuário logado.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const currentUser = await getUserByIdAsync(session.user.id);
  if (!currentUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const users = (await getTenantUsersAsync(currentUser))
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      oab: u.oab ?? [],
      company: u.company ?? null,
    }));
  return NextResponse.json(users);
}
