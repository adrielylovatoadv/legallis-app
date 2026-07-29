export type Plan = "admin" | "profissional" | "pro" | "basic";
export type Role = "admin" | "user";

// Nomenclatura de exibição não é 1:1 com a chave interna (mantida por compatibilidade de
// dados já gravados no banco): chave "profissional" exibe como "Pro" (tier intermediário) e
// chave "pro" exibe como "Profissional" (tier completo). Ver memória do projeto Legarium para
// contexto da pesquisa de mercado (AdvBox/Astrea/Projuris) que embasou os limites abaixo.
export const PLAN_FEATURES: Record<Plan, {
  label: string;
  modules: string[];
  exports: string[];
  canAssignTasks: boolean;
  maxUsers: number;
  maxProcessos: number;
  maxOabs: number;
}> = {
  basic: {
    label: "Básico",
    modules: ["controle", "calculadora", "prazos"],
    exports: ["pdf"],
    canAssignTasks: false,
    maxUsers: 3, // 1 admin + até 2 usuários
    maxProcessos: 100,
    maxOabs: 2,
  },
  profissional: {
    label: "Pro",
    modules: ["controle", "calculadora", "prazos", "financeiro", "publicacoes", "kanban"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: 7, // 1 admin + até 6 usuários
    maxProcessos: 400,
    maxOabs: 10,
  },
  pro: {
    label: "Profissional",
    modules: ["controle", "calculadora", "prazos", "financeiro", "publicacoes", "kanban", "indicadores", "auditoria"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: 21, // 1 admin + até 20 usuários
    maxProcessos: 3000,
    maxOabs: Infinity,
  },
  admin: {
    label: "Administrador",
    modules: ["controle", "calculadora", "prazos", "financeiro", "publicacoes", "kanban", "indicadores", "auditoria", "admin"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: Infinity,
    maxProcessos: Infinity,
    maxOabs: Infinity,
  },
};

export function canAccess(plan: Plan, module: string): boolean {
  return PLAN_FEATURES[plan].modules.includes(module);
}

export function canExport(plan: Plan, format: string): boolean {
  return PLAN_FEATURES[plan].exports.includes(format);
}
