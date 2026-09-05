-- Авто-уведомления родителям. По умолчанию выключены: включает администратор.
ALTER TABLE "Settings" ADD COLUMN "notifyGrade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "notifyHomework" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "notifyCancel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "tplGrade" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "tplHomework" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "tplCancel" TEXT NOT NULL DEFAULT '';
