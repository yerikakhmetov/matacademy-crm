"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/audit";
import { money } from "@/lib/format";
import { getSettings, parseDiscounts, parseMultiTiers, multiTierFor, computePricing, splitAmount, isDiscountMode } from "@/lib/settings";
import { recalc } from "@/lib/overdue";
import { maxRefundable, outstanding, paymentStatus, planPaymentEdit, rescaleItems } from "@/lib/payments";
import { UserError, asResult, assertEditor, int, parseDate, str, dateOrToday } from "./_shared";
import { MAX_PERIOD_MONTHS, invoicePeriodLabel } from "@/lib/period";
import { nextStudyMonth, studyMonthLabel } from "@/lib/packages";

// «Месяц обучения» из формы: номер пакета занятий, с которого начинается счёт, и сколько
// месяцев оплачено. Пусто — следующий по порядку у ученика. При правке счёта пустое поле
// оставляет как было (у старого календарного счёта — null).
async function studyFromForm(formData: FormData, studentId: string, current: { studyMonth: number | null; months: number } | null) {
  const months = Math.min(MAX_PERIOD_MONTHS, Math.max(1, int(formData.get("months")) || current?.months || 1));
  const raw = int(formData.get("studyMonth"));
  if (raw >= 1) return { studyMonth: raw, months };
  if (current) return { studyMonth: current.studyMonth, months };
  const prev = await prisma.payment.findMany({ where: { studentId }, select: { studyMonth: true, months: true } });
  return { studyMonth: nextStudyMonth(prev), months };
}

// ---------- Абонементы ----------
// Счёт за обучение по предметам: цена по прайсу со всеми скидками (пакет, спец-скидка,
// персональная, брат/сестра, промокод). Счёт на N месяцев: доля предмета в зарплате
// делится между этими месяцами (Payment.months). Абонементы больше не создаются.
export async function createInvoice(studentId: string, formData: FormData) {
  return asResult(() => createInvoiceImpl(studentId, formData));
}

