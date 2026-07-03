const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const ENV_FILE = path.join(__dirname, "..", ".env.production.local");
const TARGET_EMAIL = "mariasouzaadv@hotmail.com";

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv(ENV_FILE);
  const sql = neon(process.env.POSTGRES_URL);

  const rows = await sql`SELECT value FROM kv_store WHERE key = 'users_global'`;
  const users = rows[0]?.value || [];
  console.log("total users:", users.length);
  const fake = users.find(u => u.email === TARGET_EMAIL);
  console.log("target user found:", !!fake);
  if (fake) console.log(JSON.stringify({ id: fake.id, tenantId: fake.tenantId, plan: fake.plan, subscriptionStatus: fake.subscriptionStatus, name: fake.name }, null, 2));

  const keys = await sql`SELECT key FROM kv_store WHERE key LIKE 'controle_%' OR key LIKE 'financeiro_%'`;
  console.log("existing tenant data keys:", keys.map(r => r.key));
}

main().catch(e => { console.error(e); process.exit(1); });
