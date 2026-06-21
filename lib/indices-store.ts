import { dbGet, dbSet } from "@/lib/db";
import { loadIndices, type Indices } from "@/lib/calc-formulas";

const DB_KEY = "indices_juridicos_overrides";
let _cache: { data: Indices; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

export async function loadIndicesAsync(): Promise<Indices> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL) return _cache.data;

  const base = loadIndices();

  let overrides: Partial<Indices> | null = null;
  try {
    overrides = await dbGet<Partial<Indices>>(DB_KEY);
  } catch {
    // DB indisponível — usa base JSON sem interromper o cálculo
  }

  if (!overrides) {
    _cache = { data: base, fetchedAt: Date.now() };
    return base;
  }

  const merged: Indices = {
    inpc:      { ...base.inpc,      ...(overrides.inpc      ?? {}) },
    ipcae:     { ...base.ipcae,     ...(overrides.ipcae     ?? {}) },
    ipca:      { ...base.ipca,      ...(overrides.ipca      ?? {}) },
    selic:     { ...base.selic,     ...(overrides.selic     ?? {}) },
    tjsp_inpc: { ...base.tjsp_inpc, ...(overrides.tjsp_inpc ?? {}) },
    tjsp_14905:{ ...base.tjsp_14905,...(overrides.tjsp_14905?? {}) },
    ultima_atualizacao: overrides.ultima_atualizacao ?? base.ultima_atualizacao,
  };

  _cache = { data: merged, fetchedAt: Date.now() };
  return merged;
}

export function invalidateIndicesCache() {
  _cache = null;
}

export async function saveIndicesOverrides(partial: Partial<Indices>): Promise<void> {
  const existing = (await dbGet<Partial<Indices>>(DB_KEY)) ?? {};
  const merged: Partial<Indices> = {
    inpc:       { ...(existing.inpc       ?? {}), ...(partial.inpc       ?? {}) },
    ipcae:      { ...(existing.ipcae      ?? {}), ...(partial.ipcae      ?? {}) },
    ipca:       { ...(existing.ipca       ?? {}), ...(partial.ipca       ?? {}) },
    selic:      { ...(existing.selic      ?? {}), ...(partial.selic      ?? {}) },
    tjsp_inpc:  { ...(existing.tjsp_inpc  ?? {}), ...(partial.tjsp_inpc  ?? {}) },
    tjsp_14905: { ...(existing.tjsp_14905 ?? {}), ...(partial.tjsp_14905 ?? {}) },
    ultima_atualizacao: partial.ultima_atualizacao ?? existing.ultima_atualizacao,
  };
  await dbSet(DB_KEY, merged);
  invalidateIndicesCache();
}
