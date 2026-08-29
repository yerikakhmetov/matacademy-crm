import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEdit } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Приём фото (multipart) → загрузка в Vercel Blob → сохранение URL.
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Хранилище фото (Vercel Blob) не подключено к проекту." }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const entity = String(form.get("entity") ?? "");
  const id = String(form.get("id") ?? "");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  if (entity !== "student" && entity !== "teacher") return NextResponse.json({ error: "Неверный тип" }, { status: 400 });

  // права: админ/менеджер, либо преподаватель для своего фото
  if (!canEdit(session.user.role)) {
    let ok = false;
    if (entity === "teacher" && session.user.role === "TEACHER") {
      const t = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
      ok = t?.userId === session.user.id;
    }
    if (!ok) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  try {
    const blob = await put(`${entity}/${id}-${Date.now()}.jpg`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/jpeg",
    });
    if (entity === "student") await prisma.student.update({ where: { id }, data: { photoUrl: blob.url } });
    else await prisma.teacher.update({ where: { id }, data: { photoUrl: blob.url } });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки" }, { status: 500 });
  }
}