async function createInvoiceImpl(studentId: string, formData: FormData) {
  await assertEditor("finance");
  const study = await studyFromForm(formData, studentId, null);
  const months = study.months;
  const studyMonth = study.studyMonth ?? 1; // без текущего счёта номер всегда есть
  // дата счёта — день выставления: по ней порядок списания занятий и срок оплаты
  const start = await dateOrToday(null);

  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);

  let plan: string;
  let price: number;
  let basePrice = 0;
  let discountPct = 0;
  let promoApplyId: string | null = null;
  let promoMaxUses = 0;
  let items: { subjectId: string; subjectName: string; base: number; amount: number; lessonsPerMonth: number | null }[] = [];

  if (subjectIds.length > 0) {
    // Новый режим: комбо-абонемент по предметам со скидками
    const settings = await getSettings();
    const subs = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
    // сохранить порядок выбора
    const chosen = subjectIds.map((id) => subs.find((s) => s.id === id)).filter(Boolean) as typeof subs;
    if (chosen.length === 0) throw new UserError("Предметы не найдены");

    const discName = str(formData.get("discount"));
    const disc = parseDiscounts(settings.discounts).find((d) => d.name === discName);
    discountPct = disc ? disc.percent : 0;
    // Порог за количество предметов: либо процент, либо фиксированная цена пакета.
    const tier = multiTierFor(chosen.length, parseMultiTiers(settings.multiDiscount));
    const packagePrice = tier?.fixed ?? null;
    // если пакет задан ценой, процентной мульти-скидки быть не должно — иначе двойной счёт
    const multiTierPct = packagePrice != null ? 0 : (tier?.percent ?? 0);

    // Персональная скидка ученика и авто-скидка «брат/сестра» (по телефону родителя)
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { personalDiscount: true, parentPhone: true } });
    const personalPct = Math.max(0, student?.personalDiscount ?? 0);
    let siblingPct = 0;
    if (settings.siblingDiscount > 0 && student?.parentPhone) {
      const sib = await prisma.student.count({ where: { id: { not: studentId }, status: "ACTIVE", parentPhone: student.parentPhone } });
      if (sib > 0) siblingPct = settings.siblingDiscount;
    }

    // Промокод (если введён и действителен)
    let promoPct = 0;
    const codeInput = str(formData.get("promo"));
    if (codeInput) {
      const code = codeInput.trim().toUpperCase().replace(/\s+/g, "");
      const promo = await prisma.promoCode.findUnique({ where: { code } });
      if (!promo || !promo.active) throw new UserError("Промокод не найден или отключён");
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw new UserError("Промокод исчерпан");
      if (promo.expiresAt && promo.expiresAt < new Date()) throw new UserError("Срок действия промокода истёк");
      promoPct = promo.percent;
      promoApplyId = promo.id;
      promoMaxUses = promo.maxUses;
    }

    const mode = isDiscountMode(settings.discountMode) ? settings.discountMode : "add";
    const pricing = computePricing({
      subjects: chosen.map((s) => ({ id: s.id, name: s.name, price: s.price, lessonsPerMonth: s.lessonsPerMonth })),
      months,
      discountParts: [discountPct, multiTierPct, personalPct, siblingPct, promoPct],
      mode,
      packagePrice,
    });
    basePrice = pricing.base;
    price = pricing.total;
    plan = chosen.map((s) => s.name).join(" + ");
    items = pricing.items.map((it) => ({
      subjectId: it.id,
      subjectName: it.name,
      base: it.base,
      amount: it.amount,
      lessonsPerMonth: chosen.find((s) => s.id === it.id)?.lessonsPerMonth ?? null,
    }));
  } else {
    // Старый режим: ручная цена
    plan = str(formData.get("plan")) || "Обучение";
    price = int(formData.get("price"));
    basePrice = price;
  }

  if (price <= 0) throw new UserError("Сумма счёта должна быть больше нуля");

  const purpose = `${plan} · ${studyMonthLabel(studyMonth, months)}`;
  const payItems = items.map((it) => ({ subjectId: it.subjectId, subjectName: it.subjectName, amount: it.amount, lessonsPerMonth: it.lessonsPerMonth }));
  await prisma.$transaction(async (tx) => {
    if (promoApplyId) {
      // Лимит проверяется в той же записи: два одновременных счёта не превысят maxUses
      const used = await tx.promoCode.updateMany({
        where: promoMaxUses > 0 ? { id: promoApplyId, usedCount: { lt: promoMaxUses } } : { id: promoApplyId },
        data: { usedCount: { increment: 1 } },
      });
      if (used.count === 0) throw new UserError("Промокод исчерпан");
    }
    // счёт хранит разбивку по предметам — по ней считаются доход по предметам и зарплата
    await tx.payment.create({
      data: {
        studentId,
        purpose,
        amount: price,
        status: "PENDING",
        date: start,
        months,
        studyMonth,
        items: payItems.length > 0 ? { create: payItems } : undefined,
      },
    });
  });
  await recalc(studentId);

  const stSub = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  const savedLabel = basePrice > price && basePrice > 0 ? ` (−${Math.round((1 - price / basePrice) * 100)}%)` : "";
  await logAudit("CREATE", "Счёт", `${stSub?.name ?? ""} · ${purpose} · ${money(price)}${savedLabel}`);
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

