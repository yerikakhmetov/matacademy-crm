-- Снимок «занятий в месяце» предмета на момент счёта: смена настроек предмета
-- не должна пересчитывать цену занятия в уже выставленных счетах.
ALTER TABLE "PaymentItem" ADD COLUMN "lessonsPerMonth" INTEGER;

-- Существующие строки: текущее значение предмета (0 = не задано — остаётся NULL, берётся по умолчанию)
UPDATE "PaymentItem" pi
SET "lessonsPerMonth" = s."lessonsPerMonth"
FROM "Subject" s
WHERE pi."subjectId" = s.id AND s."lessonsPerMonth" > 0;
