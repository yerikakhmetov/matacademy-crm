-- Язык по умолчанию для страниц учеников и родителей (каждый может переключить сам).
ALTER TABLE "Settings" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'ru';
