import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserAsync } from "@/lib/users";

// Só apaga a conexão localmente — não revoga o token do lado do Google (o usuário pode fazer
// isso manualmente em myaccount.google.com/permissions se quiser).
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  await updateUserAsync(session.user.id, {
    googleCalendar: { connected: false, refreshTokenEnc: "", connectedAt: "" },
  });

  return NextResponse.json({ ok: true });
}
