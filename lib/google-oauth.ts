// OAuth2 com o Google via fetch puro (sem googleapis/google-auth-library — SDKs desnecessários
// pra duas chamadas REST simples numa função serverless). Escopo mínimo: só criar/editar/apagar
// eventos de agenda, não acesso completo ao Google Calendar da pessoa.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://app.legarium.app.br";
}

export function getRedirectUri(): string {
  return `${appUrl()}/api/google/callback`;
}

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // força emissão de refresh_token mesmo em reconexão
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });
  if (!res.ok) {
    console.error("[google-oauth] Falha ao trocar code por tokens:", await res.text().catch(() => res.statusText));
    return null;
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  // invalid_grant (token revogado/expirado) não é uma falha transitória — quem chama deve
  // marcar a conexão como desconectada em vez de tentar de novo.
  if (!res.ok) {
    console.error("[google-oauth] Falha ao renovar access token:", await res.text().catch(() => res.statusText));
    return null;
  }
  return res.json();
}
