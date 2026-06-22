import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync, saveUsersAsync } from "@/lib/users";

// Endpoint único: define tenantId para todos os usuários ativos sem tenantId
export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const users = await getUsersAsync();
  const DEFAULT_TENANT = "t_1";
  let atualizados = 0;

  const updated = users.map(u => {
    if (u.isActive && !u.tenantId) {
      atualizados++;
      return { ...u, tenantId: DEFAULT_TENANT };
    }
    return u;
  });

  await saveUsersAsync(updated);

  return NextResponse.json({
    ok: true,
    atualizados,
    total: users.length,
  });
}
