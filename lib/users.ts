import fs from "fs";
import path from "path";
import crypto from "crypto";
export type { Plan, Role } from "./plans";
export { PLAN_FEATURES, canAccess, canExport } from "./plans";
import type { Plan, Role } from "./plans";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled" | "pending";

export interface OABEntry {
  state: string;
  number: string;
}

export interface Company {
  name?: string;
  cnpj?: string;
  address?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  plan: Plan;
  avatar: string;
  createdAt: string;
  // Extended fields
  phone?: string;
  oab?: OABEntry[];
  company?: Company;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  theme?: "dark" | "light" | "auto";
  permissions?: string[];
  isActive: boolean;
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
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    // Migrate legacy users that don't have new fields
    return raw.map((u: Partial<User> & { id: string }) => ({
      subscriptionStatus: "active" as SubscriptionStatus,
      isActive: true,
      ...u,
    }));
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

export function isTrialExpired(user: User): boolean {
  if (user.subscriptionStatus !== "trial") return false;
  if (!user.trialEndsAt) return true;
  return new Date(user.trialEndsAt) < new Date();
}

export function getTrialDaysRemaining(user: User): number {
  if (!user.trialEndsAt) return 0;
  const diff = new Date(user.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const tokens = getTokens().filter(t => t.email !== email);
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
