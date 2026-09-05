-- Уведомления самому ученику и длительность занятия (для выгрузки расписания в календарь).
ALTER TABLE "Settings" ADD COLUMN "notifyStudent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "lessonDurationMin" INTEGER NOT NULL DEFAULT 60;
