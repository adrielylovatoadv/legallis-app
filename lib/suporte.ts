import fs from "fs";
import path from "path";
import { dbGet, dbSet, dbInit, hasDb } from "./db";

export type TicketStatus = "aberto" | "em_andamento" | "resolvido" | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "urgente";
export type TicketCategory = "duvida" | "bug" | "sugestao" | "financeiro" | "outro";

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: "user" | "admin" | "master";
  content: string;
  attachments?: string[];
  createdAt: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

// Chamados de suporte são centralizados (não são dados por tenant): qualquer escritório abre
// chamado e só a equipe Legarium (plan="admin") vê todos. Por isso usam uma única chave global
// no kv_store, e não o padrão por-tenant usado em lib/repo/*.
const KV_KEY = "support_tickets_all";
const TICKETS_FILE = path.join(process.cwd(), "data", "support_tickets.json");

function readFromFile(): Ticket[] {
  try {
    return JSON.parse(fs.readFileSync(TICKETS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveToFile(tickets: Ticket[]): void {
  fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

export async function getTickets(): Promise<Ticket[]> {
  if (hasDb()) {
    await dbInit();
    const tickets = await dbGet<Ticket[]>(KV_KEY);
    return tickets ?? [];
  }
  return readFromFile();
}

async function saveTickets(tickets: Ticket[]): Promise<void> {
  if (hasDb()) {
    const ok = await dbSet(KV_KEY, tickets);
    if (!ok) throw new Error("Falha ao salvar chamados de suporte no banco.");
    return;
  }
  saveToFile(tickets);
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const tickets = await getTickets();
  return tickets.find(t => t.id === id) ?? null;
}

export async function getTicketsByUser(userId: string): Promise<Ticket[]> {
  const tickets = await getTickets();
  return tickets.filter(t => t.userId === userId);
}

export async function createTicket(data: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "messages">): Promise<Ticket> {
  const tickets = await getTickets();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...data,
    id: String(Date.now()),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  tickets.push(ticket);
  await saveTickets(tickets);
  return ticket;
}

export async function addMessage(ticketId: string, msg: Omit<TicketMessage, "id" | "ticketId" | "createdAt">): Promise<TicketMessage | null> {
  const tickets = await getTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return null;
  const message: TicketMessage = {
    ...msg,
    id: String(Date.now()),
    ticketId,
    createdAt: new Date().toISOString(),
  };
  tickets[idx].messages.push(message);
  tickets[idx].updatedAt = message.createdAt;
  if (tickets[idx].status === "aberto") tickets[idx].status = "em_andamento";
  await saveTickets(tickets);
  return message;
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<boolean> {
  const tickets = await getTickets();
  const idx = tickets.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tickets[idx].status = status;
  tickets[idx].updatedAt = new Date().toISOString();
  await saveTickets(tickets);
  return true;
}
