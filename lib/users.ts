import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
export type { Plan, Role } from "./plans";
export { PLAN_FEATURES, canAccess, canExport } from "./plans";
import type { Plan, Role } from "./plans";
import { dbGet, dbSet, dbInit, hasDb, getSql } from "./db";

// Chave legada do blob em kv_store — mantida só para a rota de migração (lib/users.ts não lê
// mais dela; ver upsertUserRow/getUsersAsync acima, que já usam a tabela relacional `users`).
export const USERS_DB_KEY = "users_global";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled" | "pending";

export interface OABEntry {
  state: string;
  number: string;
}

export interface Company {
  name?: string;
  cnpj?: string;
  address?: string;
  defaultPdfSignerId?: string;
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
  tenantId?: string;
  sexo?: "feminino" | "masculino";
  cargo?: "administrador" | "socio" | "advogado" | "estagiario" | "assistente";
  googleCalendar?: { connected: boolean; refreshTokenEnc: string; connectedAt: string };
}

// Remove segredos antes de mandar o usuário pro cliente: nunca a senha, e do googleCalendar só
// o que a UI precisa pra mostrar status de conexão — nunca o refreshTokenEnc.
export function toSafeUser(user: User): Omit<User, "password" | "googleCalendar"> & { googleCalendar?: { connected: boolean; connectedAt: string } } {
  const { password: _pw, googleCalendar, ...safe } = user;
  return {
    ...safe,
    googleCalendar: googleCalendar
      ? { connected: googleCalendar.connected, connectedAt: googleCalendar.connectedAt }
      : undefined,
  };
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
  const hashedPassword = data.password && !data.password.startsWith("$2")
    ? bcrypt.hashSync(data.password, 10)
    : data.password;
  const user: User = {
    ...data,
    password: hashedPassword,
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

// ── Async versions (usam Neon em produção, arquivo em dev) ───────────────────
//
// Tabela relacional `users` (lib/schema.ts), uma linha por usuário — substitui o antigo blob
// único `kv_store.users_global`, onde qualquer gravação lia o array inteiro e reescrevia o
// array inteiro, então duas escritas concorrentes (dois cadastros, ou um webhook do Stripe
// rodando junto de uma edição de perfil) podiam se apagar mutuamente. Cada função abaixo agora
// lê/grava só a própria linha por `id`, então updates em usuários diferentes nunca se tocam.

function jsonbOrNull(v: unknown): string | null {
  return v === undefined ? null : JSON.stringify(v);
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    password: r.password as string,
    role: r.role as Role,
    plan: r.plan as Plan,
    avatar: r.avatar as string,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at as string),
    phone: (r.phone as string | null) ?? undefined,
    oab: (r.oab as OABEntry[] | null) ?? undefined,
    company: (r.company as Company | null) ?? undefined,
    subscriptionStatus: r.subscription_status as SubscriptionStatus,
    trialEndsAt: r.trial_ends_at instanceof Date ? r.trial_ends_at.toISOString() : (r.trial_ends_at as string | null) ?? undefined,
    stripeCustomerId: (r.stripe_customer_id as string | null) ?? undefined,
    stripeSubscriptionId: (r.stripe_subscription_id as string | null) ?? undefined,
    theme: (r.theme as User["theme"] | null) ?? undefined,
    permissions: (r.permissions as string[] | null) ?? undefined,
    isActive: r.is_active as boolean,
    tenantId: (r.tenant_id as string | null) ?? undefined,
    sexo: (r.sexo as User["sexo"] | null) ?? undefined,
    cargo: (r.cargo as User["cargo"] | null) ?? undefined,
    googleCalendar: (r.google_calendar as User["googleCalendar"] | null) ?? undefined,
  };
}

// INSERT ... ON CONFLICT (id) DO UPDATE — serve tanto criar quanto atualizar uma linha inteira,
// sempre por `id`, nunca tocando nas linhas de outros usuários.
// Exportado só para a rota de migração (app/api/master/migrate-users) reaproveitar a mesma
// gravação linha-a-linha usada pelo resto deste arquivo, em vez de duplicar o INSERT.
export async function upsertUserRow(user: User): Promise<void> {
  const sql = getSql()!;
  await sql`
    INSERT INTO users (id, name, email, password, role, plan, avatar, created_at, phone, oab, company,
      subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, theme, permissions,
      is_active, tenant_id, sexo, cargo, google_calendar, raw)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password}, ${user.role}, ${user.plan}, ${user.avatar},
      ${user.createdAt}, ${user.phone ?? null}, ${jsonbOrNull(user.oab)}, ${jsonbOrNull(user.company)},
      ${user.subscriptionStatus}, ${user.trialEndsAt ?? null}, ${user.stripeCustomerId ?? null}, ${user.stripeSubscriptionId ?? null},
      ${user.theme ?? null}, ${jsonbOrNull(user.permissions)}, ${user.isActive}, ${user.tenantId ?? null},
      ${user.sexo ?? null}, ${user.cargo ?? null}, ${jsonbOrNull(user.googleCalendar)}, ${jsonbOrNull(user)})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role,
      plan = EXCLUDED.plan, avatar = EXCLUDED.avatar, phone = EXCLUDED.phone, oab = EXCLUDED.oab,
      company = EXCLUDED.company, subscription_status = EXCLUDED.subscription_status,
      trial_ends_at = EXCLUDED.trial_ends_at, stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id, theme = EXCLUDED.theme,
      permissions = EXCLUDED.permissions, is_active = EXCLUDED.is_active, tenant_id = EXCLUDED.tenant_id,
      sexo = EXCLUDED.sexo, cargo = EXCLUDED.cargo, google_calendar = EXCLUDED.google_calendar, raw = EXCLUDED.raw
  `;
}

