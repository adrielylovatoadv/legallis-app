import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken, getUserByEmail, updateUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const email = consumeResetToken(token);
  if (!email) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 400 });
  }
  const user = getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  updateUser(user.id, { password });
  return NextResponse.json({ ok: true });
}
