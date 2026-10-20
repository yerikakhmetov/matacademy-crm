import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_BYTES, isJpeg } from "@/lib/upload-policy";
import { getStudentIdForUser } from "@/lib/teacher";

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
  // parent — фото родителя, хранится у ученика (id — id ученика)
  if (entity !== "student" && entity !== "teacher" && entity !== "parent") return NextResponse.json({ error: "Неверный тип" }, { status: 400 });
  // Браузер пересжимает фото в JPEG до 512px — всё остальное (SVG, HTML, огромные файлы) не фото
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Фото больше 2 МБ" }, { status: 400 });
  if (!isJpeg(new Uint8Array(await file.slice(0, 3).arrayBuffer()))) {
    return NextResponse.json({ error: "Это не фото" }, { status: 400 });
  }

  // права: админ/менеджер, преподаватель — своё фото, ученик — своё фото (из кабинета)
  if (!(await canEditData(session.user.role))) {
    let ok = false;
    if (entity === "teacher" && session.user.role === "TEACHER") {
      const t = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
      ok = t?.userId === session.user.id;
    }
    if (entity === "student" && session.user.role === "STUDENT") {
      ok = (await getStudentIdForUser(session.user.id)) === id;
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
    else if (entity === "parent") await prisma.student.update({ where: { id }, data: { parentPhotoUrl: blob.url } });
    else await prisma.teacher.update({ where: { id }, data: { photoUrl: blob.url } });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки" }, { status: 500 });
  }
}