// ---------- Оплаты ----------
export async function createPayment(formData: FormData) {
  await assertEditor("finance");
  const studentId = str(formData.get("studentId"));
  if (!studentId) throw new Error("Выберите ученика");
  const amount = int(formData.get("amount"));
  const status = str(formData.get("status")) || "PAID";

  // Разбивка платежа по выбранным предметам — пропорционально числу занятий,
  // теми же весами, что и доли абонемента (см. splitWeights в lib/pricing.ts)
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  let payItems: { subjectId: string; subjectName: string; amount: number; lessonsPerMonth: number | null }[] = [];
  if (subjectIds.length > 0) {
    const subs = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, price: true, lessonsPerMonth: true },
    });
    const chosen = subjectIds.map((id) => subs.find((s) => s.id === id)).filter(Boolean) as typeof subs;
    payItems = splitAmount(amount, chosen).map((r) => ({
      subjectId: r.id,
      subjectName: r.name,
      amount: r.amount,
      lessonsPerMonth: chosen.find((x) => x.id === r.id)?.lessonsPerMonth ?? null,
    }));
  }

  const method = str(formData.get("method")) || null;
  const paidNow = status === "PAID" ? amount : 0;
  // За какой месяц обучения платят: предоплата за следующие пакеты занятий
  // спишется, когда до них дойдут занятия (lib/packages.ts)
  const study = await studyFromForm(formData, studentId, null);
  await prisma.payment.create({
    data: {
      studentId,
      purpose: `${str(formData.get("purpose")) || "Оплата"} · ${studyMonthLabel(study.studyMonth ?? 1, study.months)}`,
      method,
      amount,
      date: await dateOrToday(null),
      months: study.months,
      studyMonth: study.studyMonth,
      status,
      paidAmount: paidNow,
      items: payItems.length > 0 ? { create: payItems } : undefined,
      // Деньги, полученные сразу, тоже становятся движением — доход считается по ним
      txs: paidNow > 0 ? { create: [{ kind: "PAYMENT", amount: paidNow, method }] } : undefined,
    },
  });
  const st0 = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  await logAudit("CREATE", status === "PAID" ? "Оплата" : "Счёт", `${st0?.name ?? ""} · ${money(amount)}`);
  // Задолженность считается автоматически из неоплаченных счетов
  await recalc(studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
}

const STALE_PAYMENT = "Счёт уже изменился (возможно, оплату приняли в другой вкладке). Обновите страницу.";

// Отметить счёт оплаченным (гасит долг)
// Принять оплату по счёту: сумма по умолчанию — весь остаток (кнопка «Оплачен»),
// либо частичная сумма из формы.
export async function receivePayment(paymentId: string, amountIn: number | null, method?: string, dateStr?: string) {
  await assertEditor("finance");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { name: true } } },
  });
  if (!payment) throw new Error("Счёт не найден");

  const left = outstanding(payment.amount, payment.paidAmount);
  if (left <= 0) throw new UserError("Счёт уже оплачен полностью");
  const sum = amountIn == null ? left : Math.min(Math.max(1, amountIn), left);

  const session = await auth();
  const paidAmount = payment.paidAmount + sum;
  await prisma.$transaction(async (tx) => {
    // Пишем, только если счёт не изменился с момента чтения: второй клик «Оплачен»
    // или вторая вкладка получат ошибку, а не второй приход на ту же сумму.
    const upd = await tx.payment.updateMany({
      where: { id: paymentId, paidAmount: payment.paidAmount },
      data: {
        paidAmount,
        method: method || payment.method,
        status: paymentStatus(payment.amount, paidAmount, payment.date),
      },
    });
    if (upd.count === 0) throw new UserError(STALE_PAYMENT);
    await tx.paymentTx.create({
      data: {
        paymentId,
        kind: "PAYMENT",
        amount: sum,
        method: method || payment.method,
        date: parseDate(dateStr ?? null) ?? new Date(),
        createdBy: session?.user?.name ?? null,
      },
    });
  });

  await logAudit(
    "UPDATE",
    "Оплата",
    `${payment.student.name} · принято ${money(sum)}${paidAmount < payment.amount ? ` · остаток ${money(payment.amount - paidAmount)}` : " · оплачен полностью"}`
  );
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

