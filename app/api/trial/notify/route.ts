import { NextRequest, NextResponse } from "next/server";
import { getUsersAsync, updateUserAsync } from "@/lib/users";
import { sendTrialExpiringSoon } from "@/lib/email";

// Called by Vercel Cron (vercel.json) or manually with CRON_SECRET header
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  // CRON_SECRET é obrigatório — sem ele qualquer pessoa pode expirar trials
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await getUsersAsync();
  const now = Date.now();
  const notified: string[] = [];
  const expired: string[] = [];

  for (const user of users) {
    if (user.subscriptionStatus !== "trial" || !user.trialEndsAt) continue;

    const trialEnd = new Date(user.trialEndsAt).getTime();
    const msLeft = trialEnd - now;
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    if (msLeft < 0) {
      await updateUserAsync(user.id, { subscriptionStatus: "expired" });
      expired.push(user.email);
    } else if (daysLeft <= 1) {
      await sendTrialExpiringSoon(user.name, user.email, daysLeft, user.trialEndsAt);
      notified.push(user.email);
    }
  }

  console.log(`[Trial Notify] Notified: ${notified.length}, Expired: ${expired.length}`);
  return NextResponse.json({ notified, expired, checkedAt: new Date().toISOString() });
}
