-- Отработка пропущенного по уважительной причине занятия.
CREATE TABLE "Makeup" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "missedDate" TIMESTAMP(3) NOT NULL,
  "plannedAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Makeup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Makeup_studentId_lessonId_missedDate_key" ON "Makeup"("studentId", "lessonId", "missedDate");
CREATE INDEX "Makeup_plannedAt_idx" ON "Makeup"("plannedAt");
CREATE INDEX "Makeup_studentId_idx" ON "Makeup"("studentId");

ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Makeup" ADD CONSTRAINT "Makeup_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
