import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailAsync, createUserAsync, updateUserAsync } from "@/lib/users";

const VALID_PLANS = new Set(["basic", "profissional", "pro"]);

export async function POST(req: NextRequest) {
  const { nome, nomeEscritorio, email, telefone, senha, plan } = await req.json();

  if (!nome || !nomeEscritorio || !email || !senha || !plan) {
    return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres." }, { status: 400 });
  }
  if (!VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (await getUserByEmailAsync(email)) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  // Cria como "pending" — o webhook ativa e define o plano após pagamento
  const user = await createUserAsync({
    name: nome,
    email,
    password: senha,
    role: "user",
    plan: "basic",
    avatar: "",
    phone: telefone ?? "",
    company: { name: nomeEscritorio },
    subscriptionStatus: "pending",
    isActive: true,
  });

  // Salva tenantId baseado no ID real do usuário para consistência permanente
  await updateUserAsync(user.id, { tenantId: `t_${user.id}` });

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