// Приём оплаты из формы (частичной или полной).
export async function receivePaymentForm(paymentId: string, formData: FormData) {
  const asked = int(formData.get("amount"));
  return asResult(() =>
    receivePayment(
      paymentId,
      asked > 0 ? asked : null,
      str(formData.get("method")) || undefined,
      str(formData.get("date")) || undefined
    )
  );
}

// Совместимость со старой кнопкой «Оплачен» — принимает весь остаток.
export async function markPaid(paymentId: string, method?: string) {
  return receivePayment(paymentId, null, method);
}

// Возврат денег родителю. Уменьшает доход тем месяцем, когда возврат сделан.
export async function refundPayment(paymentId: string, formData: FormData) {
  return asResult(() => refundPaymentImpl(paymentId, formData));
}

async function refundPaymentImpl(paymentId: string, formData: FormData) {
  await assertEditor("finance");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { name: true } } },
  });
  if (!payment) throw new Error("Счёт не найден");

  const canRefund = maxRefundable(payment.paidAmount, payment.refundedAmount);
  if (canRefund <= 0) throw new UserError("По этому счёту возвращать нечего");
  const asked = int(formData.get("amount"));
  const sum = Math.min(Math.max(1, asked || canRefund), canRefund);

  const session = await auth();
  await prisma.$transaction(async (tx) => {
    // Та же защита от двойного возврата, что и у приёма оплаты
    const upd = await tx.payment.updateMany({
      where: { id: paymentId, refundedAmount: payment.refundedAmount, paidAmount: payment.paidAmount },
      data: { refundedAmount: payment.refundedAmount + sum },
    });
    if (upd.count === 0) throw new UserError(STALE_PAYMENT);
    await tx.paymentTx.create({
      data: {
        paymentId,
        kind: "REFUND",
        amount: sum,
        method: str(formData.get("method")) || payment.method,
        date: parseDate(formData.get("date")) ?? new Date(),
        note: str(formData.get("note")) || null,
        createdBy: session?.user?.name ?? null,
      },
    });
  });

  await logAudit("UPDATE", "Возврат", `${payment.student.name} · ${money(sum)}`);
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

// Исправить уже созданный счёт или принятую оплату: сумма, ученик, назначение,
// способ, дата и предметы. Деньги могли уже прийти, поэтому правила — в
// planPaymentEdit: одна полная оплата исправляется вместе с приходом, иначе
// меняется только счёт и не ниже уже принятого.
export async function updatePayment(paymentId: string, formData: FormData) {
  return asResult(() => updatePaymentImpl(paymentId, formData));
}

