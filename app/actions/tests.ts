"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { getStudentIdForUser } from "@/lib/teacher";
import { isTestOpen } from "@/lib/tests";
import { parseTestSource } from "@/lib/test-import";
import { assertCanManageGroup, assertEditor, int, parseDate, str, dateOrToday } from "./_shared";

// ---------- Тесты ----------
// Импорт теста из LaTeX-исходника: разбираем тем же модулем, что и предпросмотр в форме,
// поэтому преподаватель получает ровно то, что видел перед сохранением.
export async function importTest(formData: FormData) {
  const groupId = str(formData.get("groupId")) || null;
  const subjectId = str(formData.get("subjectId")) || null;
  if (groupId) await assertCanManageGroup(groupId);
  else await assertEditor();

  const parsed = parseTestSource(String(formData.get("source") ?? ""));
  if (parsed.questions.length === 0) {
    throw new Error("В исходнике не найдено ни одного вопроса. Нужны строки \\item $…$ и \\choices{}{}{}{}.");
  }

  const title = str(formData.get("title")) || parsed.title || "Импортированный тест";
  const limit = int(formData.get("timeLimitMin"));
  const test = await prisma.test.create({
    data: {
      title,
      groupId,
      subjectId,
      // балл за тест = число вопросов: один вопрос — один балл
      maxScore: parsed.questions.length,
      date: await dateOrToday(formData.get("date")),
      shuffle: formData.get("shuffle") != null,
      timeLimitMin: limit > 0 ? limit : null,
      questions: {
        create: parsed.questions.map((q, i) => ({
          order: i,
          text: q.text,
          options: q.options,
          correct: q.correct,
          textTex: q.tex,
          optionsTex: q.optionsTex,
        })),
      },
    },
  });
  await logAudit("CREATE", "Тест", `${test.title} · импорт, вопросов: ${parsed.questions.length}`);
  revalidatePath("/tests");
  redirect(`/tests/${test.id}`);
}

// Обновление вопросов уже существующего теста из того же LaTeX-исходника.
// Нужно, когда тест импортировали до появления набора формул: пересоздавать его
// нельзя — вместе с ним ушли бы попытки и оценки учеников.
// Открыть доступ к тесту прямо сейчас или вернуть его к расписанию.
// Тест часто заводят уже после урока — тогда правило «после урока в день теста»
// держит его закрытым, и открыть иначе было нельзя.
export async function setTestAccess(testId: string, open: boolean) {
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { groupId: true, title: true } });
  if (!test) throw new Error("Тест не найден");
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();

  await prisma.test.update({
    where: { id: testId },
    data: { availableFrom: open ? new Date() : null },
  });
  await logAudit("UPDATE", "Тест", `${test.title} · ${open ? "доступ открыт вручную" : "доступ по расписанию"}`);
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/cabinet");
}

export async function refreshTestQuestions(testId: string, formData: FormData) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, groupId: true, maxScore: true, title: true, _count: { select: { attempts: true } } },
  });
  if (!test) throw new Error("Тест не найден");
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();

  const parsed = parseTestSource(String(formData.get("source") ?? ""));
  if (parsed.questions.length === 0) {
    throw new Error("В исходнике не найдено ни одного вопроса. Нужны строки \\item $…$ и \\choices{}{}{}{}.");
  }

  const existing = await prisma.testQuestion.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  // Ответы в попытках хранятся по номеру вопроса. Если вопросов станет другое
  // количество, старые ответы поедут — такое допускаем только пока никто не проходил.
  if (existing.length > 0 && existing.length !== parsed.questions.length && test._count.attempts > 0) {
    throw new Error(
      `В тесте ${existing.length} вопросов, а в исходнике ${parsed.questions.length}. ` +
        `Тест уже проходили (${test._count.attempts}), поэтому менять их количество нельзя — исправьте исходник.`
    );
  }

  await prisma.$transaction(async (tx) => {
    if (existing.length === parsed.questions.length) {
      // порядок совпадает — обновляем на месте, id вопросов сохраняются
      for (let i = 0; i < existing.length; i++) {
        const q = parsed.questions[i];
        await tx.testQuestion.update({
          where: { id: existing[i].id },
          data: { order: i, text: q.text, options: q.options, correct: q.correct, textTex: q.tex, optionsTex: q.optionsTex },
        });
      }
    } else {
      await tx.testQuestion.deleteMany({ where: { testId } });
      await tx.testQuestion.createMany({
        data: parsed.questions.map((q, i) => ({
          testId, order: i, text: q.text, options: q.options, correct: q.correct,
          textTex: q.tex, optionsTex: q.optionsTex,
        })),
      });
    }
  });

  // Верные ответы могли сдвинуться — пересчитываем уже сданные работы,
  // иначе у ученика останется балл от старой версии вопросов.
  const fresh = await prisma.testQuestion.findMany({
    where: { testId }, orderBy: { order: "asc" }, select: { correct: true },
  });
  const attempts = await prisma.testAttempt.findMany({
    where: { testId, finished: true },
    select: { id: true, studentId: true, answers: true },
  });
  for (const a of attempts) {
    const { total, correctCount, score } = scoreAnswers(fresh, a.answers, test.maxScore);
    await prisma.testAttempt.update({ where: { id: a.id }, data: { total, correctCount, score } });
    await prisma.grade.updateMany({
      where: { testId, studentId: a.studentId },
      data: { score, maxScore: test.maxScore },
    });
  }

  await logAudit(
    "UPDATE",
    "Тест",
    `${test.title} · вопросы обновлены из исходника (${parsed.questions.length})${attempts.length > 0 ? `, пересчитано работ: ${attempts.length}` : ""}`
  );
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/grades");
  revalidatePath("/cabinet");
}

