import fs from "fs";
import path from "path";
import crypto from "crypto";
export type { Plan, Role } from "./plans";
export { PLAN_FEATURES, canAccess, canExport } from "./plans";
import type { Plan, Role } from "./plans";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  plan: Plan;
  avatar: string;
  createdAt: string;
}

export interface ResetToken {
  token: string;
  email: string;
  expiresAt: string;
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const TOKENS_FILE = path.join(process.cwd(), "data", "reset_tokens.json");

export function getUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function getUserById(id: string): User | null {
  return getUsers().find(u => u.id === id) ?? null;
}

export function getUserByEmail(email: string): User | null {
  return getUsers().find(u => u.email === email) ?? null;
}

export function updateUser(id: string, data: Partial<Omit<User, "id">>): User | null {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...data };
  saveUsers(users);
  return users[idx];
}

export function createUser(data: Omit<User, "id" | "createdAt">): User {
  const users = getUsers();
  const user: User = {
    ...data,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const next = users.filter(u => u.id !== id);
  if (next.length === users.length) return false;
  saveUsers(next);
  return true;
}

// Reset tokens
function getTokens(): ResetToken[] {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveTokens(tokens: ResetToken[]): void {
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

export function createResetToken(email: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1h
  const tokens = getTokens().filter(t => t.email !== email); // remove old
  tokens.push({ token, email, expiresAt });
  saveTokens(tokens);
  return token;
}

export function consumeResetToken(token: string): string | null {
  const tokens = getTokens();
  const t = tokens.find(t => t.token === token);
  if (!t) return null;
  if (new Date(t.expiresAt) < new Date()) return null;
  saveTokens(tokens.filter(x => x.token !== token));
  return t.email;
}

