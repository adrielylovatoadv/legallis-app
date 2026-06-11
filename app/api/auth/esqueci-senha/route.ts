import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createResetToken } from "@/lib/users";
import { sendPasswordReset } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const user = getUserByEmail(email);
  // Always return success to avoid email enumeration
  if (!user) return NextResponse.json({ ok: true });

  const token = createResetToken(email);
  const resetUrl = `${process.env.NEXTAUTH_URL}/redefinir-senha?token=${token}`;

  await sendPasswordReset(email, resetUrl);

  return NextResponse.json({ ok: true });
}
