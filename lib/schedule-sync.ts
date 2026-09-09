// Расписание группы: разбор введённых слотов и аккуратная синхронизация с Lesson.
//
// Главная осторожность: удаление Lesson каскадом уносит посещаемость,
// журнал тем и отработки. Поэтому слот с изменившимся временем мы
// ОБНОВЛЯЕМ, а не удаляем-и-создаём заново — история занятия сохраняется.

export type Slot = { dayOfWeek: number; startTime: string; room: string };
export type ExistingLesson = { id: string } & Slot;

export type SyncPlan = {
  create: Slot[];
  update: ({ id: string } & Slot)[];
  remove: string[];
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

// Приводим "9:5" → "09:05"; мусор отбрасываем (вернём null).
export function normalizeTime(raw: string): string | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Слоты приходят из формы JSON-строкой. Всё кривое молча отбрасываем:
// форма не должна ронять сохранение группы.
export function parseSlots(raw: unknown, fallbackRoom = "Каб. 1"): Slot[] {
  let arr: unknown;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  } else arr = raw;
  if (!Array.isArray(arr)) return [];

  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = Number(o.dayOfWeek);
    if (!Number.isInteger(day) || day < 1 || day > 6) continue;
    const time = normalizeTime(String(o.startTime ?? ""));
    if (!time) continue;
    const room = String(o.room ?? "").trim() || fallbackRoom;
    const key = `${day}|${time}|${room}`; // дубли одного и того же слота не нужны
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ dayOfWeek: day, startTime: time, room });
  }
  return out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

const same = (a: Slot, b: Slot) => a.dayOfWeek === b.dayOfWeek && a.startTime === b.startTime;

export function planScheduleSync(existing: ExistingLesson[], desired: Slot[]): SyncPlan {
  const freeExisting = [...existing];
  const unmatched: Slot[] = [];
  const plan: SyncPlan = { create: [], update: [], remove: [] };

  // 1) точное совпадение дня и времени — занятие остаётся, меняем разве что кабинет
  for (const slot of desired) {
    const i = freeExisting.findIndex((e) => same(e, slot));
    if (i === -1) {
      unmatched.push(slot);
      continue;
    }
    const [hit] = freeExisting.splice(i, 1);
    if (hit.room !== slot.room) plan.update.push({ id: hit.id, ...slot });
  }

  // 2) тот же день недели — считаем это переносом времени, а не новым занятием
  const stillUnmatched: Slot[] = [];
  for (const slot of unmatched) {
    const i = freeExisting.findIndex((e) => e.dayOfWeek === slot.dayOfWeek);
    if (i === -1) {
      stillUnmatched.push(slot);
      continue;
    }
    const [hit] = freeExisting.splice(i, 1);
    plan.update.push({ id: hit.id, ...slot });
  }

  // 3) остаток: день тоже сменился — переиспользуем любое свободное занятие,
  // чтобы не терять его историю понапрасну
  for (const slot of stillUnmatched) {
    const hit = freeExisting.shift();
    if (hit) plan.update.push({ id: hit.id, ...slot });
    else plan.create.push(slot);
  }

  plan.remove = freeExisting.map((e) => e.id);
  return plan;
}
