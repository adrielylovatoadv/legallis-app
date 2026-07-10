import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync } from "@/lib/users";

export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getUsersAsync();
  return NextResponse.json(users.map(({ password: _pw, ...u }) => u));
}
