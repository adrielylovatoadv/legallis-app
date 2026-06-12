import fs from "fs";
import path from "path";

export interface AuditEvent {
  id: string;
  tipo: string;
  descricao: string;
  usuario: string;
  usuarioId: string;
  data: string;
  hora: string;
  detalhe?: string;
}

const FILE = path.join(process.cwd(), "data", "audit.json");
const TMP_FILE = "/tmp/legallis_audit.json";

export function getAuditLog(): AuditEvent[] {
  const src = fs.existsSync(TMP_FILE) ? TMP_FILE : FILE;
  try { return JSON.parse(fs.readFileSync(src, "utf-8")); }
  catch { return []; }
}

export function logEvent(event: Omit<AuditEvent, "id" | "data" | "hora">): AuditEvent {
  const events = getAuditLog();
  const now = new Date();
  const e: AuditEvent = {
    ...event,
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    data: now.toLocaleDateString("pt-BR"),
    hora: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
  events.unshift(e);
  if (events.length > 5000) events.splice(5000);
  const content = JSON.stringify(events, null, 2);
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, content);
  } catch {
    try { fs.writeFileSync(TMP_FILE, content); } catch { /* silent on Vercel */ }
  }
  return e;
}
