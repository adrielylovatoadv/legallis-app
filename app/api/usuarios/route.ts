import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsers, createUser } from "@/lib/users";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const users = getUsers().map(({ password: _, ...u }) => u);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, password, role, plan } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }
  const user = createUser({ name, email, password, role: role ?? "user", plan: plan ?? "basic", avatar: "" });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
