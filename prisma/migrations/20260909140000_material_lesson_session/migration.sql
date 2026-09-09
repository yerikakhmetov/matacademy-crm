-- Материал, разобранный на конкретном занятии.
-- SET NULL, а не CASCADE: если запись занятия убрали, сам файл терять нельзя —
-- он остаётся материалом группы.
ALTER TABLE "Material" ADD COLUMN "lessonSessionId" TEXT;
CREATE INDEX "Material_lessonSessionId_idx" ON "Material"("lessonSessionId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_lessonSessionId_fkey"
  FOREIGN KEY ("lessonSessionId") REFERENCES "LessonSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
