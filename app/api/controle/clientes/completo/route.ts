import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as clientesRepo from "@/lib/repo/clientes";

// Igual a GET /api/controle/clientes, mas SEM sanitizar senha_gov/senha_serasa/conta/chave_pix —
// usado só pela exportação em Excel (components/layout/Sidebar.tsx "Exportar dados"). Por isso
// exige hasFinanceiroAccess, ao contrário da listagem principal (que qualquer usuário do
// escritório pode ver, já sem os campos sensíveis).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) {
    return NextResponse.json({ error: "Sem permissão para exportar dados sensíveis de clientes" }, { status: 403 });
  }
  const tid = session.user.tenantId;
  const lista = (await clientesRepo.list(tid)).sort((a, b) => a.nome.localeCompare(b.nome));
  return NextResponse.json(lista);
}
