-- Уведомления о зачётах: переключатель и шаблоны
ALTER TABLE "Settings" ADD COLUMN "notifyZachet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "tplZachet" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "tplZachetResult" TEXT NOT NULL DEFAULT '';
