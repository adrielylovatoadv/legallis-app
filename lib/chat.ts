import fs from "fs";
import path from "path";
import { dbGet, dbSet, dbInit, hasDb } from "./db";

export interface ChatMessage {
  id: string;
  conversationId: string;
  from: string;
  fromName: string;
  text: string;
  type: "user" | "system";
  createdAt: string;
  readBy: string[];
}

export interface Conversation {
  id: string;
  type: "channel" | "dm" | "group" | "system";
  name: string;
  members: string[] | null;
  createdAt: string;
  createdBy?: string;
}

interface ChatData {
  conversations: Conversation[];
  messages: ChatMessage[];
}

// Keep legacy interface for backward compat
export interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string | null;
  text: string;
  createdAt: string;
  readBy: string[];
}

const FILE = path.join(process.cwd(), "data", "chat.json");
const TMP_FILE = "/tmp/legallis_chat.json";
const DB_KEY_PREFIX = "chat";

const DEFAULT_CONVERSATIONS: Conversation[] = [
  { id: "general", type: "channel", name: "Canal Geral", members: null, createdAt: new Date().toISOString() },
  { id: "system", type: "system", name: "Sistema", members: null, createdAt: new Date().toISOString() },
];

function readFromFile(): ChatData {
  const src = fs.existsSync(TMP_FILE) ? TMP_FILE : FILE;
  try {
    const raw = JSON.parse(fs.readFileSync(src, "utf-8"));
    if (Array.isArray(raw)) {
      return {
        conversations: [...DEFAULT_CONVERSATIONS],
        messages: raw.map((m: Message) => ({
          id: m.id, conversationId: "general", from: m.from,
          fromName: m.fromName, text: m.text, type: "user" as const,
          createdAt: m.createdAt, readBy: m.readBy || [],
        })),
      };
    }
    return {
      conversations: raw.conversations?.length ? raw.conversations : DEFAULT_CONVERSATIONS,
      messages: raw.messages || [],
    };
  } catch {
    return { conversations: [...DEFAULT_CONVERSATIONS], messages: [] };
  }
}

function writeToFile(data: ChatData): void {
  const content = JSON.stringify(data, null, 2);
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, content, "utf-8");
  } catch {
    fs.writeFileSync(TMP_FILE, content, "utf-8");
  }
}

async function getDataAsync(tenantId = "default"): Promise<ChatData> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    await dbInit();
    const d = await dbGet<ChatData>(key);
    if (d) {
      if (!d.conversations?.length) d.conversations = [...DEFAULT_CONVERSATIONS];
      return d;
    }
    const fromFile = readFromFile();
    await dbSet(key, fromFile);
    return fromFile;
  }
  return readFromFile();
}

async function saveDataAsync(data: ChatData, tenantId = "default"): Promise<void> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    await dbSet(key, data);
    return;
  }
  writeToFile(data);
}

export async function getConversations(tenantId = "default"): Promise<Conversation[]> {
  return (await getDataAsync(tenantId)).conversations;
}

export async function getOrCreateDM(userId1: string, userId2: string, tenantId = "default"): Promise<Conversation> {
  const data = await getDataAsync(tenantId);
  const id = `dm_${[userId1, userId2].sort().join("_")}`;
  let conv = data.conversations.find(c => c.id === id);
  if (!conv) {
    conv = { id, type: "dm", name: "", members: [userId1, userId2], createdAt: new Date().toISOString() };
    data.conversations.push(conv);
    await saveDataAsync(data, tenantId);
  }
  return conv;
}

export async function createGroup(name: string, members: string[], createdBy: string, tenantId = "default"): Promise<Conversation> {
  const data = await getDataAsync(tenantId);
  const id = `group_${Date.now()}`;
  const conv: Conversation = { id, type: "group", name, members, createdAt: new Date().toISOString(), createdBy };
  data.conversations.push(conv);
  await saveDataAsync(data, tenantId);
  return conv;
}

export async function getMessages(conversationId: string, tenantId = "default"): Promise<ChatMessage[]> {
  return (await getDataAsync(tenantId)).messages.filter(m => m.conversationId === conversationId);
}

export async function addMessage(msg: Omit<ChatMessage, "id" | "createdAt" | "readBy">, tenantId = "default"): Promise<ChatMessage> {
  const data = await getDataAsync(tenantId);
  const m: ChatMessage = {
    ...msg,
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    readBy: msg.type === "system" ? [] : [msg.from],
  };
  data.messages.push(m);
  await saveDataAsync(data, tenantId);
  return m;
}

export async function addSystemMessage(text: string, conversationId = "system", tenantId = "default"): Promise<ChatMessage> {
  return addMessage({ conversationId, from: "system", fromName: "Sistema", text, type: "system" }, tenantId);
}

export async function markRead(userId: string, conversationId: string, tenantId = "default"): Promise<void> {
  const data = await getDataAsync(tenantId);
  data.messages.forEach(m => {
    if (m.conversationId === conversationId && !m.readBy.includes(userId)) {
      m.readBy.push(userId);
    }
  });
  await saveDataAsync(data, tenantId);
}

export async function getUnreadCounts(userId: string, tenantId = "default"): Promise<Record<string, number>> {
  const data = await getDataAsync(tenantId);
  const counts: Record<string, number> = {};
  data.messages.forEach(m => {
    if (!m.readBy.includes(userId)) {
      counts[m.conversationId] = (counts[m.conversationId] || 0) + 1;
    }
  });
  return counts;
}
