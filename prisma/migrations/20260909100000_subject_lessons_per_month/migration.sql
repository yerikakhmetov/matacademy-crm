-- Сколько занятий в месяц входит в цену предмета.
-- По этому числу платёж делится между предметами абонемента.
ALTER TABLE "Subject" ADD COLUMN "lessonsPerMonth" INTEGER NOT NULL DEFAULT 0;
