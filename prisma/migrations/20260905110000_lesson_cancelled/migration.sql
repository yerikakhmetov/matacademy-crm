-- Отмена занятия в конкретную дату (праздник, болезнь преподавателя).
ALTER TABLE "LessonSession" ALTER COLUMN "topic" SET DEFAULT '';
ALTER TABLE "LessonSession" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LessonSession" ADD COLUMN "cancelReason" TEXT;