export async function getUsersAsync(): Promise<User[]> {
  if (hasDb()) {
    await dbInit();
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM users` as Record<string, unknown>[];
    if (rows.length > 0) return rows.map(rowToUser);
    // Primeira vez (tabela vazia): semeia com os usuários do arquivo local (admins do setup).
    // Não é o caminho da migração real — isso é feito uma vez, sob demanda, a partir do blob
    // kv_store.users_global já existente (ver rota de migração).
    const fromFile = getUsers();
    for (const u of fromFile) await upsertUserRow(u);
    return fromFile;
  }
  return getUsers();
}

// Upsert em lote por id — usado hoje só por app/api/admin/setup-escritorio/route.ts (ferramenta
// de correção em massa). Cada usuário grava só a própria linha; nunca reescreve a tabela inteira.
export async function saveUsersAsync(users: User[]): Promise<void> {
  if (hasDb()) {
    await dbInit();
    for (const user of users) await upsertUserRow(user);
    return;
  }
  saveUsers(users);
}

export async function getUserByIdAsync(id: string): Promise<User | null> {
  if (hasDb()) {
    await dbInit();
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM users WHERE id = ${id}` as Record<string, unknown>[];
    return rows[0] ? rowToUser(rows[0]) : null;
  }
  return getUsers().find(u => u.id === id) ?? null;
}

export async function getUserByEmailAsync(email: string): Promise<User | null> {
  if (hasDb()) {
    await dbInit();
    const sql = getSql()!;
    const rows = await sql`SELECT * FROM users WHERE email = ${email}` as Record<string, unknown>[];
    return rows[0] ? rowToUser(rows[0]) : null;
  }
  return getUsers().find(u => u.email === email) ?? null;
}

// O dono do escritório é o usuário que originou o tenant (tenantId = t_<seu próprio id>,
// atribuído no cadastro em app/api/cadastro/route.ts e cadastro/gratis/route.ts).
export function isOwner(user: Pick<User, "id" | "tenantId">): boolean {
  return !!user.tenantId && user.tenantId === `t_${user.id}`;
}

// Usuários ativos do mesmo escritório (tenantId) de currentUser. Se currentUser não tiver
// tenantId, retorna só ele mesmo — nunca vaza usuários de outros escritórios.
export async function getTenantUsersAsync(currentUser: Pick<User, "id" | "tenantId">): Promise<User[]> {
  const allUsers = await getUsersAsync();
  return currentUser.tenantId
    ? allUsers.filter(u => u.tenantId === currentUser.tenantId && u.isActive)
    : allUsers.filter(u => u.id === currentUser.id);
}

export async function updateUserAsync(id: string, data: Partial<Omit<User, "id">>): Promise<User | null> {
  const current = await getUserByIdAsync(id);
  if (!current) return null;
  const merged: User = { ...current, ...data };
  if (hasDb()) {
    await dbInit();
    await upsertUserRow(merged);
    return merged;
  }
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = merged;
  saveUsers(users);
  return merged;
}

export async function createUserAsync(data: Omit<User, "id" | "createdAt">): Promise<User> {
  const hashedPassword = data.password && !data.password.startsWith("$2")
    ? await bcrypt.hash(data.password, 10)
    : data.password;
  const user: User = { ...data, password: hashedPassword, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (hasDb()) {
    await dbInit();
    await upsertUserRow(user);
    return user;
  }
  const users = getUsers();
  users.push(user);
  saveUsers(users);
  return user;
}

export async function deleteUserAsync(id: string): Promise<boolean> {
  if (hasDb()) {
    await dbInit();
    const sql = getSql()!;
    const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id` as unknown[];
    return rows.length > 0;
  }
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

const RESET_TOKENS_DB_KEY = "reset_tokens_global";

async function getTokensAsync(): Promise<ResetToken[]> {
  if (hasDb()) {
    await dbInit();
    return (await dbGet<ResetToken[]>(RESET_TOKENS_DB_KEY)) ?? [];
  }
  return getTokens();
}

async function saveTokensAsync(tokens: ResetToken[]): Promise<void> {
  if (hasDb()) {
    await dbInit();
    const ok = await dbSet(RESET_TOKENS_DB_KEY, tokens);
    if (!ok) throw new Error("Falha ao salvar token de redefinição de senha no banco de dados");
    return;
  }
  saveTokens(tokens);
}

export async function createResetTokenAsync(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const tokens = (await getTokensAsync()).filter(t => t.email !== email);
  tokens.push({ token, email, expiresAt });
  await saveTokensAsync(tokens);
  return token;
}

export async function consumeResetTokenAsync(token: string): Promise<string | null> {
  const tokens = await getTokensAsync();
  const t = tokens.find(t => t.token === token);
  if (!t) return null;
  if (new Date(t.expiresAt) < new Date()) return null;
  await saveTokensAsync(tokens.filter(x => x.token !== token));
  return t.email;
}
