import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:";

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPT_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

export function encryptField(text: string): string {
  if (!text) return text;
  if (text.startsWith(PREFIX)) return text; // já criptografado
  const key = getKey();
  if (!key) return text; // sem chave configurada, passa como está
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptField(text: string): string {
  if (!text || !text.startsWith(PREFIX)) return text; // texto puro (dados antigos) — passa direto
  const key = getKey();
  if (!key) return text;
  try {
    const parts = text.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return text;
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return ""; // falha de integridade — retorna vazio em vez de vazar dado corrompido
  }
}
