-- Many-to-many преподаватель <-> предмет (implicit relation Prisma)
CREATE TABLE "_SubjectToTeacher" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_SubjectToTeacher_AB_unique" ON "_SubjectToTeacher"("A", "B");
CREATE INDEX "_SubjectToTeacher_B_index" ON "_SubjectToTeacher"("B");
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
