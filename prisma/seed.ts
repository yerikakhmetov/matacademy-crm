import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Очистка и наполнение базы демо-данными…");

  // Порядок важен из-за внешних ключей
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.student.deleteMany();
  await prisma.group.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const hash = (p: string) => bcrypt.hashSync(p, 10);

  // --- Пользователи (вход + роли) ---
  const admin = await prisma.user.create({
    data: { name: "Айгерим Жаксыбекова", email: "admin@matacademy.kz", passwordHash: hash("admin123"), role: "ADMIN" },
  });
  await prisma.user.create({
    data: { name: "Данияр Менеджер", email: "manager@matacademy.kz", passwordHash: hash("manager123"), role: "MANAGER" },
  });
  const teacherUser = await prisma.user.create({
    data: { name: "Мадина Жумабекова", email: "teacher@matacademy.kz", passwordHash: hash("teacher123"), role: "TEACHER" },
  });

  // --- Преподаватели ---
  const madina = await prisma.teacher.create({
    data: { name: "Мадина Жумабекова", specialty: "Алгебра · Геометрия", phone: "+7 701 111 22 33", color: "#3A5AE0", userId: teacherUser.id, rateType: "PER_LESSON", rate: 3500 },
  });
  const erlan = await prisma.teacher.create({
    data: { name: "Ерлан Сапаров", specialty: "ЕНТ · Математика", phone: "+7 701 222 33 44", color: "#2F9E44", rateType: "PER_LESSON", rate: 4000 },
  });
  const asel = await prisma.teacher.create({
    data: { name: "Асель Кенжебекова", specialty: "Ментальный счёт", phone: "+7 701 333 44 55", color: "#7048E8", rateType: "PER_STUDENT", rate: 5000 },
  });
  const bauyrzhan = await prisma.teacher.create({
    data: { name: "Бауыржан Оразалы", specialty: "Олимпиадная математика", phone: "+7 701 444 55 66", color: "#C2255C", rateType: "PERCENT", rate: 40 },
  });

  // --- Группы ---
  const gAlgPro = await prisma.group.create({ data: { name: "Алгебра · Pro", level: "7 класс", capacity: 12, color: "#3A5AE0", teacherId: madina.id } });
  const gEnt = await prisma.group.create({ data: { name: "ЕНТ · Математика", level: "11 класс", capacity: 10, color: "#2F9E44", teacherId: erlan.id } });
  const gMental = await prisma.group.create({ data: { name: "Ментальный счёт", level: "4–5 класс", capacity: 14, color: "#7048E8", teacherId: asel.id } });
  const gGeom = await prisma.group.create({ data: { name: "Геометрия · Basic", level: "8 класс", capacity: 12, color: "#0C8599", teacherId: madina.id } });
  const gAlgBasic = await prisma.group.create({ data: { name: "Алгебра · Basic", level: "6 класс", capacity: 12, color: "#E8590C", teacherId: erlan.id } });
  const gOlymp = await prisma.group.create({ data: { name: "Олимпиадная математика", level: "9–10 класс", capacity: 8, color: "#C2255C", teacherId: bauyrzhan.id } });

  // --- Расписание (dayOfWeek: 1=Пн ... 6=Сб) ---
  const lessons: { group: string; day: number; time: string; room: string }[] = [
    { group: gAlgBasic.id, day: 1, time: "14:00", room: "Каб. 1" },
    { group: gMental.id, day: 1, time: "15:00", room: "Каб. 3" },
    { group: gAlgPro.id, day: 1, time: "16:00", room: "Каб. 2" },
    { group: gGeom.id, day: 2, time: "17:00", room: "Каб. 2" },
    { group: gEnt.id, day: 2, time: "18:00", room: "Каб. 1" },
    { group: gAlgBasic.id, day: 3, time: "14:00", room: "Каб. 1" },
    { group: gMental.id, day: 3, time: "15:00", room: "Каб. 3" },
    { group: gAlgPro.id, day: 3, time: "16:00", room: "Каб. 2" },
    { group: gGeom.id, day: 4, time: "17:00", room: "Каб. 2" },
    { group: gEnt.id, day: 4, time: "18:00", room: "Каб. 1" },
    { group: gAlgBasic.id, day: 5, time: "14:00", room: "Каб. 1" },
    { group: gAlgPro.id, day: 5, time: "16:00", room: "Каб. 2" },
    { group: gOlymp.id, day: 6, time: "11:00", room: "Каб. 3" },
  ];
  for (const l of lessons) {
    await prisma.lesson.create({ data: { groupId: l.group, dayOfWeek: l.day, startTime: l.time, room: l.room } });
  }

  // --- Ученики ---
  const students: {
    name: string; grade: string; group: string; status: string; balance: number; attendance: number; parent: string;
  }[] = [
    { name: "Алишер Нурланов", grade: "7 класс", group: gAlgPro.id, status: "ACTIVE", balance: 0, attendance: 94, parent: "Нурлан А." },
    { name: "Диана Ким", grade: "9 класс", group: gGeom.id, status: "ACTIVE", balance: 0, attendance: 88, parent: "Ольга К." },
    { name: "Тимур Ахметов", grade: "5 класс", group: gMental.id, status: "ACTIVE", balance: -18000, attendance: 71, parent: "Асхат А." },
    { name: "Аружан Сериковна", grade: "11 класс", group: gEnt.id, status: "ACTIVE", balance: 0, attendance: 97, parent: "Серик Б." },
    { name: "Ерасыл Болатов", grade: "6 класс", group: gAlgBasic.id, status: "PAUSED", balance: -9000, attendance: 62, parent: "Болат Е." },
    { name: "Камила Ержанова", grade: "8 класс", group: gGeom.id, status: "ACTIVE", balance: 0, attendance: 90, parent: "Ержан К." },
    { name: "Нурислам Абаев", grade: "4 класс", group: gMental.id, status: "ACTIVE", balance: 0, attendance: 85, parent: "Абай Н." },
    { name: "Сабина Оспанова", grade: "10 класс", group: gEnt.id, status: "ACTIVE", balance: -27000, attendance: 79, parent: "Оспан С." },
    { name: "Данияр Тлеу", grade: "7 класс", group: gAlgPro.id, status: "ACTIVE", balance: 0, attendance: 96, parent: "Тлеу Д." },
    { name: "Аяна Мукан", grade: "9 класс", group: gGeom.id, status: "ACTIVE", balance: 0, attendance: 83, parent: "Мукан А." },
    { name: "Санжар Кайратов", grade: "8 класс", group: gAlgPro.id, status: "ACTIVE", balance: 0, attendance: 91, parent: "Кайрат С." },
    { name: "Алия Досжан", grade: "5 класс", group: gMental.id, status: "ACTIVE", balance: 0, attendance: 87, parent: "Досжан А." },
  ];

  const createdStudents: Awaited<ReturnType<typeof prisma.student.create>>[] = [];
  for (const s of students) {
    const st = await prisma.student.create({
      data: {
        name: s.name, grade: s.grade, groupId: s.group, status: s.status,
        balance: s.balance, attendance: s.attendance,
        parentName: s.parent, parentPhone: "+7 (7__) ___-__-__", phone: "+7 (7__) ___-__-__",
      },
    });
    createdStudents.push(st);
  }
  const byName = (n: string) => createdStudents.find((s) => s.name === n)!;

  // --- Абонементы ---
  const subs: { name: string; plan: string; months: number; price: number }[] = [
    { name: "Алишер Нурланов", plan: "Годовой", months: 12, price: 168000 },
    { name: "Диана Ким", plan: "6 месяцев", months: 6, price: 90000 },
    { name: "Тимур Ахметов", plan: "3 месяца", months: 3, price: 54000 },
    { name: "Аружан Сериковна", plan: "ЕНТ-курс", months: 8, price: 120000 },
    { name: "Данияр Тлеу", plan: "Годовой", months: 12, price: 168000 },
  ];
  for (const sub of subs) {
    await prisma.subscription.create({
      data: { studentId: byName(sub.name).id, plan: sub.plan, months: sub.months, price: sub.price },
    });
  }

  // --- Оплаты ---
  const now = new Date();
  const d = (offset: number) => new Date(now.getTime() - offset * 86400000);
  const payments: { name: string; purpose: string; method: string | null; amount: number; status: string; date: Date }[] = [
    { name: "Диана Ким", purpose: "Абонемент · 6 мес", method: "Kaspi", amount: 90000, status: "PAID", date: d(0) },
    { name: "Данияр Тлеу", purpose: "Абонемент · 12 мес", method: "Карта", amount: 168000, status: "PAID", date: d(0) },
    { name: "Тимур Ахметов", purpose: "Доплата · август", method: null, amount: 18000, status: "PENDING", date: d(-2) },
    { name: "Аружан Сериковна", purpose: "ЕНТ-курс", method: "Kaspi", amount: 120000, status: "PAID", date: d(1) },
    { name: "Сабина Оспанова", purpose: "Абонемент · сентябрь", method: null, amount: 27000, status: "OVERDUE", date: d(3) },
    { name: "Камила Ержанова", purpose: "Абонемент · 6 мес", method: "Наличные", amount: 90000, status: "PAID", date: d(2) },
    { name: "Ерасыл Болатов", purpose: "Доплата · август", method: null, amount: 9000, status: "PENDING", date: d(-2) },
    { name: "Нурислам Абаев", purpose: "Ментал. · 3 мес", method: "Kaspi", amount: 54000, status: "PAID", date: d(3) },
  ];
  for (const p of payments) {
    await prisma.payment.create({
      data: { studentId: byName(p.name).id, purpose: p.purpose, method: p.method, amount: p.amount, status: p.status, date: p.date },
    });
  }

  // --- Лиды ---
  const leads: { name: string; child: string; grade: string; subject: string; source: string; stage: string }[] = [
    { name: "Айдана (мама Санжара)", child: "Санжар", grade: "8 класс", subject: "Алгебра", source: "Instagram", stage: "NEW" },
    { name: "Руслан Т.", child: "Руслан", grade: "11 класс", subject: "ЕНТ", source: "Сайт", stage: "NEW" },
    { name: "Гульнара (мама Алии)", child: "Алия", grade: "5 класс", subject: "Ментальный счёт", source: "2ГИС", stage: "CONTACTED" },
    { name: "Марат Ж.", child: "Марат", grade: "9 класс", subject: "Геометрия", source: "Реклама", stage: "CONTACTED" },
    { name: "Жанна (мама Дамира)", child: "Дамир", grade: "7 класс", subject: "Алгебра", source: "Рекомендация", stage: "TRIAL" },
    { name: "Инкар С.", child: "Инкар", grade: "10 класс", subject: "ЕНТ", source: "Instagram", stage: "TRIAL" },
    { name: "Азамат (папа Ромы)", child: "Рома", grade: "6 класс", subject: "Алгебра", source: "Сайт", stage: "INVOICED" },
    { name: "Сауле (мама Аяны)", child: "Аяна", grade: "9 класс", subject: "Геометрия", source: "2ГИС", stage: "WON" },
    { name: "Дана К.", child: "Дана", grade: "11 класс", subject: "ЕНТ", source: "Рекомендация", stage: "WON" },
  ];
  const inDays = (n: number) => new Date(now.getTime() + n * 86400000);
  for (const l of leads) {
    const created = await prisma.lead.create({
      data: { name: l.name, childName: l.child, grade: l.grade, subject: l.subject, source: l.source, stage: l.stage },
    });
    // Немного демо-активностей для лидов на активных этапах
    if (l.stage === "CONTACTED") {
      await prisma.leadActivity.create({ data: { leadId: created.id, type: "CALL", text: "Позвонили, рассказали о курсе, заинтересованы", done: true } });
      await prisma.leadActivity.create({ data: { leadId: created.id, type: "TASK", text: "Записать на пробный урок", dueDate: inDays(2), done: false } });
    }
    if (l.stage === "TRIAL") {
      await prisma.leadActivity.create({ data: { leadId: created.id, type: "TASK", text: "Провести пробный урок и собрать обратную связь", dueDate: inDays(1), done: false } });
    }
    if (l.stage === "INVOICED") {
      await prisma.leadActivity.create({ data: { leadId: created.id, type: "TASK", text: "Напомнить об оплате счёта", dueDate: inDays(-1), done: false } });
    }
  }

  // Пересчёт задолженности из неоплаченных счетов (единый источник истины)
  for (const s of createdStudents) {
    const unpaid = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { studentId: s.id, status: { in: ["PENDING", "OVERDUE"] } },
    });
    await prisma.student.update({ where: { id: s.id }, data: { balance: -(unpaid._sum.amount ?? 0) } });
  }

  console.log("✅ Готово. Вход: admin@matacademy.kz / admin123");
  console.log(`   Пользователей: 3 · Учеников: ${createdStudents.length} · Групп: 6 · Лидов: ${leads.length}`);
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
