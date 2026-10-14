"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getSettings, parseList } from "@/lib/settings";
import { parseSlots, planScheduleSync } from "@/lib/schedule-sync";
import { schoolToday } from "@/lib/school-time";
import { assertEditor, int, str } from "./_shared";

// ---------- Группы ----------
// Дата первого занятия обязательна: без неё делитель зарплаты и журнал
// считают занятия, которых не было.
// Массовое проставление даты первого занятия: отдельная страница, где
// у всех групп сразу видно, у кого даты нет. Пустое поле не трогаем —
// чтобы случайно не стереть уже заданную дату.
export async function setGroupStartDates(formData: FormData) {
  await assertEditor();
  let changed = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("start_")) continue;
    const v = str(value);
    if (!v) continue;
    const id = key.slice("start_".length);
    await prisma.group.update({
      where: { id },
      data: { startDate: new Date(`${v}T00:00:00Z`) },
    });
    changed++;
  }
  if (changed > 0) await logAudit("UPDATE", "Группы", `Дата начала задана: ${changed}`);
  revalidatePath("/groups");
  revalidatePath("/groups/start-dates");
  revalidatePath("/payroll");
}

function groupStartDate(formData: FormData): Date {
  const v = str(formData.get("startDate"));
  if (!v) throw new Error("Укажите дату начала занятий группы");
  return new Date(`${v}T00:00:00Z`);
}

// Приводим занятия группы к тому, что задали в форме расписания.
// Занятия по возможности обновляем, а не пересоздаём: удаление Lesson
// каскадом уносит посещаемость, темы уроков и отработки.
// isNew — группа только создаётся: её слоты действуют с начала группы. При правке
// существующей группы новые слоты действуют с сегодняшнего дня школы.
async function syncGroupSchedule(groupId: string, raw: FormDataEntryValue | null, isNew = false) {
  if (raw === null) return; // форма без блока расписания — расписание не трогаем
  const settings = await getSettings();
  const rooms = parseList(settings.rooms);
  const desired = parseSlots(raw, rooms[0] ?? "Каб. 1");
  const existing = await prisma.lesson.findMany({
    where: { groupId, archivedAt: null },
    select: { id: true, dayOfWeek: true, startTime: true, room: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  const plan = planScheduleSync(existing, desired);

  for (const u of plan.update) {
    await prisma.lesson.update({
      where: { id: u.id },
      data: { dayOfWeek: u.dayOfWeek, startTime: u.startTime, room: u.room },
    });
  }
  if (plan.create.length > 0) {
    const activeFrom = isNew ? null : schoolToday(settings.tzOffsetHours);
    await prisma.lesson.createMany({ data: plan.create.map((c) => ({ groupId, ...c, activeFrom })) });
  }
  if (plan.remove.length > 0) {
    // Слот с историей (отметки, темы занятий, отработки) не удаляем:
    // вместе с ним каскадом ушла бы вся посещаемость за прошлые месяцы.
    // Прячем его из расписания, журнал за прошлые даты остаётся.
    const withHistory = await prisma.lesson.findMany({
      where: {
        id: { in: plan.remove },
        OR: [{ attendance: { some: {} } }, { sessions: { some: {} } }, { makeups: { some: {} } }],
      },
      select: { id: true },
    });
    const keep = new Set(withHistory.map((l) => l.id));
    if (keep.size > 0) {
      await prisma.lesson.updateMany({ where: { id: { in: [...keep] } }, data: { archivedAt: new Date() } });
    }
    const drop = plan.remove.filter((id) => !keep.has(id));
    if (drop.length > 0) await prisma.lesson.deleteMany({ where: { id: { in: drop } } });
  }
  return plan;
}

export async function createGroup(formData: FormData) {
  await assertEditor();
  const group = await prisma.group.create({
    data: {
      name: str(formData.get("name")),
      level: str(formData.get("level")),
      capacity: int(formData.get("capacity")) || 12,
      color: str(formData.get("color")) || "#3A5AE0",
      teacherId: str(formData.get("teacherId")) || null,
      subjectId: str(formData.get("subjectId")) || null,
      curatorId: str(formData.get("curatorId")) || null,
      curatorRate: Math.max(0, int(formData.get("curatorRate"))),
      // дата хранится UTC-полуночью — так же, как считаются занятия месяца
      startDate: groupStartDate(formData),
    },
  });
  await syncGroupSchedule(group.id, formData.get("schedule"), true);
  await logAudit("CREATE", "Группа", str(formData.get("name")));
  revalidatePath("/groups");
  revalidatePath("/schedule");
  revalidatePath("/journal");
}

export async function updateGroup(id: string, formData: FormData) {
  await assertEditor();
  await prisma.group.update({
    where: { id },
    data: {
      name: str(formData.get("name")),
      level: str(formData.get("level")),
      capacity: int(formData.get("capacity")) || 12,
      color: str(formData.get("color")) || "#3A5AE0",
      teacherId: str(formData.get("teacherId")) || null,
      subjectId: str(formData.get("subjectId")) || null,
      curatorId: str(formData.get("curatorId")) || null,
      curatorRate: Math.max(0, int(formData.get("curatorRate"))),
      // дата хранится UTC-полуночью — так же, как считаются занятия месяца
      startDate: groupStartDate(formData),
    },
  });
  const plan = await syncGroupSchedule(id, formData.get("schedule"));
  const changed = plan ? plan.create.length + plan.update.length + plan.remove.length : 0;
  await logAudit(
    "UPDATE",
    "Группа",
    changed > 0 ? `${str(formData.get("name"))} · расписание изменено` : str(formData.get("name"))
  );
  revalidatePath("/groups");
  revalidatePath("/schedule");
  revalidatePath("/journal");
}

export async function deleteGroup(id: string) {
  await assertEditor();
  const g = await prisma.group.findUnique({ where: { id }, select: { name: true } });
  // ученики открепляются (groupId -> null), занятия удаляются каскадом
  await prisma.group.delete({ where: { id } });
  await logAudit("DELETE", "Группа", g?.name ?? id);
  revalidatePath("/groups");
  revalidatePath("/schedule");
}
