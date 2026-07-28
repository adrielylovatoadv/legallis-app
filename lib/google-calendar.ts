// Sincroniza Processo/Atendimento com o Google Calendar real do responsável (não mais o link
// manual "clique pra adicionar" de lib/controle.ts). Cada função aqui engole seus próprios
// erros — uma falha na API do Google nunca pode derrubar o salvamento do processo/atendimento
// que a chamou (mesmo espírito do lib/email.ts: notificação é best-effort).
import { decryptField } from "@/lib/crypto";
import { getUsersAsync, updateUserAsync, type User } from "@/lib/users";
import { refreshAccessToken } from "@/lib/google-oauth";
import { normalizeData, normText } from "@/lib/controle";
import type { Processo, Atendimento } from "@/lib/controle-data";
import * as processosRepo from "@/lib/repo/processos";
import * as atendimentosRepo from "@/lib/repo/atendimentos";

const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function getValidAccessToken(user: User): Promise<string | null> {
  if (!user.googleCalendar?.connected || !user.googleCalendar.refreshTokenEnc) return null;
  const refreshToken = decryptField(user.googleCalendar.refreshTokenEnc);
  const tokens = await refreshAccessToken(refreshToken);
  if (!tokens) {
    // Token revogado/expirado do lado do Google — marca desconectado pra UI oferecer reconectar
    // em vez de tentar (e falhar) silenciosamente pra sempre.
    await updateUserAsync(user.id, { googleCalendar: { ...user.googleCalendar, connected: false } });
    return null;
  }
  return tokens.access_token;
}

// Resolve o campo livre "responsavel" (nome digitado) pro usuário cadastrado correspondente,
// só se ele tiver o Google conectado. Sem match ou sem conexão → não sincroniza (nunca escreve
// na agenda da pessoa errada, ver decisão #1 do plano).
async function resolveResponsavel(tenantId: string, responsavel: string): Promise<User | null> {
  if (!responsavel?.trim()) return null;
  const users = await getUsersAsync();
  const alvo = normText(responsavel);
  const match = users.find(u => u.tenantId === tenantId && u.isActive && normText(u.name) === alvo);
  return match?.googleCalendar?.connected ? match : null;
}

async function calendarRequest(accessToken: string, method: "POST" | "PATCH" | "DELETE", suffix: string, body?: unknown) {
  const res = await fetch(`${EVENTS_BASE}${suffix}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 || res.status === 410) return null; // evento já não existe (ok, inclusive pra delete)
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Google Calendar ${method} ${suffix}: ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(n => parseInt(n, 10) || 0);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

interface CalendarEventBody {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  reminders: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
}

// Mesmo gate de lib/controle.ts `gcalUrl` (AIJ/AC/PERÍCIA + data) — evento com hora.
function buildAudienciaEvent(p: Processo): CalendarEventBody | null {
  const s = (p.andamento || "").toUpperCase().trim();
  const isPericia = s === "PERÍCIA" || s === "PERICIA";
  if (!s.includes("AIJ") && !s.startsWith("AC") && !isPericia) return null;
  const dataIso = normalizeData(p.data);
  if (!dataIso) return null;
  const hora = /^\d{2}:\d{2}$/.test(p.hora || "") ? p.hora : "08:00";
  const tipo = s.includes("AIJ") ? "AIJ" : s.startsWith("AC") ? "AC" : "PERÍCIA";
  return {
    summary: `${tipo} ${p.autor} ${p.numero_processo}`.trim(),
    description: `Processo: ${p.numero_processo} | ${p.autor} × ${p.reu} | ${p.objeto}`,
    start: { dateTime: `${dataIso}T${hora}:00`, timeZone: "America/Sao_Paulo" },
    end: { dateTime: `${dataIso}T${addMinutes(hora, 30)}:00`, timeZone: "America/Sao_Paulo" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }, { method: "popup", minutes: 60 }] },
  };
}

// Prazo fatal é independente de andamento/hora — evento de dia inteiro.
function buildPrazoEvent(p: Processo): CalendarEventBody | null {
  const dataIso = normalizeData(p.prazo_fatal || "");
  if (!dataIso) return null;
  const fim = new Date(`${dataIso}T00:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 1); // eventos de dia inteiro no Google usam fim exclusivo
  return {
    summary: `⛔ Prazo fatal — ${p.autor} ${p.numero_processo}`.trim(),
    description: `Processo: ${p.numero_processo} | ${p.autor} × ${p.reu} | ${p.objeto}`,
    start: { date: dataIso },
    end: { date: fim.toISOString().slice(0, 10) },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 2 * 24 * 60 }, { method: "popup", minutes: 24 * 60 }] },
  };
}

