import fs from "fs";
import path from "path";

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

const TICKETS_FILE = path.join(process.cwd(), "data", "support_tickets.json");

export function getTickets(): Ticket[] {
  try {
    return JSON.parse(fs.readFileSync(TICKETS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[]): void {
  fs.mkdirSync(path.dirname(TICKETS_FILE), { recursive: true });
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

export function getTicketById(id: string): Ticket | null {
  return getTickets().find(t => t.id === id) ?? null;
}

export function getTicketsByUser(userId: string): Ticket[] {
  return getTickets().filter(t => t.userId === userId);
}

export function createTicket(data: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "messages">): Ticket {
  const tickets = getTickets();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    ...data,
    id: String(Date.now()),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  tickets.push(ticket);
  saveTickets(tickets);
  return ticket;
}

export function addMessage(ticketId: string, msg: Omit<TicketMessage, "id" | "ticketId" | "createdAt">): TicketMessage | null {
  const tickets = getTickets();
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
  saveTickets(tickets);
  return message;
}

export function updateTicketStatus(id: string, status: TicketStatus): boolean {
  const tickets = getTickets();
  const idx = tickets.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tickets[idx].status = status;
  tickets[idx].updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return true;
}
