-- Назначение теста группе со своим днём теста. Неявная связь _TestGroups
-- заменяется явной таблицей; существующие назначения переносятся.
CREATE TABLE "TestGroup" (
    "testId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    CONSTRAINT "TestGroup_pkey" PRIMARY KEY ("testId", "groupId")
);
CREATE INDEX "TestGroup_groupId_idx" ON "TestGroup"("groupId");
ALTER TABLE "TestGroup" ADD CONSTRAINT "TestGroup_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestGroup" ADD CONSTRAINT "TestGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TestGroup" ("testId", "groupId")
SELECT "B", "A" FROM "_TestGroups"
ON CONFLICT DO NOTHING;

DROP TABLE "_TestGroups";
