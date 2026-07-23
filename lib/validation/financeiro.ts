import { z } from "zod";

export const statusSchema = z.enum(["pago", "pendente", "repasse"]);

export const acordoCreateSchema = z.object({
  mes: z.string().trim().min(1, "Mês é obrigatório"),
  data_pagamento: z.string().trim().default(""),
  cliente: z.string().trim().min(1, "Cliente é obrigatório"),
  reu: z.string().trim().default(""),
  objeto: z.string().trim().default(""),
  processo: z.string().trim().default(""),
  valor_acordo: z.number().positive("Valor do acordo deve ser maior que zero"),
  pct_honorarios: z.number().min(0).max(100).default(41.5),
  status: statusSchema.default("pendente"),
  processoId: z.string().optional(),
});
export const acordoUpdateSchema = acordoCreateSchema.partial();

export const tipoExecucaoSchema = z.enum(["processo_completo", "honorarios_somente"]);
export const execucaoCreateSchema = z.object({
  mes: z.string().trim().min(1, "Mês é obrigatório"),
  data_pagamento: z.string().trim().default(""),
  cliente: z.string().trim().min(1, "Cliente é obrigatório"),
  reu: z.string().trim().default(""),
  processo: z.string().trim().default(""),
  tipo_execucao: tipoExecucaoSchema.default("processo_completo"),
  valor_percebido: z.number().min(0).default(0),
  pct_honorarios: z.number().min(0).max(100).default(35),
  sucumbencia: z.number().min(0).default(0),
  status: statusSchema.default("pago"),
  processoId: z.string().optional(),
});
export const execucaoUpdateSchema = execucaoCreateSchema.partial();

export const honorarioInicialCreateSchema = z.object({
  mes: z.string().trim().optional(),
  cliente: z.string().trim().min(1, "Cliente é obrigatório"),
  processo: z.string().trim().default(""),
  valor: z.number().min(0).default(0),
  data_pagamento: z.string().trim().default(""),
  observacao: z.string().trim().default(""),
  status: statusSchema.default("pago"),
  processoId: z.string().optional(),
});
export const honorarioInicialUpdateSchema = honorarioInicialCreateSchema.partial();

export const fixaCreateSchema = z.object({
  categoria: z.string().trim().min(1).optional(),
  quem: z.string().trim().default("dividido"),
  valores: z.record(z.string(), z.number()).default({}),
  valor_fixo: z.number().optional(),
});
export const fixaUpdateSchema = z.object({
  nova_categoria: z.string().trim().optional(),
  quem: z.string().trim().optional(),
  valores: z.record(z.string(), z.number()).optional(),
  valor_fixo: z.number().optional(),
});

export const variavelCreateSchema = z.object({
  descricao: z.string().trim().min(1, "Descrição é obrigatória"),
  valor: z.number().min(0).default(0),
  parcelas: z.string().trim().default("1x"),
  quem: z.string().trim().default("dividido"),
  onde: z.string().trim().default(""),
  status: statusSchema.default("pendente"),
  data_compra: z.string().trim().default(""),
  meses: z.record(z.string(), z.number()).default({}),
});
export const variavelUpdateSchema = variavelCreateSchema.partial();

export const timesheetCreateSchema = z.object({
  processoId: z.string().optional(),
  processo: z.string().trim().optional(),
  cliente: z.string().trim().optional(),
  data: z.string().trim().min(1, "Data é obrigatória"),
  minutos: z.number().positive("Minutos devem ser maior que zero"),
  descricao: z.string().trim().default(""),
  responsavel: z.string().trim().default(""),
  faturavel: z.boolean().default(true),
  valor_hora: z.number().optional(),
  status: statusSchema.default("pendente"),
});
export const timesheetUpdateSchema = timesheetCreateSchema.partial();
