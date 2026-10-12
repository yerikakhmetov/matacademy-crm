-- Зарплата куратора: ставка с одного оплатившего ученика по предмету.
-- Общая ставка — в настройках, у предмета может быть своя (0 = общая).
ALTER TABLE "Settings" ADD COLUMN "curatorRate" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Subject" ADD COLUMN "curatorRate" INTEGER NOT NULL DEFAULT 0;
