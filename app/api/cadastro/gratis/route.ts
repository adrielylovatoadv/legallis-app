import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { nome, email, telefone, senha, confirmSenha } = await req.json();

  if (!nome || !email || !senha) {
    return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres." }, { status: 400 });
  }
  if (senha !== confirmSenha) {
    return NextResponse.json({ error: "Senhas não conferem." }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const trialEndsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  const user = createUser({
    name: nome,
    email,
    password: senha,
    role: "user",
    plan: "basic",
    avatar: "",
    phone: telefone ?? "",
    subscriptionStatus: "trial",
    trialEndsAt,
    isActive: true,
  });

  // Send welcome email (non-blocking)
  import("@/lib/email").then(({ sendWelcomeTrial }) =>
    sendWelcomeTrial(user.name, user.email, trialEndsAt).catch(console.error)
  );

  return NextResponse.json({ userId: user.id, trialEndsAt }, { status: 201 });
}
