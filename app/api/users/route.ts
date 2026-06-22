import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersAsync } from "@/lib/users";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const users = (await getUsersAsync())
    .filter(u => u.isActive)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      oab: u.oab ?? [],
      company: u.company ?? null,
    }));
  return NextResponse.json(users);
}