export async function createTest(formData: FormData) {
  const groupId = str(formData.get("groupId")) || null;
  const subjectId = str(formData.get("subjectId")) || null;
  // Тест можно дать нескольким группам; основная группа входит в список всегда
  const picked = formData.getAll("groupIds").map((v) => str(v)).filter(Boolean);
  const groupIds = [...new Set([...(groupId ? [groupId] : []), ...picked])];
  if (groupId) await assertCanManageGroup(groupId);
  else if (groupIds.length > 0) await assertCanManageGroup(groupIds[0]);
  else await assertEditor();
  for (const gid of groupIds) await assertCanManageGroup(gid);
  const test = await prisma.test.create({
    data: {
      title: str(formData.get("title")) || "Тест",
      groupId,
      subjectId,
      groupLinks: { create: groupIds.map((groupId) => ({ groupId })) },
      maxScore: Math.max(1, int(formData.get("maxScore")) || 100),
      date: await dateOrToday(formData.get("date")),
      shuffle: formData.get("shuffle") != null,
      allowRetake: formData.get("allowRetake") != null,
      timeLimitMin: int(formData.get("timeLimitMin")) > 0 ? int(formData.get("timeLimitMin")) : null,
    },
  });
  await logAudit("CREATE", "Тест", `${test.title}`);
  revalidatePath("/tests");
  redirect(`/tests/${test.id}`);
}

// Кому назначен тест: список групп можно поменять после создания.
// Основная группа (для ввода баллов) остаётся в списке всегда.
// Правка теста: дату, название и настройки нужно уметь менять и после
// создания — тест нередко заводят «на вчера» или переносят на другой день.
export async function updateTest(testId: string, formData: FormData) {
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { groupId: true, title: true } });
  if (!test) throw new Error("Тест не найден");
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();

  const date = parseDate(formData.get("date"));
  await prisma.test.update({
    where: { id: testId },
    data: {
      title: str(formData.get("title")) || test.title,
      subjectId: str(formData.get("subjectId")) || null,
      maxScore: Math.max(1, int(formData.get("maxScore")) || 100),
      ...(date ? { date } : {}),
      shuffle: formData.get("shuffle") != null,
      allowRetake: formData.get("allowRetake") != null,
      timeLimitMin: int(formData.get("timeLimitMin")) > 0 ? int(formData.get("timeLimitMin")) : null,
    },
  });
  await logAudit("UPDATE", "Тест", `${str(formData.get("title")) || test.title} — изменён`);
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/tests");
  revalidatePath("/cabinet");
}

