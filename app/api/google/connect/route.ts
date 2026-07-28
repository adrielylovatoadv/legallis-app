import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google-oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Integração com Google não configurada (GOOGLE_CLIENT_ID/SECRET ausentes)" }, { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