function buildAtendimentoEvent(a: Atendimento): CalendarEventBody | null {
  const dataIso = normalizeData(a.data);
  if (!dataIso) return null;
  const hora = /^\d{2}:\d{2}$/.test(a.hora || "") ? a.hora : "08:00";
  return {
    summary: `Atendimento - ${a.cliente}`.trim(),
    description: [a.forma && `Via ${a.forma}`, a.telefone, a.observacoes].filter(Boolean).join(" | ") || `Atendimento com ${a.cliente}`,
    start: { dateTime: `${dataIso}T${hora}:00`, timeZone: "America/Sao_Paulo" },
    end: { dateTime: `${dataIso}T${addMinutes(hora, 30)}:00`, timeZone: "America/Sao_Paulo" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
  };
}

// Cria, atualiza ou apaga UM evento, conforme `event` qualificar ou não e já existir ou não um
// google_event_id anterior. Se o evento tinha sido apagado manualmente do lado do Google
// (PATCH volta 404), recria em vez de desistir.
async function syncSingleEvent(
  accessToken: string,
  event: CalendarEventBody | null,
  existingId: string | undefined,
  persist: (id: string | null) => Promise<void>,
): Promise<void> {
  if (!event) {
    if (existingId) {
      await calendarRequest(accessToken, "DELETE", `/${existingId}`);
      await persist(null);
    }
    return;
  }
  if (existingId) {
    const updated = await calendarRequest(accessToken, "PATCH", `/${existingId}`, event);
    if (updated) return;
  }
  const created = await calendarRequest(accessToken, "POST", "", event);
  if (created?.id) await persist(created.id);
}

export async function syncProcessoEvent(tenantId: string, processo: Processo): Promise<void> {
  try {
    const user = await resolveResponsavel(tenantId, processo.responsavel);
    if (!user) return;
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return;

    await syncSingleEvent(accessToken, buildAudienciaEvent(processo), processo.google_event_id_audiencia, async id => {
      await processosRepo.update(tenantId, processo.id, { google_event_id_audiencia: id ?? undefined });
    });
    await syncSingleEvent(accessToken, buildPrazoEvent(processo), processo.google_event_id_prazo, async id => {
      await processosRepo.update(tenantId, processo.id, { google_event_id_prazo: id ?? undefined });
    });
  } catch (err) {
    console.error("[google-calendar] Falha ao sincronizar processo", processo.id, err);
  }
}

export async function syncAtendimentoEvent(tenantId: string, atendimento: Atendimento): Promise<void> {
  try {
    const user = await resolveResponsavel(tenantId, atendimento.responsavel);
    if (!user) return;
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return;

    await syncSingleEvent(accessToken, buildAtendimentoEvent(atendimento), atendimento.google_event_id, async id => {
      await atendimentosRepo.update(tenantId, atendimento.id, { google_event_id: id ?? undefined });
    });
  } catch (err) {
    console.error("[google-calendar] Falha ao sincronizar atendimento", atendimento.id, err);
  }
}

// Usadas quando o registro inteiro é apagado (não só um campo que desqualifica o evento) —
// não há mais linha pra persistir um google_event_id limpo, só apagar do lado do Google.
export async function deleteProcessoEvents(tenantId: string, processo: Processo): Promise<void> {
  if (!processo.google_event_id_audiencia && !processo.google_event_id_prazo) return;
  try {
    const user = await resolveResponsavel(tenantId, processo.responsavel);
    if (!user) return;
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return;
    if (processo.google_event_id_audiencia) await calendarRequest(accessToken, "DELETE", `/${processo.google_event_id_audiencia}`);
    if (processo.google_event_id_prazo) await calendarRequest(accessToken, "DELETE", `/${processo.google_event_id_prazo}`);
  } catch (err) {
    console.error("[google-calendar] Falha ao apagar eventos do processo", processo.id, err);
  }
}

export async function deleteAtendimentoEvent(tenantId: string, atendimento: Atendimento): Promise<void> {
  if (!atendimento.google_event_id) return;
  try {
    const user = await resolveResponsavel(tenantId, atendimento.responsavel);
    if (!user) return;
    const accessToken = await getValidAccessToken(user);
    if (!accessToken) return;
    await calendarRequest(accessToken, "DELETE", `/${atendimento.google_event_id}`);
  } catch (err) {
    console.error("[google-calendar] Falha ao apagar evento do atendimento", atendimento.id, err);
  }
}
