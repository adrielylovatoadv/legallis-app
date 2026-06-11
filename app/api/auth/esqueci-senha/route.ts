import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createResetToken } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const user = getUserByEmail(email);
  // Always return success to avoid email enumeration
  if (!user) return NextResponse.json({ ok: true });

  const token = createResetToken(email);
  const resetUrl = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${token}`;

  // Send via Resend if configured
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Legallis <noreply@legallis.app.br>",
      to: email.includes("@legallis") ? "adriely@legallis.app.br" : email,
      subject: "Redefinição de senha — Legallis",
      html: `<p>Clique no link para redefinir sua senha (válido por 1 hora):</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  } else {
    // Log token for development
    console.log(`[RESET TOKEN] ${email} → ${resetUrl}`);
  }

  return NextResponse.json({ ok: true });
}