export async function setTestGroups(testId: string, formData: FormData) {
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { groupId: true, title: true } });
  if (!test) throw new Error("Тест не найден");
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();

  const picked = formData.getAll("groupIds").map((v) => str(v)).filter(Boolean);
  const groupIds = [...new Set([...(test.groupId ? [test.groupId] : []), ...picked])];
  for (const gid of groupIds) await assertCanManageGroup(gid);

  // Убираем только те группы, которыми пользователь может управлять: преподаватель, сохраняя
  // свои группы, не должен отвязывать от теста группы коллег (их нет в его списке).
  const attached = await prisma.testGroup.findMany({ where: { testId, groupId: { notIn: groupIds } }, select: { groupId: true } });
  const removable: string[] = [];
  for (const a of attached) {
    try {
      await assertCanManageGroup(a.groupId);
      removable.push(a.groupId);
    } catch {
      // чужая группа — остаётся привязанной
    }
  }
  if (removable.length > 0) await prisma.testGroup.deleteMany({ where: { testId, groupId: { in: removable } } });
  // У каждой группы свой день теста: поле date_<groupId>; пусто — общая дата
  for (const groupId of groupIds) {
    const date = parseDate(formData.get(`date_${groupId}`));
    await prisma.testGroup.upsert({
      where: { testId_groupId: { testId, groupId } },
      create: { testId, groupId, date },
      update: { date },
    });
  }
  await logAudit("UPDATE", "Тест", `${test.title} — группы: ${groupIds.length}`);
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/tests");
}

export async function saveTestResults(testId: string, formData: FormData) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { group: { include: { students: { select: { id: true } } } } },
  });
  if (!test) throw new Error("Тест не найден");
  if (!test.groupId || !test.group) throw new Error("У теста нет группы для ввода оценок");
  const session = await assertCanManageGroup(test.groupId);

  let saved = 0;
  for (const s of test.group.students) {
    const raw = formData.get(`score_${s.id}`);
    const val = raw == null || String(raw).trim() === "" ? null : int(raw);
    if (val == null) {
      // очистить, если было
      await prisma.grade.deleteMany({ where: { testId, studentId: s.id } });
      continue;
    }
    const score = Math.max(0, Math.min(val, test.maxScore));
    await prisma.grade.upsert({
      where: { testId_studentId: { testId, studentId: s.id } },
      create: {
        studentId: s.id,
        testId,
        groupId: test.groupId,
        topic: test.title,
        type: "TEST",
        score,
        maxScore: test.maxScore,
        date: test.date,
        createdBy: session.user?.name ?? null,
      },
      update: { score, maxScore: test.maxScore, topic: test.title, date: test.date },
    });
    saved++;
  }
  await logAudit("UPDATE", "Тест", `${test.title} · ${saved} оценок`);
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/tests");
  revalidatePath("/grades");
}

// Проверка доступа ученика к тесту: он в группе теста и тест уже открыт.
async function assertCanTakeTest(testId: string) {
  const session = await auth();
  const studentId = await getStudentIdForUser(session?.user?.id);
  if (!studentId) throw new Error("Профиль ученика не найден");

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: { orderBy: { order: "asc" }, select: { id: true, correct: true } },
      // Тест может быть назначен нескольким группам, у каждой свой день и расписание
      groupLinks: {
        select: {
          date: true,
          group: { select: { id: true, lessons: { where: { archivedAt: null }, select: { dayOfWeek: true, startTime: true } } } },
        },
      },
    },
  });
  if (!test) throw new Error("Тест не найден");
  if (test.groupLinks.length === 0) throw new Error("Тест не привязан к группе");
  if (test.questions.length === 0) throw new Error("В тесте нет вопросов");

  // Ученик должен состоять в одной из групп теста — по ней и считаем открытие
  const me = await prisma.student.findUnique({ where: { id: studentId }, select: { groups: { select: { id: true } } } });
  const myGroupIds = new Set((me?.groups ?? []).map((g) => g.id));
  const link = test.groupLinks.find((l) => myGroupIds.has(l.group.id));
  if (!link) throw new Error("Тест не для вашей группы");

  const tz = (await getSettings()).tzOffsetHours;
  if (!isTestOpen(link.date ?? test.date, link.group.lessons, new Date(), tz, test.availableFrom)) {
    throw new Error("Тест ещё не открыт");
  }

  return { studentId, test, groupId: link.group.id };
}

// Подсчёт результата по сохранённым ответам.
function scoreAnswers(questions: { correct: number }[], answers: number[], maxScore: number) {
  const total = questions.length;
  const correctCount = questions.reduce((a, q, i) => a + (answers[i] === q.correct ? 1 : 0), 0);
  return { total, correctCount, score: Math.round((correctCount / total) * maxScore) };
}

// Начать тест с ограничением по времени: фиксируем момент старта.
// Сервер сам следит за временем: клиентский таймер можно обойти, вызвав экшен напрямую.
// 30 секунд запаса — на задержку сети при последнем ответе.
const TEST_DEADLINE_GRACE_MS = 30_000;

