// Демо-данные поверх prisma/seed.ts — ТОЛЬКО для локальной разработки и проверки дизайна.
// Запуск: npm run db:seed && npx tsx scripts/demo-data.ts
// Добавляет предметы по прайсу, расписание, два месяца посещаемости, оценки, тест,
// домашние задания, счета и тестовые входы ученика и куратора (пароли — ниже, только локально).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("demo-data: только для локальной базы (DATABASE_URL должен указывать на localhost)");
}

const DEMO_LOGINS = {
  student: { email: "student@matacademy.kz", password: "student123" },
  curator: { email: "curator@matacademy.kz", password: "curator123" },
};

// Ссылка-ключ портала родителя демо-ученика. Только для локального демо: на рабочей
// базе ключи случайные (newToken), этот скрипт туда не запускается.
const DEMO_PARENT_TOKEN = "demo-parent";

const utcDay = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d));

async function main() {
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  // --- Предметы по прайсу школы ---
  const [math, phys, literacy, history] = await Promise.all([
    prisma.subject.create({ data: { name: "Математика", price: 24000, lessonsPerMonth: 12, color: "#3A5AE0", teacherRate: 8000, teacherRateLessons: 12 } }),
    prisma.subject.create({ data: { name: "Физика", price: 24000, lessonsPerMonth: 12, color: "#7048E8" } }),
    prisma.subject.create({ data: { name: "Математическая грамотность", price: 18000, lessonsPerMonth: 8, color: "#0C8599", curatorRate: 700 } }),
    prisma.subject.create({ data: { name: "История Казахстана", price: 18000, lessonsPerMonth: 8, color: "#E8590C", curatorRate: 700 } }),
  ]);

  const groups = await prisma.group.findMany({ orderBy: { createdAt: "asc" } });
  const subjectFor = [math, math, literacy, phys, history, math];
  const daysFor = [[1, 3, 5], [2, 4, 6], [2, 4], [1, 3, 5], [3, 6], [2, 4, 6]];
  const timeFor = ["15:00", "17:00", "14:00", "16:00", "15:30", "18:00"];

  // --- Куратор ---
  const curator = await prisma.user.create({
    data: { name: "Жанар Куратор", email: DEMO_LOGINS.curator.email, passwordHash: hash(DEMO_LOGINS.curator.password), role: "CURATOR" },
  });

  for (const [i, g] of groups.entries()) {
    await prisma.lesson.deleteMany({ where: { groupId: g.id } });
    await prisma.group.update({
      where: { id: g.id },
      data: {
        subjectId: subjectFor[i % subjectFor.length].id,
        startDate: utcDay(2026, 8, 1),
        curatorId: i < 3 ? curator.id : null,
        curatorRate: i === 0 ? 1000 : 0,
        lessons: {
          create: daysFor[i % daysFor.length].map((d) => ({ dayOfWeek: d, startTime: timeFor[i % timeFor.length], room: `Каб. ${(i % 3) + 1}` })),
        },
      },
    });
  }

  // --- Ученики: больше людей в группах, у одного — вход в кабинет ---
  const names = [
    "Айдос Серікұлы", "Аружан Нұрланқызы", "Дамир Ахметов", "Милана Ким", "Ерасыл Бекболат",
    "Томирис Сапарова", "Алихан Жумабаев", "Камила Ержанова", "Нурсултан Ибраев", "Аяулым Тлеубай",
    "Санжар Омаров", "Дильназ Кайратова",
  ];
  const existing = await prisma.student.findMany({ orderBy: { createdAt: "asc" } });
  const students = [...existing];
  for (const [i, name] of names.entries()) {
    students.push(
      await prisma.student.create({
        data: {
          name,
          phone: `+7 70${i % 10} ${100 + i} 22 ${10 + i}`,
          grade: `${7 + (i % 5)} класс`,
          parentName: `Родитель: ${name.split(" ")[0]}`,
          parentPhone: `+7 77${i % 10} ${200 + i} 33 ${20 + i}`,
          status: i === 11 ? "PAUSED" : "ACTIVE",
        },
      })
    );
  }
  const fresh = await prisma.group.findMany({ orderBy: { createdAt: "asc" }, include: { lessons: true } });
  for (const [i, s] of students.entries()) {
    // каждый ученик — в 2–3 группах разных предметов
    const picks = [fresh[i % fresh.length], fresh[(i + 2) % fresh.length], ...(i % 3 === 0 ? [fresh[(i + 4) % fresh.length]] : [])];
    await prisma.student.update({ where: { id: s.id }, data: { groups: { set: picks.map((g) => ({ id: g.id })) } } });
  }

  const me = students[2]; // ученик с входом в кабинет
  const studentUser = await prisma.user.create({
    data: { name: me.name, email: DEMO_LOGINS.student.email, passwordHash: hash(DEMO_LOGINS.student.password), role: "STUDENT" },
  });
  await prisma.student.update({
    where: { id: me.id },
    data: {
      userId: studentUser.id,
      groups: { set: [fresh[0], fresh[2], fresh[4]].map((g) => ({ id: g.id })) },
      // постоянная ссылка для родителя: /p/demo-parent (для показа портала родителя)
      portalToken: DEMO_PARENT_TOKEN,
      // демо-иллюстрации из public/demo (не фото реальных людей)
      photoUrl: "/demo/student.svg",
      parentPhotoUrl: "/demo/parent.svg",
    },
  });

  // фото преподавателя с входом teacher@ (демо-иллюстрация)
  await prisma.teacher.updateMany({ where: { user: { email: "teacher@matacademy.kz" } }, data: { photoUrl: "/demo/teacher.svg" } });

  // --- Посещаемость с 1 сентября по вчера ---
  const today = utcDay(2026, 9, 13);
  const withStudents = await prisma.group.findMany({ include: { lessons: true, students: { select: { id: true } } } });
  const att: { lessonId: string; studentId: string; date: Date; present: boolean; excused: boolean }[] = [];
  let seq = 0;
  for (const g of withStudents) {
    for (let d = utcDay(2026, 8, 1); d < today; d = new Date(d.getTime() + 86400000)) {
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      for (const l of g.lessons.filter((x) => x.dayOfWeek === dow)) {
        for (const s of g.students) {
          seq++;
          const absent = seq % 11 === 0;
          att.push({ lessonId: l.id, studentId: s.id, date: d, present: !absent, excused: absent && seq % 2 === 0 });
        }
      }
    }
  }
  await prisma.attendance.createMany({ data: att, skipDuplicates: true });
  for (const s of students) {
    const rows = att.filter((a) => a.studentId === s.id && !(!a.present && a.excused));
    const pct = rows.length ? Math.round((rows.filter((a) => a.present).length / rows.length) * 100) : null;
    await prisma.student.update({ where: { id: s.id }, data: { attendance: pct } });
  }

  // --- Оценки ---
  const topics = ["Дроби", "Уравнения", "Проценты", "Функции", "Степени", "Неравенства"];
  for (const [i, s] of students.entries()) {
    const g = withStudents.find((x) => x.students.some((st) => st.id === s.id));
    for (const [k, topic] of topics.entries()) {
      await prisma.grade.create({
        data: {
          studentId: s.id,
          groupId: g?.id,
          topic: `Контрольная: ${topic}`,
          type: k % 3 === 2 ? "HOMEWORK" : "TEST",
          score: 55 + ((i * 7 + k * 13) % 45),
          maxScore: 100,
          date: utcDay(2026, 8, 5 + k * 6),
          createdBy: "Мадина Жумабекова",
        },
      });
    }
  }

  // --- Тест: один пройден, один открыт сейчас ---
  // text — читаемый текст (списки, аналитика), textTex — формула для экрана теста (KaTeX).
  // Словесная часть — в \text{…}, как набирают преподаватели в редакторе теста.
  const q = (text: string, textTex: string, options: string[], correct: number, order: number, optionsTex: string[] = []) => ({
    text,
    textTex,
    options,
    correct,
    order,
    optionsTex,
  });
  const doneTest = await prisma.test.create({
    data: {
      title: "Квадратные уравнения",
      groupId: fresh[0].id,
      subjectId: math.id,
      date: utcDay(2026, 9, 7),
      groupLinks: { create: [{ groupId: fresh[0].id, date: utcDay(2026, 9, 7) }] },
      questions: {
        create: [
          q("Корни уравнения x² − 5x + 6 = 0", "\\text{Корни уравнения } x^2-5x+6=0", ["2 и 3", "1 и 6", "−2 и −3", "нет корней"], 0, 0),
          q("Дискриминант x² + 4x + 4", "\\text{Дискриминант } x^2+4x+4", ["0", "4", "8", "16"], 0, 1),
          q("Сумма корней x² − 7x + 10 = 0", "\\text{Сумма корней } x^2-7x+10=0", ["7", "10", "−7", "3"], 0, 2),
        ],
      },
    },
  });
  await prisma.testAttempt.create({ data: { testId: doneTest.id, studentId: me.id, answers: [0, 0, 1], correctCount: 2, total: 3, score: 67 } });
  await prisma.grade.create({
    data: { studentId: me.id, testId: doneTest.id, groupId: fresh[0].id, topic: doneTest.title, type: "TEST", score: 67, maxScore: 100, date: utcDay(2026, 9, 7) },
  });
  await prisma.test.create({
    data: {
      title: "Модуль числа",
      groupId: fresh[0].id,
      subjectId: math.id,
      date: utcDay(2026, 9, 12),
      timeLimitMin: 20,
      groupLinks: { create: [{ groupId: fresh[0].id, date: utcDay(2026, 9, 12) }] },
      questions: {
        create: [
          q("|−7| равен", "|-7| \\text{ равен}", ["7", "−7", "0", "49"], 0, 0),
          q("Решите |x| = 3", "\\text{Решите } |x|=3", ["±3", "3", "−3", "нет решений"], 0, 1, ["\\pm 3", "3", "-3", "\\text{нет решений}"]),
          q("|x − 2| < 1 при", "|x-2|<1 \\text{ при}", ["1 < x < 3", "x < 1", "x > 3", "x = 2"], 0, 2, ["1<x<3", "x<1", "x>3", "x=2"]),
          q("|a|·|b| равно", "|a|\\cdot|b| \\text{ равно}", ["|ab|", "ab", "a + b", "|a + b|"], 0, 3, ["|ab|", "ab", "a+b", "|a+b|"]),
        ],
      },
    },
  });

  // --- Домашние задания ---
  for (const [k, g] of fresh.entries()) {
    const hw = await prisma.homework.create({
      data: {
        groupId: g.id,
        title: ["Решить №120–135", "Конспект параграфа 4", "Тренажёр: 30 задач", "Задачи на движение", "Тест-подготовка: вариант 3", "Олимпиадные задачи 1–5"][k],
        description: "Сдать к следующему занятию, решение — в тетради или фото.",
        dueDate: utcDay(2026, 9, 15 + (k % 3)),
        createdBy: "Мадина Жумабекова",
      },
    });
    if (g.id === fresh[0].id) await prisma.homeworkDone.create({ data: { homeworkId: hw.id, studentId: me.id, done: true } });
  }

  // --- Счета: сентябрь оплачен, октябрь у части учеников ждёт оплаты ---
  for (const [i, s] of students.entries()) {
    const groupsOf = withStudents.filter((g) => g.students.some((st) => st.id === s.id));
    const subj = await prisma.subject.findMany({ where: { id: { in: groupsOf.map((g) => g.subjectId!).filter(Boolean) } } });
    const total = subj.reduce((a, x) => a + x.price, 0) || 24000;
    const weight = subj.reduce((a, x) => a + x.lessonsPerMonth, 0) || 1;
    const items = subj.map((x) => ({ subjectId: x.id, subjectName: x.name, amount: Math.round((total * x.lessonsPerMonth) / weight) }));
    for (const [m0, paid] of [[8, true], [9, i % 3 !== 0]] as const) {
      const p = await prisma.payment.create({
        data: {
          studentId: s.id,
          purpose: subj.map((x) => x.name).join(" + ") || "Обучение",
          amount: total,
          paidAmount: paid ? total : 0,
          status: paid ? "PAID" : "PENDING",
          method: paid ? "Kaspi" : null,
          date: utcDay(2026, m0, 1),
          items: { create: items },
        },
      });
      if (paid) await prisma.paymentTx.create({ data: { paymentId: p.id, kind: "PAYMENT", amount: total, method: "Kaspi", date: utcDay(2026, m0, 3 + (i % 5)) } });
    }
    const debt = (await prisma.payment.findMany({ where: { studentId: s.id, status: { in: ["PENDING", "OVERDUE"] } } })).reduce((a, p) => a + p.amount - p.paidAmount, 0);
    await prisma.student.update({ where: { id: s.id }, data: { balance: -debt } });
  }

  console.log(`✅ Демо: ${students.length} учеников, ${att.length} отметок, вход ученика и куратора — см. DEMO_LOGINS в scripts/demo-data.ts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
