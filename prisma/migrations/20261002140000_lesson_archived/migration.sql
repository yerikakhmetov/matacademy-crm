-- Слот расписания с историей посещаемости не удаляется, а прячется.
ALTER TABLE "Lesson" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Lesson_archivedAt_idx" ON "Lesson"("archivedAt");
