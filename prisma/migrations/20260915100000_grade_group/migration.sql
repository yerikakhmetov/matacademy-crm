-- Оценка привязывается к группе: ученик может заниматься в нескольких группах,
-- и без этого его оценки показывались в каждой из них.
ALTER TABLE "Grade" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Grade_groupId_idx" ON "Grade"("groupId");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Оценки за тест: группу знает сам тест.
UPDATE "Grade" g
SET "groupId" = t."groupId"
FROM "Test" t
WHERE g."testId" = t.id AND t."groupId" IS NOT NULL;

-- Оценки, выставленные руками: если ученик состоит ровно в одной группе,
-- двусмысленности нет — привязываем к ней. У остальных остаётся NULL:
-- угадывать нельзя, такие оценки видны в карточке ученика.
UPDATE "Grade" g
SET "groupId" = sub."A"
FROM (
  SELECT "B" AS student_id, MIN("A") AS "A"
  FROM "_GroupToStudent"
  GROUP BY "B"
  HAVING COUNT(*) = 1
) sub
WHERE g."groupId" IS NULL AND g."studentId" = sub.student_id;
