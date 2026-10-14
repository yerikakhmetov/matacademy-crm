-- С какого дня слот расписания действует. null — с начала группы.
ALTER TABLE "Lesson" ADD COLUMN "activeFrom" TIMESTAMP(3);

-- Слоты, появившиеся при прошлых сменах расписания, раньше считались «с начала группы»,
-- и делитель прошлых месяцев учитывал и старый (архивный), и новый слот.
-- Восстанавливаем: если в группе есть архивный слот, то действующий слот без отметок
-- до даты последней смены расписания появился в эту смену.
UPDATE "Lesson" l
SET "activeFrom" = a.changed_on
FROM (
  SELECT "groupId",
         date_trunc('day', max("archivedAt") + make_interval(hours => COALESCE((SELECT "tzOffsetHours" FROM "Settings" LIMIT 1), 5))) AS changed_on
  FROM "Lesson"
  WHERE "archivedAt" IS NOT NULL
  GROUP BY "groupId"
) a
WHERE l."groupId" = a."groupId"
  AND l."archivedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Attendance" t WHERE t."lessonId" = l.id AND t."date" < a.changed_on
  );
