import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailAsync, createResetToken } from "@/lib/users";
import { sendPasswordReset } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`esqueci:${ip}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde 10 minutos." }, { status: 429 });
  }

  const { email } = await req.json();
  const user = await getUserByEmailAsync(email);
  // Always return success to avoid email enumeration
  if (!user) return NextResponse.json({ ok: true });

  const token = createResetToken(email);
  const resetUrl = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${token}`;

  await sendPasswordReset(email, resetUrl);

  return NextResponse.json({ ok: true });
}
