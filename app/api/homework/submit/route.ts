import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStudentIdForUser } from "@/lib/teacher";
import { safeFileName, uploadContentType, uploadError } from "@/lib/upload-policy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Ученик прикрепляет работу к домашнему заданию (фото тетради или файл).
export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Хранилище файлов не подключено." }, { status: 400 });
  }
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const homeworkId = String(form.get("homeworkId") ?? "").trim();
  const comment = String(form.get("comment") ?? "").trim() || null;
  if (!homeworkId) return NextResponse.json({ error: "Задание не указано" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  const bad = uploadError(file);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  // Задание должно относиться к группе этого ученика
  const hw = await prisma.homework.findUnique({ where: { id: homeworkId }, select: { groupId: true } });
  if (!hw) return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
  const inGroup = await prisma.student.findFirst({
    where: { id: studentId, groups: { some: { id: hw.groupId } } },
    select: { id: true },
  });
  if (!inGroup) return NextResponse.json({ error: "Это задание не для вашей группы" }, { status: 403 });

  const safeName = safeFileName(file.name);
  try {
    const blob = await put(`homework/${homeworkId}/${studentId}-${Date.now()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: uploadContentType(file.name)!, // проверено в uploadError
    });
    await prisma.homeworkDone.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId } },
      create: { homeworkId, studentId, done: true, fileUrl: blob.url, fileName: file.name, comment, submittedAt: new Date() },
      update: { done: true, fileUrl: blob.url, fileName: file.name, comment, submittedAt: new Date() },
    });
    return NextResponse.json({ ok: true, fileUrl: blob.url, fileName: file.name });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка загрузки" }, { status: 500 });
  }
}
