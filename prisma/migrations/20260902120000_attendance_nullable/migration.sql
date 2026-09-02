-- Посещаемость больше не выставляется "по умолчанию" (был фейковый 90%).
-- Делаем колонку nullable и сбрасываем значения у тех, у кого нет ни одной реальной отметки.
ALTER TABLE "Student" ALTER COLUMN "attendance" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "attendance" DROP NOT NULL;

UPDATE "Student" s
SET "attendance" = NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "Attendance" a WHERE a."studentId" = s."id"
);
