import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumeResetToken, getUserByEmailAsync, updateUserAsync } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`redefinir:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 10 minutos." }, { status: 429 });
  }

  const { token, password } = await req.json();
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const email = consumeResetToken(token);
  if (!email) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 400 });
  }
  const user = await getUserByEmailAsync(email);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const hashedPassword = await bcrypt.hash(password as string, 10);
  await updateUserAsync(user.id, { password: hashedPassword });
  return NextResponse.json({ ok: true });
}
