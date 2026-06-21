import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getUserByIdAsync } from "@/lib/users";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id, password } = await req.json();
  if (session.user.id !== id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const user = await getUserByIdAsync(id);
  if (!user) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  const match = user.password.startsWith("$2")
    ? await bcrypt.compare(password as string, user.password)
    : user.password === password;
  if (!match) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
