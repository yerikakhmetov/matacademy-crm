// Выгрузка расписания в календарь телефона (iCalendar).
// Занятия повторяются каждую неделю, поэтому это одно событие с правилом RRULE,
// а не сотня отдельных записей.

export type IcsEvent = {
  uid: string;
  summary: string;
  location?: string | null;
  dayOfWeek: number; // 1 = Пн … 7 = Вс
  startTime: string; // "16:00"
  durationMin: number;
};

const BYDAY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

// В тексте iCalendar запятая, точка с запятой и перевод строки — служебные символы.
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Ближайшая дата нужного дня недели, начиная с from (включительно), в UTC-полночь.
export function nextOccurrence(from: Date, dayOfWeek: number): Date {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const cur = base.getUTCDay() === 0 ? 7 : base.getUTCDay();
  const diff = (dayOfWeek - cur + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diff);
  return base;
}

export function buildIcs(
  events: IcsEvent[],
  opts: { name: string; tzOffsetHours: number; from?: Date; now?: Date }
): string {
  const from = opts.from ?? new Date();
  const now = opts.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MatAcademy//Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(opts.name)}`,
  ];

  for (const e of events) {
    const day = nextOccurrence(from, e.dayOfWeek);
    const [hh, mi] = e.startTime.split(":").map((x) => parseInt(x, 10));
    const start = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        (isNaN(hh) ? 0 : hh) - opts.tzOffsetHours,
        isNaN(mi) ? 0 : mi
      )
    );
    const end = new Date(start.getTime() + Math.max(1, e.durationMin) * 60_000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[e.dayOfWeek] ?? "MO"}`,
      `SUMMARY:${icsEscape(e.summary)}`
    );
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // По спецификации строки разделяются CRLF
  return lines.join("\r\n") + "\r\n";
}
