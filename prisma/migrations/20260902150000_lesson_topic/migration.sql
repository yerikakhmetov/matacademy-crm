-- Журнал: тема урока в конкретную дату (что проходили на занятии).
CREATE TABLE "LessonSession" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "topic" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonSession_lessonId_date_key" ON "LessonSession"("lessonId", "date");
CREATE INDEX "LessonSession_lessonId_idx" ON "LessonSession"("lessonId");

ALTER TABLE "LessonSession" ADD CONSTRAINT "LessonSession_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
