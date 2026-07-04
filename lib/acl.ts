// Controle de acesso por cargo dentro do escritório (independente do plano de assinatura).
// Cargos sem uma regra explícita (undefined) mantêm o comportamento anterior: acesso liberado,
// já que nem todo tenant preenche esse campo.

export type Cargo = "administrador" | "socio" | "advogado" | "estagiario" | "assistente";

const FINANCEIRO_CARGOS: Cargo[] = ["administrador", "socio", "advogado"];
const CONTROLE_RESTRITO_CARGOS: Cargo[] = ["estagiario"];

export function hasFinanceiroAccess(cargo?: string | null): boolean {
  if (!cargo) return true;
  return FINANCEIRO_CARGOS.includes(cargo as Cargo);
}

// Estagiário só enxerga Iniciais e Clientes dentro de Controle Processual —
// sem Visão Geral (que expõe indicadores financeiros), Processos ou Finalizados.
export function hasControleRestrito(cargo?: string | null): boolean {
  if (!cargo) return false;
  return CONTROLE_RESTRITO_CARGOS.includes(cargo as Cargo);
}