function testTimeIsUp(timeLimitMin: number | null, startedAt: Date | null, now = new Date()): boolean {
  if (!timeLimitMin || !startedAt) return false;
  return now.getTime() > startedAt.getTime() + timeLimitMin * 60_000 + TEST_DEADLINE_GRACE_MS;
}

export async function startTestAttempt(testId: string) {
  const { studentId, test } = await assertCanTakeTest(testId);
  const existing = await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } } });
  if (existing && existing.finished && !test.allowRetake) throw new Error("Тест уже пройден");
  // Идущую попытку не перезапускаем: иначе повторное «Начать» стирало ответы и обнуляло таймер
  if (existing && !existing.finished) {
    revalidatePath(`/cabinet/test/${testId}`);
    return;
  }

  await prisma.testAttempt.upsert({
    where: { testId_studentId: { testId, studentId } },
    create: {
      testId,
      studentId,
      answers: new Array(test.questions.length).fill(-1),
      total: test.questions.length,
      startedAt: new Date(),
      finished: false,
    },
    update: { answers: new Array(test.questions.length).fill(-1), correctCount: 0, score: 0, startedAt: new Date(), finished: false },
  });
  revalidatePath(`/cabinet/test/${testId}`);
}

// Попытка теста без таймера начинается с первого ответа (кнопки «Начать» нет).
// Только создаём отсутствующую: сданную попытку здесь не трогаем никогда — запоздавший
// запрос сохранения после «Сдать» иначе стёр бы результат. Пересдача — явно, через startTestAttempt.
async function ensureUntimedAttempt(testId: string, studentId: string, questions: number) {
  const existing = await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } } });
  if (existing) return existing;
  return prisma.testAttempt.create({
    data: { testId, studentId, answers: new Array(questions).fill(-1), total: questions, startedAt: new Date(), finished: false },
  });
}

// Сохранение ответа по ходу теста: если вкладка закроется, ответы уже на сервере.
export async function saveTestAnswer(testId: string, index: number, choice: number) {
  const { studentId, test } = await assertCanTakeTest(testId);
  const attempt = test.timeLimitMin
    ? await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } } })
    : await ensureUntimedAttempt(testId, studentId, test.questions.length);
  if (!attempt || attempt.finished) return;
  if (index < 0 || index >= test.questions.length) return;
  if (!Number.isInteger(choice) || choice < -1) return;
  if (testTimeIsUp(test.timeLimitMin, attempt.startedAt)) throw new Error("Время вышло — ответ не сохранён");

  const answers = [...attempt.answers];
  while (answers.length < test.questions.length) answers.push(-1);
  answers[index] = choice;
  await prisma.testAttempt.update({ where: { id: attempt.id }, data: { answers } });
}

// Завершить попытку по сохранённым ответам — вызывается по кнопке и когда время вышло.
export async function finishTestAttempt(testId: string) {
  const { studentId, test, groupId } = await assertCanTakeTest(testId);
  // без таймера сдать можно и не ответив ни на что — тогда попытка создаётся пустой
  const attempt = test.timeLimitMin
    ? await prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } } })
    : await ensureUntimedAttempt(testId, studentId, test.questions.length);
  if (!attempt || attempt.finished) return;

  const { total, correctCount, score } = scoreAnswers(test.questions, attempt.answers, test.maxScore);
  const session = await auth();
  await prisma.$transaction([
    prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { correctCount, total, score, finished: true, submittedAt: new Date() },
    }),
    prisma.grade.upsert({
      where: { testId_studentId: { testId, studentId } },
      create: {
        studentId, testId, groupId, topic: test.title, type: "TEST", score,
        maxScore: test.maxScore, date: new Date(), createdBy: session?.user?.name ?? null,
      },
      update: { score, maxScore: test.maxScore, topic: test.title },
    }),
  ]);
  revalidatePath(`/cabinet/test/${testId}`);
  revalidatePath("/cabinet");
  revalidatePath(`/tests/${testId}`);
  revalidatePath("/grades");
}

export async function deleteTest(id: string) {
  const test = await prisma.test.findUnique({ where: { id }, select: { groupId: true, title: true } });
  if (!test) return;
  if (test.groupId) await assertCanManageGroup(test.groupId);
  else await assertEditor();
  await prisma.test.delete({ where: { id } }); // каскадом удаляются связанные оценки
  await logAudit("DELETE", "Тест", test.title);
  revalidatePath("/tests");
  revalidatePath("/grades");
}
