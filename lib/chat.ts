import fs from "fs";
import path from "path";

export interface Message {
  id: string;
  from: string;       // user id
  fromName: string;
  to: string | null;  // null = broadcast/admin channel
  text: string;
  createdAt: string;
  readBy: string[];
}

const FILE = path.join(process.cwd(), "data", "chat.json");

export function getMessages(): Message[] {
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
  catch { return []; }
}

export function saveMessages(msgs: Message[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(msgs, null, 2));
}

export function addMessage(msg: Omit<Message, "id" | "createdAt" | "readBy">): Message {
  const msgs = getMessages();
  const m: Message = { ...msg, id: String(Date.now()), createdAt: new Date().toISOString(), readBy: [msg.from] };
  msgs.push(m);
  saveMessages(msgs);
  return m;
}

export function markRead(userId: string, beforeDate: string): void {
  const msgs = getMessages();
  msgs.forEach(m => {
    if (m.createdAt <= beforeDate && !m.readBy.includes(userId)) m.readBy.push(userId);
  });
  saveMessages(msgs);
}
