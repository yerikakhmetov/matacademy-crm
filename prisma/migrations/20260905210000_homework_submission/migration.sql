-- Сдача домашнего задания файлом: раньше ученик мог только поставить галочку.
ALTER TABLE "HomeworkDone" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "HomeworkDone" ADD COLUMN "fileName" TEXT;
ALTER TABLE "HomeworkDone" ADD COLUMN "comment" TEXT;
ALTER TABLE "HomeworkDone" ADD COLUMN "submittedAt" TIMESTAMP(3);
