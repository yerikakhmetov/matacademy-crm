-- Счёт на несколько месяцев вместо абонемента.
ALTER TABLE "Payment" ADD COLUMN "months" INTEGER NOT NULL DEFAULT 1;

-- Счета, выставленные из старых абонементов, получают число месяцев своего абонемента:
-- иначе 3-месячный счёт целиком попал бы в зарплату первого месяца.
-- Счёт абонемента создавался с purpose = 'Абонемент · ' || plan и датой начала абонемента.
UPDATE "Payment" p
SET "months" = s."months"
FROM "Subscription" s
WHERE p."studentId" = s."studentId"
  AND p."date" = s."startDate"
  AND p."purpose" = 'Абонемент · ' || s."plan"
  AND s."months" > 1;

-- Индексы под частые выборки счетов (долги, просрочка, зарплата, страница оплат).
CREATE INDEX "Payment_studentId_status_idx" ON "Payment"("studentId", "status");
CREATE INDEX "Payment_status_date_idx" ON "Payment"("status", "date");
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
