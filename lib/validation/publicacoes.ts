import { z } from "zod";

// Item cru do DJEN, já buscado pelo navegador (ver lib/integrations/djen.ts) — o servidor não
// consulta o DJEN diretamente, só recebe e deduplica o que o navegador trouxe. Passthrough
// porque o formato é ditado pelo CNJ, não por nós; só exigimos os campos que de fato usamos.
const djenItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  data_disponibilizacao: z.string().optional(),
  nomeOrgao: z.string().optional(),
  tipoComunicacao: z.string().optional(),
  texto: z.string().optional(),
  numero_processo: z.string().optional(),
  numeroprocessocommascara: z.string().optional(),
}).passthrough();

export const buscarPublicacoesSchema = z.object({
  oabNumero: z.string().trim().min(1, "Número da OAB é obrigatório"),
  oabUf: z.string().trim().length(2, "UF deve ter 2 letras").toUpperCase(),
  dataDisponibilizacaoInicio: z.string().trim().optional(),
  dataDisponibilizacaoFim: z.string().trim().optional(),
  djenItems: z.array(djenItemSchema).optional(),
  djenErro: z.string().optional(),
});

export const publicacaoUpdateSchema = z.object({
  tratada: z.boolean().optional(),
  processoId: z.string().trim().nullable().optional(),
});
