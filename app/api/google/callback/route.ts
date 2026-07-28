import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { exchangeCodeForTokens } from "@/lib/google-oauth";
import { encryptField } from "@/lib/crypto";
import { updateUserAsync } from "@/lib/users";

const STATE_COOKIE = "google_oauth_state";
const PERFIL_URL = "/dashboard/configuracoes/perfil";

function redirectComErro(req: NextRequest, motivo: string) {
  return NextResponse.redirect(new URL(`${PERFIL_URL}?google=erro&motivo=${encodeURIComponent(motivo)}`, req.url));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectComErro(req, "estado_invalido");
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens) return redirectComErro(req, "falha_troca_tokens");
  if (!tokens.refresh_token) {
    // Sem refresh_token: normalmente acontece se o usuário já tinha consentido antes sem
    // "prompt=consent" — pedimos consent sempre, então isso não deveria ocorrer, mas sem ele
    // não há como renovar o acesso depois, então tratamos como falha em vez de conexão parcial.
    return redirectComErro(req, "sem_refresh_token");
  }

  await updateUserAsync(session.user.id, {
    googleCalendar: {
      connected: true,
      refreshTokenEnc: encryptField(tokens.refresh_token),
      connectedAt: new Date().toISOString(),
    },
  });

  return NextResponse.redirect(new URL(`${PERFIL_URL}?google=conectado`, req.url));
}
