-- Расходы: ежемесячные и перенос из прошлого месяца
ALTER TABLE "Expense" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "copiedFromId" TEXT;
