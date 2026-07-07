import { z } from "zod";

export const processoCreateSchema = z.object({
  autor: z.string().trim().min(1, "Autor é obrigatório"),
  reu: z.string().trim().default(""),
  objeto: z.string().trim().default(""),
  numero_processo: z.string().trim().default(""),
  data: z.string().trim().default(""),
  hora: z.string().trim().default(""),
  andamento: z.string().trim().default(""),
  responsavel: z.string().trim().default(""),
  observacoes: z.string().trim().default(""),
  atencao: z.boolean().default(false),
  finalizado: z.boolean().default(false),
  vara: z.string().trim().optional(),
  tribunal: z.string().trim().optional(),
  prazo_fatal: z.string().trim().optional(),
});
export const processoUpdateSchema = processoCreateSchema.partial();

export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  telefone: z.string().trim().default(""),
  cpf: z.string().trim().default(""),
  email: z.string().trim().default(""),
  endereco: z.string().trim().default(""),
  tipo_aposentadoria: z.string().trim().default(""),
  informacoes: z.string().trim().default(""),
  senha_gov: z.string().default(""),
  senha_serasa: z.string().default(""),
  tipo_pessoa: z.enum(["fisica", "juridica"]).default("fisica"),
  cnpj: z.string().trim().default(""),
  tratamento: z.string().trim().default(""),
  etiquetas: z.array(z.string()).default([]),
  telefones_adicionais: z.array(z.string()).default([]),
  emails_adicionais: z.array(z.string()).default([]),
  rg: z.string().trim().default(""),
  profissao: z.string().trim().default(""),
  estado_civil: z.string().trim().default(""),
  nacionalidade: z.string().trim().default("brasileiro(a)"),
  banco: z.string().trim().default(""),
  agencia: z.string().trim().default(""),
  conta: z.string().trim().default(""),
  tipo_conta: z.enum(["corrente", "poupanca"]).default("corrente"),
  chave_pix: z.string().trim().default(""),
});
export const clienteUpdateSchema = clienteCreateSchema.partial();

export const inicialCreateSchema = z.object({
  cliente: z.string().trim().min(1, "Cliente é obrigatório"),
  reu: z.string().trim().default(""),
  objeto: z.string().trim().default(""),
  andamento: z.string().trim().default("FAZER INICIAL"),
  responsavel: z.string().trim().default(""),
  observacoes: z.string().trim().default(""),
  data: z.string().trim().default(""),
  hora: z.string().trim().default(""),
});
export const inicialUpdateSchema = inicialCreateSchema.partial();

export const tarefaCreateSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório"),
  descricao: z.string().trim().default(""),
  status: z.enum(["a_fazer", "fazendo", "concluido"]).default("a_fazer"),
  responsavel: z.string().trim().default(""),
  prazo: z.string().trim().optional(),
  processo_id: z.string().trim().optional(),
  processo_titulo: z.string().trim().optional(),
});
export const tarefaUpdateSchema = tarefaCreateSchema.partial();
