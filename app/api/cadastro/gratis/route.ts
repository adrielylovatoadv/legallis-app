import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailAsync, createUserAsync, updateUserAsync } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { nome, nomeEscritorio, sexo, email, telefone, senha, confirmSenha } = await req.json();

  if (!nome || !nomeEscritorio || !email || !senha) {
    return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres." }, { status: 400 });
  }
  if (senha !== confirmSenha) {
    return NextResponse.json({ error: "Senhas não conferem." }, { status: 400 });
  }
  if (await getUserByEmailAsync(email)) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const trialEndsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  const user = await createUserAsync({
    name: nome,
    email,
    password: senha,
    role: "user",
    plan: "basic",
    avatar: "",
    phone: telefone ?? "",
    company: { name: nomeEscritorio },
    subscriptionStatus: "trial",
    trialEndsAt,
    isActive: true,
    sexo: (sexo === "feminino" || sexo === "masculino") ? sexo : undefined,
  });

  // Salva tenantId baseado no ID real do usuário para consistência permanente
  await updateUserAsync(user.id, { tenantId: `t_${user.id}` });

  // Send welcome email (non-blocking)
  import("@/lib/email").then(({ sendWelcomeTrial }) =>
    sendWelcomeTrial(user.name, user.email, trialEndsAt).catch(console.error)
  );

  return NextResponse.json({ userId: user.id, trialEndsAt }, { status: 201 });
}
