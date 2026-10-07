-- Один тест можно назначить нескольким группам; каждая открывает его
-- по своему расписанию.
CREATE TABLE "_TestGroups" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_TestGroups_AB_unique" ON "_TestGroups"("A", "B");
CREATE INDEX "_TestGroups_B_index" ON "_TestGroups"("B");
ALTER TABLE "_TestGroups" ADD CONSTRAINT "_TestGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TestGroups" ADD CONSTRAINT "_TestGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Уже существующие тесты назначаем их группе, чтобы ничего не пропало
INSERT INTO "_TestGroups" ("A", "B")
SELECT "groupId", "id" FROM "Test" WHERE "groupId" IS NOT NULL;
