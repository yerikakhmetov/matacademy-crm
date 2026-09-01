-- Student ↔ Group many-to-many (ученик в нескольких группах)
CREATE TABLE "_GroupToStudent" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_GroupToStudent_AB_unique" ON "_GroupToStudent"("A", "B");
CREATE INDEX "_GroupToStudent_B_index" ON "_GroupToStudent"("B");
ALTER TABLE "_GroupToStudent" ADD CONSTRAINT "_GroupToStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GroupToStudent" ADD CONSTRAINT "_GroupToStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- перенос существующих привязок
INSERT INTO "_GroupToStudent" ("A", "B") SELECT "groupId", "id" FROM "Student" WHERE "groupId" IS NOT NULL;

-- удаление старого одиночного поля
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_groupId_fkey";
ALTER TABLE "Student" DROP COLUMN "groupId";
