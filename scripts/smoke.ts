// Дымовой тест: под каждой ролью открыть все страницы и проверить, что ни одна не падает.
// Запуск при работающем dev-сервере и локальной демо-базе:
//   npm run smoke            (по умолчанию http://localhost:3002)
//   SMOKE_URL=http://localhost:3000 npm run smoke
// Только для локального демо: входит учётками из prisma/seed.ts и scripts/demo-data.ts.
import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_URL ?? "http://localhost:3002";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error("smoke: только локальный сервер (SMOKE_URL должен быть http://localhost:…)");
}
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("smoke: только локальная база (DATABASE_URL должен указывать на localhost)");
}

// локальные демо-учётки (те же, что в prisma/seed.ts и scripts/demo-data.ts)
const LOGINS: Record<string, string> = {
  admin: "admin123",
  manager: "manager123",
  teacher: "teacher123",
  curator: "curator123",
  student: "student123",
};

const ERROR_MARK = /Страница не загрузилась|Бет жүктелмеді|Application error|"digest"/;

class Session {
  private jar = new Map<string, string>();
  private cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  private keep(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    // редиректы проходим вручную, чтобы не терять cookie между шагами
    let url = BASE + path;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(url, { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie: this.cookieHeader() } });
      this.keep(res);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).toString();
        init = {};
        continue;
      }
      return res;
    }
    throw new Error(`слишком много редиректов: ${path}`);
  }
  async login(role: string): Promise<string | undefined> {
    const { csrfToken } = (await (await this.fetch("/api/auth/csrf")).json()) as { csrfToken: string };
    await this.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email: `${role}@matacademy.kz`, password: LOGINS[role] }).toString(),
    });
    const s = (await (await this.fetch("/api/auth/session")).json()) as { user?: { role?: string } };
    return s?.user?.role;
  }
}

async function check(s: Session, paths: string[]): Promise<string[]> {
  const bad: string[] = [];
  for (const p of paths) {
    const res = await s.fetch(p);
    const text = await res.text();
    const err = ERROR_MARK.test(text);
    if (res.status >= 400 || err) bad.push(`${p} → ${res.status}${err ? " (страница ошибки)" : ""}`);
  }
  return bad;
}

async function main() {
  const prisma = new PrismaClient();
  const [g, st, l, lead, pay, test, portal] = await Promise.all([
    prisma.group.findFirst({ select: { id: true } }),
    prisma.student.findFirst({ where: { userId: { not: null } }, select: { id: true } }),
    prisma.lesson.findFirst({ where: { archivedAt: null }, select: { id: true } }),
    prisma.lead.findFirst({ select: { id: true } }),
    prisma.payment.findFirst({ where: { paidAmount: { gt: 0 } }, select: { id: true } }),
    prisma.test.findFirst({ select: { id: true } }),
    prisma.student.findFirst({ where: { portalToken: { not: null } }, select: { portalToken: true } }),
  ]);
  await prisma.$disconnect();

  const staff = [
    "/dashboard", "/audit", "/expenses", "/grades", "/groups", "/groups/start-dates", "/homework", "/journal",
    "/leads", "/makeups", "/materials", "/my-salary", "/my-students", "/payments", "/payments/daily", "/payroll",
    "/reminders", "/reports", "/schedule", "/search?q=а", "/settings", "/stats", "/students", "/subjects",
    "/teachers", "/tests", "/users", "/zachets", "/career-test",
    ...(g ? [`/groups/${g.id}`] : []),
    ...(lead ? [`/leads/${lead.id}`] : []),
    ...(l ? [`/schedule/${l.id}`] : []),
    ...(st ? [`/students/${st.id}`, `/students/${st.id}?tab=attendance`, `/students/${st.id}?tab=grades`] : []),
    ...(test ? [`/tests/${test.id}`] : []),
    ...(pay ? [`/receipt/${pay.id}`] : []),
  ];
  // тест, доступный ученику с входом (его группы), — иначе страница теста просто перенаправит в кабинет
  const prisma2 = new PrismaClient();
  const myTest = st
    ? await prisma2.test.findFirst({
        where: { OR: [{ group: { students: { some: { id: st.id } } } }, { groupLinks: { some: { group: { students: { some: { id: st.id } } } } } }] },
        select: { id: true },
      })
    : null;
  await prisma2.$disconnect();
  const cabinet = ["/cabinet", "/cabinet?tab=tests", "/cabinet?tab=grades", "/cabinet?tab=tasks", "/cabinet?tab=schedule", ...(myTest ? [`/cabinet/test/${myTest.id}`] : [])];

  let failed = 0;
  for (const role of ["admin", "manager", "teacher", "curator", "student"]) {
    const s = new Session();
    const as = await s.login(role);
    if (!as) {
      console.log(`✗ ${role}: не удалось войти`);
      failed++;
      continue;
    }
    const paths = role === "student" ? cabinet : staff;
    const bad = await check(s, paths);
    failed += bad.length;
    console.log(`${bad.length ? "✗" : "✓"} ${role} (${as}): ${paths.length - bad.length}/${paths.length}`);
    for (const b of bad) console.log("   " + b);
  }
  if (portal?.portalToken) {
    const bad = await check(new Session(), [`/p/${portal.portalToken}`, "/login"]);
    failed += bad.length;
    console.log(`${bad.length ? "✗" : "✓"} без входа: портал родителя и вход`);
    for (const b of bad) console.log("   " + b);
  }
  if (failed) {
    console.log(`\nНайдено проблем: ${failed}`);
    process.exit(1);
  }
  console.log("\nВсе страницы открываются.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
