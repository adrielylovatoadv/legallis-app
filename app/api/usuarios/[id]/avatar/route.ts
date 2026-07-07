import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { updateUserAsync } from "@/lib/users";

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
  // Path prefixado por tenant: isola arquivos entre escritórios diferentes no mesmo Blob store.
  const pathname = `avatars/${session.user.tenantId}/${id}.${ext}`;

  let avatarUrl: string;
  try {
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: false, allowOverwrite: true });
    avatarUrl = blob.url;
  } catch {
    return NextResponse.json({ error: "Erro ao salvar arquivo." }, { status: 500 });
  }

  await updateUserAsync(id, { avatar: avatarUrl });

  return NextResponse.json({ avatarUrl });
}
