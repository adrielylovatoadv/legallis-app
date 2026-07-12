import { z } from "zod";

export const buscarPublicacoesSchema = z.object({
  oabNumero: z.string().trim().min(1, "Número da OAB é obrigatório"),
  oabUf: z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase(),
  dataDisponibilizacaoInicio: z.string().trim().optional(),
  dataDisponibilizacaoFim: z.string().trim().optional(),
});

export const publicacaoUpdateSchema = z.object({
  tratada: z.boolean().optional(),
  processoId: z.string().trim().nullable().optional(),
});
