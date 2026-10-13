"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditData } from "@/lib/access";

// ---------- Фото профиля ----------
async function assertCanEditPhoto(entity: "student" | "teacher", id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (await canEditData(session.user.role)) return;
  // учитель может менять только своё фото
  if (entity === "teacher" && session.user.role === "TEACHER") {
    const t = await prisma.teacher.findUnique({ where: { id }, select: { userId: true } });
    if (t?.userId === session.user.id) return;
  }
  throw new Error("Недостаточно прав");
}

// Сохранить URL фото (файл уже загружен напрямую в Vercel Blob с клиента).
export async function savePhotoUrl(entity: "student" | "teacher", id: string, url: string) {
  await assertCanEditPhoto(entity, id);
  // Разбираем URL целиком: регулярка по строке пропускала «https://evil.com?x.blob.vercel-storage.com/…»
  let photoHost = "";
  try {
    const u = new URL(url);
    if (u.protocol === "https:") photoHost = u.hostname;
  } catch {}
  if (!photoHost.endsWith(".blob.vercel-storage.com")) {
    throw new Error("Недопустимый адрес файла");
  }
  if (entity === "student") await prisma.student.update({ where: { id }, data: { photoUrl: url } });
  else await prisma.teacher.update({ where: { id }, data: { photoUrl: url } });

  revalidatePath(entity === "student" ? `/students/${id}` : "/teachers");
  revalidatePath("/my-students");
}

export async function removePhoto(entity: "student" | "teacher", id: string) {
  await assertCanEditPhoto(entity, id);
  if (entity === "student") await prisma.student.update({ where: { id }, data: { photoUrl: null } });
  else await prisma.teacher.update({ where: { id }, data: { photoUrl: null } });
  revalidatePath(entity === "student" ? `/students/${id}` : "/teachers");
  revalidatePath("/my-students");
}
