import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/users";

const PLAN_MAP: Record<string, { role: "user"; plan: "basic" | "pro" | "profissional" }> = {
  basic:         { role: "user", plan: "basic" },
  pro:           { role: "user", plan: "pro" },
  profissional:  { role: "user", plan: "pro" }, // mapeado para pro até ter plano separado
};

export async function POST(req: NextRequest) {
  const { nome, nomeEscritorio, email, telefone, senha, plan } = await req.json();

  if (!nome || !nomeEscritorio || !email || !senha || !plan) {
    return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: "Senha mínima de 6 caracteres." }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const planConfig = PLAN_MAP[plan] ?? { role: "user" as const, plan: "basic" as const };

  // Cria como "pending" — será ativado pelo webhook após pagamento
  const user = createUser({
    name: nome,
    email,
    password: senha,
    role: planConfig.role,
    plan: "basic",
    avatar: "",
    phone: telefone ?? "",
    company: { name: nomeEscritorio },
    subscriptionStatus: "pending",
    isActive: true,
  });

  // Salva tenantId baseado no ID real do usuário para consistência permanente
  const { updateUser } = await import("@/lib/users");
  updateUser(user.id, { tenantId: `t_${user.id}` });

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
