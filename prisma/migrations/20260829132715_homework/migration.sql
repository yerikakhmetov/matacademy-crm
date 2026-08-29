CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Homework_groupId_idx" ON "Homework"("groupId");
CREATE TABLE "HomeworkDone" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "HomeworkDone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeworkDone_homeworkId_studentId_key" ON "HomeworkDone"("homeworkId", "studentId");
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkDone" ADD CONSTRAINT "HomeworkDone_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkDone" ADD CONSTRAINT "HomeworkDone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
