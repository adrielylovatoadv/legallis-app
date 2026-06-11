export type Plan = "admin" | "profissional" | "pro" | "basic";
export type Role = "admin" | "user";

export const PLAN_FEATURES: Record<Plan, {
  label: string;
  modules: string[];
  exports: string[];
  canAssignTasks: boolean;
  maxUsers: number;
}> = {
  profissional: {
    label: "Profissional",
    modules: ["controle", "financeiro", "calculadora"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: Infinity,
  },
  admin: {
    label: "Administrador",
    modules: ["controle", "financeiro", "calculadora", "admin"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: Infinity,
  },
  pro: {
    label: "Pro",
    modules: ["controle", "financeiro", "calculadora"],
    exports: ["pdf", "word", "excel"],
    canAssignTasks: true,
    maxUsers: 10,
  },
  basic: {
    label: "Básico",
    modules: ["controle", "calculadora"],
    exports: ["pdf"],
    canAssignTasks: false,
    maxUsers: 1,
  },
};

export function canAccess(plan: Plan, module: string): boolean {
  return PLAN_FEATURES[plan].modules.includes(module);
}

export function canExport(plan: Plan, format: string): boolean {
  return PLAN_FEATURES[plan].exports.includes(format);
}
