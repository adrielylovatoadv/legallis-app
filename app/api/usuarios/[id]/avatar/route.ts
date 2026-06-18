import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateUserAsync } from "@/lib/users";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (session.user.id !== id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2MB." }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${id}.${ext}`;
  const avatarsDir = join(process.cwd(), "public", "avatars");
  const filePath = join(avatarsDir, filename);

  try {
    mkdirSync(avatarsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);
  } catch {
    return NextResponse.json({ error: "Erro ao salvar arquivo." }, { status: 500 });
  }

  const avatarUrl = `/avatars/${filename}`;
  await updateUserAsync(id, { avatar: avatarUrl });

  return NextResponse.json({ avatarUrl });
}
