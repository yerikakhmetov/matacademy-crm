import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Загрузка учебного материала (файла) в Vercel Blob + запись в БД.
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Хранилище файлов (Vercel Blob) не подключено." }, { status: 400 });
  }
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  // Материал занятия: приходит id занятия и дата — тогда файл привязывается
  // к конкретному дню, а группа берётся у самого занятия.
  const lessonId = String(form.get("lessonId") ?? "").trim();
  const dateStr = String(form.get("date") ?? "").trim();
  let groupId = String(form.get("groupId") ?? "").trim() || null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Файл больше 20 МБ" }, { status: 400 });

  let lessonSessionId: string | null = null;
  if (lessonId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "Неверная дата занятия" }, { status: 400 });
    }
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { groupId: true, group: { select: { teacher: { select: { userId: true } } } } },
    });
    if (!lesson) return NextResponse.json({ error: "Занятие не найдено" }, { status: 404 });
    const owns = lesson.group.teacher?.userId === session.user.id;
    if (!(await canEditData(session.user.role)) && !owns) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    groupId = lesson.groupId;
    const date = new Date(dateStr + "T00:00:00.000Z");
    // запись занятия может ещё не существовать — тема могла быть не заполнена
    const ls = await prisma.lessonSession.upsert({
      where: { lessonId_date: { lessonId, date } },
      create: { lessonId, date, topic: "" },
      update: {},
      select: { id: true },
    });
    lessonSessionId = ls.id;
  } else if (!(await canEditData(session.user.role))) {
    // права: админ/менеджер, либо преподаватель для своей группы
    let ok = false;
    if (session.user.role === "TEACHER" && groupId) {
      const g = await prisma.group.findUnique({ where: { id: groupId }, select: { teacher: { select: { userId: true } } } });
      ok = g?.teacher?.userId === session.user.id;
    }
    if (!ok) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const safeName = file.name.replace(/[^\w.\-А-Яа-яЁё ]+/g, "_").slice(0, 120);
  try {
    const blob = await put(`materials/${groupId ?? "all"}/${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || "application/octet-stream",
    });
    await prisma.material.create({
      data: {
        groupId,
        title: title || file.name,
        fileUrl: blob.url,
        fileName: file.name,
        fileType: file.type || "",
        uploadedBy: session.user.name ?? null,
        lessonSessionId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки" }, { status: 500 });
  }
}
