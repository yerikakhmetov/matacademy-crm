-- Прохождение теста учеником: одна попытка с ответами и авто-результатом.
CREATE TABLE "TestAttempt" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "answers" INTEGER[],
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestAttempt_testId_studentId_key" ON "TestAttempt"("testId", "studentId");
CREATE INDEX "TestAttempt_studentId_idx" ON "TestAttempt"("studentId");

ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
