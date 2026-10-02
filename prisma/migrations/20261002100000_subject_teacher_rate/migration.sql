-- Ставка преподавателя по предмету: сумма с одного ученика за N занятий.
ALTER TABLE "Subject" ADD COLUMN "teacherRate" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subject" ADD COLUMN "teacherRateLessons" INTEGER NOT NULL DEFAULT 12;

-- Стартовые ставки: математика, физика, информатика, география —
-- 8000 ₸ с ученика за 12 занятий. Остальные предметы остаются на старой модели,
-- пока администратор не задаст им ставку.
UPDATE "Subject"
SET "teacherRate" = 8000, "teacherRateLessons" = 12
WHERE "teacherRate" = 0
  AND (
    "name" ILIKE '%математик%' OR
    "name" ILIKE '%физик%' OR
    "name" ILIKE '%информатик%' OR
    "name" ILIKE '%географи%'
  );