async function updatePaymentImpl(paymentId: string, formData: FormData) {
  await assertEditor("finance");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      txs: { select: { id: true, kind: true, amount: true, date: true } },
      student: { select: { name: true } },
      items: { select: { subjectId: true, subjectName: true, amount: true, lessonsPerMonth: true } },
    },
  });
  if (!payment) throw new Error("Счёт не найден");

  const studentId = str(formData.get("studentId")) || payment.studentId;
  const amount = int(formData.get("amount"));
  // Отдельной галочки нет: если оплата принята одним движением целиком, правка
  // суммы всегда исправляет и принятые деньги (обычно это опечатка при приёме).
  const alsoReceived = true;
  const method = str(formData.get("method")) || null;
  const purpose = str(formData.get("purpose")) || payment.purpose;
  const { studyMonth, months } = await studyFromForm(formData, payment.studentId, { studyMonth: payment.studyMonth, months: payment.months });
  const date = payment.date;

  const plan = planPaymentEdit(
    { amount: payment.amount, paidAmount: payment.paidAmount, refundedAmount: payment.refundedAmount, txs: payment.txs },
    amount,
    alsoReceived
  );
  if (!plan.ok) throw new UserError(plan.error);

  // Разбивка по предметам: по ней считается цена занятия для преподавателя.
  // Предметы те же — сохраняем строки счёта (со скидочной разбивкой и снимком числа занятий),
  // сумма поменялась — масштабируем их в прежней пропорции. Пересчёт «с нуля» — только
  // если поменялся набор предметов.
  const subjectIds = formData.getAll("subjects").map((v) => String(v)).filter(Boolean);
  const sameSubjects =
    payment.items.length > 0 &&
    [...new Set(subjectIds)].sort().join("|") === payment.items.map((i) => i.subjectId ?? "").sort().join("|");
  let payItems: { subjectId: string; subjectName: string; amount: number; lessonsPerMonth: number | null }[] = [];
  if (sameSubjects) {
    payItems = rescaleItems(
      payment.items.map((i) => ({ subjectId: i.subjectId!, subjectName: i.subjectName, amount: i.amount, lessonsPerMonth: i.lessonsPerMonth })),
      amount
    );
  } else if (subjectIds.length > 0) {
    const subs = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, price: true, lessonsPerMonth: true },
    });
    const chosen = subjectIds.map((id) => subs.find((x) => x.id === id)).filter(Boolean) as typeof subs;
    payItems = splitAmount(amount, chosen).map((r) => ({
      subjectId: r.id,
      subjectName: r.name,
      amount: r.amount,
      lessonsPerMonth: chosen.find((x) => x.id === r.id)?.lessonsPerMonth ?? null,
    }));
  }

  await prisma.$transaction(async (tx) => {
    if (plan.mode === "single") {
      // Сумму прихода исправляем вместе со счётом, иначе доход месяца останется неверным.
      // Дату прихода не трогаем: правка периода счёта («за какой месяц») не должна
      // переносить уже полученные деньги в другой месяц дохода.
      await tx.paymentTx.update({ where: { id: plan.txId }, data: { amount, method } });
    }
    await tx.paymentItem.deleteMany({ where: { paymentId } });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        studentId,
        purpose,
        method,
        amount,
        months,
        studyMonth,
        paidAmount: plan.paidAmount,
        status: paymentStatus(amount, plan.paidAmount, date),
        items: payItems.length > 0 ? { create: payItems } : undefined,
      },
    });
  });

  const changes: string[] = [];
  if (amount !== payment.amount) changes.push(`${money(payment.amount)} → ${money(amount)}`);
  if (studentId !== payment.studentId) changes.push("другой ученик");
  if ((method ?? "") !== (payment.method ?? "")) changes.push(`способ: ${method ?? "—"}`);
  const oldPeriod = invoicePeriodLabel(payment);
  const newPeriod = invoicePeriodLabel({ date, months, studyMonth });
  if (oldPeriod !== newPeriod) changes.push(`период: ${oldPeriod} → ${newPeriod}`);
  await logAudit(
    "UPDATE",
    "Оплата",
    `${payment.student.name} · исправлено${changes.length ? ": " + changes.join(", ") : ""}${plan.mode === "single" ? " (вместе с приходом)" : ""}`
  );

  // долг пересчитываем у обоих, если счёт перенесли на другого ученика
  await recalc(payment.studentId);
  if (studentId !== payment.studentId) await recalc(studentId);
  revalidatePath("/payments");
  revalidatePath("/payments/daily");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  if (studentId !== payment.studentId) revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

// Удаление ошибочной оплаты. Движения денег и разбивка по предметам удаляются
// каскадом, поэтому принятая сумма уходит и из дохода месяца, и из доли предмета.
export async function deletePayment(paymentId: string) {
  await assertEditor("finance");
  const payment = await prisma.payment.delete({ where: { id: paymentId }, include: { student: { select: { name: true } } } });
  await logAudit(
    "DELETE",
    "Оплата",
    `${payment.student.name} · ${money(payment.amount)}${payment.paidAmount > 0 ? ` · было принято ${money(payment.paidAmount)}` : ""}`
  );
  await recalc(payment.studentId);
  revalidatePath("/payments");
  revalidatePath("/payments/daily");
  revalidatePath("/students");
  revalidatePath(`/students/${payment.studentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
